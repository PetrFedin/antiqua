import {db,send,requireCsrf,audit} from './runtime-v09.mjs';
import {getShipment,listDisputes,upsertCollectionRecord,addMovement} from './domain-e2e-v14.mjs';
import {getSettlement,transitionSettlement} from './commerce-lifecycle-v16.mjs';
import {loadOrderAuthority,transitionOrder} from './order-verification-lifecycle-v16.mjs';
import {getPayout,transitionPayout} from './finance-v10.mjs';
import {recordOwnershipTransfer,currentOwnership} from './ownership-v14.mjs';

export async function routeOwnershipV14(req,res,url,ctx){
 if(!ctx)return false;const a=ctx.account;
 const own=url.pathname.match(/^\/api\/ownership\/([^/]+)$/);if(own&&req.method==='GET'){const current=await currentOwnership(db,own[1],a.id);return send(res,200,{ownership:current})}
 const m=url.pathname.match(/^\/api\/shipments\/([^/]+)\/confirm-receipt$/);if(!m||req.method!=='POST')return false;
 requireCsrf(req,ctx);const s=await getShipment(a,m[1]);if(!s||s.buyerAccountId!==a.id)return send(res,403,{error:'Buyer only'});if(s.status!=='DELIVERED')return send(res,409,{error:'Shipment must be delivered before receipt confirmation'});
 const open=(await listDisputes(a)).filter(d=>(d.shipmentId===s.id||d.orderId===s.orderId||d.settlementId===s.settlementId)&&!['RESOLVED_BUYER','RESOLVED_SELLER','CLOSED','FULL_REFUND','PARTIAL_REFUND'].includes(d.status));if(open.length)return send(res,409,{error:'Open dispute blocks ownership confirmation',disputes:open.map(x=>x.id)});
 const receivedAt=new Date().toISOString(),sourceType=s.settlementId?'AUCTION':'ORDER',sourceId=s.settlementId||s.orderId,record=await upsertCollectionRecord(a,s.objectId,{status:'OWNED',acquisition:{source:sourceType,orderId:s.orderId||null,settlementId:s.settlementId||null,receivedAt},storage:{location:'Owner custody'}});await addMovement(a,s.objectId,{movementType:'ACQUIRED',note:'Receipt confirmed through ANTIQUA',occurredAt:receivedAt});
 const ownership=await recordOwnershipTransfer(db,{objectId:s.objectId,newOwnerAccountId:a.id,sourceType,sourceId,eventType:'ACQUIRED',idempotencyKey:`receipt:${s.id}:ownership`,publicNote:{en:'Ownership transferred after confirmed receipt through ANTIQUA',ru:'Переход владения после подтверждённого получения через ANTIQUA'}});
 let payoutId=null;if(s.orderId){const o=await loadOrderAuthority(s.orderId);if(o){const timeline=[...(o.timeline||[])];if(!timeline.some(x=>x.status==='DELIVERED'))timeline.push({status:'DELIVERED',at:receivedAt});if(!timeline.some(x=>x.status==='OWNERSHIP_TRANSFERRED'))timeline.push({status:'OWNERSHIP_TRANSFERRED',at:receivedAt});const updated=await transitionOrder(a,o.id,'OWNERSHIP_TRANSFERRED',{lifecycleFacts:{RECEIPT_CONFIRMED:true},sourceKey:`receipt:${s.id}:order`,patch:{shippingStatus:'DELIVERED',timeline}});payoutId=updated.finance?.payoutId||null}}
 if(s.settlementId){const set=await getSettlement(a,s.settlementId);if(set){const fulfilled=set.status==='PAID'?await transitionSettlement(a,set.id,'FULFILLMENT',{lifecycleAuthority:'SYSTEM',shipmentId:s.id,sourceKey:`receipt:${s.id}:fulfillment`}):set,done=fulfilled.status==='FULFILLMENT'?await transitionSettlement(a,fulfilled.id,'COMPLETED',{lifecycleAuthority:'SYSTEM',receiptConfirmed:true,sourceKey:`receipt:${s.id}:complete`}):fulfilled;payoutId=done.metadata?.payoutId||null}}
 let payout=null;if(payoutId){const p=await getPayout(payoutId);if(p?.status==='ON_HOLD')payout=await transitionPayout(p.id,'READY')}
 await audit(req,a,'OWNERSHIP_TRANSFER_CONFIRMED','OBJECT',s.objectId,null,{recordId:record.id,payoutId,ownershipEventId:ownership.id||null});return send(res,200,{confirmed:true,record,ownership,payout})
}
