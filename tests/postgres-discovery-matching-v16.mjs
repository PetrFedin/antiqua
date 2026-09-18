import assert from 'node:assert/strict';
import crypto from 'node:crypto';

if(!process.env.DATABASE_URL){console.log('ANTIQUA v16 PostgreSQL discovery: skipped (DATABASE_URL not set)');process.exit(0)}

const {db,lots}=await import('../runtime-v09.mjs');
const {createSubscription,listSubscriptions,updateSubscription}=await import('../domain-e2e-v14.mjs');
const {searchDiscoveryPostgres,notifyDiscoveryForObjectPostgres,discoveryPostgresCapabilities}=await import('../discovery-matching-v16.mjs');
const {planLifecycleTransition}=await import('../lifecycle-authority-v16.mjs');
const {recordLifecycleTransitionTx}=await import('../lifecycle-events-v16.mjs');
const {processOutboxBatch}=await import('../worker-runtime-v15.mjs');

const token=crypto.randomUUID().replaceAll('-',''),marker=`Discovery-${token.slice(0,12)}`,objectId=`lot-discovery-${token}`,objectCode=`AQ-DISC-${token.slice(0,10)}`,listingId=`lst-discovery-${token}`,reservedObjectId=`lot-reserved-${token}`,reservedListingId=`lst-reserved-${token}`,auctionObjectId=`lot-auction-${token}`,auctionId=`auc-discovery-${token}`,draftId=`draft-discovery-${token}`,sourceKey=`publish-discovery-${token}`;
let subId=null;
const buyer=await db.findAccountByEmail('buyer@demo.antiqua');
async function workerUntil(predicate){for(let i=0;i<8;i++){await processOutboxBatch({workerId:`discovery-${token}`,limit:100,leaseMs:5000});if(await predicate())return true}return false}

try{
 assert.equal(db.kind,'POSTGRES');assert.ok(buyer);assert.equal(lots.some(x=>x.id===objectId),false);
 const cap=discoveryPostgresCapabilities();assert.equal(cap.postgresAuthority,true);assert.equal(cap.fullText,'POSTGRES_TSVECTOR');assert.equal(cap.trigram,'PG_TRGM');
 assert.equal((await db.pool.query("SELECT count(*)::int n FROM pg_extension WHERE extname='pg_trgm'")).rows[0].n,1);

 let sub=await createSubscription(buyer,{subscriptionType:'SAVED_SEARCH',label:marker,criteria:{q:marker}});
 subId=sub.id;assert.equal(sub.matchCount,0);
 assert.equal(Number((await db.pool.query('SELECT count(*)::int n FROM discovery_matches WHERE subscription_id=$1',[subId])).rows[0].n),0);

 const passport={id:objectId,objectId:objectCode,title:{en:`${marker} porcelain bowl`,ru:`${marker} фарфоровая чаша`},maker:{en:'Discovery Test Maker',ru:'Тестовый мастер'},department:{en:'Ceramics',ru:'Керамика'},period:{en:'Late 20th century',ru:'Конец XX века'},origin:{en:'France',ru:'Франция'},materials:{en:'Porcelain, gilt bronze',ru:'Фарфор, золочёная бронза'},technique:{en:'Hand painted porcelain',ru:'Ручная роспись фарфора'},conditionGrade:'A-',location:'Paris',currency:'EUR',image:'https://example.test/discovery.jpg',publicationStatus:'PUBLIC'};
 await db.pool.query(`INSERT INTO objects(id,object_code,seller_id,passport,catalogue_status,trust_status,publication_status,passport_hash,created_at,updated_at)
   VALUES($1,$2,'seller-preview',$3,'PUBLISHED','CLEARED','PUBLIC',NULL,now(),now())`,[objectId,objectCode,passport]);
 const listing={id:listingId,lotId:objectId,sellerId:'seller-preview',saleType:'BUY_NOW',price:12500,currency:'EUR',negotiable:true,status:'ACTIVE',shippingFrom:'Paris',publishedAt:new Date().toISOString()};
 await db.pool.query(`INSERT INTO listings(id,object_id,seller_id,status,payload,updated_at) VALUES($1,$2,$3,'ACTIVE',$4,now())`,[listingId,objectId,'seller-preview',listing]);
 const reservedPassport={...passport,id:reservedObjectId,objectId:`AQ-RES-${token.slice(0,8)}`,title:{en:`${marker} reserved object`,ru:`${marker} зарезервированный предмет`}};
 await db.pool.query(`INSERT INTO objects(id,object_code,seller_id,passport,catalogue_status,trust_status,publication_status,passport_hash,created_at,updated_at)
   VALUES($1,$2,'seller-preview',$3,'PUBLISHED','CLEARED','PUBLIC',NULL,now(),now())`,[reservedObjectId,reservedPassport.objectId,reservedPassport]);
 const reservedListing={id:reservedListingId,lotId:reservedObjectId,sellerId:'seller-preview',saleType:'BUY_NOW',price:13000,currency:'EUR',status:'RESERVED'};
 await db.pool.query(`INSERT INTO listings(id,object_id,seller_id,status,payload,updated_at) VALUES($1,$2,'seller-preview','RESERVED',$3,now())`,[reservedListingId,reservedObjectId,reservedListing]);
 const auctionPassport={...passport,id:auctionObjectId,objectId:`AQ-AUC-${token.slice(0,8)}`,title:{en:`${marker} expired auction object`,ru:`${marker} завершившийся аукционный предмет`}};
 await db.pool.query(`INSERT INTO objects(id,object_code,seller_id,passport,catalogue_status,trust_status,publication_status,passport_hash,created_at,updated_at)
   VALUES($1,$2,'seller-preview',$3,'PUBLISHED','CLEARED','PUBLIC',NULL,now(),now())`,[auctionObjectId,auctionPassport.objectId,auctionPassport]);
 const auctionState={id:auctionId,lotId:auctionObjectId,currency:'EUR',currentBid:14000,endsAt:new Date(Date.now()-3600000).toISOString(),state:'LIVE'};
 await db.pool.query(`INSERT INTO auctions(id,object_id,sale_id,status,current_bid,ends_at,state,updated_at) VALUES($1,$2,'sale-test','LIVE',14000,$3,$4,now())`,[auctionId,auctionObjectId,auctionState.endsAt,auctionState]);

 assert.equal(lots.some(x=>x.id===objectId),false,'fixture must remain absent from runtime lots');
 for(const criteria of [
   {q:marker},{category:'Ceramics'},{maker:'Discovery Test Maker'},{material:'Porcelain'},{technique:'Hand painted'},{condition:'A-'},{location:'Paris'},{purchaseMethod:'BUY_NOW'},{seller:'seller-preview'},{objectId:objectCode},{priceMin:12000,priceMax:13000}
 ]){const result=await searchDiscoveryPostgres(criteria,{limit:20});assert.ok(result.matches.some(x=>x.id===objectId),`criterion failed: ${JSON.stringify(criteria)}`)}
 assert.equal((await searchDiscoveryPostgres({q:'definitely-no-discovery-match-'+token},{limit:20})).matches.some(x=>x.id===objectId),false);
 const reserved=await searchDiscoveryPostgres({objectId:reservedObjectId,purchaseMethod:'BUY_NOW'},{limit:20});assert.equal(reserved.matches[0]?.id,reservedObjectId,'RESERVED listing must preserve legacy purchase-method semantics');
 const expiredAuction=await searchDiscoveryPostgres({objectId:auctionObjectId,purchaseMethod:'AUCTION'},{limit:20});assert.equal(expiredAuction.total,0,'expired LIVE-status auction must not remain discoverable as AUCTION');
 const noPrice=await searchDiscoveryPostgres({objectId:auctionObjectId,priceMin:999999},{limit:20});assert.equal(noPrice.total,1,'legacy price criteria do not exclude objects with no active commercial price');

 let listed=await listSubscriptions(buyer),view=listed.find(x=>x.id===subId);assert.ok(view);assert.equal(view.matchCount,1);assert.equal(view.matches[0].id,objectId);
 assert.equal(Number((await db.pool.query('SELECT count(*)::int n FROM discovery_matches WHERE subscription_id=$1',[subId])).rows[0].n),0,'list is dynamic and must not fabricate durable match events');

 const cx=await db.pool.connect();try{await cx.query('BEGIN');const plan=planLifecycleTransition({domain:'PUBLICATION',from:'APPROVED',to:'PUBLISHED',action:'PUBLISH',authority:'OPERATOR',facts:{CHECKLIST_READY:true,CATALOGUE_APPROVED:true,TRUST_ALLOWED:true,SELLER_VERIFIED:true,NO_BLOCKING_RISK:true}});await recordLifecycleTransitionTx(cx,{plan,aggregateId:draftId,sourceKey,metadata:{objectId}});await cx.query('COMMIT')}catch(e){try{await cx.query('ROLLBACK')}catch{}throw e}finally{cx.release()}

 const matched=await workerUntil(async()=>Number((await db.pool.query('SELECT count(*)::int n FROM discovery_matches WHERE subscription_id=$1 AND object_id=$2',[subId,objectId])).rows[0].n)===1);assert.equal(matched,true);
 const delivered=await workerUntil(async()=>Boolean((await db.pool.query("SELECT notified_at FROM discovery_matches WHERE subscription_id=$1 AND object_id=$2",[subId,objectId])).rows[0]?.notified_at));assert.equal(delivered,true);
 let matchRow=(await db.pool.query('SELECT matched_at,notified_at FROM discovery_matches WHERE subscription_id=$1 AND object_id=$2',[subId,objectId])).rows[0];assert.ok(matchRow.matched_at);assert.ok(matchRow.notified_at);
 let notifications=(await db.pool.query("SELECT id,type,payload FROM notifications WHERE account_id=$1 AND type='DISCOVERY_MATCH' AND payload->>'subscriptionId'=$2 AND payload->>'objectId'=$3",[buyer.id,subId,objectId])).rows;assert.equal(notifications.length,1);

 const repeat1=await notifyDiscoveryForObjectPostgres(objectId),repeat2=await notifyDiscoveryForObjectPostgres(objectId);assert.equal(repeat1.inserted,0);assert.equal(repeat2.inserted,0);
 await workerUntil(async()=>true);
 notifications=(await db.pool.query("SELECT id FROM notifications WHERE account_id=$1 AND type='DISCOVERY_MATCH' AND payload->>'subscriptionId'=$2 AND payload->>'objectId'=$3",[buyer.id,subId,objectId])).rows;assert.equal(notifications.length,1,'object-trigger replay must not duplicate notification');

 sub=await updateSubscription(buyer,subId,{criteria:{maker:'No Such Discovery Maker'} });assert.equal(sub.matchCount,0);assert.equal(Number((await db.pool.query('SELECT count(*)::int n FROM discovery_matches WHERE subscription_id=$1',[subId])).rows[0].n),0);
 sub=await updateSubscription(buyer,subId,{criteria:{q:marker}});assert.equal(sub.matchCount,1);assert.equal(Number((await db.pool.query('SELECT count(*)::int n FROM discovery_matches WHERE subscription_id=$1 AND object_id=$2',[subId,objectId])).rows[0].n),1);
 const summaryDelivered=await workerUntil(async()=>Number((await db.pool.query("SELECT count(*)::int n FROM notifications WHERE account_id=$1 AND type='DISCOVERY_MATCHES' AND payload->>'subscriptionId'=$2",[buyer.id,subId])).rows[0].n)>=1);assert.equal(summaryDelivered,true);
 matchRow=(await db.pool.query('SELECT notified_at FROM discovery_matches WHERE subscription_id=$1 AND object_id=$2',[subId,objectId])).rows[0];assert.ok(matchRow.notified_at);

 console.log('ANTIQUA v16 PostgreSQL discovery: DB-only object search + criteria compiler + publication outbox match + exactly-once notification + criteria reset passed');
}finally{
 if(subId){
  await db.pool.query("DELETE FROM notifications WHERE account_id=$1 AND payload->>'subscriptionId'=$2",[buyer.id,subId]).catch(()=>{});
  await db.pool.query("DELETE FROM outbox_events WHERE (payload->'data'->>'subscriptionId')=$1 OR (payload->'discoveryMatch'->>'subscriptionId')=$1 OR (payload->'discoveryMatchSet'->>'subscriptionId')=$1",[subId]).catch(()=>{});
  await db.pool.query('DELETE FROM discovery_subscriptions WHERE id=$1',[subId]).catch(()=>{});
 }
 await db.pool.query('DELETE FROM outbox_events WHERE aggregate_type=$1 AND aggregate_id=$2',['PUBLICATION',draftId]).catch(()=>{});
 await db.pool.query('DELETE FROM lifecycle_events WHERE domain=$1 AND aggregate_id=$2',['PUBLICATION',draftId]).catch(()=>{});
 await db.pool.query('DELETE FROM auctions WHERE id=$1',[auctionId]).catch(()=>{});
 await db.pool.query('DELETE FROM listings WHERE id=ANY($1::text[])',[[listingId,reservedListingId]]).catch(()=>{});
 await db.pool.query('DELETE FROM objects WHERE id=ANY($1::text[])',[[objectId,reservedObjectId,auctionObjectId]]).catch(()=>{});
 await db.pool.end();
}
