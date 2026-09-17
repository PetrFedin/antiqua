import assert from 'node:assert/strict';
import crypto from 'node:crypto';

if(!process.env.DATABASE_URL){console.log('ANTIQUA v16 media lifecycle: skipped (DATABASE_URL not set)');process.exit(0)}

const {db}=await import('../runtime-v09.mjs');
const {beginMediaVerification,markMediaReady,rejectMediaVerification}=await import('../media-lifecycle-v16.mjs');
const {processOutboxBatch}=await import('../worker-runtime-v15.mjs');
const token=crypto.randomUUID();

try{
 assert.equal(db.kind,'POSTGRES');const seller=await db.findAccountByEmail('seller@demo.antiqua');assert.ok(seller?.sellerId);
 const draftId=`draft-media-life-${token}`,draft={id:draftId,sellerId:seller.sellerId,status:'DRAFT',saleRoute:'SHOP',title:{en:'Media lifecycle',ru:'Media lifecycle'},category:{en:'Decorative Arts',ru:'Декоративное искусство'},media:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};await db.pool.query('INSERT INTO seller_drafts(id,seller_id,status,payload,created_at,updated_at) VALUES($1,$2,$3,$4,now(),now())',[draftId,seller.sellerId,draft.status,draft]);
 const mediaId=`media-life-${token}`,sha='a'.repeat(64);await db.pool.query(`INSERT INTO media_assets(id,entity_type,entity_id,storage_key,content_type,bytes,sha256,role,visibility,status,created_at) VALUES($1,'DRAFT',$2,$3,'image/jpeg',12,$4,'HERO','PRIVATE','UPLOADING',now())`,[mediaId,draftId,`media/${token}/hero.jpg`,sha]);
 let x=await beginMediaVerification(seller,mediaId,{sourceKey:`${token}:begin`});assert.equal(x.asset.status,'VERIFYING');assert.equal(x.lifecycle.action,'BEGIN_VERIFY');
 x=await markMediaReady(mediaId,{bytes:12,contentType:'image/jpeg',sha256:sha,etag:'etag-proof',uploadedAt:new Date().toISOString()},{sourceKey:`${token}:ready`});assert.equal(x.asset.status,'READY');assert.equal(x.lifecycle.action,'MARK_READY');
 const linked=(await db.pool.query('SELECT payload FROM seller_drafts WHERE id=$1',[draftId])).rows[0].payload.media;assert.equal(linked.length,1);assert.equal(linked[0].id,mediaId);assert.equal(linked[0].status,'READY');
 const replayBegin=await beginMediaVerification(seller,mediaId,{sourceKey:`${token}:begin`});assert.equal(replayBegin.idempotentTransition,true);assert.equal(replayBegin.asset.status,'READY');const replayReady=await markMediaReady(mediaId,{bytes:12,contentType:'image/jpeg',sha256:sha},{sourceKey:`${token}:ready`});assert.equal(replayReady.idempotentTransition,true);assert.equal((await db.pool.query('SELECT payload FROM seller_drafts WHERE id=$1',[draftId])).rows[0].payload.media.length,1);
 await assert.rejects(()=>rejectMediaVerification(mediaId,new Error('late rejection'),{sourceKey:`${token}:late-reject`}),e=>e.code==='LIFECYCLE_TRANSITION_INVALID');
 let events=(await db.pool.query("SELECT action,from_state,to_state,authority FROM lifecycle_events WHERE domain='MEDIA' AND aggregate_id=$1 ORDER BY created_at,id",[mediaId])).rows;assert.deepEqual(events.map(e=>[e.action,e.from_state,e.to_state,e.authority]),[['BEGIN_VERIFY','UPLOADING','VERIFYING','SELLER'],['MARK_READY','VERIFYING','READY','SYSTEM']]);

 const rejectId=`media-reject-${token}`;await db.pool.query(`INSERT INTO media_assets(id,entity_type,entity_id,storage_key,content_type,bytes,sha256,role,visibility,status,created_at) VALUES($1,'DRAFT',$2,$3,'image/jpeg',9,NULL,'DETAIL','PRIVATE','UPLOADING',now())`,[rejectId,draftId,`media/${token}/reject.jpg`]);await beginMediaVerification(seller,rejectId,{sourceKey:`${token}:reject-begin`});const rejected=await rejectMediaVerification(rejectId,Object.assign(new Error('hash mismatch'),{code:'MEDIA_HASH_MISMATCH'}),{sourceKey:`${token}:reject`});assert.equal(rejected.asset.status,'REJECTED');const rejectReplay=await rejectMediaVerification(rejectId,new Error('again'),{sourceKey:`${token}:reject`});assert.equal(rejectReplay.idempotentTransition,true);assert.equal((await db.pool.query('SELECT status FROM media_assets WHERE id=$1',[rejectId])).rows[0].status,'REJECTED');events=(await db.pool.query("SELECT action,from_state,to_state FROM lifecycle_events WHERE domain='MEDIA' AND aggregate_id=$1 ORDER BY created_at,id",[rejectId])).rows;assert.deepEqual(events.map(e=>[e.action,e.from_state,e.to_state]),[['BEGIN_VERIFY','UPLOADING','VERIFYING'],['REJECT','VERIFYING','REJECTED']]);

 let pending=Number((await db.pool.query("SELECT count(*)::int AS n FROM outbox_events WHERE aggregate_id=ANY($1::text[]) AND status='PENDING' AND payload->>'kind'='LIFECYCLE_TRANSITION'",[[mediaId,rejectId]])).rows[0].n);assert.equal(pending,4);for(let i=0;i<3&&pending;i++){await processOutboxBatch({workerId:`media-life-${token}-${i}`,limit:100,leaseMs:5000});pending=Number((await db.pool.query("SELECT count(*)::int AS n FROM outbox_events WHERE aggregate_id=ANY($1::text[]) AND status='PENDING' AND payload->>'kind'='LIFECYCLE_TRANSITION'",[[mediaId,rejectId]])).rows[0].n)}assert.equal(pending,0);
 console.log('ANTIQUA v16 media lifecycle: verify/ready/reject row locks + replay + draft link atomicity + journal/outbox delivery passed');
}finally{await db.pool.end()}
