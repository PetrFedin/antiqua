import {db,orders,uid,now,notify} from './runtime-v09.mjs';
import {inferLifecycleAuthority,planLifecycleTransition} from './lifecycle-authority-v16.mjs';
import {findLifecycleEventBySourceTx,recordLifecycleTransitionTx} from './lifecycle-events-v16.mjs';
import {createDispute as legacyCreateDispute,getDispute as legacyGetDispute,listDisputes as legacyListDisputes,addDisputeEvidence as legacyAddDisputeEvidence,decideDispute as legacyDecideDispute} from './domain-e2e-v14.mjs';

const ACTIVE_EVIDENCE_STATES=new Set(['OPEN','UNDER_REVIEW','EVIDENCE_REQUIRED']);
const TERMINAL=new Set(['RESOLVED_BUYER','RESOLVED_SELLER','PARTIAL_REFUND','FULL_REFUND','CLOSED']);
const clone=x=>x==null?x:structuredClone(x);
const iso=v=>v?.toISOString?.()||v||null;
const conflict=message=>Object.assign(new Error(message),{status:409,code:'LIFECYCLE_EVENT_CONFLICT'});
const access=(a,d)=>Boolean(a&&(a.id===d.buyerAccountId||(a.sellerId&&a.sellerId===d.sellerId)||a.roles?.includes('ADMIN')||a.roles?.includes('TRUST_REVIEWER')));
const mapDispute=r=>r?{id:r.id,orderId:r.order_id??r.orderId,settlementId:r.settlement_id??r.settlementId,shipmentId:r.shipment_id??r.shipmentId,objectId:r.object_id??r.objectId,openedByAccountId:r.opened_by_account_id??r.openedByAccountId,buyerAccountId:r.buyer_account_id??r.buyerAccountId,sellerId:r.seller_id??r.sellerId,category:r.category,status:r.status,summary:r.summary,requestedResolution:r.requested_resolution??r.requestedResolution,decision:r.decision||{},createdAt:iso(r.created_at??r.createdAt),updatedAt:iso(r.updated_at??r.updatedAt)}:null;
const mapEvidence=r=>r?{id:r.id,disputeId:r.dispute_id??r.disputeId,submittedByAccountId:r.submitted_by_account_id??r.submittedByAccountId,evidenceType:r.evidence_type??r.evidenceType,note:r.note||'',mediaIds:r.media_ids??r.mediaIds??[],createdAt:iso(r.created_at??r.createdAt)}:null;
const decisionAction=(from,to)=>to==='RESOLVED_BUYER'?'RESOLVE_BUYER':to==='RESOLVED_SELLER'?'RESOLVE_SELLER':to==='EVIDENCE_REQUIRED'?'REQUEST_EVIDENCE':to==='UNDER_REVIEW'?(from==='EVIDENCE_REQUIRED'?'RESUME_REVIEW':'CONTINUE_REVIEW'):to==='CLOSED'?'CLOSE':to;

export const getDispute=legacyGetDispute;
export const listDisputes=legacyListDisputes;

async function notifyOpened(d){await notify(d.buyerAccountId,'DISPUTE_OPENED',{disputeId:d.id,objectId:d.objectId});const sa=d.sellerId?await db.findAccountBySellerId(d.sellerId):null;if(sa)await notify(sa.id,'DISPUTE_OPENED',{disputeId:d.id,objectId:d.objectId})}
async function notifyDecision(d){await notify(d.buyerAccountId,'DISPUTE_DECISION',{disputeId:d.id,status:d.status,decision:d.decision});const sa=d.sellerId?await db.findAccountBySellerId(d.sellerId):null;if(sa)await notify(sa.id,'DISPUTE_DECISION',{disputeId:d.id,status:d.status,decision:d.decision})}

async function resolveTransactionTx(cx,actor,b){
  let shipment=null,order=null,settlement=null;const shipmentId=String(b.shipmentId||'');
  if(shipmentId)shipment=(await cx.query('SELECT * FROM shipments WHERE id=$1',[shipmentId])).rows[0]||null;
  const orderId=String(b.orderId||shipment?.order_id||'');if(orderId)order=(await cx.query('SELECT * FROM orders WHERE id=$1',[orderId])).rows[0]||null;
  const settlementId=String(b.settlementId||shipment?.settlement_id||'');if(settlementId)settlement=(await cx.query('SELECT * FROM auction_settlements WHERE id=$1 FOR UPDATE',[settlementId])).rows[0]||null;
  if(!shipment&&!order&&!settlement)throw Object.assign(new Error('Transaction reference required'),{status:400});
  const buyer=shipment?.buyer_account_id||order?.buyer_account_id||settlement?.buyer_account_id,sellerId=shipment?.seller_id||order?.seller_id||settlement?.seller_id,objectId=shipment?.object_id||order?.object_id||settlement?.object_id;
  const resource={buyerAccountId:buyer,sellerId};if(!access(actor,resource))throw Object.assign(new Error('Dispute access denied'),{status:403});
  return{shipment,order,settlement,buyer,sellerId,objectId,shipmentId:shipmentId||null,orderId:orderId||null,settlementId:settlementId||null}
}

export async function createDisputeAuthority(actor,b={}){
  const category=String(b.category||'OTHER').toUpperCase(),summary=String(b.summary||'').trim(),requestedResolution=String(b.requestedResolution||'');
  if(!['NONRECEIPT','DAMAGE','MISMATCH','COMPLETENESS','AUTHENTICITY','PAYMENT','OTHER'].includes(category))throw Object.assign(new Error('Invalid dispute category'),{status:400});if(!summary)throw Object.assign(new Error('Dispute summary required'),{status:400});
  if(db.kind!=='POSTGRES'){
    const d=await legacyCreateDispute(actor,b),plan=planLifecycleTransition({domain:'DISPUTE',from:'NONE',to:'OPEN',action:'OPEN',authority:inferLifecycleAuthority({account:actor,resource:d})});return{...d,idempotentTransition:false,lifecycle:plan}
  }
  const cx=await db.pool.connect();let d,plan;
  try{
    await cx.query('BEGIN');const tx=await resolveTransactionTx(cx,actor,b);plan=planLifecycleTransition({domain:'DISPUTE',from:'NONE',to:'OPEN',action:'OPEN',authority:inferLifecycleAuthority({account:actor,resource:{buyerAccountId:tx.buyer,sellerId:tx.sellerId}})});const id=String(b.id||uid('dsp')),ts=now();d={id,orderId:tx.orderId,settlementId:tx.settlementId,shipmentId:tx.shipmentId,objectId:tx.objectId,openedByAccountId:actor.id,buyerAccountId:tx.buyer,sellerId:tx.sellerId,category,status:plan.to,summary,requestedResolution,decision:{},createdAt:ts,updatedAt:ts};
    await cx.query('INSERT INTO disputes(id,order_id,settlement_id,shipment_id,object_id,opened_by_account_id,buyer_account_id,seller_id,category,status,summary,requested_resolution,decision,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)',[d.id,d.orderId,d.settlementId,d.shipmentId,d.objectId,d.openedByAccountId,d.buyerAccountId,d.sellerId,d.category,d.status,d.summary,d.requestedResolution,d.decision,d.createdAt]);await recordLifecycleTransitionTx(cx,{plan,aggregateId:d.id,sourceKey:b.sourceKey??null,metadata:{orderId:d.orderId,settlementId:d.settlementId,shipmentId:d.shipmentId,objectId:d.objectId,category:d.category}});
    if(tx.settlement&&['PAID','FULFILLMENT'].includes(tx.settlement.status)){
      const settlementPlan=planLifecycleTransition({domain:'SETTLEMENT',from:tx.settlement.status,to:'DISPUTED',action:'OPEN_DISPUTE',authority:inferLifecycleAuthority({account:actor,resource:{buyerAccountId:tx.settlement.buyer_account_id,sellerId:tx.settlement.seller_id}})});await cx.query("UPDATE auction_settlements SET status='DISPUTED',updated_at=now() WHERE id=$1",[tx.settlement.id]);await cx.query('INSERT INTO settlement_events(id,settlement_id,event_type,actor_account_id,payload,created_at) VALUES($1,$2,$3,$4,$5,now())',[uid('sev'),tx.settlement.id,'SETTLEMENT_DISPUTED',actor.id,{disputeId:d.id}]);await recordLifecycleTransitionTx(cx,{plan:settlementPlan,aggregateId:tx.settlement.id,sourceKey:`dispute:${d.id}:settlement-open`,metadata:{disputeId:d.id}})
    }
    await cx.query('COMMIT')
  }catch(e){try{await cx.query('ROLLBACK')}catch{}throw e}finally{cx.release()}
  await notifyOpened(d);return{...clone(d),idempotentTransition:false,lifecycle:plan}
}

export async function addDisputeEvidenceAuthority(actor,id,b={}){
  const sourceKey=b.sourceKey??(b.clientEvidenceId?`evidence:${b.clientEvidenceId}`:null),evidenceType=String(b.evidenceType||'NOTE').toUpperCase(),note=String(b.note||''),mediaIds=Array.isArray(b.mediaIds)?b.mediaIds.slice(0,20):[];
  if(db.kind!=='POSTGRES'){
    const current=await legacyGetDispute(actor,id);if(!current)throw Object.assign(new Error('Dispute not found'),{status:404});if(!ACTIVE_EVIDENCE_STATES.has(current.status))throw Object.assign(new Error('Dispute no longer accepts evidence'),{status:409,code:'DISPUTE_TERMINAL'});let plan=null;if(current.status==='OPEN')plan=planLifecycleTransition({domain:'DISPUTE',from:'OPEN',to:'UNDER_REVIEW',action:'ADD_EVIDENCE',authority:inferLifecycleAuthority({account:actor,resource:current})});const evidence=await legacyAddDisputeEvidence(actor,id,b);return{evidence,idempotentTransition:false,lifecycle:plan}
  }
  const cx=await db.pool.connect();let evidence,plan=null,idempotentTransition=false;
  try{
    await cx.query('BEGIN');const row=(await cx.query('SELECT * FROM disputes WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row)throw Object.assign(new Error('Dispute not found'),{status:404});const current=mapDispute(row);if(!access(actor,current))throw Object.assign(new Error('Dispute not found'),{status:404});if(!ACTIVE_EVIDENCE_STATES.has(current.status))throw Object.assign(new Error('Dispute no longer accepts evidence'),{status:409,code:'DISPUTE_TERMINAL'});
    if(sourceKey){const prior=await findLifecycleEventBySourceTx(cx,{domain:'DISPUTE',aggregateId:id,sourceKey});if(prior){const evidenceId=prior.metadata?.evidenceId;if(!evidenceId)throw conflict('Evidence source key belongs to a different dispute transition');const priorEvidence=(await cx.query('SELECT * FROM dispute_evidence WHERE id=$1 AND dispute_id=$2',[evidenceId,id])).rows[0];if(!priorEvidence)throw conflict('Evidence replay could not resolve original evidence');await cx.query('COMMIT');return{evidence:mapEvidence(priorEvidence),idempotentTransition:true,lifecycle:prior}}}
    const eid=uid('evd');evidence={id:eid,disputeId:id,submittedByAccountId:actor.id,evidenceType,note,mediaIds,createdAt:now()};await cx.query('INSERT INTO dispute_evidence(id,dispute_id,submitted_by_account_id,evidence_type,note,media_ids,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[evidence.id,id,evidence.submittedByAccountId,evidence.evidenceType,evidence.note,evidence.mediaIds,evidence.createdAt]);
    if(current.status==='OPEN'){plan=planLifecycleTransition({domain:'DISPUTE',from:'OPEN',to:'UNDER_REVIEW',action:'ADD_EVIDENCE',authority:inferLifecycleAuthority({account:actor,resource:current})});await cx.query("UPDATE disputes SET status='UNDER_REVIEW',updated_at=now() WHERE id=$1",[id]);await recordLifecycleTransitionTx(cx,{plan,aggregateId:id,sourceKey,metadata:{evidenceId:evidence.id,evidenceType:evidence.evidenceType,submittedByAccountId:actor.id}})}
    await cx.query('COMMIT')
  }catch(e){try{await cx.query('ROLLBACK')}catch{}throw e}finally{cx.release()}
  return{evidence:mapEvidence(evidence),idempotentTransition,lifecycle:plan}
}

export async function decideDisputeAuthority(actor,id,{status,reason='',refundAmountMinor=0,sourceKey=null,effect=null}={}){
  status=String(status||'').toUpperCase();sourceKey=sourceKey==null?`decision:${status}`:String(sourceKey);
  if(!['RESOLVED_BUYER','RESOLVED_SELLER','PARTIAL_REFUND','FULL_REFUND','CLOSED','EVIDENCE_REQUIRED','UNDER_REVIEW'].includes(status))throw Object.assign(new Error('Invalid dispute decision'),{status:400});const isRefund=['FULL_REFUND','PARTIAL_REFUND'].includes(status);
  if(db.kind!=='POSTGRES'){
    const current=await legacyGetDispute(actor,id);if(!current)throw Object.assign(new Error('Dispute not found'),{status:404});const action=decisionAction(current.status,status),authority=inferLifecycleAuthority({account:actor,resource:current});planLifecycleTransition({domain:'DISPUTE',from:current.status,to:status,action,authority,facts:isRefund?{REFUND_EFFECT_RECORDED:true}:{}});let effectResult=null;if(isRefund){if(typeof effect!=='function')throw Object.assign(new Error('Refund effect required'),{status:409,code:'REFUND_EFFECT_REQUIRED'});effectResult=await effect(current);if(effectResult?.refundEffectRecorded!==true)throw Object.assign(new Error('Refund effect was not recorded'),{status:409,code:'LIFECYCLE_PRECONDITION_FAILED'})}const plan=planLifecycleTransition({domain:'DISPUTE',from:current.status,to:status,action,authority,facts:isRefund?{REFUND_EFFECT_RECORDED:true}:{}}),amount=effectResult?.refund?.amountMinor??refundAmountMinor,d=await legacyDecideDispute(actor,id,{status:plan.to,reason,refundAmountMinor:amount});return{dispute:d,refund:effectResult?.refund||null,idempotentTransition:false,lifecycle:plan}
  }
  const cx=await db.pool.connect();let updated,plan,effectResult=null,idempotentTransition=false;
  try{
    await cx.query('BEGIN');const row=(await cx.query('SELECT * FROM disputes WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row)throw Object.assign(new Error('Dispute not found'),{status:404});const current=mapDispute(row);if(!access(actor,current))throw Object.assign(new Error('Dispute not found'),{status:404});
    if(sourceKey){const prior=await findLifecycleEventBySourceTx(cx,{domain:'DISPUTE',aggregateId:id,sourceKey});if(prior){if(prior.to!==status)throw conflict('Lifecycle source key already belongs to a different dispute decision');if(Number(refundAmountMinor||0)>0&&Number(prior.metadata?.refundAmountMinor||0)!==Number(refundAmountMinor))throw conflict('Lifecycle source key already belongs to a different refund amount');await cx.query('COMMIT');return{dispute:{...(await legacyGetDispute(actor,id)),idempotentTransition:true},refund:prior.metadata?.refund||null,idempotentTransition:true,lifecycle:prior}}}
    if(TERMINAL.has(current.status))throw Object.assign(new Error('Dispute is already terminal'),{status:409,code:'LIFECYCLE_TRANSITION_INVALID'});const action=decisionAction(current.status,status),authority=inferLifecycleAuthority({account:actor,resource:current});planLifecycleTransition({domain:'DISPUTE',from:current.status,to:status,action,authority,facts:isRefund?{REFUND_EFFECT_RECORDED:true}:{}});
    if(isRefund){if(typeof effect!=='function')throw Object.assign(new Error('Refund effect required'),{status:409,code:'REFUND_EFFECT_REQUIRED'});effectResult=await effect(current);if(effectResult?.refundEffectRecorded!==true)throw Object.assign(new Error('Refund effect was not recorded'),{status:409,code:'LIFECYCLE_PRECONDITION_FAILED'})}
    plan=planLifecycleTransition({domain:'DISPUTE',from:current.status,to:status,action,authority,facts:isRefund?{REFUND_EFFECT_RECORDED:true}:{}});const amount=Number(effectResult?.refund?.amountMinor??refundAmountMinor??0),decision={reason:String(reason||''),refundAmountMinor:Math.max(0,Math.trunc(amount)),decidedBy:actor.id,decidedAt:now(),...(effectResult?.refund?{refund:effectResult.refund}:{})};const changed=(await cx.query('UPDATE disputes SET status=$2,decision=$3,updated_at=now() WHERE id=$1 RETURNING *',[id,plan.to,decision])).rows[0];updated=mapDispute(changed);await recordLifecycleTransitionTx(cx,{plan,aggregateId:id,sourceKey,metadata:{reason:decision.reason,refundAmountMinor:decision.refundAmountMinor,refund:effectResult?.refund||null}});await cx.query('COMMIT')
  }catch(e){try{await cx.query('ROLLBACK')}catch{}throw e}finally{cx.release()}
  await notifyDecision(updated);return{dispute:{...(await legacyGetDispute(actor,id)),idempotentTransition},refund:effectResult?.refund||null,idempotentTransition,lifecycle:plan}
}

export function disputeLifecycleCapabilities(){return{postgresAuthority:db.kind==='POSTGRES',rowLock:true,journal:true,outbox:true,decisionSerialization:true,refundSagaRecoverable:true,settlementOpenAtomic:true,evidenceOpenTransitionAtomic:true}}
