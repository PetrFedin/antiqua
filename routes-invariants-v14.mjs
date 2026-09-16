import {PREVIEW,db,send,readBody,requireCsrf,audit,orders} from './runtime-v09.mjs';
import {getDispute,decideDispute,getSettlement} from './domain-e2e-v14.mjs';
import {postLedgerTransaction,getPayout,listPayouts,transitionPayout} from './finance-v10.mjs';

const SYSTEM={id:'system',roles:['ADMIN'],sellerId:null};
const canOperate=a=>Boolean(a?.roles?.includes('ADMIN')||a?.roles?.includes('TRUST_REVIEWER'));
async function loadOrder(id){let o=orders.get(id);if(!o&&db.kind==='POSTGRES')o=(await db.pool.query('SELECT payload FROM orders WHERE id=$1',[id])).rows[0]?.payload||null;return o}
async function paidContext(a,d){if(d.orderId){const o=await loadOrder(d.orderId);if(!o)return null;return{amountMinor:Math.round(Number(o.price||0)*100),currency:o.currency||'EUR',provider:o.finance?.provider||'NOT_CONFIGURED',payoutId:o.finance?.payoutId||null,sellerId:o.sellerId||d.sellerId}}if(d.settlementId){const s=await getSettlement(a,d.settlementId)||await getSettlement(SYSTEM,d.settlementId);if(!s)return null;return{amountMinor:Number(s.winningAmountMinor||0),currency:s.currency||'EUR',provider:s.metadata?.provider||'NOT_CONFIGURED',payoutId:s.metadata?.payoutId||null,sellerId:s.sellerId||d.sellerId}}return null}
function refundEntries({sellerId,amountMinor,currency,provider}){return[{ownerType:'SELLER',ownerId:sellerId||'platform-consignment',currency,accountType:'LIABILITY',name:'SELLER_PAYABLE_HOLD',side:'DEBIT',amountMinor},{ownerType:'PAYMENT_PROVIDER',ownerId:provider,currency,accountType:'ASSET',name:'CLEARING',side:'CREDIT',amountMinor}]}
async function reversePayouts(d,ctx){const ids=new Set();if(ctx?.payoutId)ids.add(ctx.payoutId);if(d.orderId)for(const p of await listPayouts({orderId:d.orderId}))ids.add(p.id);for(const id of ids){const p=await getPayout(id);if(p&&['ON_HOLD','READY','FAILED'].includes(p.status))try{await transitionPayout(id,'REVERSED')}catch{}}}

export async function routeInvariantPublicV14(req,res,url){
 if(url.pathname==='/api/verification/start'&&req.method==='POST'&&!PREVIEW)return send(res,503,{error:'Identity provider adapter is not connected',code:'IDENTITY_PROVIDER_NOT_CONNECTED'});
 return false
}

export async function routeInvariantsV14(req,res,url,ctx){
 if(!ctx)return false;
 const a=ctx.account;
 const ship=url.pathname.match(/^\/api\/shipments\/([^/]+)\/transition$/);
 if(ship&&req.method==='POST'&&!canOperate(a)&&!a.sellerId){requireCsrf(req,ctx);return send(res,403,{error:'Only the seller, operator or shipping provider can advance shipment state',code:'SHIPMENT_AUTHORITY_REQUIRED'})}
 const ds=url.pathname.match(/^\/api\/disputes\/([^/]+)\/decision$/);
 if(ds&&req.method==='POST'){
  requireCsrf(req,ctx);if(!canOperate(a))return send(res,403,{error:'Operator permission required',code:'FORBIDDEN'});
  const before=await getDispute(a,ds[1]);if(!before)return send(res,404,{error:'Dispute not found'});
  const body=await readBody(req),decision=String(body.status||'').toUpperCase(),isRefund=['FULL_REFUND','PARTIAL_REFUND'].includes(decision);let refund=null;
  if(isRefund){if(!PREVIEW)return send(res,503,{error:'Refund execution requires a connected PSP adapter',code:'PAYMENT_PROVIDER_ACTION_REQUIRED'});const ctxPaid=await paidContext(a,before);if(!ctxPaid?.amountMinor)return send(res,409,{error:'Paid amount is unavailable'});let amount=decision==='FULL_REFUND'?ctxPaid.amountMinor:Math.round(Number(body.refundAmountMinor||0));if(decision==='PARTIAL_REFUND'&&(!amount||amount>=ctxPaid.amountMinor))return send(res,400,{error:'Partial refund must be greater than zero and less than the paid amount'});const provider=ctxPaid.provider==='NOT_CONFIGURED'?'INTERNAL_PREVIEW':ctxPaid.provider,tx=await postLedgerTransaction({transactionType:decision,externalReference:`dispute-${before.id}`,entries:refundEntries({sellerId:ctxPaid.sellerId,amountMinor:amount,currency:ctxPaid.currency,provider}),metadata:{disputeId:before.id,preview:PREVIEW}});refund={ledgerTransactionId:tx.id,amountMinor:amount,currency:ctxPaid.currency};await reversePayouts(before,ctxPaid)}
  const d=await decideDispute(a,ds[1],{...body,refundAmountMinor:refund?.amountMinor||body.refundAmountMinor});await audit(req,a,'DISPUTE_DECIDED','DISPUTE',d.id,before,{status:d.status,refund});return send(res,200,{dispute:d,refund})
 }
 return false
}
