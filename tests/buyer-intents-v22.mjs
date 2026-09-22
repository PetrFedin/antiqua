import assert from 'node:assert/strict';
import {projectBidIntent,projectOfferIntent,getBuyerIntents,buyerIntentCapabilities} from '../buyer-intents-v22.mjs';
import {db} from '../runtime-v09.mjs';

const accountId='acct-proof';
const liveBase={auctionId:'auc-proof',objectId:'lot-proof',currency:'EUR',status:'LIVE',currentBid:6000,increment:250,bidCount:7,startsAt:new Date(Date.now()-3600000).toISOString(),endsAt:new Date(Date.now()+3600000).toISOString(),maxAmount:8000,updatedAt:new Date().toISOString()};

let x=projectBidIntent({...liveBase,leaderAccountId:accountId},accountId);
assert.equal(x.leading,true);assert.equal(x.nextAction.type,'WAIT');assert.equal(x.needsAttention,false);assert.equal(x.maxAmount,8000);

x=projectBidIntent({...liveBase,leaderAccountId:'acct-other'},accountId);
assert.equal(x.leading,false);assert.equal(x.nextAction.type,'RAISE_MAX');assert.equal(x.nextAction.minimum,6250);assert.equal(x.needsAttention,true);

x=projectBidIntent({...liveBase,status:'CLOSED',endsAt:new Date(Date.now()-1000).toISOString(),leaderAccountId:accountId},accountId);
assert.equal(x.state,'CLOSED');assert.equal(x.nextAction.type,'VIEW_RESULT');

let o=projectOfferIntent({id:'off-1',listingId:'lst-110',lotId:'lot-110',status:'PENDING',buyerAmount:4500,sellerAmount:null,currency:'EUR'});
assert.equal(o.nextAction.type,'WAIT');assert.equal(o.needsAttention,false);

o=projectOfferIntent({id:'off-2',listingId:'lst-110',lotId:'lot-110',status:'COUNTERED_BY_SELLER',buyerAmount:4500,sellerAmount:5200,currency:'EUR'});
assert.equal(o.nextAction.type,'REVIEW_COUNTER');assert.deepEqual(o.nextAction.allowed,['ACCEPT','COUNTER']);assert.equal(o.nextAction.counterMin,4501);assert.equal(o.nextAction.counterMax,5199);assert.equal(o.needsAttention,true);

o=projectOfferIntent({id:'off-3',listingId:'lst-110',lotId:'lot-110',status:'COUNTERED_BY_SELLER',buyerAmount:5000,sellerAmount:5001,currency:'EUR'});
assert.deepEqual(o.nextAction.allowed,['ACCEPT']);assert.equal(o.nextAction.counterMin,null);assert.equal(o.nextAction.counterMax,null);

o=projectOfferIntent({id:'off-4',listingId:'lst-110',lotId:'lot-110',status:'COUNTERED_BY_BUYER',buyerAmount:4800,sellerAmount:5200,currency:'EUR'});
assert.equal(o.nextAction.type,'WAIT');

o=projectOfferIntent({id:'off-5',listingId:'lst-110',lotId:'lot-110',status:'ACCEPTED',buyerAmount:4800,sellerAmount:5200,currency:'EUR'},{id:'ord-5'});
assert.equal(o.nextAction.type,'OPEN_ORDER');assert.equal(o.nextAction.orderId,'ord-5');

const operator=await db.findAccountByEmail('operator@demo.antiqua');assert.ok(operator);await assert.rejects(()=>getBuyerIntents(operator),e=>e.code==='BUYER_REQUIRED');

const cap=buyerIntentCapabilities();assert.equal(cap.databaseBackedBids,true);assert.equal(cap.privateMaximumOwnerOnly,true);assert.equal(cap.mutationsReuseExistingAuthorities,true);
console.log('ANTIQUA v22 buyer intent: bid/offer state projection + authority-aligned next actions passed');
