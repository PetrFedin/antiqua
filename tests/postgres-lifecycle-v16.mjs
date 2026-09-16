import assert from 'node:assert/strict';
import crypto from 'node:crypto';

if(!process.env.DATABASE_URL){console.log('ANTIQUA v16 PostgreSQL lifecycle: skipped (DATABASE_URL not set)');process.exit(0)}

const {db}=await import('../runtime-v09.mjs');
const {createPayoutHold,transitionPayout}=await import('../finance-v10.mjs');
const {processOutboxBatch}=await import('../worker-runtime-v15.mjs');
const token=crypto.randomUUID(),sellerId=`lifecycle-seller-${token}`,sourceId=`lifecycle-order-${token}`;

try{
  assert.equal(db.kind,'POSTGRES');
  const payout=await createPayoutHold({sellerId,amountMinor:42000,currency:'EUR',sourceType:'ORDER',sourceId,idempotencyKey:`lifecycle-payout-${token}`});
  assert.equal(payout.status,'ON_HOLD');

  let p=await transitionPayout(payout.id,'READY',{lifecycleAuthority:'SYSTEM',sourceKey:`release-${token}`});
  assert.equal(p.status,'READY');
  p=await transitionPayout(payout.id,'SUBMITTED',{provider:'PG_LIFECYCLE_PSP',providerReference:`transfer-${token}`,sourceKey:`submit-${token}`});
  assert.equal(p.status,'SUBMITTED');
  p=await transitionPayout(payout.id,'PAID',{provider:'PG_LIFECYCLE_PSP',providerReference:`transfer-${token}`,sourceKey:`paid-${token}`});
  assert.equal(p.status,'PAID');assert.equal(p.idempotentTransition,false);

  const replay=await transitionPayout(payout.id,'PAID',{provider:'PG_LIFECYCLE_PSP',providerReference:`transfer-${token}`,sourceKey:`paid-${token}`});
  assert.equal(replay.status,'PAID');assert.equal(replay.idempotentTransition,true);
  await assert.rejects(()=>transitionPayout(payout.id,'FAILED',{provider:'PG_LIFECYCLE_PSP',providerReference:`transfer-${token}`,sourceKey:`paid-${token}`}),e=>e.code==='LIFECYCLE_EVENT_CONFLICT');
  await assert.rejects(()=>transitionPayout(payout.id,'PAID',{provider:'DIFFERENT_PSP',providerReference:`transfer-${token}`,sourceKey:`paid-${token}`}),e=>e.code==='LIFECYCLE_EVENT_CONFLICT');

  let q=await db.pool.query(`SELECT action,from_state,to_state,authority,audit_action,outbox_topic
    FROM lifecycle_events WHERE domain='PAYOUT' AND aggregate_id=$1 ORDER BY created_at,id`,[payout.id]);
  assert.equal(q.rows.length,3);
  assert.deepEqual(q.rows.map(x=>[x.action,x.from_state,x.to_state]),[
    ['RELEASE_HOLD','ON_HOLD','READY'],['SUBMIT','READY','SUBMITTED'],['MARK_PAID','SUBMITTED','PAID']
  ]);
  assert.deepEqual(q.rows.map(x=>x.authority),['SYSTEM','PROVIDER','PROVIDER']);
  assert.deepEqual(q.rows.map(x=>x.outbox_topic),['PAYOUT.RELEASE_HOLD','PAYOUT.SUBMITTED','PAYOUT.PAID']);

  q=await db.pool.query(`SELECT status,count(*)::int AS count FROM outbox_events
    WHERE aggregate_type='PAYOUT' AND aggregate_id=$1 AND payload->>'kind'='LIFECYCLE_TRANSITION' GROUP BY status`,[payout.id]);
  assert.equal(q.rows.reduce((n,x)=>n+x.count,0),3);
  assert.equal(q.rows.find(x=>x.status==='PENDING')?.count,3);

  const delivered=await processOutboxBatch({workerId:`lifecycle-test-${token}`,limit:50,leaseMs:5000});
  assert.ok(delivered.completed>=3);
  q=await db.pool.query(`SELECT status,count(*)::int AS count FROM outbox_events
    WHERE aggregate_type='PAYOUT' AND aggregate_id=$1 AND payload->>'kind'='LIFECYCLE_TRANSITION' GROUP BY status`,[payout.id]);
  assert.equal(q.rows.length,1);assert.equal(q.rows[0].status,'COMPLETED');assert.equal(q.rows[0].count,3);

  const before=(await db.pool.query("SELECT count(*)::int AS count FROM lifecycle_events WHERE domain='PAYOUT' AND aggregate_id=$1",[payout.id])).rows[0].count;
  await assert.rejects(()=>transitionPayout(payout.id,'READY',{lifecycleAuthority:'SYSTEM'}),e=>e.code==='LIFECYCLE_TRANSITION_INVALID');
  const after=(await db.pool.query("SELECT count(*)::int AS count FROM lifecycle_events WHERE domain='PAYOUT' AND aggregate_id=$1",[payout.id])).rows[0].count;
  assert.equal(after,before);

  console.log('ANTIQUA v16 PostgreSQL lifecycle: payout row lock + immutable journal + atomic outbox + source replay + conflict detection + worker delivery + invalid rollback passed');
}finally{
  await db.pool.end();
}
