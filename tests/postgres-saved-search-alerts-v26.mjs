import assert from 'node:assert/strict';
import crypto from 'node:crypto';

if(!process.env.DATABASE_URL){console.log('ANTIQUA v26 PostgreSQL saved-search alerts: skipped (DATABASE_URL not set)');process.exit(0)}

const {db}=await import('../runtime-v09.mjs');
const {createSubscription,listSubscriptions,updateSubscription}=await import('../domain-e2e-v14.mjs');
const {notifyDiscoveryForObjectPostgres,enqueueDueDiscoveryDigestsPostgres,discoverySubscriptionCapabilities}=await import('../discovery-matching-v16.mjs');
const {processOutboxBatch,workerCapabilities}=await import('../worker-runtime-v15.mjs');

assert.equal(db.kind,'POSTGRES');
const buyer=await db.findAccountByEmail('buyer@demo.antiqua');assert.ok(buyer?.id);
const token=crypto.randomUUID().replaceAll('-',''),marker='V26-'+token.slice(0,12);
const objectIds=[1,2,3].map(n=>'v26-object-'+n+'-'+token),objectCodes=[1,2,3].map(n=>'AQ-V26-'+n+'-'+token.slice(0,8));
let subId=null;
async function workerUntil(predicate){
 for(let i=0;i<8;i++){await processOutboxBatch({workerId:'v26-'+token,limit:100,leaseMs:5000});if(await predicate())return true}
 return false
}
async function addObject(index){
 const id=objectIds[index],code=objectCodes[index],passport={id,objectId:code,title:{en:marker+' saved-search object '+(index+1),ru:marker+' предмет '+(index+1)},maker:{en:'V26 Test Maker',ru:'Тестовый мастер V26'},department:{en:'Decorative Arts',ru:'Декоративное искусство'},period:{en:'20th century',ru:'XX век'},origin:{en:'France',ru:'Франция'},materials:{en:'Bronze',ru:'Бронза'},conditionGrade:'A',location:'Paris',currency:'EUR'};
 await db.pool.query(`INSERT INTO objects(id,object_code,seller_id,passport,catalogue_status,trust_status,publication_status,created_at,updated_at)
   VALUES($1,$2,NULL,$3,'PUBLISHED','CLEARED','PUBLIC',now(),now())`,[id,code,passport])
}
async function matchCount(objectId){return Number((await db.pool.query('SELECT count(*)::int n FROM discovery_matches WHERE subscription_id=$1 AND object_id=$2',[subId,objectId])).rows[0].n)}
async function pendingCount(){return Number((await db.pool.query('SELECT count(*)::int n FROM discovery_matches WHERE subscription_id=$1 AND notified_at IS NULL',[subId])).rows[0].n)}

try{
 const cap=discoverySubscriptionCapabilities();assert.equal(cap.contractVersion,'v26');assert.equal(cap.exactlyOnceOutbox,true);assert.equal(workerCapabilities().discoveryDigestDelivery,'SCHEDULED_OUTBOX_EXACTLY_ONCE');

 const first=await createSubscription(buyer,{subscriptionType:'SAVED_SEARCH',label:marker,criteria:{q:marker},deliveryMode:'DAILY_DIGEST',digestHourUtc:8});
 subId=first.id;assert.equal(first.idempotent,false);assert.equal(first.deliveryMode,'DAILY_DIGEST');assert.equal(first.digestHourUtc,8);assert.ok(first.nextDigestAt);assert.equal(first.matchCount,0);

 const concurrent=await Promise.all(Array.from({length:7},(_,i)=>createSubscription(buyer,{subscriptionType:'SAVED_SEARCH',label:marker+' duplicate '+i,criteria:{q:'  '+marker+'  '},deliveryMode:i%2?'IMMEDIATE':'DAILY_DIGEST',digestHourUtc:12})));
 assert.equal(new Set(concurrent.map(x=>x.id)).size,1,'concurrent duplicate saves must reuse one subscription');
 assert.equal(concurrent.every(x=>x.id===subId&&x.idempotent===true),true);
 assert.equal(concurrent.every(x=>x.deliveryMode==='DAILY_DIGEST'&&x.digestHourUtc===8),true,'duplicate save must not silently change delivery authority');
 assert.equal(Number((await db.pool.query("SELECT count(*)::int n FROM discovery_subscriptions WHERE account_id=$1 AND subscription_type='SAVED_SEARCH' AND criteria=$2::jsonb AND status IN('ACTIVE','PAUSED')",[buyer.id,JSON.stringify({q:marker})])).rows[0].n),1);

 await addObject(0);
 await notifyDiscoveryForObjectPostgres(objectIds[0]);
 assert.equal(await matchCount(objectIds[0]),1);
 assert.equal(await pendingCount(),1);
 assert.equal(Number((await db.pool.query("SELECT count(*)::int n FROM outbox_events WHERE payload->'data'->>'subscriptionId'=$1 AND payload->>'type'='DISCOVERY_MATCH'",[subId])).rows[0].n),0,'daily mode must not enqueue an immediate object alert');

 const dueAt=new Date(Date.now()-60000).toISOString();await db.pool.query('UPDATE discovery_subscriptions SET next_digest_at=$2 WHERE id=$1',[subId,dueAt]);
 const scheduled=await enqueueDueDiscoveryDigestsPostgres({nowMs:Date.now(),limit:20,maxMatches:20});assert.ok(scheduled.enqueued>=1);assert.ok(scheduled.matches>=1);
 const digestOutbox=(await db.pool.query("SELECT * FROM outbox_events WHERE payload->'data'->>'subscriptionId'=$1 AND payload->>'type'='DISCOVERY_DIGEST'",[subId])).rows;
 assert.equal(digestOutbox.length,1);assert.deepEqual(digestOutbox[0].payload.data.objectIds,[objectIds[0]]);assert.equal(digestOutbox[0].payload.data.count,1);
 const replay=await enqueueDueDiscoveryDigestsPostgres({nowMs:Date.now(),limit:20,maxMatches:20});assert.equal(replay.checked,0,'same digest window must be advanced exactly once');
 assert.equal(Number((await db.pool.query("SELECT count(*)::int n FROM outbox_events WHERE payload->'data'->>'subscriptionId'=$1 AND payload->>'type'='DISCOVERY_DIGEST'",[subId])).rows[0].n),1);

 const delivered=await workerUntil(async()=>Number((await db.pool.query("SELECT count(*)::int n FROM notifications WHERE account_id=$1 AND type='DISCOVERY_DIGEST' AND payload->>'subscriptionId'=$2",[buyer.id,subId])).rows[0].n)===1);assert.equal(delivered,true);
 assert.equal(await pendingCount(),0);assert.ok((await db.pool.query('SELECT notified_at FROM discovery_matches WHERE subscription_id=$1 AND object_id=$2',[subId,objectIds[0]])).rows[0].notified_at);

 let sub=await updateSubscription(buyer,subId,{status:'PAUSED'});assert.equal(sub.status,'PAUSED');
 await addObject(1);await notifyDiscoveryForObjectPostgres(objectIds[1]);assert.equal(await matchCount(objectIds[1]),0,'paused subscription must not create new durable matches');

 sub=await updateSubscription(buyer,subId,{status:'ACTIVE'});assert.equal(sub.status,'ACTIVE');assert.equal(await matchCount(objectIds[1]),1,'resume must deterministically catch up objects published while paused');assert.equal(await pendingCount(),1);
 assert.equal(Number((await db.pool.query("SELECT count(*)::int n FROM outbox_events WHERE payload->'data'->>'subscriptionId'=$1 AND payload->>'type'='DISCOVERY_MATCH'",[subId])).rows[0].n),0);

 sub=await updateSubscription(buyer,subId,{deliveryMode:'IMMEDIATE'});assert.equal(sub.deliveryMode,'IMMEDIATE');assert.equal(sub.nextDigestAt,null);
 assert.equal(Number((await db.pool.query("SELECT count(*)::int n FROM outbox_events WHERE payload->'data'->>'subscriptionId'=$1 AND payload->>'type'='DISCOVERY_MATCHES' AND status IN('PENDING','PROCESSING','COMPLETED')",[subId])).rows[0].n)>=1,true,'switch to immediate must flush pending digest matches');
 const flushed=await workerUntil(async()=>Boolean((await db.pool.query('SELECT notified_at FROM discovery_matches WHERE subscription_id=$1 AND object_id=$2',[subId,objectIds[1]])).rows[0]?.notified_at));assert.equal(flushed,true);

 sub=await updateSubscription(buyer,subId,{status:'ARCHIVED'});assert.equal(sub.status,'ARCHIVED');assert.equal(sub.nextDigestAt,null);
 await addObject(2);await notifyDiscoveryForObjectPostgres(objectIds[2]);assert.equal(await matchCount(objectIds[2]),0,'unsubscribed search must not match future objects');

 const listed=(await listSubscriptions(buyer)).find(x=>x.id===subId);assert.ok(listed);assert.equal(listed.status,'ARCHIVED');assert.equal(listed.deliveryMode,'IMMEDIATE');
 console.log('ANTIQUA v26 PostgreSQL saved-search alerts: duplicate protection + daily digest exactly-once + pause/resume + immediate flush + unsubscribe passed');
}finally{
 if(subId){
  await db.pool.query("DELETE FROM notifications WHERE account_id=$1 AND payload->>'subscriptionId'=$2",[buyer.id,subId]).catch(()=>{});
  await db.pool.query("DELETE FROM outbox_events WHERE (payload->'data'->>'subscriptionId')=$1 OR (payload->'discoveryMatch'->>'subscriptionId')=$1 OR (payload->'discoveryMatchSet'->>'subscriptionId')=$1",[subId]).catch(()=>{});
  await db.pool.query('DELETE FROM discovery_subscriptions WHERE id=$1',[subId]).catch(()=>{});
 }
 await db.pool.query('DELETE FROM objects WHERE id=ANY($1::text[])',[objectIds]).catch(()=>{});
 await db.pool.end()
}
