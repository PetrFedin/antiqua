import {PREVIEW,send,readBody,requireCsrf,audit} from './runtime-v09.mjs';
import {majorToMinor,assertMinorAmount} from './money-v15.mjs';
import {postLedgerTransaction,getPayout,listPayouts,transitionPayout} from './finance-v10.mjs';
import {loadOrderAuthority} from './order-verification-lifecycle-v16.mjs';
import {getSettlement} from './commerce-lifecycle-v16.mjs';
import {createDisputeAuthority,addDisputeEvidenceAuthority,decideDisputeAuthority,disputeLifecycleCapabilities} from './dispute-lifecycle-v16.mjs';

const SYSTEM={id:'system',roles:['ADMIN'],sellerId:null};
const canOperate=a=>Boolean(a?.roles?.includes('ADMIN')||a?.roles?.includes('TRUST_REVIEWER'));
const paymentProvider=()=>process.env.PAYMENT_PROVIDER||'NOT_CONFIGURED';
const refundEntries=({sellerId,amountMinor,currency,provider})=>[
 {ownerType:'SELLER',ownerId:sellerId||'platform-consignment',currency,accountType:'LIABILITY',name:'SELLER_PAYABLE_HOLD',side:'DEBIT',amountMinor},
 {ownerType:'PAYMENT_PROVIDER',ownerId:provider,currency,accountType:'ASSET',name:'CLEARING',side:'CREDIT',amountMinor}
];

async function paidContext(a,d){
 if(d.orderId){const o=await loadOrderAuthority(d.orderId);if(!o)return null;const currency=o.currency||'EUR';return{amountMinor:majorToMinor(o.price,currency),currency,provider:o.finance?.provider||'NOT_CONFIGURED',payoutId:o.finance?.payoutId||null,sellerId:o.sellerId||d.sellerId}}
 if(d.settlementId){const s=await getSettlement(a,d.settlementId)||await getSettlement(SYSTEM,d.settlementId);if(!s)return null;return{amountMinor:Number(s.winningAmountMinor||0),currency:s.currency||'EUR',provider:s.metadata?.provider||'NOT_CONFIGURED',payoutId:s.metadata?.payoutId||null,sellerId:s.sellerId||d.sellerId}}
 return null
}
async function reversePayouts(d,ctx){
 const ids=new Set();if(ctx?.payoutId)ids.add(ctx.payoutId);if(d.orderId)for(const p of await listPayouts({orderId:d.orderId}))ids.add(p.id);const reversed=[];
 for(const id of ids){const p=await getPayout(id);if(p&&['ON_HOLD','READY','FAILED'].includes(p.status)){const r=await transitionPayout(id,'REVERSED',{lifecycleAuthority:'SYSTEM',sourceKey:`dispute:${d.id}:reverse:${id}`});reversed.push(r.id)}}return reversed
}

export async function routeDisputeV16(req,res,url,ctx){
 if(!ctx)return false;const a=ctx.account;
 if(url.pathname==='/api/e2e/dispute-lifecycle-capabilities'&&req.method==='GET')return send(res,200,{capabilities:disputeLifecycleCapabilities()});
 if(url.pathname==='/api/disputes'&&req.method==='POST'){
  requireCsrf(req,ctx);const body=await readBody(req),d=await createDisputeAuthority(a,{...body,sourceKey:String(req.headers['idempotency-key']||body.sourceKey||'')||null});await audit(req,a,d.lifecycle?.auditAction||'DISPUTE_OPENED','DISPUTE',d.id,null,{status:d.status},{lifecycle:d.lifecycle});return send(res,201,{dispute:d})
 }
 const evidence=url.pathname.match(/^\/api\/disputes\/([^/]+)\/evidence$/);if(evidence&&req.method==='POST'){
  requireCsrf(req,ctx);const body=await readBody(req),x=await addDisputeEvidenceAuthority(a,evidence[1],{...body,sourceKey:String(req.headers['idempotency-key']||body.sourceKey||'')||null});await audit(req,a,x.lifecycle?.auditAction||'DISPUTE_EVIDENCE_ADDED','DISPUTE',evidence[1],null,{evidenceId:x.evidence.id},{lifecycle:x.lifecycle||null,idempotentTransition:x.idempotentTransition});return send(res,x.idempotentTransition?200:201,{evidence:x.evidence,idempotent:x.idempotentTransition})
 }
 const decision=url.pathname.match(/^\/api\/disputes\/([^/]+)\/decision$/);if(decision&&req.method==='POST'){
  requireCsrf(req,ctx);if(!canOperate(a))return send(res,403,{error:'Operator permission required',code:'FORBIDDEN'});const body=await readBody(req),status=String(body.status||'').toUpperCase(),isRefund=['FULL_REFUND','PARTIAL_REFUND'].includes(status);if(isRefund&&!PREVIEW)return send(res,503,{error:'Refund execution requires a connected PSP adapter',code:'PAYMENT_PROVIDER_ACTION_REQUIRED'});
  const sourceKey=String(req.headers['idempotency-key']||body.sourceKey||`decision:${status}`),result=await decideDisputeAuthority(a,decision[1],{status,reason:String(body.reason||''),refundAmountMinor:Number(body.refundAmountMinor||0),sourceKey,effect:isRefund?async current=>{
    const paid=await paidContext(a,current);if(!paid?.amountMinor)throw Object.assign(new Error('Paid amount is unavailable'),{status:409});let amount=status==='FULL_REFUND'?paid.amountMinor:assertMinorAmount(body.refundAmountMinor,{allowZero:false,name:'refundAmountMinor'});if(status==='PARTIAL_REFUND'&&amount>=paid.amountMinor)throw Object.assign(new Error('Partial refund must be greater than zero and less than the paid amount'),{status:400});const provider=paid.provider==='NOT_CONFIGURED'?'INTERNAL_PREVIEW':paid.provider,tx=await postLedgerTransaction({transactionType:status,externalReference:`dispute-${current.id}`,idempotencyKey:`refund:dispute:${current.id}:${status}`,entries:refundEntries({sellerId:paid.sellerId,amountMinor:amount,currency:paid.currency,provider}),metadata:{disputeId:current.id,preview:PREVIEW,provider}}),reversedPayoutIds=await reversePayouts(current,paid);return{refundEffectRecorded:Boolean(tx?.id),refund:{ledgerTransactionId:tx.id,amountMinor:amount,currency:paid.currency,idempotent:Boolean(tx.idempotent),reversedPayoutIds}}
  }:null});await audit(req,a,result.lifecycle.auditAction,'DISPUTE',decision[1],null,{status:result.dispute.status,refund:result.refund},{lifecycle:result.lifecycle,idempotentTransition:result.idempotentTransition});return send(res,200,{dispute:result.dispute,refund:result.refund,idempotent:result.idempotentTransition})
 }
 return false
}
