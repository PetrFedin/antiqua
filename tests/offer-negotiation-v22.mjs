import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {db,offers,orders,listing} from '../runtime-v09.mjs';
import {createOffer,getOffer,actOnOffer,offerNegotiationCapabilities} from '../offer-negotiation-v22.mjs';

assert.notEqual(db.kind,'POSTGRES','memory authority test must not use PostgreSQL');
const buyer=await db.findAccountByEmail('buyer@demo.antiqua');
const seller=await db.findAccountByEmail('seller@demo.antiqua');
assert.ok(buyer?.id);assert.ok(seller?.sellerId);

const key=prefix=>prefix+'-'+crypto.randomUUID();
const future=hours=>new Date(Date.now()+hours*3600000).toISOString();
const caps=offerNegotiationCapabilities();
assert.equal(caps.optimisticLocking,true);
assert.equal(caps.idempotency,true);
assert.equal(caps.immutableHistory,true);
assert.equal(caps.atomicAcceptToOrder,true);

const createKey=key('create');
let x=await createOffer(buyer,'lst-109',{amount:'7000',currency:'EUR',expiresAt:future(72),comment:'Collector opening offer',clientActionId:createKey});
assert.equal(x.idempotent,false);const offerId=x.offer.id;
assert.equal(x.offer.status,'OPEN');assert.equal(x.offer.version,1);assert.equal(x.offer.currentAmountMinor,700000);
assert.equal(x.offer.awaitingRole,'SELLER');assert.deepEqual(x.offer.allowedActions,['WITHDRAW']);
let replay=await createOffer(buyer,'lst-109',{amount:'1',currency:'EUR',expiresAt:future(24),clientActionId:createKey});
assert.equal(replay.idempotent,true);assert.equal(replay.offer.id,offerId);assert.equal(replay.offer.currentAmountMinor,700000);

await assert.rejects(
 ()=>actOnOffer(buyer,offerId,{action:'ACCEPT',expectedVersion:1,clientActionId:key('buyer-invalid')}),
 e=>e.code==='OFFER_ACTION_DENIED'
);

x=await actOnOffer(seller,offerId,{action:'COUNTER',amount:'7400',comment:'Dealer counter',expiresAt:future(72),expectedVersion:1,clientActionId:key('seller-counter')});
assert.equal(x.offer.status,'COUNTERED');assert.equal(x.offer.version,2);assert.equal(x.offer.currentAmountMinor,740000);assert.equal(x.offer.awaitingRole,'BUYER');
await assert.rejects(
 ()=>actOnOffer(buyer,offerId,{action:'ACCEPT',expectedVersion:1,clientActionId:key('stale')}),
 e=>e.code==='OFFER_VERSION_CONFLICT'&&e.currentVersion===2
);

x=await actOnOffer(buyer,offerId,{action:'COUNTER',amount:'7200',comment:'Improved buyer counter',expiresAt:future(72),expectedVersion:2,clientActionId:key('buyer-counter')});
assert.equal(x.offer.version,3);assert.equal(x.offer.currentProposerRole,'BUYER');assert.equal(x.offer.awaitingRole,'SELLER');

const acceptKey=key('accept');
x=await actOnOffer(seller,offerId,{action:'ACCEPT',expectedVersion:3,clientActionId:acceptKey});
assert.equal(x.idempotent,false);assert.equal(x.offer.status,'ACCEPTED');assert.equal(x.offer.version,4);assert.ok(x.order?.id);
assert.equal(x.order.offerId,offerId);assert.equal(x.order.price,7200);assert.equal(x.order.status,'AWAITING_PAYMENT_CONNECTOR');
assert.equal(listing('lst-109').status,'RESERVED');assert.equal(orders.get(x.order.id)?.id,x.order.id);

replay=await actOnOffer(seller,offerId,{action:'ACCEPT',expectedVersion:3,clientActionId:acceptKey});
assert.equal(replay.idempotent,true);assert.equal(replay.order.id,x.order.id);
const accepted=await getOffer(buyer,offerId);
assert.deepEqual(accepted.history.map(e=>e.version),[1,2,3,4]);
assert.deepEqual(accepted.history.map(e=>e.eventType),['CREATED','COUNTERED','COUNTERED','ACCEPTED']);

let w=await createOffer(buyer,'lst-110',{amount:'5000',currency:'EUR',expiresAt:future(24),clientActionId:key('withdraw-create')});
w=await actOnOffer(buyer,w.offer.id,{action:'WITHDRAW',expectedVersion:1,clientActionId:key('withdraw')});
assert.equal(w.offer.status,'WITHDRAWN');assert.equal(w.offer.version,2);

let r=await createOffer(buyer,'lst-110',{amount:'4950',currency:'EUR',expiresAt:future(24),clientActionId:key('reject-create')});
r=await actOnOffer(seller,r.offer.id,{action:'REJECT',expectedVersion:1,comment:'Not acceptable',clientActionId:key('reject')});
assert.equal(r.offer.status,'REJECTED');assert.equal(r.offer.version,2);

let e=await createOffer(buyer,'lst-110',{amount:'4900',currency:'EUR',expiresAt:future(24),clientActionId:key('expire-create')});
const raw=offers.get(e.offer.id);raw.expiresAt=new Date(Date.now()-1000).toISOString();
e={offer:await getOffer(buyer,e.offer.id)};
assert.equal(e.offer.status,'EXPIRED');assert.equal(e.offer.version,2);assert.equal(e.offer.history.at(-1).eventType,'EXPIRED');

console.log('ANTIQUA v22 offer negotiation: state machine + replay + optimistic lock + accept-to-order + reject/withdraw/expire passed');
