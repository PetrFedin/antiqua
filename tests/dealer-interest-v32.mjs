import assert from 'node:assert/strict';
import {buildDealerInterestProjection,dealerInterestCapabilities} from '../dealer-interest-v32.mjs';

const account={id:'seller-test',sellerId:'seller-test',roles:['SELLER']};
const row=(id,extra={})=>({objectId:id,objectCode:id,title:{en:id,ru:id},listingStatus:'ACTIVE',listingPrice:1000,currency:'EUR',views:0,saved:0,watching:0,conversations:0,offers:0,acceptedOffers:0,orders:0,bids:0,settlements:0,openDisputes:0,...extra});
const analytics={objects:[
 row('o-discovered',{views:1}),
 row('o-engaged',{views:2,saved:1}),
 row('o-inquiry',{views:1,conversations:1}),
 row('o-viewing',{views:1,conversations:1}),
 row('o-negotiating',{views:1,offers:1}),
 row('o-transacting',{views:1,orders:1}),
 row('o-historical',{views:1,offers:2})
]};
const dealerLeads={leads:[
 {objectId:'o-inquiry',stage:'NEW_LEAD',potentialCurrency:'EUR',potentialAmountMinor:100000,refs:{conversationId:'c1'},nextAction:{code:'REPLY_TO_BUYER'},updatedAt:'2026-09-28T10:00:00Z'},
 {objectId:'o-viewing',stage:'VIEWING',potentialCurrency:'EUR',potentialAmountMinor:120000,refs:{viewingRequestId:'v1'},nextAction:{code:'PREPARE_VIEWING'},updatedAt:'2026-09-28T11:00:00Z'},
 {objectId:'o-negotiating',stage:'NEGOTIATING',potentialCurrency:'USD',potentialAmountMinor:130000,refs:{offerId:'f1'},nextAction:{code:'RESPOND_TO_OFFER'},updatedAt:'2026-09-28T12:00:00Z'},
 {objectId:'o-historical',stage:'LOST',potentialCurrency:'EUR',potentialAmountMinor:90000,refs:{offerId:'f2'},nextAction:{code:'NONE'},updatedAt:'2026-09-27T12:00:00Z'}
]};
const editorialByObject={'o-engaged':{opens:3,uniqueViewers:2,lastOccurredAt:'2026-09-28T09:00:00Z'}};
const p=buildDealerInterestProjection({account,analytics,dealerLeads,editorialByObject});
const by=Object.fromEntries(p.objects.map(x=>[x.objectId,x]));
assert.equal(by['o-discovered'].stage,'DISCOVERED');
assert.equal(by['o-engaged'].stage,'ENGAGED');
assert.equal(by['o-inquiry'].stage,'INQUIRY');
assert.equal(by['o-viewing'].stage,'VIEWING');
assert.equal(by['o-negotiating'].stage,'NEGOTIATING');
assert.equal(by['o-transacting'].stage,'TRANSACTING');
assert.equal(by['o-historical'].stage,'ENGAGED','historical lost offers must not look like active negotiation');
assert.equal(by['o-engaged'].passive.editorialUniqueViewers,2);
assert.equal(by['o-engaged'].privacy.passiveViewerIdentityExposed,false);
assert.equal(by['o-inquiry'].privacy.explicitLeadIdentityAvailableOnlyInLeadWorkflow,true);
assert.deepEqual(p.summary.potentialByCurrency,{EUR:220000,USD:130000});
assert.equal(p.summary.explicitCommercialIntent,4);
assert.equal(dealerInterestCapabilities().opaqueScore,false);
assert.equal(dealerInterestCapabilities().crossSignalUniqueAudience,false);
console.log('ANTIQUA v32 Dealer Interest: explainable stages + no stale negotiation + privacy boundary passed');
