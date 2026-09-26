import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {db} from '../runtime-v09.mjs';
import {createDrop,updateDrop,upsertDropItem,transitionDrop,setDropFollow,getDropForOperator,advanceDueDrops} from '../drops-v29.mjs';
import {processOutboxBatch} from '../worker-runtime-v15.mjs';

if(!process.env.DATABASE_URL){console.log('ANTIQUA v29 PostgreSQL Drops: skipped (DATABASE_URL not set)');process.exit(0)}
assert.equal(db.kind,'POSTGRES');
const operator=await db.findAccountByEmail('operator@demo.antiqua'),buyer=await db.findAccountByEmail('buyer@demo.antiqua');assert.ok(operator?.id);assert.ok(buyer?.id);
const token=crypto.randomUUID().replaceAll('-','').slice(0,12);
const created=await createDrop(operator,{slug:'drop-pg-'+token,titleEn:'Postgres Drop '+token,titleRu:'Postgres выпуск '+token,curatorLabelEn:'Test Curator',clientActionId:'create-'+token});
const id=created.drop.id;
let x=await upsertDropItem(operator,id,{objectId:'lot-110',sortOrder:1,releaseLimit:1,expectedVersion:1,clientActionId:'item-'+token});assert.equal(x.drop.version,2);
x=await updateDrop(operator,id,{coverObjectId:'lot-110',expectedVersion:2,clientActionId:'cover-'+token});assert.equal(x.drop.version,3);
const previewAt=new Date(Date.now()-120000).toISOString(),releaseAt=new Date(Date.now()-60000).toISOString(),archiveAt=new Date(Date.now()+86400000).toISOString();
x=await transitionDrop(operator,id,'SCHEDULED',{expectedVersion:3,previewAt,releaseAt,archiveAt,clientActionId:'schedule-'+token});assert.equal(x.drop.version,4);
const scheduleReplay=await transitionDrop(operator,id,'SCHEDULED',{expectedVersion:3,previewAt,releaseAt,archiveAt,clientActionId:'schedule-'+token});assert.equal(scheduleReplay.idempotent,true);
await assert.rejects(()=>transitionDrop(operator,id,'PREVIEW',{expectedVersion:3,clientActionId:'stale-'+token}),e=>e?.code==='STALE_DROP_VERSION');
x=await transitionDrop(operator,id,'PREVIEW',{expectedVersion:4,clientActionId:'preview-'+token});assert.equal(x.drop.status,'PREVIEW');assert.equal(x.drop.version,5);
await setDropFollow(buyer,id,true);
const sweep=await advanceDueDrops();assert.ok(sweep.released>=1);
let current=await getDropForOperator(id);assert.equal(current.status,'LIVE');assert.equal(current.version,6);
const key='notification:drop-released:'+id+':'+buyer.id+':v6';
let out=(await db.pool.query('SELECT id,status,payload FROM outbox_events WHERE idempotency_key=$1',[key])).rows;assert.equal(out.length,1);assert.equal(out[0].payload.type,'DROP_RELEASED');
const again=await advanceDueDrops();assert.equal(again.released,0);assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM outbox_events WHERE idempotency_key=$1',[key])).rows[0].n,1);
const workerId='drop-test-'+token,processed=await processOutboxBatch({workerId,limit:100,leaseMs:120000});assert.ok(processed.completed>=1);
out=(await db.pool.query('SELECT id,status FROM outbox_events WHERE idempotency_key=$1',[key])).rows;assert.equal(out[0].status,'COMPLETED');
assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM notifications WHERE source_outbox_id=$1',[out[0].id])).rows[0].n,1);

const event=(await db.pool.query("SELECT id FROM drop_events WHERE drop_id=$1 AND event_type='RELEASED'",[id])).rows[0];assert.ok(event);
const cx=await db.pool.connect();try{await cx.query('BEGIN');await cx.query('SAVEPOINT immutable_probe');let blocked=false;try{await cx.query("UPDATE drop_events SET metadata=$2 WHERE id=$1",[event.id,{tampered:true}])}catch(e){blocked=e.code==='55000';await cx.query('ROLLBACK TO SAVEPOINT immutable_probe')}assert.equal(blocked,true,'drop history must be immutable');await cx.query('ROLLBACK')}finally{cx.release()}
console.log('ANTIQUA v29 PostgreSQL Drops: worker release + exactly-once follower notification + optimistic lock + immutable history passed');
await db.pool.end();
