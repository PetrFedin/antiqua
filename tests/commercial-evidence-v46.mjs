import assert from 'node:assert/strict';
import {commercialEvidenceCapabilities,summarizeCommercialEvents} from '../commercial-evidence-v46.mjs';

const caps=commercialEvidenceCapabilities();
assert.equal(caps.contractVersion,'v46');
assert.equal(caps.appendOnly,true);
assert.equal(caps.operatorControlledWrites,true);
assert.equal(caps.accountingBoundary.quoteIsRevenue,false);
assert.equal(caps.accountingBoundary.writtenAcceptanceIsRevenue,false);
assert.equal(caps.accountingBoundary.invoiceIsCash,false);
assert.equal(caps.accountingBoundary.paymentReceivedIsCash,true);

const ev=(eventType,amountMinor,currency='EUR',extra={})=>({id:eventType+'-'+Math.random(),eventType,amountMinor,currency,revenueStream:'PROFESSIONAL_SAAS',occurredAt:new Date().toISOString(),...extra});

const quoteOnly=summarizeCommercialEvents([ev('QUOTE_ISSUED',100000)]);
assert.equal(quoteOnly.evidenceLevel,'INTERNAL_HYPOTHESIS');
assert.deepEqual(quoteOnly.cashReceivedMinorByCurrency,{});
assert.deepEqual(quoteOnly.grossContributionMinorByCurrency,{});
assert.equal(quoteOnly.pricingEvidence.confidence,'UNPROVEN');

const accepted=summarizeCommercialEvents([
 ev('QUOTE_ISSUED',100000),
 ev('PRICE_WRITTEN_ACCEPTED',90000)
]);
assert.equal(accepted.evidenceLevel,'WRITTEN_ACCEPTANCE');
assert.deepEqual(accepted.cashReceivedMinorByCurrency,{});
assert.equal(accepted.pricingEvidence.realizedPriceRatio,0.9);
assert.equal(accepted.pricingEvidence.discountRate,0.1);
assert.equal(accepted.pricingEvidence.confidence,'LOW');

const invoiced=summarizeCommercialEvents([
 ev('QUOTE_ISSUED',100000),
 ev('PRICE_WRITTEN_ACCEPTED',90000),
 ev('INVOICE_ISSUED',90000)
]);
assert.equal(invoiced.evidenceLevel,'INVOICED');
assert.deepEqual(invoiced.cashReceivedMinorByCurrency,{});

const paid=summarizeCommercialEvents([
 ev('QUOTE_ISSUED',100000),
 ev('PRICE_WRITTEN_ACCEPTED',90000),
 ev('INVOICE_ISSUED',90000),
 ev('PAYMENT_RECEIVED',90000),
 ev('DIRECT_COST_RECORDED',25000),
 ev('REFUND_RECORDED',5000)
]);
assert.equal(paid.evidenceLevel,'VERIFIED_CASH');
assert.equal(paid.cashReceivedMinorByCurrency.EUR,90000);
assert.equal(paid.refundsMinorByCurrency.EUR,5000);
assert.equal(paid.directCostMinorByCurrency.EUR,25000);
assert.equal(paid.grossContributionMinorByCurrency.EUR,60000);
assert.equal(paid.pricingEvidence.confidence,'MEDIUM');

const renewed=summarizeCommercialEvents([
 ...[
  ev('QUOTE_ISSUED',100000),
  ev('PRICE_WRITTEN_ACCEPTED',90000),
  ev('PAYMENT_RECEIVED',90000)
 ],
 ev('RENEWAL_ACCEPTED',95000)
]);
assert.equal(renewed.evidenceLevel,'RENEWAL');
assert.equal(renewed.renewalAccepted,true);
assert.equal(renewed.pricingEvidence.confidence,'HIGH');

const voidTarget=ev('PAYMENT_RECEIVED',90000);
const voided=summarizeCommercialEvents([
 voidTarget,
 {id:'void-1',eventType:'COMMERCIAL_EVENT_VOIDED',amountMinor:null,currency:null,payload:{voidsEventId:voidTarget.id},occurredAt:new Date().toISOString()}
]);
assert.deepEqual(voided.cashReceivedMinorByCurrency,{});

console.log('ANTIQUA v46 Commercial Evidence Authority contract passed');
