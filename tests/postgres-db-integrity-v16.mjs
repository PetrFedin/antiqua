import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {migrationManifest} from '../migration-manifest-v16.mjs';

if(!process.env.DATABASE_URL){console.log('ANTIQUA v16 PostgreSQL DB integrity: skipped (DATABASE_URL not set)');process.exit(0)}

const {db}=await import('../runtime-v09.mjs');
const token=crypto.randomUUID().replaceAll('-','');
const id=p=>`${p}-${token}`;
const expectCode=async(promise,code)=>{
 await assert.rejects(()=>promise,e=>{
  assert.equal(e.code,code,`expected PostgreSQL ${code}, got ${e.code}: ${e.message}`);
  return true;
 });
};

const cleanup={objects:[],listings:[],orders:[],auctions:[],exhibitions:[],ensembles:[],media:[]};

try{
 assert.equal(db.kind,'POSTGRES');
 assert.equal(migrationManifest.at(-1).version,'015_v16_db_integrity');

 const versions=(await db.pool.query("SELECT version FROM schema_migrations WHERE version IN ('014_v16_discovery_postgres_matching','015_v16_db_integrity') ORDER BY version")).rows.map(x=>x.version);
 assert.deepEqual(versions,['014_v16_discovery_postgres_matching','015_v16_db_integrity'],'CLI/server migration authority must include 014 and 015');

 const buyer=await db.findAccountByEmail('buyer@demo.antiqua');
 assert.ok(buyer);
 const listing=(await db.pool.query('SELECT id,object_id,seller_id,payload FROM listings ORDER BY id LIMIT 1')).rows[0];
 const auction=(await db.pool.query('SELECT id,object_id FROM auctions ORDER BY id LIMIT 1')).rows[0];
 assert.ok(listing);assert.ok(auction);
 const otherObject=(await db.pool.query('SELECT id FROM objects WHERE id<>$1 ORDER BY id LIMIT 1',[listing.object_id])).rows[0];
 assert.ok(otherObject);

 await expectCode(db.pool.query(
  "INSERT INTO listings(id,object_id,seller_id,status,payload) VALUES($1,$2,$3,'INACTIVE','{}'::jsonb)",
  [id('bad-listing'),'missing-object-'+token,listing.seller_id]
 ),'23503');

 await expectCode(db.pool.query(
  "INSERT INTO collection_records(id,account_id,object_id,status) VALUES($1,$2,$3,'OWNED')",
  [id('bad-record'),buyer.id,'missing-object-'+token]
 ),'23503');

 await expectCode(db.pool.query(
  "INSERT INTO offers(id,listing_id,buyer_account_id,seller_id,status,payload,created_at) VALUES($1,$2,$3,$4,'PENDING','{}'::jsonb,now())",
  [id('bad-offer'),listing.id,buyer.id,'wrong-seller-'+token]
 ),'23514');

 await expectCode(db.pool.query(
  "INSERT INTO orders(id,listing_id,object_id,buyer_account_id,seller_id,status,payload,created_at) VALUES($1,$2,$3,$4,$5,'ORDER_CREATED','{}'::jsonb,now())",
  [id('bad-order'),listing.id,otherObject.id,buyer.id,listing.seller_id]
 ),'23514');

 await expectCode(db.pool.query(
  "INSERT INTO shipments(id,order_id,settlement_id,object_id,buyer_account_id,seller_id,status) VALUES($1,NULL,NULL,$2,$3,$4,'QUOTE_REQUIRED')",
  [id('bad-shipment-source-count'),listing.object_id,buyer.id,listing.seller_id]
 ),'23514');

 const exA=id('ex-a'),exB=id('ex-b'),sectionA=id('section-a'),ensA=id('ens-a'),ensB=id('ens-b'),slotA=id('slot-a');
 cleanup.exhibitions.push(exA,exB);cleanup.ensembles.push(ensA,ensB);
 await db.pool.query("INSERT INTO exhibitions(id,owner_account_id,title,visibility,status) VALUES($1,$3,$2,'PRIVATE','DRAFT'),($4,$3,$2,'PRIVATE','DRAFT')",[exA,{en:'Integrity A'},buyer.id,exB]);
 await db.pool.query("INSERT INTO exhibition_sections(id,exhibition_id,title,sort_order) VALUES($1,$2,$3,1)",[sectionA,exA,{en:'Section'}]);
 await db.pool.query("INSERT INTO ensembles(id,title,visibility,status) VALUES($1,$3,'PRIVATE','DRAFT'),($2,$3,'PRIVATE','DRAFT')",[ensA,ensB,{en:'Integrity ensemble'}]);
 await db.pool.query("INSERT INTO ensemble_slots(id,ensemble_id,label,sort_order) VALUES($1,$2,$3,1)",[slotA,ensA,{en:'Slot'}]);

 await expectCode(db.pool.query(
  "INSERT INTO exhibition_items(id,exhibition_id,object_id,ensemble_id,sort_order) VALUES($1,$2,$3,$4,1)",
  [id('bad-ex-target'),exA,listing.object_id,ensA]
 ),'23514');

 await expectCode(db.pool.query(
  "INSERT INTO exhibition_items(id,exhibition_id,section_id,object_id,sort_order) VALUES($1,$2,$3,$4,2)",
  [id('bad-ex-section'),exB,sectionA,listing.object_id]
 ),'23514');

 await expectCode(db.pool.query(
  "INSERT INTO ensemble_claims(id,ensemble_id,slot_id,claimant_account_id,status) VALUES($1,$2,$3,$4,'PENDING')",
  [id('bad-claim'),ensB,slotA,buyer.id]
 ),'23514');

 await expectCode(db.pool.query(
  "INSERT INTO wanted_requests(id,account_id,ensemble_id,slot_id,query,status,visibility) VALUES($1,$2,$3,$4,'{}'::jsonb,'ACTIVE','PRIVATE')",
  [id('bad-wanted'),buyer.id,ensB,slotA]
 ),'23514');

 await expectCode(db.pool.query(
  "INSERT INTO media_assets(id,entity_type,entity_id,storage_key,content_type,bytes,sha256,role,visibility,status) VALUES($1,'OBJECT',$2,$3,'image/jpeg',10,$4,'DETAIL','PRIVATE','UPLOADING')",
  [id('bad-media'),'missing-object-'+token,'integrity/'+token+'/missing.jpg','a'.repeat(64)]
 ),'23503');

 await expectCode(db.pool.query(
  "INSERT INTO auction_bids(id,auction_id,account_id,max_amount,visible_amount,idempotency_key) VALUES($1,$2,$3,100,200,$4)",
  [id('bad-bid'),auction.id,buyer.id,id('bid-idem')]
 ),'23514');

 await expectCode(db.pool.query(
  "INSERT INTO payouts(id,seller_id,amount_minor,currency,status) VALUES($1,$2,-1,'EUR','ON_HOLD')",
  [id('bad-payout-negative'),listing.seller_id]
 ),'23514');

 await expectCode(db.pool.query(
  "INSERT INTO payouts(id,seller_id,amount_minor,currency,status) VALUES($1,$2,100,'E1R','ON_HOLD')",
  [id('bad-payout-currency'),listing.seller_id]
 ),'23514');

 const auc=id('temp-auction');cleanup.auctions.push(auc);
 await db.pool.query(
  "INSERT INTO auctions(id,object_id,sale_id,status,current_bid,ends_at,state,baseline_bid,reserve_price,increment,starts_at) VALUES($1,$2,'integrity-sale','LIVE',100,now()+interval '1 day','{}'::jsonb,100,100,10,now())",
  [auc,listing.object_id]
 );
 await expectCode(db.pool.query(
  "INSERT INTO auction_settlements(id,auction_id,object_id,buyer_account_id,seller_id,winning_amount_minor,currency,status) VALUES($1,$2,$3,$4,$5,10000,'EUR','PAYMENT_DUE')",
  [id('bad-settlement'),auc,otherObject.id,buyer.id,listing.seller_id]
 ),'23514');

 const objectId=id('guard-object'),objectCode='AQ-INTEGRITY-'+token.slice(0,12),listingId=id('guard-listing'),orderId=id('guard-order'),mediaId=id('guard-media');
 cleanup.objects.push(objectId);cleanup.listings.push(listingId);cleanup.orders.push(orderId);cleanup.media.push(mediaId);
 await db.pool.query(
  "INSERT INTO objects(id,object_code,seller_id,passport,catalogue_status,trust_status,publication_status) VALUES($1,$2,$3,$4,'APPROVED','CLEARED','PRIVATE')",
  [objectId,objectCode,listing.seller_id,{id:objectId,objectId:objectCode,title:{en:'Integrity guard'}}]
 );
 const listingPayload={id:listingId,lotId:objectId,sellerId:listing.seller_id,saleType:'BUY_NOW',price:100,currency:'EUR',status:'INACTIVE'};
 await db.pool.query("INSERT INTO listings(id,object_id,seller_id,status,payload) VALUES($1,$2,$3,'INACTIVE',$4)",[listingId,objectId,listing.seller_id,listingPayload]);
 const orderPayload={id:orderId,listingId,lotId:objectId,buyerClientId:buyer.id,sellerId:listing.seller_id,status:'ORDER_CREATED',price:100,currency:'EUR',createdAt:new Date().toISOString()};
 await db.pool.query("INSERT INTO orders(id,listing_id,object_id,buyer_account_id,seller_id,status,payload,created_at) VALUES($1,$2,$3,$4,$5,'ORDER_CREATED',$6,now())",[orderId,listingId,objectId,buyer.id,listing.seller_id,orderPayload]);

 await expectCode(db.pool.query('DELETE FROM listings WHERE id=$1',[listingId]),'23503');

 await expectCode(db.pool.query(
  "INSERT INTO shipments(id,order_id,object_id,buyer_account_id,seller_id,status) VALUES($1,$2,$3,$4,$5,'QUOTE_REQUIRED')",
  [id('bad-shipment-consistency'),orderId,otherObject.id,buyer.id,listing.seller_id]
 ),'23514');

 await db.pool.query(
  "INSERT INTO media_assets(id,entity_type,entity_id,storage_key,content_type,bytes,sha256,role,visibility,status) VALUES($1,'OBJECT',$2,$3,'image/jpeg',10,$4,'DETAIL','PRIVATE','READY')",
  [mediaId,objectId,'integrity/'+token+'/guard.jpg','b'.repeat(64)]
 );
 await expectCode(db.pool.query('DELETE FROM objects WHERE id=$1',[objectId]),'23503');

 const fkNames=['listings_object_fk','orders_object_fk','auction_settlements_auction_fk','shipments_order_fk','disputes_object_fk','collection_records_object_fk'];
 const found=(await db.pool.query('SELECT conname FROM pg_constraint WHERE conname=ANY($1::text[])',[fkNames])).rows.map(x=>x.conname);
 assert.equal(new Set(found).size,fkNames.length);

 console.log('ANTIQUA v16 PostgreSQL DB integrity: manifest 001..015 + FK/orphan prevention + exact shipment source + cross-aggregate consistency + Money/media guards passed');
}finally{
 for(const m of cleanup.media)await db.pool.query('DELETE FROM media_assets WHERE id=$1',[m]).catch(()=>{});
 for(const o of cleanup.orders)await db.pool.query('DELETE FROM orders WHERE id=$1',[o]).catch(()=>{});
 for(const l of cleanup.listings)await db.pool.query('DELETE FROM listings WHERE id=$1',[l]).catch(()=>{});
 for(const a of cleanup.auctions)await db.pool.query('DELETE FROM auctions WHERE id=$1',[a]).catch(()=>{});
 await db.pool.query('DELETE FROM exhibition_sections WHERE exhibition_id=ANY($1::text[])',[cleanup.exhibitions]).catch(()=>{});
 for(const e of cleanup.exhibitions)await db.pool.query('DELETE FROM exhibitions WHERE id=$1',[e]).catch(()=>{});
 await db.pool.query('DELETE FROM ensemble_slots WHERE ensemble_id=ANY($1::text[])',[cleanup.ensembles]).catch(()=>{});
 for(const e of cleanup.ensembles)await db.pool.query('DELETE FROM ensembles WHERE id=$1',[e]).catch(()=>{});
 for(const o of cleanup.objects)await db.pool.query('DELETE FROM objects WHERE id=$1',[o]).catch(()=>{});
 await db.pool.end();
}
