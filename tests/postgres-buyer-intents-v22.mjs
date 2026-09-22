import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {db} from '../runtime-v09.mjs';
import {getBuyerIntents} from '../buyer-intents-v22.mjs';

if(!process.env.DATABASE_URL){
 console.log('ANTIQUA v22 PostgreSQL buyer intent: skipped (DATABASE_URL not set)');
 process.exit(0);
}
assert.equal(db.kind,'POSTGRES');
const other=await db.findAccountByEmail('buyer@demo.antiqua');assert.ok(other?.id);
const token=crypto.randomUUID().replaceAll('-','').slice(0,12),buyerId='acct-intent-'+token,email='intent-'+token+'@example.test';
const objectId='lot-intent-'+token,objectCode='AQ-INTENT-'+token,auctionId='auc-intent-'+token,listingId='lst-intent-'+token,offerId='off-intent-'+token,orderId='ord-intent-'+token;
const now=Date.now(),starts=new Date(now-3600_000).toISOString(),ends=new Date(now+3600_000).toISOString();
const buyer={id:buyerId,email,displayName:'Intent proof',accountType:'BUYER',status:'ACTIVE',sellerId:null,twofaStatus:'DISABLED',roles:['BUYER']};

try{
 await db.pool.query("INSERT INTO accounts(id,email,display_name,password_hash,account_type,status,twofa_status,created_at) VALUES($1,$2,'Intent proof','test-hash','BUYER','ACTIVE','DISABLED',now())",[buyerId,email]);
 await db.pool.query("INSERT INTO account_roles(account_id,role) VALUES($1,'BUYER')",[buyerId]);
 await db.pool.query("INSERT INTO objects(id,object_code,seller_id,passport,catalogue_status,trust_status,publication_status) VALUES($1,$2,'seller-preview',$3,'APPROVED','CLEARED','PUBLIC')",[objectId,objectCode,{id:objectId,objectId:objectCode,title:{en:'Buyer intent proof',ru:'Проверка намерения покупателя'}}]);
 await db.pool.query("INSERT INTO auctions(id,object_id,sale_id,status,current_bid,ends_at,state,baseline_bid,reserve_price,increment,bid_count,leader_account_id,starts_at) VALUES($1,$2,'sale-v22','LIVE',10250,$3,$4,5000,6000,250,6,$5,$6)",[auctionId,objectId,ends,{id:auctionId,lotId:objectId,saleId:'sale-v22',currency:'EUR',currentBid:10250,increment:250,bidCount:6,startsAt:starts,endsAt:ends,state:'LIVE'},other.id,starts]);
 await db.pool.query("INSERT INTO auction_proxy_positions(auction_id,account_id,max_amount,accepted_at,updated_at) VALUES($1,$2,10000,now(),now()),($1,$3,12000,now(),now())",[auctionId,buyerId,other.id]);
 await db.putListing({id:listingId,lotId:objectId,sellerId:'seller-preview',saleType:'MAKE_OFFER',price:5600,currency:'EUR',negotiable:true,status:'ACTIVE',shippingFrom:'Amsterdam',publishedAt:new Date().toISOString()});
 const offer={id:offerId,listingId,lotId:objectId,sellerId:'seller-preview',buyerClientId:buyerId,status:'COUNTERED_BY_SELLER',buyerAmount:4500,sellerAmount:5200,currency:'EUR',history:[{by:'BUYER',amount:4500,time:new Date().toISOString()},{by:'SELLER',amount:5200,time:new Date().toISOString()}],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
 await db.putOffer(offer);

 let intents=await getBuyerIntents(buyer);
 assert.equal(intents.summary.activeBids,1);assert.equal(intents.summary.outbid,1);assert.equal(intents.summary.activeOffers,1);assert.equal(intents.summary.needsAttention,2);
 const bid=intents.bids.find(x=>x.auctionId===auctionId);assert.ok(bid);assert.equal(bid.maxAmount,10000);assert.equal(bid.leading,false);assert.equal(bid.nextAction.type,'RAISE_MAX');assert.equal(bid.nextAction.minimum,10500);
 const oi=intents.offers.find(x=>x.offerId===offerId);assert.ok(oi);assert.equal(oi.nextAction.type,'REVIEW_COUNTER');assert.deepEqual(oi.nextAction.allowed,['ACCEPT','COUNTER']);assert.equal(oi.askingPrice,5600);

 const otherIntents=await getBuyerIntents(other),otherBid=otherIntents.bids.find(x=>x.auctionId===auctionId);assert.ok(otherBid);assert.equal(otherBid.maxAmount,12000);assert.equal(otherBid.leading,true);assert.notEqual(otherBid.maxAmount,bid.maxAmount,'one buyer must never receive another buyer private maximum');

 await db.pool.query('UPDATE auctions SET current_bid=9500,leader_account_id=$2 WHERE id=$1',[auctionId,buyerId]);
 intents=await getBuyerIntents(buyer);const leading=intents.bids.find(x=>x.auctionId===auctionId);assert.equal(leading.leading,true);assert.equal(leading.nextAction.type,'WAIT');

 offer.status='ACCEPTED';offer.updatedAt=new Date().toISOString();await db.putOffer(offer);
 await db.putOrder({id:orderId,listingId,sourceOfferId:offerId,lotId:objectId,sellerId:'seller-preview',buyerClientId:buyerId,price:5200,currency:'EUR',status:'AWAITING_PAYMENT_CONNECTOR',paymentStatus:'NOT_CONFIGURED',invoiceStatus:'DRAFT_NOT_ISSUED',shippingStatus:'QUOTE_REQUIRED',taxStatus:'NOT_CALCULATED',timeline:[{status:'OFFER_ACCEPTED',at:new Date().toISOString()}],createdAt:new Date().toISOString()});
 intents=await getBuyerIntents(buyer);
 assert.equal(intents.summary.activeOffers,0);const storedOrder=(await db.pool.query('SELECT payload FROM orders WHERE id=$1',[orderId])).rows[0].payload;assert.equal(storedOrder.sourceOfferId,offerId);assert.equal(intents.offers.find(x=>x.offerId===offerId).nextAction.type,'OPEN_ORDER');assert.equal(intents.offers.find(x=>x.offerId===offerId).nextAction.orderId,orderId);
 assert.equal(intents.summary.needsAttention,0);

 console.log('ANTIQUA v22 PostgreSQL buyer intent: DB-backed bid positions + private max isolation + offer next action + order transition passed');
}finally{
 await db.pool.query('DELETE FROM orders WHERE id=$1',[orderId]).catch(()=>{});
 await db.pool.query('DELETE FROM offers WHERE id=$1',[offerId]).catch(()=>{});
 await db.pool.query('DELETE FROM listings WHERE id=$1',[listingId]).catch(()=>{});
 await db.pool.query('DELETE FROM auctions WHERE id=$1',[auctionId]).catch(()=>{});
 await db.pool.query('DELETE FROM objects WHERE id=$1',[objectId]).catch(()=>{});
 await db.pool.query('DELETE FROM accounts WHERE id=$1',[buyerId]).catch(()=>{});
 await db.pool.end();
}
