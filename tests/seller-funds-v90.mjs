import assert from 'node:assert/strict';
import {summarizeSettlementFundsV90,conversationIntensityV90} from '../seller-funds-v90.mjs';

const rows=[
 {id:'unpaid-eur',status:'PAYMENT_DUE',currency:'EUR',winningAmountMinor:990000},
 {id:'processing-eur',status:'PAYMENT_PROCESSING',currency:'EUR',winningAmountMinor:800000},
 {id:'paid-eur',status:'PAID',currency:'EUR',winningAmountMinor:12345},
 {id:'fulfilling-eur',status:'FULFILLMENT',currency:'EUR',winningAmountMinor:5000},
 {id:'done-usd',status:'COMPLETED',currency:'USD',winningAmountMinor:19003},
 {id:'dispute-eur',status:'DISPUTED',currency:'EUR',winningAmountMinor:30000},
 {id:'void-eur',status:'VOID',currency:'EUR',winningAmountMinor:900000},
 {id:'unpaid-final-eur',status:'NONPAYMENT',currency:'EUR',winningAmountMinor:900000},
 {id:'reoffered-eur',status:'REOFFERED',currency:'EUR',winningAmountMinor:900000},
 {id:'paid-eur',status:'PAID',currency:'EUR',winningAmountMinor:12345},
 {id:'broken',status:'PAID',currency:'EUR',winningAmountMinor:-15},
 {id:'without-id',status:'PAID',currency:'EUR',winningAmountMinor:100,id:null}
];
const before=structuredClone(rows);
const a=summarizeSettlementFundsV90(rows);
assert.equal(a.schemaVersion,'antiqua-gross-auction-payments-v1');
assert.deepEqual(a.grossPaidByCurrency,{EUR:17345,USD:19003});
assert.deepEqual(a.contestedByCurrency,{EUR:30000});
assert.equal(a.paidCount,3);
assert.equal(a.contestedCount,1);
assert.equal(a.awaitingCount,2);
assert.equal(a.unpaidFinalCount,3);
assert.equal(a.invalidCount,3);
assert.equal(a.boundaries.notBankReconciled,true);
assert.equal(a.boundaries.notPayoutConfirmation,true);
assert.equal(a.boundaries.disputesExcludedFromPaid,true);
assert.equal(a.boundaries.crossCurrencySummation,false);
assert.deepEqual(rows,before);
assert.deepEqual(summarizeSettlementFundsV90([]).grossPaidByCurrency,{});
assert.throws(()=>summarizeSettlementFundsV90({data:rows}),TypeError);
assert.throws(()=>summarizeSettlementFundsV90([
 {id:'A',status:'PAID',currency:'EUR',winningAmountMinor:Number.MAX_SAFE_INTEGER},
 {id:'B',status:'PAID',currency:'EUR',winningAmountMinor:1}
]),RangeError,'unsafe currency sum must fail');
assert.equal(conversationIntensityV90({threads:2,viewSessions:8}),25);
assert.equal(conversationIntensityV90({threads:3,viewSessions:7}),42.9);
assert.equal(conversationIntensityV90({threads:5,viewSessions:2}),250,
 'activity intensity may exceed 100 and is NOT conversion rate');
assert.equal(conversationIntensityV90({threads:0,viewSessions:0}),null);
assert.equal(conversationIntensityV90({threads:-1,viewSessions:2}),null);
assert.equal(conversationIntensityV90({threads:2,viewSessions:Infinity}),null);
console.log('ANTIQUA v90 seller funds — no nominal unpaid/disputed leakage, no FX blending, safe arithmetic and honest activity denominator PASS');
