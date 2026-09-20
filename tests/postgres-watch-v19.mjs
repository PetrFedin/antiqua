import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {db,listing} from '../runtime-v09.mjs';
import {setObjectFlag} from '../preferences-v14.mjs';
import {persistSellerListingWithWatch,listingWatchData,enqueueWatchNotificationsTx} from '../watch-events-v19.mjs';
import {processOutboxBatch} from '../worker-runtime-v15.mjs';

if(!process.env.DATABASE_URL){
 console.log('ANTIQUA v19 PostgreSQL WATCH: skipped (DATABASE_URL not set)');
 process.exit(0);
}
assert.equal(db.kind,'POSTGRES');
const buyer=await db.findAccountByEmail('buyer@demo.antiqua'),seller=await db.findAccountByEmail('seller@demo.antiqua');
assert.ok(buyer?.id&&seller?.id&&seller?.sellerId);
const current=listing('lst-109');assert.ok(current);
const before=structuredClone(current),after={...structuredClone(current),price:Number(current.price)+137};
const token=crypto.randomUUID().replaceAll('-','');

try{
 await setObjectFlag(db,buyer.id,'lot-109','WATCH',true);
 const persisted=await persistSellerListingWithWatch(before,after,{actorAccountId:seller.id,eventKey:'listing-proof-'+token});
 assert.equal(persisted.watch.persistent,true);assert.equal(persisted.watch.subscribers,1);assert.equal(persisted.watch.queued,1);

 const data=listingWatchData(before,after),cx=await db.pool.connect();let replay;
 try{await cx.query('BEGIN');replay=await enqueueWatchNotificationsTx(cx,{objectId:'lot-109',type:'WATCH_LISTING_CHANGED',data,excludeAccountIds:[seller.id],eventKey:persisted.eventKey});await cx.query('COMMIT')}catch(e){try{await cx.query('ROLLBACK')}catch{}throw e}finally{cx.release()}
 assert.equal(replay.queued,0);assert.equal(replay.idempotent,1,'same WATCH event key must reuse outbox effect');

 const outbox=(await db.pool.query("SELECT id,status,payload FROM outbox_events WHERE idempotency_key=$1",[`watch:${persisted.eventKey}:${buyer.id}`])).rows;
 assert.equal(outbox.length,1);assert.equal(outbox[0].payload.type,'WATCH_LISTING_CHANGED');assert.equal(outbox[0].payload.data.price,after.price);

 const worker=await processOutboxBatch({workerId:'watch-proof-'+token,limit:100});
 assert.ok(worker.completed>=1);
 const delivered=(await db.pool.query('SELECT id,type,payload,source_outbox_id FROM notifications WHERE source_outbox_id=$1',[outbox[0].id])).rows;
 assert.equal(delivered.length,1);assert.equal(delivered[0].type,'WATCH_LISTING_CHANGED');assert.equal(delivered[0].payload.objectId,'lot-109');
 await processOutboxBatch({workerId:'watch-proof-replay-'+token,limit:100});
 const stillOne=(await db.pool.query('SELECT count(*)::int AS n FROM notifications WHERE source_outbox_id=$1',[outbox[0].id])).rows[0].n;assert.equal(stillOne,1,'completed outbox must remain exactly-once');

 const rollbackKey='watch-rollback-'+token,rx=await db.pool.connect();
 try{await rx.query('BEGIN');const queued=await enqueueWatchNotificationsTx(rx,{objectId:'lot-109',type:'WATCH_LISTING_CHANGED',data,excludeAccountIds:[seller.id],eventKey:rollbackKey});assert.equal(queued.queued,1);await rx.query('ROLLBACK')}finally{rx.release()}
 const rolled=(await db.pool.query("SELECT count(*)::int AS n FROM outbox_events WHERE idempotency_key=$1",[`watch:${rollbackKey}:${buyer.id}`])).rows[0].n;assert.equal(rolled,0,'rolled-back domain transaction must not leak WATCH outbox');

 const sx=await db.pool.connect();
 try{await sx.query('BEGIN');const suppressed=await enqueueWatchNotificationsTx(sx,{objectId:'lot-109',type:'WATCH_LISTING_CHANGED',data,excludeAccountIds:[seller.id,buyer.id],eventKey:'watch-self-'+token});assert.equal(suppressed.subscribers,0);assert.equal(suppressed.queued,0);await sx.query('ROLLBACK')}finally{sx.release()}

 console.log('ANTIQUA v19 PostgreSQL WATCH: atomic outbox + idempotent replay + exact-once worker + rollback + actor suppression passed');
}finally{
 await setObjectFlag(db,buyer.id,'lot-109','WATCH',false).catch(()=>{});
 await db.putListing(before).catch(()=>{});
 Object.assign(current,before);
 await db.pool.end();
}
