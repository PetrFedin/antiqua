import {PREVIEW,db,orders,uid,now,notify} from './runtime-v09.mjs';
import {inferLifecycleAuthority,planLifecycleTransition} from './lifecycle-authority-v16.mjs';
import {findLifecycleEventBySourceTx,recordLifecycleTransitionTx} from './lifecycle-events-v16.mjs';
import {
  getSettlement as legacyGetSettlement,
  listSettlements as legacyListSettlements,
  transitionSettlement as legacyTransitionSettlement,
  getShipment as legacyGetShipment,
  listShipments as legacyListShipments,
  quoteShipment as legacyQuoteShipment,
  transitionShipment as legacyTransitionShipment,
  createDispute as legacyCreateDispute
} from './domain-e2e-v14.mjs';

const clone=x=>x==null?x:structuredClone(x);
const iso=v=>v?.toISOString?.()||v||null;
const canAccess=(a,buyer,sellerId)=>Boolean(a&&(a.id===buyer||(sellerId&&a.sellerId===sellerId)||a.roles?.includes('ADMIN')||a.roles?.includes('TRUST_REVIEWER')));
const conflict=message=>Object.assign(new Error(message),{status:409,code:'LIFECYCLE_EVENT_CONFLICT'});
const mapSettlement=r=>({id:r.id,auctionId:r.auction_id??r.auctionId,objectId:r.object_id??r.objectId,buyerAccountId:r.buyer_account_id??r.buyerAccountId,sellerId:r.seller_id??r.sellerId,winningAmountMinor:Number(r.winning_amount_minor??r.winningAmountMinor),currency:r.currency,status:r.status,paymentDueAt:iso(r.payment_due_at??r.paymentDueAt),nonpaymentAt:iso(r.nonpayment_at??r.nonpaymentAt),completedAt:iso(r.completed_at??r.completedAt),metadata:r.metadata||{},createdAt:iso(r.created_at??r.createdAt),updatedAt:iso(r.updated_at??r.updatedAt)});
const mapShipment=r=>({id:r.id,orderId:r.order_id??r.orderId,settlementId:r.settlement_id??r.settlementId,objectId:r.object_id??r.objectId,buyerAccountId:r.buyer_account_id??r.buyerAccountId,sellerId:r.seller_id??r.sellerId,status:r.status,provider:r.provider,serviceLevel:r.service_level??r.serviceLevel,trackingReference:r.tracking_reference??r.trackingReference,insuredValueMinor:Number((r.insured_value_minor??r.insuredValueMinor)??0),currency:r.currency,quote:r.quote||{},packageSpec:(r.package_spec??r.packageSpec)||{},deliveryProof:(r.delivery_proof??r.deliveryProof)||{},createdAt:iso(r.created_at??r.createdAt),updatedAt:iso(r.updated_at??r.updatedAt)});

function settlementFacts(payload={}){
  const metadata=payload.metadata||{};
  return{...(payload.lifecycleFacts||{}),PAYMENT_EFFECT_RECORDED:Boolean(payload.lifecycleFacts?.PAYMENT_EFFECT_RECORDED??(metadata.paymentLedgerTransactionId&&metadata.payoutId))};
}
function shipmentFacts(payload={}){
  return{...(payload.lifecycleFacts||{}),PROVIDER_EVENT_OR_PREVIEW:Boolean(payload.lifecycleFacts?.PROVIDER_EVENT_OR_PREVIEW??(payload.providerEvent||String(payload.lifecycleAuthority||'').toUpperCase()==='PROVIDER'||PREVIEW))};
}
function settlementAuthority(actor,current,next,payload={}){
  if(payload.lifecycleAuthority)return String(payload.lifecycleAuthority).toUpperCase();
  if(String(next).toUpperCase()==='PAID'&&settlementFacts(payload).PAYMENT_EFFECT_RECORDED)return'SYSTEM';
  return inferLifecycleAuthority({account:actor,resource:current});
}
function shipmentAuthority(actor,current,payload={}){return payload.lifecycleAuthority?String(payload.lifecycleAuthority).toUpperCase():inferLifecycleAuthority({account:actor,resource:current})}

async function settlementLegacyEventTx(cx,id,next,actor,payload){await cx.query('INSERT INTO settlement_events(id,settlement_id,event_type,actor_account_id,payload,created_at) VALUES($1,$2,$3,$4,$5,now())',[uid('sev'),id,`SETTLEMENT_${next}`,actor?.id||null,payload||{}])}
async function shipmentLegacyEventTx(cx,id,next,payload){await cx.query('INSERT INTO shipment_events(id,shipment_id,event_type,payload,created_at) VALUES($1,$2,$3,$4,now())',[uid('she'),id,`SHIPMENT_${next}`,payload||{}])}

export const getSettlement=legacyGetSettlement;
export const listSettlements=legacyListSettlements;
export const getShipment=legacyGetShipment;
export const listShipments=legacyListShipments;

export async function transitionSettlement(actor,id,next,payload={}){
  next=String(next||'').toUpperCase();const sourceKey=payload.sourceKey??payload.metadata?.externalReference??null;
  if(db.kind!=='POSTGRES'){
    const current=await legacyGetSettlement(actor,id);if(!current)throw Object.assign(new Error('Settlement not found'),{status:404});
    planLifecycleTransition({domain:'SETTLEMENT',from:current.status,to:next,authority:settlementAuthority(actor,current,next,payload),facts:settlementFacts(payload)});
    return legacyTransitionSettlement(actor,id,next,payload);
  }
  const cx=await db.pool.connect();let current,updated,idempotentTransition=false;
  try{
    await cx.query('BEGIN');const row=(await cx.query('SELECT * FROM auction_settlements WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row)throw Object.assign(new Error('Settlement not found'),{status:404});current=mapSettlement(row);if(!canAccess(actor,current.buyerAccountId,current.sellerId))throw Object.assign(new Error('Settlement not found'),{status:404});
    if(sourceKey!=null){const prior=await findLifecycleEventBySourceTx(cx,{domain:'SETTLEMENT',aggregateId:id,sourceKey});if(prior){if(prior.to!==next)throw conflict('Lifecycle source key already belongs to a different settlement transition');await cx.query('COMMIT');idempotentTransition=true;updated=current;return{...(await legacyGetSettlement(actor,id)),idempotentTransition}}}
    const plan=planLifecycleTransition({domain:'SETTLEMENT',from:current.status,to:next,authority:settlementAuthority(actor,current,next,payload),facts:settlementFacts(payload)}),metadata={...(current.metadata||{}),...(payload.metadata||{})},nonpaymentAt=next==='NONPAYMENT'?now():null,completedAt=next==='COMPLETED'?now():null;
    const changed=(await cx.query('UPDATE auction_settlements SET status=$2,metadata=$3,nonpayment_at=COALESCE($4,nonpayment_at),completed_at=COALESCE($5,completed_at),updated_at=now() WHERE id=$1 RETURNING *',[id,plan.to,metadata,nonpaymentAt,completedAt])).rows[0];updated=mapSettlement(changed);
    await settlementLegacyEventTx(cx,id,plan.to,actor,payload);await recordLifecycleTransitionTx(cx,{plan,aggregateId:id,sourceKey,metadata:{actorAccountId:actor?.id||null,...metadata}});await cx.query('COMMIT');
  }catch(e){try{await cx.query('ROLLBACK')}catch{}throw e}finally{cx.release()}
  await notify(current.buyerAccountId,`SETTLEMENT_${next}`,{settlementId:id,objectId:current.objectId});const sa=current.sellerId?await db.findAccountBySellerId(current.sellerId):null;if(sa)await notify(sa.id,`SETTLEMENT_${next}`,{settlementId:id,objectId:current.objectId});
  return{...(await legacyGetSettlement(actor,id)),idempotentTransition};
}

export async function quoteShipment(actor,id,b={}){
  if(db.kind!=='POSTGRES'){
    const current=await legacyGetShipment(actor,id);if(!current)throw Object.assign(new Error('Shipment not found'),{status:404});planLifecycleTransition({domain:'SHIPMENT',from:current.status,to:'QUOTED',action:'QUOTE',authority:shipmentAuthority(actor,current,b),facts:{QUOTE_AVAILABLE:true}});return legacyQuoteShipment(actor,id,b)
  }
  const cx=await db.pool.connect();let current;
  try{
    await cx.query('BEGIN');const row=(await cx.query('SELECT * FROM shipments WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row)throw Object.assign(new Error('Shipment not found'),{status:404});current=mapShipment(row);if(!canAccess(actor,current.buyerAccountId,current.sellerId))throw Object.assign(new Error('Shipment not found'),{status:404});const quote={amountMinor:current.insuredValueMinor>800000?32000:18000,currency:current.currency,insuranceIncluded:true,origin:String(b.origin||''),destination:String(b.destination||''),validUntil:new Date(Date.now()+7*86400000).toISOString(),provider:process.env.SHIPPING_PROVIDER||'INTERNAL_PREVIEW_QUOTE'},plan=planLifecycleTransition({domain:'SHIPMENT',from:current.status,to:'QUOTED',action:'QUOTE',authority:shipmentAuthority(actor,current,b),facts:{QUOTE_AVAILABLE:true}});await cx.query('UPDATE shipments SET status=$2,provider=$3,quote=$4,updated_at=now() WHERE id=$1',[id,plan.to,quote.provider,quote]);await shipmentLegacyEventTx(cx,id,'QUOTED',quote);await recordLifecycleTransitionTx(cx,{plan,aggregateId:id,sourceKey:b.sourceKey??null,metadata:{provider:quote.provider,amountMinor:quote.amountMinor,currency:quote.currency}});await cx.query('COMMIT')
  }catch(e){try{await cx.query('ROLLBACK')}catch{}throw e}finally{cx.release()}
  return legacyGetShipment(actor,id);
}

export async function transitionShipment(actor,id,next,payload={}){
  next=String(next||'').toUpperCase();const sourceKey=payload.sourceKey??null;
  if(db.kind!=='POSTGRES'){
    const current=await legacyGetShipment(actor,id);if(!current)throw Object.assign(new Error('Shipment not found'),{status:404});planLifecycleTransition({domain:'SHIPMENT',from:current.status,to:next,authority:shipmentAuthority(actor,current,payload),facts:shipmentFacts(payload)});return legacyTransitionShipment(actor,id,next,payload)
  }
  const cx=await db.pool.connect();let current,idempotentTransition=false;
  try{
    await cx.query('BEGIN');const row=(await cx.query('SELECT * FROM shipments WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row)throw Object.assign(new Error('Shipment not found'),{status:404});current=mapShipment(row);if(!canAccess(actor,current.buyerAccountId,current.sellerId))throw Object.assign(new Error('Shipment not found'),{status:404});
    if(sourceKey!=null){const prior=await findLifecycleEventBySourceTx(cx,{domain:'SHIPMENT',aggregateId:id,sourceKey});if(prior){if(prior.to!==next)throw conflict('Lifecycle source key already belongs to a different shipment transition');await cx.query('COMMIT');idempotentTransition=true;return{...(await legacyGetShipment(actor,id)),idempotentTransition}}}
    const plan=planLifecycleTransition({domain:'SHIPMENT',from:current.status,to:next,authority:shipmentAuthority(actor,current,payload),facts:shipmentFacts(payload)}),tracking=payload.trackingReference||current.trackingReference,proof=payload.deliveryProof||current.deliveryProof,packageSpec=payload.packageSpec||current.packageSpec;await cx.query('UPDATE shipments SET status=$2,tracking_reference=$3,delivery_proof=$4,package_spec=$5,updated_at=now() WHERE id=$1',[id,plan.to,tracking,proof,packageSpec]);await shipmentLegacyEventTx(cx,id,plan.to,payload);await recordLifecycleTransitionTx(cx,{plan,aggregateId:id,sourceKey,metadata:{trackingReference:tracking,providerEvent:Boolean(payload.providerEvent)}});await cx.query('COMMIT')
  }catch(e){try{await cx.query('ROLLBACK')}catch{}throw e}finally{cx.release()}
  await notify(current.buyerAccountId,`SHIPMENT_${next}`,{shipmentId:id,objectId:current.objectId});return{...(await legacyGetShipment(actor,id)),idempotentTransition};
}

export async function createDispute(actor,b){
  if(db.kind!=='POSTGRES')return legacyCreateDispute(actor,b);
  const shipmentId=String(b.shipmentId||''),shipment=shipmentId?await legacyGetShipment(actor,shipmentId):null;let order=b.orderId?orders.get(b.orderId):null;if(b.orderId&&!order)order=(await db.pool.query('SELECT payload FROM orders WHERE id=$1',[b.orderId])).rows[0]?.payload||null;const settlement=b.settlementId?await legacyGetSettlement(actor,b.settlementId):null;if(!order&&!settlement&&!shipment)throw Object.assign(new Error('Transaction reference required'),{status:400});const buyer=shipment?.buyerAccountId||order?.buyerClientId||settlement?.buyerAccountId,sellerId=shipment?.sellerId||order?.sellerId||settlement?.sellerId,objectId=shipment?.objectId||order?.lotId||settlement?.objectId;if(!canAccess(actor,buyer,sellerId))throw Object.assign(new Error('Dispute access denied'),{status:403});const category=String(b.category||'OTHER').toUpperCase();if(!['NONRECEIPT','DAMAGE','MISMATCH','COMPLETENESS','AUTHENTICITY','PAYMENT','OTHER'].includes(category))throw Object.assign(new Error('Invalid dispute category'),{status:400});const d={id:uid('dsp'),orderId:b.orderId||shipment?.orderId||null,settlementId:b.settlementId||shipment?.settlementId||null,shipmentId:shipmentId||null,objectId,openedByAccountId:actor.id,buyerAccountId:buyer,sellerId,category,status:'OPEN',summary:String(b.summary||'').trim(),requestedResolution:String(b.requestedResolution||''),decision:{},createdAt:now(),updatedAt:now()};if(!d.summary)throw Object.assign(new Error('Dispute summary required'),{status:400});await db.pool.query('INSERT INTO disputes(id,order_id,settlement_id,shipment_id,object_id,opened_by_account_id,buyer_account_id,seller_id,category,status,summary,requested_resolution,decision,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)',[d.id,d.orderId,d.settlementId,d.shipmentId,d.objectId,d.openedByAccountId,d.buyerAccountId,d.sellerId,d.category,d.status,d.summary,d.requestedResolution,d.decision,d.createdAt]);if(d.settlementId){const s=await legacyGetSettlement(actor,d.settlementId);if(s&&['PAID','FULFILLMENT'].includes(s.status))await transitionSettlement(actor,s.id,'DISPUTED',{disputeId:d.id,sourceKey:`dispute:${d.id}`})}await notify(d.buyerAccountId,'DISPUTE_OPENED',{disputeId:d.id,objectId:d.objectId});const sa=d.sellerId?await db.findAccountBySellerId(d.sellerId):null;if(sa)await notify(sa.id,'DISPUTE_OPENED',{disputeId:d.id,objectId:d.objectId});return clone(d)
}

export function commerceLifecycleCapabilities(){return{postgresAuthority:db.kind==='POSTGRES',settlement:{rowLock:true,journal:true,outbox:true,sourceReplay:true},shipment:{rowLock:true,journal:true,outbox:true,sourceReplay:true},memoryPreview:{canonicalPreflight:true,legacyMutationFallback:true}}}
