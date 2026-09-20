import assert from 'node:assert/strict';
import {db,offers,orders} from '../runtime-v09.mjs';
import {setObjectFlag} from '../preferences-v14.mjs';
import {sellerAnalyticsFor} from '../seller-analytics-v17.mjs';

const seller=await db.findAccountByEmail('seller@demo.antiqua');
const buyer=await db.findAccountByEmail('buyer@demo.antiqua');
assert.ok(seller?.sellerId,'preview seller fixture required');
assert.ok(buyer?.id,'preview buyer fixture required');

await setObjectFlag(db,buyer.id,'lot-109','SAVED',true);
const offerId='off-analytics-proof',orderId='ord-analytics-proof';
offers.set(offerId,{id:offerId,listingId:'lst-109',lotId:'lot-109',sellerId:seller.sellerId,buyerClientId:buyer.id,status:'ACCEPTED',buyerAmount:7000,sellerAmount:null,currency:'EUR',history:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
orders.set(orderId,{id:orderId,listingId:'lst-109',lotId:'lot-109',sellerId:seller.sellerId,buyerClientId:buyer.id,price:7000,currency:'EUR',status:'AWAITING_PAYMENT_CONNECTOR',createdAt:new Date().toISOString()});

try{
 const a=await sellerAnalyticsFor(seller);
 assert.equal(a.sellerId,seller.sellerId);
 assert.equal(a.measurement.mode,'EVENTS_ONLY');
 assert.equal(a.measurement.viewsTracked,true);
 assert.equal(a.measurement.viewDefinition,'DEDUPED_30_MINUTE_PASSPORT_SESSIONS');
 assert.equal(a.measurement.visitorIdentityExposed,false);
 assert.ok(a.summary.activeListings>=2);
 assert.ok(a.summary.drafts>=2);
 assert.equal(typeof a.summary.settledByCurrency,'object');
 const row=a.objects.find(x=>x.objectId==='lot-109');
 assert.ok(row,'seller object must be projected');
 assert.ok(row.saved>=1,'real saved-object event must be counted');
 assert.ok(row.offers>=1,'real offer event must be counted');
 assert.ok(row.acceptedOffers>=1,'accepted offer must be counted');
 assert.ok(row.orders>=1,'real order event must be counted');
 assert.equal(JSON.stringify(a).includes(buyer.id),false,'buyer identity must not leak into seller analytics');
 console.log('ANTIQUA v17 seller analytics: measured engagement + currency-safe settlements + buyer privacy passed');
}finally{
 offers.delete(offerId);orders.delete(orderId);
}
