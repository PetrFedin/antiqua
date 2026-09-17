import assert from 'node:assert/strict';
import crypto from 'node:crypto';

if(!process.env.DATABASE_URL){console.log('ANTIQUA v16 order/verification lifecycle: skipped (DATABASE_URL not set)');process.exit(0)}

const {db}=await import('../runtime-v09.mjs');
const {createOrderAuthority,transitionOrder,captureOrderPaymentAuthority,startVerificationAuthority,transitionVerification}=await import('../order-verification-lifecycle-v16.mjs');
const {processOutboxBatch}=await import('../worker-runtime-v15.mjs');
const token=crypto.randomUUID();

try{
  assert.equal(db.kind,'POSTGRES');
  const buyer=await db.findAccountByEmail('buyer@demo.antiqua'),seller=await db.findAccountByEmail('seller@demo.antiqua'),operator=await db.findAccountByEmail('operator@demo.antiqua');
  assert.ok(buyer?.id);assert.ok(seller?.sellerId);assert.ok(operator?.roles?.includes('ADMIN'));

  // One listing can create only one live order under concurrent buy attempts.
  const listingId=`lst-race-${token}`,listingPayload={id:listingId,lotId:'lot-102',sellerId:seller.sellerId,status:'ACTIVE',price:2100,currency:'EUR'};
  await db.pool.query("INSERT INTO listings(id,object_id,seller_id,status,payload,updated_at) VALUES($1,'lot-102',$2,'ACTIVE',$3,now())",[listingId,seller.sellerId,listingPayload]);
  const makeRaceOrder=n=>({id:`ord-race-${n}-${token}`,listingId,lotId:'lot-102',sellerId:seller.sellerId,buyerClientId:buyer.id,price:2100,currency:'EUR',paymentStatus:'NOT_CONFIGURED',invoiceStatus:'DRAFT_NOT_ISSUED',shippingStatus:'QUOTE_REQUIRED',taxStatus:'NOT_CALCULATED',timeline:[{status:'ORDER_CREATED',at:new Date().toISOString()}],createdAt:new Date().toISOString()});
  const raced=await Promise.allSettled([createOrderAuthority(buyer,makeRaceOrder(1),{sourceKey:`race-1-${token}`}),createOrderAuthority(buyer,makeRaceOrder(2),{sourceKey:`race-2-${token}`})]);
  assert.equal(raced.filter(x=>x.status==='fulfilled').length,1);const rejected=raced.find(x=>x.status==='rejected');assert.equal(rejected?.reason?.code,'ITEM_UNAVAILABLE');
  const raceOrder=raced.find(x=>x.status==='fulfilled').value;assert.equal((await db.pool.query('SELECT status FROM listings WHERE id=$1',[listingId])).rows[0].status,'RESERVED');assert.equal(Number((await db.pool.query('SELECT count(*) AS n FROM orders WHERE listing_id=$1',[listingId])).rows[0].n),1);
  const cancelledRace=await transitionOrder(buyer,raceOrder.id,'CANCELLED',{sourceKey:`cancel-race-${token}`});assert.equal(cancelledRace.status,'CANCELLED');assert.equal((await db.pool.query('SELECT status FROM listings WHERE id=$1',[listingId])).rows[0].status,'ACTIVE');

  // Payment authority holds the order lock across the recoverable effect; cancel loses after payment wins.
  const payListingId=`lst-payrace-${token}`,payListingPayload={id:payListingId,lotId:'lot-103',sellerId:seller.sellerId,status:'ACTIVE',price:3300,currency:'EUR'};
  await db.pool.query("INSERT INTO listings(id,object_id,seller_id,status,payload,updated_at) VALUES($1,'lot-103',$2,'ACTIVE',$3,now())",[payListingId,seller.sellerId,payListingPayload]);
  const payRaceOrder=await createOrderAuthority(buyer,{id:`ord-payrace-${token}`,listingId:payListingId,lotId:'lot-103',sellerId:seller.sellerId,buyerClientId:buyer.id,price:3300,currency:'EUR',paymentStatus:'NOT_CONFIGURED',invoiceStatus:'DRAFT_NOT_ISSUED',shippingStatus:'QUOTE_REQUIRED',taxStatus:'NOT_CALCULATED',timeline:[{status:'ORDER_CREATED',at:new Date().toISOString()}],createdAt:new Date().toISOString()},{sourceKey:`create-payrace-${token}`});
  let effectStartedResolve;const effectStarted=new Promise(r=>{effectStartedResolve=r});
  const payment=captureOrderPaymentAuthority({id:'provider',roles:[]},payRaceOrder.id,{lifecycleAuthority:'PROVIDER',sourceKey:`payrace-${token}`,effect:async current=>{effectStartedResolve();await new Promise(r=>setTimeout(r,75));return{paymentEffectRecorded:true,patch:{paymentStatus:'PAID',finance:{provider:'TEST_PSP',externalReference:`payrace-${token}`},timeline:[...(current.timeline||[]),{status:'PAID',at:new Date().toISOString()}]}}}});
  await effectStarted;const cancellation=transitionOrder(buyer,payRaceOrder.id,'CANCELLED',{sourceKey:`cancel-payrace-${token}`});const [paid,cancelled]=await Promise.allSettled([payment,cancellation]);assert.equal(paid.status,'fulfilled');assert.equal(paid.value.order.status,'PAID');assert.equal(cancelled.status,'rejected');assert.equal(cancelled.reason.code,'LIFECYCLE_TRANSITION_INVALID');assert.equal((await db.pool.query('SELECT status FROM listings WHERE id=$1',[payListingId])).rows[0].status,'RESERVED');

  const orderId=`ord-life-${token}`,orderKey=`order-create-${token}`;
  const created=await createOrderAuthority(buyer,{id:orderId,listingId:null,lotId:'lot-101',sellerId:seller.sellerId,buyerClientId:buyer.id,price:5500,currency:'EUR',paymentStatus:'NOT_CONFIGURED',invoiceStatus:'DRAFT_NOT_ISSUED',shippingStatus:'QUOTE_REQUIRED',taxStatus:'NOT_CALCULATED',timeline:[{status:'ORDER_CREATED',at:new Date().toISOString()}],createdAt:new Date().toISOString()},{sourceKey:orderKey});
  assert.equal(created.status,'AWAITING_PAYMENT_CONNECTOR');assert.equal(created.lifecycle.action,'CREATE');
  const createReplay=await createOrderAuthority(buyer,{...created},{sourceKey:orderKey});assert.equal(createReplay.idempotentTransition,true);

  const payKey=`order-pay-${token}`;
  let order=await transitionOrder({id:'provider',roles:[],sellerId:null},orderId,'PAID',{lifecycleAuthority:'PROVIDER',lifecycleFacts:{PAYMENT_EFFECT_RECORDED:true},sourceKey:payKey,patch:{paymentStatus:'PAID',finance:{paymentLedgerTransactionId:`ledger-${token}`,payoutId:`payout-${token}`,provider:'TEST_PSP',externalReference:payKey},timeline:[...(created.timeline||[]),{status:'PAID',at:new Date().toISOString()}]}});
  assert.equal(order.status,'PAID');assert.equal(order.idempotentTransition,false);
  const payReplay=await transitionOrder({id:'provider',roles:[],sellerId:null},orderId,'PAID',{lifecycleAuthority:'PROVIDER',lifecycleFacts:{PAYMENT_EFFECT_RECORDED:true},sourceKey:payKey});assert.equal(payReplay.idempotentTransition,true);assert.equal(payReplay.status,'PAID');
  await assert.rejects(()=>transitionOrder(buyer,orderId,'CANCELLED',{sourceKey:payKey}),e=>e.code==='LIFECYCLE_EVENT_CONFLICT');

  const ownKey=`order-own-${token}`;
  order=await transitionOrder(buyer,orderId,'OWNERSHIP_TRANSFERRED',{lifecycleFacts:{RECEIPT_CONFIRMED:true},sourceKey:ownKey,patch:{shippingStatus:'DELIVERED',timeline:[...(order.timeline||[]),{status:'OWNERSHIP_TRANSFERRED',at:new Date().toISOString()}]}});
  assert.equal(order.status,'OWNERSHIP_TRANSFERRED');assert.equal(order.lifecycle.terminal,true);
  const orderBeforeInvalid=(await db.pool.query("SELECT count(*)::int AS n FROM lifecycle_events WHERE domain='ORDER' AND aggregate_id=$1",[orderId])).rows[0].n;
  await assert.rejects(()=>transitionOrder(buyer,orderId,'CANCELLED',{}),e=>e.code==='LIFECYCLE_TRANSITION_INVALID');
  const orderAfterInvalid=(await db.pool.query("SELECT count(*)::int AS n FROM lifecycle_events WHERE domain='ORDER' AND aggregate_id=$1",[orderId])).rows[0].n;assert.equal(orderAfterInvalid,orderBeforeInvalid);

  let rows=(await db.pool.query("SELECT action,from_state,to_state,authority,source_key FROM lifecycle_events WHERE domain='ORDER' AND aggregate_id=$1 ORDER BY created_at,id",[orderId])).rows;
  assert.deepEqual(rows.map(x=>[x.action,x.from_state,x.to_state]),[['CREATE','NONE','AWAITING_PAYMENT_CONNECTOR'],['CAPTURE_PAYMENT','AWAITING_PAYMENT_CONNECTOR','PAID'],['CONFIRM_OWNERSHIP','PAID','OWNERSHIP_TRANSFERRED']]);
  assert.deepEqual(rows.map(x=>x.authority),['BUYER','PROVIDER','BUYER']);

  const verificationId=`ver-life-${token}`,startKey=`ver-start-${token}`;
  let verification=(await startVerificationAuthority(buyer,{id:verificationId,caseType:'KYC',subjectType:'PERSON',sourceKey:startKey})).verification;
  assert.equal(verification.status,'PENDING');
  const reviewKey=`ver-review-${token}`;
  let vr=await transitionVerification({id:'provider',roles:[]},verificationId,'IN_PROGRESS',{lifecycleAuthority:'PROVIDER',lifecycleFacts:{DECISION_SOURCE_VERIFIED:true},sourceKey:reviewKey,patch:{provider:'TEST_KYC',providerReference:`KYC-${token}`}});assert.equal(vr.verification.status,'IN_PROGRESS');
  const reviewReplay=await transitionVerification({id:'provider',roles:[]},verificationId,'IN_PROGRESS',{lifecycleAuthority:'PROVIDER',lifecycleFacts:{DECISION_SOURCE_VERIFIED:true},sourceKey:reviewKey});assert.equal(reviewReplay.idempotentTransition,true);
  await assert.rejects(()=>transitionVerification({id:'provider',roles:[]},verificationId,'MORE_INFO_REQUIRED',{lifecycleAuthority:'PROVIDER',lifecycleFacts:{DECISION_SOURCE_VERIFIED:true},sourceKey:reviewKey}),e=>e.code==='LIFECYCLE_EVENT_CONFLICT');

  vr=await transitionVerification(operator,verificationId,'REJECTED',{lifecycleAuthority:'OPERATOR',lifecycleFacts:{DECISION_SOURCE_VERIFIED:true},sourceKey:`ver-reject-${token}`,patch:{riskLevel:'MEDIUM',decisionReason:'Test rejection'}});assert.equal(vr.verification.status,'REJECTED');assert.ok(vr.verification.decidedAt);
  vr=await transitionVerification(buyer,verificationId,'PENDING',{sourceKey:`ver-resubmit-${token}`,patch:{submittedAt:new Date().toISOString(),decisionReason:''}});assert.equal(vr.verification.status,'PENDING');assert.equal(vr.lifecycle.action,'RESUBMIT');assert.equal(vr.verification.decidedAt,null);
  vr=await transitionVerification(operator,verificationId,'VERIFIED',{lifecycleAuthority:'OPERATOR',lifecycleFacts:{DECISION_SOURCE_VERIFIED:true},sourceKey:`ver-verify-${token}`,patch:{riskLevel:'LOW',decisionReason:'Cleared'}});assert.equal(vr.verification.status,'VERIFIED');assert.ok(vr.verification.decidedAt);

  const verificationBeforeInvalid=(await db.pool.query("SELECT count(*)::int AS n FROM lifecycle_events WHERE domain='VERIFICATION' AND aggregate_id=$1",[verificationId])).rows[0].n;
  await assert.rejects(()=>transitionVerification(buyer,verificationId,'REJECTED',{}),e=>['LIFECYCLE_TRANSITION_INVALID','LIFECYCLE_AUTHORITY_DENIED'].includes(e.code));
  const verificationAfterInvalid=(await db.pool.query("SELECT count(*)::int AS n FROM lifecycle_events WHERE domain='VERIFICATION' AND aggregate_id=$1",[verificationId])).rows[0].n;assert.equal(verificationAfterInvalid,verificationBeforeInvalid);

  rows=(await db.pool.query("SELECT action,from_state,to_state,authority FROM lifecycle_events WHERE domain='VERIFICATION' AND aggregate_id=$1 ORDER BY created_at,id",[verificationId])).rows;
  assert.deepEqual(rows.map(x=>[x.action,x.from_state,x.to_state]),[['START','NONE','PENDING'],['BEGIN_REVIEW','PENDING','IN_PROGRESS'],['REJECT','IN_PROGRESS','REJECTED'],['RESUBMIT','REJECTED','PENDING'],['VERIFY','PENDING','VERIFIED']]);
  assert.deepEqual(rows.map(x=>x.authority),['BUYER','PROVIDER','OPERATOR','BUYER','OPERATOR']);

  let pending=(await db.pool.query("SELECT count(*)::int AS n FROM outbox_events WHERE aggregate_id=ANY($1::text[]) AND status='PENDING' AND payload->>'kind'='LIFECYCLE_TRANSITION'",[[orderId,verificationId]])).rows[0].n;assert.equal(pending,8);
  for(let i=0;i<4&&pending;i++){await processOutboxBatch({workerId:`order-ver-life-${token}-${i}`,limit:100,leaseMs:5000});pending=(await db.pool.query("SELECT count(*)::int AS n FROM outbox_events WHERE aggregate_id=ANY($1::text[]) AND status='PENDING' AND payload->>'kind'='LIFECYCLE_TRANSITION'",[[orderId,verificationId]])).rows[0].n}
  assert.equal(pending,0);

  console.log('ANTIQUA v16 order/verification lifecycle: listing serialization + payment/cancel lock + journal/outbox + provider replay/conflict + resubmit decision reset + invalid rollback passed');
}finally{await db.pool.end()}
