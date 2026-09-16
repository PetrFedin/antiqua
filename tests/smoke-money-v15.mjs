import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.PREVIEW_MODE='true';
process.env.APP_SECRET=process.env.APP_SECRET||crypto.randomBytes(32).toString('hex');
process.env.NODE_ENV='test';

const money=await import('../money-v15.mjs');
const finance=await import('../finance-v10.mjs');

assert.equal(money.normalizeCurrency(' eur '),'EUR');
assert.equal(money.currencyExponent('EUR'),2);
assert.equal(money.currencyExponent('JPY'),0);
assert.equal(money.currencyExponent('KWD'),3);
assert.equal(money.majorToMinor('7800','EUR'),780000);
assert.equal(money.majorToMinor('12.34','EUR'),1234);
assert.equal(money.majorToMinor('1200','JPY'),1200);
assert.equal(money.majorToMinor('1.234','KWD'),1234);
assert.equal(money.minorToMajorString(780000,'EUR'),'7800.00');
assert.deepEqual(money.moneyFromMinor(1234,'eur'),{amountMinor:1234,currency:'EUR'});
assert.throws(()=>money.majorToMinor('12.345','EUR'),e=>e.code==='INVALID_MONEY_PRECISION');
assert.throws(()=>money.majorToMinor('-1','EUR'),e=>e.code==='INVALID_MONEY_AMOUNT');
assert.throws(()=>money.assertMinorAmount(100.5),e=>e.code==='INVALID_MONEY_AMOUNT');
assert.throws(()=>money.assertMinorAmount(Number.MAX_SAFE_INTEGER+1),e=>e.code==='INVALID_MONEY_AMOUNT');
assert.throws(()=>money.normalizeCurrency('EURO'),e=>e.code==='INVALID_CURRENCY');

const amountMinor=money.majorToMinor('7800','EUR');
const tx=await finance.postLedgerTransaction({transactionType:'MONEY_CONTRACT_TEST',externalReference:'money-v15',entries:[
  {ownerType:'PAYMENT_PROVIDER',ownerId:'test-provider',currency:'eur',accountType:'ASSET',name:'CLEARING',side:'debit',amountMinor},
  {ownerType:'SELLER',ownerId:'test-seller',currency:'EUR',accountType:'LIABILITY',name:'SELLER_PAYABLE_HOLD',side:'CREDIT',amountMinor}
]});
assert.equal(tx.amountMinor,780000);
assert.equal(tx.currency,'EUR');

const payout=await finance.createPayoutHold({orderId:'money-test-order',sellerId:'test-seller',amountMinor,currency:'eur'});
assert.equal(payout.amountMinor,780000);
assert.equal(payout.currency,'EUR');

await assert.rejects(()=>finance.postLedgerTransaction({transactionType:'INVALID_FRACTIONAL_MINOR',entries:[
  {ownerType:'A',ownerId:'a',currency:'EUR',accountType:'ASSET',name:'A',side:'DEBIT',amountMinor:100.5},
  {ownerType:'B',ownerId:'b',currency:'EUR',accountType:'LIABILITY',name:'B',side:'CREDIT',amountMinor:100.5}
]}),e=>e.code==='INVALID_MONEY_AMOUNT');

await assert.rejects(()=>finance.postLedgerTransaction({transactionType:'INVALID_MIXED_CURRENCY',entries:[
  {ownerType:'A',ownerId:'a',currency:'EUR',accountType:'ASSET',name:'A',side:'DEBIT',amountMinor:100},
  {ownerType:'B',ownerId:'b',currency:'USD',accountType:'LIABILITY',name:'B',side:'CREDIT',amountMinor:100}
]}),/cannot mix currencies/);

console.log('ANTIQUA 0.15 money smoke: canonical minor units + precision + ledger/payout validation passed');
