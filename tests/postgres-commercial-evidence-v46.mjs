import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {db} from '../runtime-v09.mjs';
import {recordCommercialEvent,operatorCommercialSummary,commercialEvidenceCapabilities} from '../commercial-evidence-v46.mjs';

if(!process.env.DATABASE_URL){console.log('ANTIQUA v46 PostgreSQL Commercial Evidence: skipped (DATABASE_URL not set)');process.exit(0)}
assert.equal(db.kind,'POSTGRES');

const operator=await db.findAccountByEmail('operator@demo.antiqua');
const seller=await db.findAccountByEmail('seller@demo.antiqua');
assert.ok(operator?.id);assert.ok(seller?.sellerId);

const token=crypto.randomUUID().replaceAll('-','').slice(0,12),pilotId='pilot-v46-'+token;
const start=new Date(Date.now()-7*86400000).toISOString(),end=new Date(Date.now()+23*86400000).toISOString();
try{
 await db.pool.query(`INSERT INTO dealer_pilot_engagements(id,seller_id,name,status,starts_at,ends_at,inventory_scope,kpi_contract,created_by_account_id)
 VALUES($1,$2,$3,'ACTIVE',$4,$5,'[]'::jsonb,'[]'::jsonb,$6)`,[pilotId,seller.sellerId,'v46 commercial proof',start,end,operator.id]);

 const quote=await recordCommercialEvent(operator,pilotId,{eventType:'QUOTE_ISSUED',revenueStream:'PROFESSIONAL_SAAS',amountMinor:100000,currency:'EUR',clientActionId:'q1'});
 assert.equal(quote.eventType,'QUOTE_ISSUED');

 const accepted=await recordCommercialEvent(operator,pilotId,{eventType:'PRICE_WRITTEN_ACCEPTED',revenueStream:'PROFESSIONAL_SAAS',amountMinor:90000,currency:'EUR',evidenceRef:'proposal:v46',clientActionId:'a1'});
 assert.equal(accepted.amountMinor,90000);

 await recordCommercialEvent(operator,pilotId,{eventType:'INVOICE_ISSUED',revenueStream:'PROFESSIONAL_SAAS',amountMinor:90000,currency:'EUR',evidenceRef:'invoice:v46',clientActionId:'i1'});
 let summary=await operatorCommercialSummary(operator,pilotId);
 assert.deepEqual(summary.summary.cashReceivedMinorByCurrency,{});
 assert.equal(summary.summary.evidenceLevel,'INVOICED');

 const payment=await recordCommercialEvent(operator,pilotId,{eventType:'PAYMENT_RECEIVED',revenueStream:'PROFESSIONAL_SAAS',amountMinor:90000,currency:'EUR',evidenceRef:'bank:v46',clientActionId:'p1'});
 await recordCommercialEvent(operator,pilotId,{eventType:'DIRECT_COST_RECORDED',revenueStream:'PROFESSIONAL_SAAS',amountMinor:20000,currency:'EUR',clientActionId:'c1'});
 await recordCommercialEvent(operator,pilotId,{eventType:'REFUND_RECORDED',revenueStream:'PROFESSIONAL_SAAS',amountMinor:5000,currency:'EUR',evidenceRef:'refund:v46',clientActionId:'r1'});
 summary=await operatorCommercialSummary(operator,pilotId);
 assert.equal(summary.summary.cashReceivedMinorByCurrency.EUR,90000);
 assert.equal(summary.summary.grossContributionMinorByCurrency.EUR,65000);
 assert.equal(summary.summary.pricingEvidence.realizedPriceRatio,0.9);
 assert.equal(summary.summary.pricingEvidence.confidence,'MEDIUM');

 const replay=await recordCommercialEvent(operator,pilotId,{eventType:'PAYMENT_RECEIVED',revenueStream:'PROFESSIONAL_SAAS',amountMinor:90000,currency:'EUR',evidenceRef:'bank:v46',clientActionId:'p1'});
 assert.equal(replay.id,payment.id);

 await assert.rejects(
  ()=>recordCommercialEvent(operator,pilotId,{eventType:'PAYMENT_RECEIVED',revenueStream:'PROFESSIONAL_SAAS',amountMinor:91000,currency:'EUR',evidenceRef:'bank:v46-different',clientActionId:'p1'}),
  e=>e?.code==='IDEMPOTENCY_CONFLICT'&&e?.status===409
 );

 await assert.rejects(
  ()=>recordCommercialEvent(operator,pilotId,{eventType:'COMMERCIAL_EVENT_VOIDED',payload:{voidsEventId:'not-in-pilot'},clientActionId:'void-bad'}),
  e=>e?.code==='VOID_TARGET_NOT_FOUND'&&e?.status===404
 );

 await recordCommercialEvent(operator,pilotId,{eventType:'COMMERCIAL_EVENT_VOIDED',payload:{voidsEventId:payment.id},clientActionId:'void-payment'});
 summary=await operatorCommercialSummary(operator,pilotId);
 assert.deepEqual(summary.summary.cashReceivedMinorByCurrency,{});
 assert.equal(summary.summary.grossContributionMinorByCurrency.EUR,-25000);

 const caps=commercialEvidenceCapabilities();
 assert.equal(caps.accountingBoundary.invoiceIsCash,false);
 assert.equal(caps.accountingBoundary.paymentReceivedIsCash,true);
 console.log('ANTIQUA v46 PostgreSQL Commercial Evidence: idempotency, cash boundary, void and contribution passed');
}finally{
 await db.pool.query('DELETE FROM dealer_pilot_commercial_events WHERE pilot_id=$1',[pilotId]).catch(()=>{});
 await db.pool.query('DELETE FROM dealer_pilot_engagements WHERE id=$1',[pilotId]).catch(()=>{});
 await db.pool.end();
}
