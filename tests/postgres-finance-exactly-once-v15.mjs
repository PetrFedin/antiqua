import assert from 'node:assert/strict';
import crypto from 'node:crypto';

if(!process.env.DATABASE_URL){console.log('ANTIQUA 0.15 PostgreSQL finance exactly-once: skipped (DATABASE_URL not set)');process.exit(0)}

const {db}=await import('../runtime-v09.mjs');
const {postLedgerTransaction,createPayoutHold}=await import('../finance-v10.mjs');
const {claimProviderEvent,markProviderEventFailed,markProviderEventProcessed}=await import('../provider-events-v15.mjs');
const token=crypto.randomUUID();
const entries=amount=>[
  {ownerType:'PAYMENT_PROVIDER',ownerId:'PG_TEST_PSP',currency:'EUR',accountType:'ASSET',name:'CLEARING',side:'DEBIT',amountMinor:amount},
  {ownerType:'SELLER',ownerId:'pg-seller-test',currency:'EUR',accountType:'LIABILITY',name:'SELLER_PAYABLE_HOLD',side:'CREDIT',amountMinor:amount}
];

try{
  assert.equal(db.kind,'POSTGRES');
  const ledgerKey=`pg-ledger-${token}`;
  const tx1=await postLedgerTransaction({transactionType:'PAYMENT_CAPTURE',externalReference:`pg-charge-${token}`,idempotencyKey:ledgerKey,entries:entries(25000),metadata:{provider:'PG_TEST_PSP'}});
  const tx2=await postLedgerTransaction({transactionType:'PAYMENT_CAPTURE',externalReference:`pg-charge-${token}`,idempotencyKey:ledgerKey,entries:entries(25000),metadata:{provider:'PG_TEST_PSP'}});
  assert.equal(tx1.id,tx2.id);assert.equal(tx2.idempotent,true);
  let q=await db.pool.query('SELECT count(*)::int AS count FROM ledger_transactions WHERE idempotency_key=$1',[ledgerKey]);assert.equal(q.rows[0].count,1);
  q=await db.pool.query('SELECT count(*)::int AS count FROM ledger_entries WHERE transaction_id=$1',[tx1.id]);assert.equal(q.rows[0].count,2);
  await assert.rejects(()=>postLedgerTransaction({transactionType:'PAYMENT_CAPTURE',externalReference:`pg-charge-${token}`,idempotencyKey:ledgerKey,entries:entries(26000),metadata:{provider:'PG_TEST_PSP'}}),e=>e.code==='IDEMPOTENCY_CONFLICT');

  const payoutKey=`pg-payout-${token}`,sourceId=`pg-order-${token}`;
  const payout1=await createPayoutHold({sellerId:'pg-seller-test',amountMinor:25000,currency:'EUR',sourceType:'ORDER',sourceId,idempotencyKey:payoutKey});
  const payout2=await createPayoutHold({sellerId:'pg-seller-test',amountMinor:25000,currency:'EUR',sourceType:'ORDER',sourceId,idempotencyKey:payoutKey});
  assert.equal(payout1.id,payout2.id);assert.equal(payout2.idempotent,true);
  q=await db.pool.query('SELECT count(*)::int AS count FROM payouts WHERE idempotency_key=$1',[payoutKey]);assert.equal(q.rows[0].count,1);
  await assert.rejects(()=>createPayoutHold({sellerId:'pg-seller-test',amountMinor:26000,currency:'EUR',sourceType:'ORDER',sourceId,idempotencyKey:payoutKey}),e=>e.code==='IDEMPOTENCY_CONFLICT');

  const eventId=`pg-event-${token}`;
  let ev=await claimProviderEvent({providerType:'PAYMENT',provider:'PG_TEST_PSP',externalEventId:eventId,eventType:'CAPTURED',entityType:'ORDER',entityId:sourceId,payload:{amountMinor:25000}});
  assert.equal(ev.claimed,true);assert.equal(ev.event.attemptCount,1);
  await markProviderEventFailed('PG_TEST_PSP',eventId,new Error('synthetic failure'));
  ev=await claimProviderEvent({providerType:'PAYMENT',provider:'PG_TEST_PSP',externalEventId:eventId,eventType:'CAPTURED',entityType:'ORDER',entityId:sourceId,payload:{amountMinor:25000}});
  assert.equal(ev.claimed,true);assert.equal(ev.recovered,true);assert.equal(ev.event.attemptCount,2);
  await markProviderEventProcessed('PG_TEST_PSP',eventId);
  ev=await claimProviderEvent({providerType:'PAYMENT',provider:'PG_TEST_PSP',externalEventId:eventId,eventType:'CAPTURED',entityType:'ORDER',entityId:sourceId,payload:{amountMinor:25000}});
  assert.equal(ev.processed,true);assert.equal(ev.claimed,false);
  q=await db.pool.query('SELECT count(*)::int AS count, max(attempt_count)::int AS attempts FROM provider_events WHERE provider=$1 AND external_event_id=$2',['PG_TEST_PSP',eventId]);assert.equal(q.rows[0].count,1);assert.equal(q.rows[0].attempts,2);

  console.log('ANTIQUA 0.15 PostgreSQL exactly-once: unique ledger + payout effects + recoverable provider claims passed');
}finally{
  await db.pool.end();
}
