import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {db} from '../runtime-v09.mjs';
import {getPublicAuctionResult} from '../auction-results-v20.mjs';

if(!process.env.DATABASE_URL){
 console.log('ANTIQUA v20 PostgreSQL auction results: skipped (DATABASE_URL not set)');
 process.exit(0);
}
assert.equal(db.kind,'POSTGRES');
const buyer=await db.findAccountByEmail('buyer@demo.antiqua');assert.ok(buyer?.id);
const token=crypto.randomUUID().replaceAll('-','').slice(0,12);
const objectId='lot-result-'+token,objectCode='AQ-RESULT-'+token,auctionId='auc-result-'+token,settlementId='set-result-'+token;
const unsoldObjectId='lot-unsold-'+token,unsoldCode='AQ-UNSOLD-'+token,unsoldAuctionId='auc-unsold-'+token;
const ended=new Date(Date.now()-3600_000).toISOString(),started=new Date(Date.now()-7200_000).toISOString();

try{
 await db.pool.query("INSERT INTO objects(id,object_code,passport,catalogue_status,trust_status,publication_status) VALUES($1,$2,$3,'APPROVED','CLEARED','PUBLIC'),($4,$5,$6,'APPROVED','CLEARED','PUBLIC')",[
  objectId,objectCode,{id:objectId,objectId:objectCode,title:{en:'Result proof',ru:'Проверка результата'}},
  unsoldObjectId,unsoldCode,{id:unsoldObjectId,objectId:unsoldCode,title:{en:'Unsold proof',ru:'Проверка непроданного'}}
 ]);
 await db.pool.query("INSERT INTO auctions(id,object_id,sale_id,status,current_bid,ends_at,state,baseline_bid,reserve_price,increment,bid_count,leader_account_id,starts_at) VALUES($1,$2,'sale-v20','CLOSED',8500,$3,$4,6000,7000,250,7,$5,$6),($7,$8,'sale-v20','CLOSED',4000,$3,$9,3500,7000,100,3,NULL,$6)",[
  auctionId,objectId,ended,{currency:'EUR',currentBid:8500,bidCount:7,endsAt:ended,startsAt:started,state:'CLOSED'},buyer.id,started,
  unsoldAuctionId,unsoldObjectId,{currency:'EUR',currentBid:4000,bidCount:3,endsAt:ended,startsAt:started,state:'CLOSED'}
 ]);

 let r=await getPublicAuctionResult(auctionId);
 assert.equal(r.status,'PENDING');assert.equal(r.hammerAmountMinor,850000);assert.equal(r.realizedAmountMinor,null);
 const unsold=await getPublicAuctionResult(unsoldAuctionId);
 assert.equal(unsold.status,'UNSOLD');assert.equal(unsold.final,true);assert.equal(unsold.hammerAmountMinor,null);

 await db.pool.query("INSERT INTO auction_settlements(id,auction_id,object_id,buyer_account_id,seller_id,winning_amount_minor,currency,status,payment_due_at,metadata) VALUES($1,$2,$3,$4,NULL,850000,'EUR','PAYMENT_DUE',now()+interval '3 days',$5)",[settlementId,auctionId,objectId,buyer.id,{provider:'PRIVATE-PROVIDER',paymentReference:'PRIVATE-REF'}]);
 r=await getPublicAuctionResult(auctionId);
 assert.equal(r.status,'HAMMERED');assert.equal(r.realizedAmountMinor,null);

 await db.pool.query("UPDATE auction_settlements SET status='PAID' WHERE id=$1",[settlementId]);
 r=await getPublicAuctionResult(auctionId);
 assert.equal(r.status,'SALE_IN_PROGRESS');assert.equal(r.realizedAmountMinor,null);

 await db.pool.query("UPDATE auction_settlements SET status='COMPLETED',completed_at=now() WHERE id=$1",[settlementId]);
 r=await getPublicAuctionResult(auctionId);
 assert.equal(r.status,'SOLD');assert.equal(r.final,true);assert.equal(r.realizedAmountMinor,850000);

 const json=JSON.stringify(r);
 for(const secret of [buyer.id,settlementId,'PRIVATE-PROVIDER','PRIVATE-REF','buyerAccountId','settlementId','metadata'])assert.equal(json.includes(secret),false,'public result leaked '+secret);
 console.log('ANTIQUA v20 PostgreSQL auction results: pending/unsold/hammered/sold + no settlement identity leakage passed');
}finally{
 await db.pool.query('DELETE FROM auction_settlements WHERE id=$1',[settlementId]).catch(()=>{});
 await db.pool.query('DELETE FROM auctions WHERE id=ANY($1::text[])',[[auctionId,unsoldAuctionId]]).catch(()=>{});
 await db.pool.query('DELETE FROM objects WHERE id=ANY($1::text[])',[[objectId,unsoldObjectId]]).catch(()=>{});
 await db.pool.end();
}
