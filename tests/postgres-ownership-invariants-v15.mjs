import assert from 'node:assert/strict';
import crypto from 'node:crypto';

if(!process.env.DATABASE_URL){console.log('ANTIQUA 0.15 PostgreSQL ownership invariants: skipped (DATABASE_URL not set)');process.exit(0)}

const {db}=await import('../runtime-v09.mjs');
const {recordOwnershipTransfer,currentOwnership,publicOwnershipHistory}=await import('../ownership-v14.mjs');
const token=crypto.randomUUID(),objectId='lot-112';

try{
  assert.equal(db.kind,'POSTGRES');
  await db.pool.query('DELETE FROM object_ownership WHERE object_id=$1',[objectId]);
  await db.pool.query('DELETE FROM ownership_events WHERE object_id=$1',[objectId]);

  const owners=[];
  for(let i=0;i<12;i++){
    const id=`own-test-${token}-${i}`;owners.push(id);
    await db.pool.query(`INSERT INTO accounts(id,email,display_name,password_hash,account_type,status,twofa_status,created_at)
      VALUES($1,$2,$3,'ownership-test','BUYER','ACTIVE','DISABLED',now()) ON CONFLICT(id) DO NOTHING`,[id,`${id}@example.test`,`Ownership contender ${i+1}`]);
  }

  const requests=owners.map((newOwnerAccountId,i)=>({objectId,newOwnerAccountId,sourceType:'IMPORT',sourceId:`ownership-source-${token}-${i}`,eventType:'TRANSFERRED',publicNote:{en:`Synthetic transfer ${i+1}`},idempotencyKey:`ownership-idem-${token}-${i}`}));
  const results=await Promise.all(requests.map(r=>recordOwnershipTransfer(db,r)));
  assert.equal(results.length,12);assert.ok(results.every(x=>x.idempotent===false));

  let events=(await db.pool.query(`SELECT id,sequence_no,previous_owner_account_id,new_owner_account_id,source_type,source_id,idempotency_key
    FROM ownership_events WHERE object_id=$1 ORDER BY sequence_no`,[objectId])).rows;
  assert.equal(events.length,12);
  events.forEach((e,i)=>{assert.equal(Number(e.sequence_no),i+1);if(i===0)assert.equal(e.previous_owner_account_id,null);else assert.equal(e.previous_owner_account_id,events[i-1].new_owner_account_id)});
  let current=(await db.pool.query('SELECT owner_account_id,source_type,source_id FROM object_ownership WHERE object_id=$1',[objectId])).rows[0];assert.equal(current.owner_account_id,events.at(-1).new_owner_account_id);assert.equal(current.source_id,events.at(-1).source_id);

  const original=events[3],originalRequest=requests.find(r=>r.idempotencyKey===original.idempotency_key);assert.ok(originalRequest);
  const replay=await recordOwnershipTransfer(db,originalRequest);assert.equal(replay.id,original.id);assert.equal(replay.idempotent,true);
  let count=Number((await db.pool.query('SELECT count(*)::int AS n FROM ownership_events WHERE object_id=$1',[objectId])).rows[0].n);assert.equal(count,12);
  const afterReplay=(await db.pool.query('SELECT owner_account_id FROM object_ownership WHERE object_id=$1',[objectId])).rows[0].owner_account_id;assert.equal(afterReplay,current.owner_account_id);

  await assert.rejects(()=>recordOwnershipTransfer(db,{...originalRequest,newOwnerAccountId:owners[0]}),e=>e.code==='OWNERSHIP_IDEMPOTENCY_CONFLICT');
  count=Number((await db.pool.query('SELECT count(*)::int AS n FROM ownership_events WHERE object_id=$1',[objectId])).rows[0].n);assert.equal(count,12);

  const sameOwnerNewSource=await recordOwnershipTransfer(db,{objectId,newOwnerAccountId:current.owner_account_id,sourceType:'OTHER',sourceId:`no-change-${token}`,eventType:'TRANSFERRED',idempotencyKey:`no-change-${token}`});assert.equal(sameOwnerNewSource.idempotent,true);assert.equal(sameOwnerNewSource.noOwnershipChange,true);
  count=Number((await db.pool.query('SELECT count(*)::int AS n FROM ownership_events WHERE object_id=$1',[objectId])).rows[0].n);assert.equal(count,12);

  const ownerView=await currentOwnership(db,objectId,current.owner_account_id);assert.equal(ownerView.isRequesterOwner,true);assert.equal(ownerView.ownerAccountId,current.owner_account_id);assert.equal(ownerView.sourceId,current.source_id);
  const otherView=await currentOwnership(db,objectId,owners[0]===current.owner_account_id?owners[1]:owners[0]);assert.equal(otherView.isRequesterOwner,false);assert.equal(otherView.ownerAccountId,null);assert.equal(otherView.sourceId,null);

  const publicHistory=await publicOwnershipHistory(db,objectId);assert.equal(publicHistory.length,12);publicHistory.forEach((e,i)=>{assert.equal(e.sequenceNo,i+1);assert.equal('previousOwnerAccountId' in e,false);assert.equal('newOwnerAccountId' in e,false);assert.equal('sourceId' in e,false)});

  console.log('ANTIQUA 0.15 ownership proof: first-transfer serialization + contiguous chain + replay safety + conflict detection + owner privacy passed');
}finally{
  await db.pool.end();
}
