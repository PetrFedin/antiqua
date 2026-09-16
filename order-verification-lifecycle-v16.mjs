import {db,orders,uid,now} from './runtime-v09.mjs';
import {inferLifecycleAuthority,planLifecycleTransition} from './lifecycle-authority-v16.mjs';
import {findLifecycleEventBySourceTx,recordLifecycleTransitionTx} from './lifecycle-events-v16.mjs';

const conflict=message=>Object.assign(new Error(message),{status:409,code:'LIFECYCLE_EVENT_CONFLICT'});
const iso=v=>v?.toISOString?.()||v||null;
const mapVerification=r=>r?{id:r.id,accountId:r.account_id??r.accountId,subjectType:r.subject_type??r.subjectType,caseType:r.case_type??r.caseType,status:r.status,provider:r.provider||null,providerReference:r.provider_reference??r.providerReference??null,riskLevel:r.risk_level??r.riskLevel??null,decisionReason:r.decision_reason??r.decisionReason??'',submittedAt:iso(r.submitted_at??r.submittedAt),decidedAt:iso(r.decided_at??r.decidedAt),expiresAt:iso(r.expires_at??r.expiresAt),createdAt:iso(r.created_at??r.createdAt),updatedAt:iso(r.updated_at??r.updatedAt)}:null;
const orderFromRow=r=>r?{...(r.payload||{}),id:r.id,listingId:r.listing_id??r.payload?.listingId??null,lotId:r.object_id??r.payload?.lotId,buyerClientId:r.buyer_account_id??r.payload?.buyerClientId,sellerId:r.seller_id??r.payload?.sellerId,status:r.status,createdAt:iso(r.created_at??r.payload?.createdAt),updatedAt:iso(r.updated_at)}:null;
const orderAccess=(a,o)=>Boolean(a&&(a.id===o.buyerClientId||(a.sellerId&&a.sellerId===o.sellerId)||a.roles?.includes('ADMIN')||a.roles?.includes('TRUST_REVIEWER')));
const verificationAccess=(a,v)=>Boolean(a&&(a.id===v.accountId||a.roles?.includes('ADMIN')||a.roles?.includes('TRUST_REVIEWER')));

export async function loadOrderAuthority(id){
  let o=orders.get(id);if(o)return structuredClone(o);
  if(db.kind!=='POSTGRES')return null;
  const row=(await db.pool.query('SELECT * FROM orders WHERE id=$1',[id])).rows[0];o=orderFromRow(row);if(o)orders.set(o.id,o);return o?structuredClone(o):null
}

export async function createOrderAuthority(actor,order,{sourceKey=null,lifecycleAuthority=null}={}){
  const authority=String(lifecycleAuthority||inferLifecycleAuthority({account:actor,resource:order})).toUpperCase(),plan=planLifecycleTransition({domain:'ORDER',from:'NONE',to:'AWAITING_PAYMENT_CONNECTOR',action:'CREATE',authority}),o={...order,status:plan.to};
  if(db.kind!=='POSTGRES'){orders.set(o.id,structuredClone(o));await db.putOrder(o);return{...structuredClone(o),idempotentTransition:false,lifecycle:plan}}
  const cx=await db.pool.connect();try{
    await cx.query('BEGIN');const existing=(await cx.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[o.id])).rows[0];if(existing){if(sourceKey){const prior=await findLifecycleEventBySourceTx(cx,{domain:'ORDER',aggregateId:o.id,sourceKey});if(prior?.to===plan.to){await cx.query('COMMIT');const current=orderFromRow(existing);orders.set(current.id,current);return{...current,idempotentTransition:true,lifecycle:plan}}}throw Object.assign(new Error('Order already exists'),{status:409,code:'ORDER_EXISTS'})}
    await cx.query('INSERT INTO orders(id,listing_id,object_id,buyer_account_id,seller_id,status,payload,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8)',[o.id,o.listingId||null,o.lotId,o.buyerClientId,o.sellerId,o.status,o,o.createdAt||now()]);await recordLifecycleTransitionTx(cx,{plan,aggregateId:o.id,sourceKey,metadata:{listingId:o.listingId||null,objectId:o.lotId,buyerAccountId:o.buyerClientId,sellerId:o.sellerId}});await cx.query('COMMIT');orders.set(o.id,structuredClone(o));return{...structuredClone(o),idempotentTransition:false,lifecycle:plan}
  }catch(e){try{await cx.query('ROLLBACK')}catch{}throw e}finally{cx.release()}
}

export async function transitionOrder(actor,id,next,{lifecycleAuthority=null,lifecycleFacts={},sourceKey=null,patch={}}={}){
  next=String(next||'').toUpperCase();sourceKey=sourceKey==null?null:String(sourceKey);
  if(db.kind!=='POSTGRES'){
    const current=orders.get(id);if(!current||!orderAccess(actor,current))throw Object.assign(new Error('Order not found'),{status:404});const authority=String(lifecycleAuthority||inferLifecycleAuthority({account:actor,resource:current})).toUpperCase(),plan=planLifecycleTransition({domain:'ORDER',from:current.status,to:next,authority,facts:lifecycleFacts}),updated={...current,...patch,status:plan.to};orders.set(id,updated);await db.putOrder(updated);return{...structuredClone(updated),idempotentTransition:false,lifecycle:plan}
  }
  const cx=await db.pool.connect();try{
    await cx.query('BEGIN');const row=(await cx.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row)throw Object.assign(new Error('Order not found'),{status:404});const current=orderFromRow(row);if(!orderAccess(actor,current)&&String(lifecycleAuthority||'').toUpperCase()!=='SYSTEM'&&String(lifecycleAuthority||'').toUpperCase()!=='PROVIDER')throw Object.assign(new Error('Order not found'),{status:404});
    if(sourceKey){const prior=await findLifecycleEventBySourceTx(cx,{domain:'ORDER',aggregateId:id,sourceKey});if(prior){if(prior.to!==next)throw conflict('Lifecycle source key already belongs to a different order transition');await cx.query('COMMIT');orders.set(current.id,current);return{...current,idempotentTransition:true,lifecycle:prior}}}
    const authority=String(lifecycleAuthority||inferLifecycleAuthority({account:actor,resource:current})).toUpperCase(),plan=planLifecycleTransition({domain:'ORDER',from:current.status,to:next,authority,facts:lifecycleFacts}),updated={...current,...patch,status:plan.to};await cx.query('UPDATE orders SET status=$2,payload=$3,updated_at=now() WHERE id=$1',[id,plan.to,updated]);await recordLifecycleTransitionTx(cx,{plan,aggregateId:id,sourceKey,metadata:{buyerAccountId:current.buyerClientId,sellerId:current.sellerId,patchKeys:Object.keys(patch||{})}});await cx.query('COMMIT');orders.set(id,structuredClone(updated));return{...structuredClone(updated),idempotentTransition:false,lifecycle:plan}
  }catch(e){try{await cx.query('ROLLBACK')}catch{}throw e}finally{cx.release()}
}

export async function startVerificationAuthority(actor,{id=uid('ver'),caseType=null,subjectType=null,sourceKey=null}={}){
  caseType=caseType|| (actor.accountType==='SELLER'?'KYB':'KYC');subjectType=subjectType||(caseType==='KYB'?'ORGANIZATION':'PERSON');const authority=inferLifecycleAuthority({account:actor}),plan=planLifecycleTransition({domain:'VERIFICATION',from:'NONE',to:'PENDING',action:'START',authority}),ts=now(),v={id,accountId:actor.id,subjectType,caseType,status:plan.to,provider:'NOT_CONFIGURED',providerReference:null,riskLevel:null,decisionReason:'',submittedAt:ts,decidedAt:null,expiresAt:null,createdAt:ts,updatedAt:ts};
  if(db.kind!=='POSTGRES'){await db.putVerification(v);return{verification:v,idempotentTransition:false,lifecycle:plan}}
  const cx=await db.pool.connect();try{await cx.query('BEGIN');await cx.query(`INSERT INTO verification_cases(id,account_id,subject_type,case_type,status,provider,provider_reference,risk_level,decision_reason,submitted_at,decided_at,expires_at,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,NULL,NULL,'',$7,NULL,NULL,$7,$7)`,[v.id,v.accountId,v.subjectType,v.caseType,v.status,v.provider,ts]);await recordLifecycleTransitionTx(cx,{plan,aggregateId:v.id,sourceKey,metadata:{accountId:v.accountId,caseType:v.caseType,subjectType:v.subjectType}});await cx.query('COMMIT');return{verification:v,idempotentTransition:false,lifecycle:plan}}catch(e){try{await cx.query('ROLLBACK')}catch{}throw e}finally{cx.release()}
}

export async function transitionVerification(actor,id,next,{lifecycleAuthority=null,lifecycleFacts={},sourceKey=null,patch={}}={}){
  next=String(next||'').toUpperCase();sourceKey=sourceKey==null?null:String(sourceKey);
  if(db.kind!=='POSTGRES'){
    const current=await db.getVerification(id);if(!current)throw Object.assign(new Error('Verification not found'),{status:404});const authority=String(lifecycleAuthority||inferLifecycleAuthority({account:actor,resource:{...current,buyerAccountId:current.accountId}})).toUpperCase();if(!verificationAccess(actor,current)&&!['SYSTEM','PROVIDER'].includes(authority))throw Object.assign(new Error('Verification not found'),{status:404});const plan=planLifecycleTransition({domain:'VERIFICATION',from:current.status,to:next,authority,facts:lifecycleFacts}),updated={...current,...patch,status:plan.to,updatedAt:now()};await db.putVerification(updated);return{verification:updated,idempotentTransition:false,lifecycle:plan}
  }
  const cx=await db.pool.connect();try{
    await cx.query('BEGIN');const row=(await cx.query('SELECT * FROM verification_cases WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row)throw Object.assign(new Error('Verification not found'),{status:404});const current=mapVerification(row),authority=String(lifecycleAuthority||inferLifecycleAuthority({account:actor,resource:{...current,buyerAccountId:current.accountId}})).toUpperCase();if(!verificationAccess(actor,current)&&!['SYSTEM','PROVIDER'].includes(authority))throw Object.assign(new Error('Verification not found'),{status:404});
    if(sourceKey){const prior=await findLifecycleEventBySourceTx(cx,{domain:'VERIFICATION',aggregateId:id,sourceKey});if(prior){if(prior.to!==next)throw conflict('Lifecycle source key already belongs to a different verification transition');await cx.query('COMMIT');return{verification:current,idempotentTransition:true,lifecycle:prior}}}
    const plan=planLifecycleTransition({domain:'VERIFICATION',from:current.status,to:next,authority,facts:lifecycleFacts}),updated={...current,...patch,status:plan.to,updatedAt:now()},decidedAt=updated.decidedAt||(['VERIFIED','REJECTED'].includes(plan.to)?now():null);updated.decidedAt=decidedAt;await cx.query(`UPDATE verification_cases SET status=$2,provider=$3,provider_reference=$4,risk_level=$5,decision_reason=$6,submitted_at=$7,decided_at=$8,expires_at=$9,updated_at=now() WHERE id=$1`,[id,plan.to,updated.provider||null,updated.providerReference||null,updated.riskLevel||null,updated.decisionReason||'',updated.submittedAt||null,decidedAt,updated.expiresAt||null]);await recordLifecycleTransitionTx(cx,{plan,aggregateId:id,sourceKey,metadata:{accountId:current.accountId,caseType:current.caseType,provider:updated.provider||null,providerReference:updated.providerReference||null}});await cx.query('COMMIT');return{verification:{...updated,status:plan.to},idempotentTransition:false,lifecycle:plan}
  }catch(e){try{await cx.query('ROLLBACK')}catch{}throw e}finally{cx.release()}
}

export function orderVerificationLifecycleCapabilities(){return{postgresAuthority:db.kind==='POSTGRES',order:{rowLock:true,journal:true,outbox:true,sourceReplay:true},verification:{rowLock:true,journal:true,outbox:true,sourceReplay:true}}}
