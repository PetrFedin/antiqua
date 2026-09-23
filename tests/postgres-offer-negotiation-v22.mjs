import assert from 'node:assert/strict';
import crypto from 'node:crypto';

if(!process.env.DATABASE_URL){console.log('ANTIQUA v22 PostgreSQL negotiation: skipped (DATABASE_URL not set)');process.exit(0)}

const {db}=await import('../runtime-v09.mjs');
const {createOffer,getOffer,actOnOffer}=await import('../offer-negotiation-v22.mjs');
assert.equal(db.kind,'POSTGRES');

const token=crypto.randomUUID().replaceAll('-',''),key=p=>p+'-'+crypto.randomUUID();
const buyer=await db.findAccountByEmail('buyer@demo.antiqua');
const seller=await db.findAccountByEmail('seller@demo.antiqua');
assert.ok(buyer?.id);assert.ok(seller?.sellerId);
const buyer2Id='acct-v22-'+token;
const buyer2={id:buyer2Id,roles:['BUYER'],sellerId:null};
const ids={
 objects:['obj-v22-'+token,'obj-v22-fail-'+token,'obj-v22-exp-'+token],
 listings:['lst-v22-'+token,'lst-v22-fail-'+token,'lst-v22-exp-'+token],
 offers:[],orders:[]
};
const future=hours=>new Date(Date.now()+hours*3600000).toISOString();

async function insertFixture(objectId,listingId,price=10000){
 await db.pool.query("INSERT INTO objects(id,object_code,seller_id,passport,catalogue_status,trust_status,publication_status,created_at,updated_at) VALUES($1,$2,$3,$4,'APPROVED','ALLOWED','PUBLIC',now(),now())",[objectId,'AQ-V22-'+objectId,seller.sellerId,{id:objectId,objectId:'AQ-V22-'+objectId,title:{en:'V22 proof object',ru:'Предмет V22'},sellerId:seller.sellerId,catalogueStatus:'APPROVED',trustStatus:'ALLOWED',publicationStatus:'PUBLIC'}]);
 const payload={id:listingId,lotId:objectId,sellerId:seller.sellerId,saleType:'MAKE_OFFER',price,currency:'EUR',negotiable:true,status:'ACTIVE',shippingFrom:'Amsterdam'};
 await db.pool.query("INSERT INTO listings(id,object_id,seller_id,status,payload,created_at,updated_at) VALUES($1,$2,$3,'ACTIVE',$4,now(),now())",[listingId,objectId,seller.sellerId,payload])
}

try{
 await db.pool.query("INSERT INTO accounts(id,email,display_name,password_hash,account_type,status,twofa_status,created_at,updated_at) VALUES($1,$2,'V22 Buyer','test-hash','BUYER','ACTIVE','DISABLED',now(),now())",[buyer2Id,'v22-'+token+'@example.test']);
 await db.pool.query("INSERT INTO account_roles(account_id,role) VALUES($1,'BUYER')",[buyer2Id]);
 for(let i=0;i<ids.objects.length;i++)await insertFixture(ids.objects[i],ids.listings[i],i===0?10000:6000);

 const a=await createOffer(buyer,ids.listings[0],{amount:'8000',currency:'EUR',expiresAt:future(72),comment:'Primary buyer',clientActionId:key('create-a')});ids.offers.push(a.offer.id);
 const b=await createOffer(buyer2,ids.listings[0],{amount:'8200',currency:'EUR',expiresAt:future(72),comment:'Competing buyer',clientActionId:key('create-b')});ids.offers.push(b.offer.id);
 assert.equal(a.offer.version,1);assert.equal(b.offer.status,'OPEN');

 let counter=await actOnOffer(seller,a.offer.id,{action:'COUNTER',amount:'9000',expiresAt:future(72),comment:'Dealer counter',expectedVersion:1,clientActionId:key('counter')});
 assert.equal(counter.offer.version,2);assert.equal(counter.offer.awaitingRole,'BUYER');

 await assert.rejects(
  ()=>actOnOffer(buyer,a.offer.id,{action:'ACCEPT',expectedVersion:1,clientActionId:key('stale')}),
  e=>e.code==='OFFER_VERSION_CONFLICT'&&e.currentVersion===2
 );

 const acceptKey=key('accept-replay');
 const attempts=await Promise.all(Array.from({length:8},()=>actOnOffer(buyer,a.offer.id,{action:'ACCEPT',expectedVersion:2,clientActionId:acceptKey})));
 const nonReplay=attempts.filter(x=>!x.idempotent),replays=attempts.filter(x=>x.idempotent);
 assert.equal(nonReplay.length,1);assert.equal(replays.length,7);
 const orderId=attempts[0].order?.id;assert.ok(orderId);ids.orders.push(orderId);
 assert.ok(attempts.every(x=>x.order?.id===orderId));

 const orderCount=(await db.pool.query("SELECT count(*)::int n FROM orders WHERE payload->>'offerId'=$1",[a.offer.id])).rows[0].n;
 assert.equal(orderCount,1);
 const acceptedRow=(await db.pool.query('SELECT status,version,accepted_order_id FROM offers WHERE id=$1',[a.offer.id])).rows[0];
 assert.equal(acceptedRow.status,'ACCEPTED');assert.equal(acceptedRow.version,3);assert.equal(acceptedRow.accepted_order_id,orderId);
 const listingRow=(await db.pool.query('SELECT status FROM listings WHERE id=$1',[ids.listings[0]])).rows[0];assert.equal(listingRow.status,'RESERVED');
 const acceptedEvents=(await db.pool.query('SELECT event_type,version,client_action_id FROM offer_events WHERE offer_id=$1 ORDER BY version',[a.offer.id])).rows;
 assert.deepEqual(acceptedEvents.map(x=>[x.event_type,x.version]),[['CREATED',1],['COUNTERED',2],['ACCEPTED',3]]);
 assert.equal(acceptedEvents.filter(x=>x.client_action_id===acceptKey).length,1);

 const competitor=await getOffer(buyer2,b.offer.id);
 assert.equal(competitor.status,'REJECTED');assert.equal(competitor.history.at(-1).actorRole,'SYSTEM');
 assert.equal(competitor.history.at(-1).metadata.acceptedOfferId,a.offer.id);

 await assert.rejects(
  ()=>db.pool.query("UPDATE offer_events SET comment='mutated' WHERE offer_id=$1 AND version=1",[a.offer.id]),
  e=>e.code==='55000'
 );
 const immutableComment=(await db.pool.query('SELECT comment FROM offer_events WHERE offer_id=$1 AND version=1',[a.offer.id])).rows[0].comment;
 assert.equal(immutableComment,'Primary buyer');

 const failOffer=await createOffer(buyer,ids.listings[1],{amount:'5000',currency:'EUR',expiresAt:future(24),clientActionId:key('fail-create')});ids.offers.push(failOffer.offer.id);
 await db.pool.query("UPDATE listings SET status='INACTIVE',payload=jsonb_set(payload,'{status}',to_jsonb('INACTIVE'::text),true),updated_at=now() WHERE id=$1",[ids.listings[1]]);
 await assert.rejects(
  ()=>actOnOffer(seller,failOffer.offer.id,{action:'ACCEPT',expectedVersion:1,clientActionId:key('fail-accept')}),
  e=>e.code==='LISTING_NOT_AVAILABLE'
 );
 const failState=(await db.pool.query('SELECT status,version,accepted_order_id FROM offers WHERE id=$1',[failOffer.offer.id])).rows[0];
 assert.deepEqual([failState.status,failState.version,failState.accepted_order_id],['OPEN',1,null]);
 assert.equal((await db.pool.query("SELECT count(*)::int n FROM orders WHERE payload->>'offerId'=$1",[failOffer.offer.id])).rows[0].n,0);

 const expOffer=await createOffer(buyer,ids.listings[2],{amount:'5000',currency:'EUR',expiresAt:future(24),clientActionId:key('exp-create')});ids.offers.push(expOffer.offer.id);
 await db.pool.query("UPDATE offers SET expires_at=now()-interval '1 second' WHERE id=$1",[expOffer.offer.id]);
 const expired=await getOffer(buyer,expOffer.offer.id);
 assert.equal(expired.status,'EXPIRED');assert.equal(expired.version,2);assert.equal(expired.history.at(-1).eventType,'EXPIRED');

 console.log('ANTIQUA v22 PostgreSQL negotiation: row-lock concurrency + exactly-once accept/order + competitor close + immutable journal + atomic rollback + expiry passed');
}finally{
 try{
  await db.pool.query('ALTER TABLE offer_events DISABLE TRIGGER offer_events_immutable_trg');
  if(ids.offers.length)await db.pool.query('DELETE FROM offer_events WHERE offer_id=ANY($1::text[])',[ids.offers]);
  if(ids.offers.length)await db.pool.query('DELETE FROM offers WHERE id=ANY($1::text[])',[ids.offers]);
  if(ids.orders.length)await db.pool.query('DELETE FROM orders WHERE id=ANY($1::text[])',[ids.orders]);
  await db.pool.query('DELETE FROM listings WHERE id=ANY($1::text[])',[ids.listings]);
  await db.pool.query('DELETE FROM objects WHERE id=ANY($1::text[])',[ids.objects]);
  await db.pool.query('DELETE FROM notifications WHERE account_id=$1',[buyer2Id]);
  await db.pool.query('DELETE FROM account_roles WHERE account_id=$1',[buyer2Id]);
  await db.pool.query('DELETE FROM accounts WHERE id=$1',[buyer2Id]);
 }finally{
  await db.pool.query('ALTER TABLE offer_events ENABLE TRIGGER offer_events_immutable_trg').catch(()=>{});
  await db.pool.end()
 }
}
