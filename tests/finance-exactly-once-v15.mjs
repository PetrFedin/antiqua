import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {postLedgerTransaction,createPayoutHold} from '../finance-v10.mjs';
import {claimProviderEvent,markProviderEventFailed,markProviderEventProcessed} from '../provider-events-v15.mjs';

const token=crypto.randomUUID();
const entries=amount=>[
  {ownerType:'PAYMENT_PROVIDER',ownerId:'TEST_PSP',currency:'EUR',accountType:'ASSET',name:'CLEARING',side:'DEBIT',amountMinor:amount},
  {ownerType:'SELLER',ownerId:'seller-test',currency:'EUR',accountType:'LIABILITY',name:'SELLER_PAYABLE_HOLD',side:'CREDIT',amountMinor:amount}
];

const tx1=await postLedgerTransaction({transactionType:'PAYMENT_CAPTURE',externalReference:`charge-${token}`,idempotencyKey:`test-ledger-${token}`,entries:entries(12500),metadata:{provider:'TEST_PSP'}});
const tx2=await postLedgerTransaction({transactionType:'PAYMENT_CAPTURE',externalReference:`charge-${token}`,idempotencyKey:`test-ledger-${token}`,entries:entries(12500),metadata:{provider:'TEST_PSP'}});
assert.equal(tx1.id,tx2.id);assert.equal(tx1.idempotent,false);assert.equal(tx2.idempotent,true);
await assert.rejects(()=>postLedgerTransaction({transactionType:'PAYMENT_CAPTURE',externalReference:`charge-${token}`,idempotencyKey:`test-ledger-${token}`,entries:entries(12600),metadata:{provider:'TEST_PSP'}}),e=>e.code==='IDEMPOTENCY_CONFLICT');

const payout1=await createPayoutHold({sellerId:'seller-test',amountMinor:12500,currency:'EUR',sourceType:'ORDER',sourceId:`order-${token}`,idempotencyKey:`test-payout-${token}`});
const payout2=await createPayoutHold({sellerId:'seller-test',amountMinor:12500,currency:'EUR',sourceType:'ORDER',sourceId:`order-${token}`,idempotencyKey:`test-payout-${token}`});
assert.equal(payout1.id,payout2.id);assert.equal(payout1.idempotent,false);assert.equal(payout2.idempotent,true);
await assert.rejects(()=>createPayoutHold({sellerId:'seller-test',amountMinor:13000,currency:'EUR',sourceType:'ORDER',sourceId:`order-${token}`,idempotencyKey:`test-payout-${token}`}),e=>e.code==='IDEMPOTENCY_CONFLICT');

let event=await claimProviderEvent({providerType:'PAYMENT',provider:'TEST_PSP',externalEventId:`event-${token}`,eventType:'CAPTURED',entityType:'ORDER',entityId:`order-${token}`,payload:{amountMinor:12500}});
assert.equal(event.claimed,true);assert.equal(event.processed,false);assert.equal(event.idempotent,false);
await markProviderEventFailed('TEST_PSP',`event-${token}`,new Error('synthetic crash before business completion'));
event=await claimProviderEvent({providerType:'PAYMENT',provider:'TEST_PSP',externalEventId:`event-${token}`,eventType:'CAPTURED',entityType:'ORDER',entityId:`order-${token}`,payload:{amountMinor:12500}});
assert.equal(event.claimed,true);assert.equal(event.processed,false);assert.equal(event.idempotent,true);assert.equal(event.recovered,true);
await markProviderEventProcessed('TEST_PSP',`event-${token}`);
event=await claimProviderEvent({providerType:'PAYMENT',provider:'TEST_PSP',externalEventId:`event-${token}`,eventType:'CAPTURED',entityType:'ORDER',entityId:`order-${token}`,payload:{amountMinor:12500}});
assert.equal(event.claimed,false);assert.equal(event.processed,true);assert.equal(event.idempotent,true);

console.log('ANTIQUA 0.15 exactly-once: ledger + payout idempotency conflicts + provider event recovery passed');
