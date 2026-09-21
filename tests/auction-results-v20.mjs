import assert from 'node:assert/strict';
import {projectPublicAuctionResult,auctionResultCapabilities} from '../auction-results-v20.mjs';

const base={id:'auc-proof',lotId:'lot-proof',currency:'EUR',currentBid:8500,reserveMet:true,bidCount:7,endsAt:'2026-09-20T12:00:00.000Z',state:'CLOSED'};
const settlement={id:'set-secret',auctionId:'auc-proof',objectId:'lot-proof',buyerAccountId:'acct-secret',sellerId:'seller-secret',winningAmountMinor:850000,currency:'EUR',status:'PAYMENT_DUE',metadata:{provider:'secret-provider'}};

let r=projectPublicAuctionResult({...base,state:'LIVE'},null);
assert.equal(r.status,'LIVE');assert.equal(r.hammerAmountMinor,null);assert.equal(r.realizedAmountMinor,null);

r=projectPublicAuctionResult({...base,reserveMet:false,currentBid:6000},null);
assert.equal(r.status,'UNSOLD');assert.equal(r.final,true);assert.equal(r.hammerAmountMinor,null);

r=projectPublicAuctionResult(base,null);
assert.equal(r.status,'PENDING');assert.equal(r.final,false);assert.equal(r.hammerAmountMinor,850000);assert.equal(r.realizedAmountMinor,null);

r=projectPublicAuctionResult(base,settlement);
assert.equal(r.status,'HAMMERED');assert.equal(r.final,false);assert.equal(r.hammerAmountMinor,850000);assert.equal(r.realizedAmountMinor,null);

for(const status of ['PAID','FULFILLMENT']){
 const x=projectPublicAuctionResult(base,{...settlement,status});
 assert.equal(x.status,'SALE_IN_PROGRESS');assert.equal(x.final,false);assert.equal(x.realizedAmountMinor,null);
}

r=projectPublicAuctionResult(base,{...settlement,status:'COMPLETED'});
assert.equal(r.status,'SOLD');assert.equal(r.final,true);assert.equal(r.realizedAmountMinor,850000);

assert.equal(projectPublicAuctionResult(base,{...settlement,status:'DISPUTED'}).status,'UNDER_REVIEW');
assert.equal(projectPublicAuctionResult(base,{...settlement,status:'NONPAYMENT'}).status,'NOT_COMPLETED');
assert.equal(projectPublicAuctionResult(base,{...settlement,status:'REOFFERED'}).status,'REOFFERED');
assert.equal(projectPublicAuctionResult(base,{...settlement,status:'VOID'}).status,'VOID');

const json=JSON.stringify(projectPublicAuctionResult(base,{...settlement,status:'COMPLETED'}));
for(const secret of ['acct-secret','seller-secret','set-secret','secret-provider','buyerAccountId','sellerId','metadata'])assert.equal(json.includes(secret),false,'public result leaked '+secret);

const cap=auctionResultCapabilities();
assert.equal(cap.buyerIdentityExposed,false);
assert.equal(cap.settlementIdentityExposed,false);
assert.equal(cap.hammerVsRealizedSeparated,true);
assert.equal(cap.finalSaleRequiresSettlementCompleted,true);
console.log('ANTIQUA v20 auction results: hammer/realized separation + public status mapping + identity privacy passed');
