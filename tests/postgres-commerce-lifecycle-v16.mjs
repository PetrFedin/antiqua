import assert from 'node:assert/strict';
import crypto from 'node:crypto';

if(!process.env.DATABASE_URL){console.log('ANTIQUA v16 commerce lifecycle: skipped (DATABASE_URL not set)');process.exit(0)}

const {db}=await import('../runtime-v09.mjs');
const {transitionSettlement,quoteShipment,transitionShipment}=await import('../commerce-lifecycle-v16.mjs');
const {processOutboxBatch}=await import('../worker-runtime-v15.mjs');
const token=crypto.randomUUID(),operator={id:`operator-${token}`,roles:['ADMIN'],sellerId:null};

try{
  assert.equal(db.kind,'POSTGRES');
  const buyer=(await db.pool.query("SELECT id FROM accounts WHERE email='buyer@demo.antiqua' LIMIT 1")).rows[0];
  const seller=(await db.pool.query("SELECT id,seller_id FROM accounts WHERE email='seller@demo.antiqua' LIMIT 1")).rows[0];
  assert.ok(buyer?.id);assert.ok(seller?.seller_id);

  const settlementId=`set-life-${token}`,auctionId=`auc-life-${token}`,nonpaymentId=`set-nonpay-${token}`,nonpaymentAuctionId=`auc-nonpay-${token}`;
  const auctionBase={currency:'EUR',baselineBid:5000,currentBid:5500,increment:500,bidCount:1,reservePrice:5000,reserveMet:true,startsAt:new Date(Date.now()-86400000).toISOString(),endsAt:new Date(Date.now()-3600000).toISOString(),state:'CLOSED',leaderClientId:buyer.id,proxyBids:[],history:[]};
  await db.pool.query(`INSERT INTO auctions(id,object_id,sale_id,status,current_bid,ends_at,state,baseline_bid,reserve_price,increment,bid_count,leader_account_id,starts_at,version)
    VALUES($1,'lot-101','sale-lifecycle','CLOSED',5500,$3,$4,5000,5000,500,1,$2,$5,1)`,[auctionId,buyer.id,auctionBase.endsAt,{...auctionBase,id:auctionId,lotId:'lot-101'},auctionBase.startsAt]);
  await db.pool.query(`INSERT INTO auctions(id,object_id,sale_id,status,current_bid,ends_at,state,baseline_bid,reserve_price,increment,bid_count,leader_account_id,starts_at,version)
    VALUES($1,'lot-102','sale-lifecycle','CLOSED',2100,$3,$4,2000,2000,100,1,$2,$5,1)`,[nonpaymentAuctionId,buyer.id,auctionBase.endsAt,{...auctionBase,id:nonpaymentAuctionId,lotId:'lot-102',baselineBid:2000,currentBid:2100,increment:100},auctionBase.startsAt]);
  await db.pool.query(`INSERT INTO auction_settlements(id,auction_id,object_id,buyer_account_id,seller_id,winning_amount_minor,currency,status,payment_due_at,metadata,created_at,updated_at)
    VALUES($1,$2,'lot-101',$3,$4,550000,'EUR','PAYMENT_DUE',now()+interval '1 day','{}'::jsonb,now(),now())`,[settlementId,auctionId,buyer.id,seller.seller_id]);

  const payKey=`payment-${token}`;
  let settlement=await transitionSettlement(operator,settlementId,'PAID',{lifecycleAuthority:'SYSTEM',lifecycleFacts:{PAYMENT_EFFECT_RECORDED:true},metadata:{paymentLedgerTransactionId:`ledger-${token}`,payoutId:`payout-${token}`,provider:'TEST_PSP',externalReference:payKey},sourceKey:payKey});
  assert.equal(settlement.status,'PAID');assert.equal(settlement.idempotentTransition,false);
  const replay=await transitionSettlement(operator,settlementId,'PAID',{lifecycleAuthority:'SYSTEM',lifecycleFacts:{PAYMENT_EFFECT_RECORDED:true},metadata:{paymentLedgerTransactionId:`ledger-${token}`,payoutId:`payout-${token}`,provider:'TEST_PSP',externalReference:payKey},sourceKey:payKey});
  assert.equal(replay.status,'PAID');assert.equal(replay.idempotentTransition,true);
  await assert.rejects(()=>transitionSettlement(operator,settlementId,'VOID',{lifecycleAuthority:'SYSTEM',sourceKey:payKey}),e=>e.code==='LIFECYCLE_EVENT_CONFLICT');
  settlement=await transitionSettlement(operator,settlementId,'FULFILLMENT',{lifecycleAuthority:'SYSTEM',sourceKey:`fulfill-${token}`});assert.equal(settlement.status,'FULFILLMENT');
  settlement=await transitionSettlement(operator,settlementId,'COMPLETED',{lifecycleAuthority:'SYSTEM',sourceKey:`complete-${token}`});assert.equal(settlement.status,'COMPLETED');
  const beforeInvalid=(await db.pool.query("SELECT count(*)::int AS n FROM lifecycle_events WHERE domain='SETTLEMENT' AND aggregate_id=$1",[settlementId])).rows[0].n;
  await assert.rejects(()=>transitionSettlement(operator,settlementId,'PAID',{lifecycleAuthority:'SYSTEM',lifecycleFacts:{PAYMENT_EFFECT_RECORDED:true}}),e=>e.code==='LIFECYCLE_TRANSITION_INVALID');
  const afterInvalid=(await db.pool.query("SELECT count(*)::int AS n FROM lifecycle_events WHERE domain='SETTLEMENT' AND aggregate_id=$1",[settlementId])).rows[0].n;assert.equal(afterInvalid,beforeInvalid);

  let rows=(await db.pool.query("SELECT action,from_state,to_state,authority FROM lifecycle_events WHERE domain='SETTLEMENT' AND aggregate_id=$1 ORDER BY created_at,id",[settlementId])).rows;
  assert.deepEqual(rows.map(x=>[x.action,x.from_state,x.to_state]),[['CAPTURE_PAYMENT','PAYMENT_DUE','PAID'],['START_FULFILLMENT','PAID','FULFILLMENT'],['COMPLETE','FULFILLMENT','COMPLETED']]);
  assert.deepEqual(rows.map(x=>x.authority),['SYSTEM','SYSTEM','SYSTEM']);
  const legacySettlementEvents=(await db.pool.query('SELECT event_type FROM settlement_events WHERE settlement_id=$1 ORDER BY created_at,id',[settlementId])).rows.map(x=>x.event_type);
  assert.deepEqual(legacySettlementEvents,['SETTLEMENT_PAID','SETTLEMENT_FULFILLMENT','SETTLEMENT_COMPLETED']);

  await db.pool.query(`INSERT INTO auction_settlements(id,auction_id,object_id,buyer_account_id,seller_id,winning_amount_minor,currency,status,payment_due_at,metadata,created_at,updated_at)
    VALUES($1,$2,'lot-102',$3,$4,210000,'EUR','PAYMENT_DUE',now()-interval '1 day','{}'::jsonb,now(),now())`,[nonpaymentId,nonpaymentAuctionId,buyer.id,seller.seller_id]);
  let nonpayment=await transitionSettlement(operator,nonpaymentId,'NONPAYMENT',{sourceKey:`nonpay-${token}`});assert.equal(nonpayment.status,'NONPAYMENT');
  nonpayment=await transitionSettlement(operator,nonpaymentId,'REOFFERED',{sourceKey:`reoffer-${token}`});assert.equal(nonpayment.status,'REOFFERED');

  const shipmentId=`shp-life-${token}`;
  await db.pool.query(`INSERT INTO shipments(id,settlement_id,object_id,buyer_account_id,seller_id,status,insured_value_minor,currency,quote,package_spec,delivery_proof,created_at,updated_at)
    VALUES($1,$2,'lot-101',$3,$4,'QUOTE_REQUIRED',550000,'EUR','{}'::jsonb,'{}'::jsonb,'{}'::jsonb,now(),now())`,[shipmentId,settlementId,buyer.id,seller.seller_id]);
  let shipment=await quoteShipment(operator,shipmentId,{origin:'Amsterdam',destination:'Utrecht',sourceKey:`quote-${token}`});assert.equal(shipment.status,'QUOTED');
  shipment=await transitionShipment(operator,shipmentId,'BOOKED',{sourceKey:`book-${token}`});assert.equal(shipment.status,'BOOKED');
  shipment=await transitionShipment(operator,shipmentId,'PACKING',{sourceKey:`pack-${token}`});assert.equal(shipment.status,'PACKING');
  const transitKey=`carrier-transit-${token}`;
  shipment=await transitionShipment(operator,shipmentId,'IN_TRANSIT',{lifecycleAuthority:'PROVIDER',lifecycleFacts:{PROVIDER_EVENT_OR_PREVIEW:true},providerEvent:true,sourceKey:transitKey,trackingReference:`TRACK-${token}`});assert.equal(shipment.status,'IN_TRANSIT');
  const transitReplay=await transitionShipment(operator,shipmentId,'IN_TRANSIT',{lifecycleAuthority:'PROVIDER',lifecycleFacts:{PROVIDER_EVENT_OR_PREVIEW:true},providerEvent:true,sourceKey:transitKey,trackingReference:`TRACK-${token}`});assert.equal(transitReplay.status,'IN_TRANSIT');assert.equal(transitReplay.idempotentTransition,true);
  await assert.rejects(()=>transitionShipment(operator,shipmentId,'DELIVERED',{lifecycleAuthority:'PROVIDER',lifecycleFacts:{PROVIDER_EVENT_OR_PREVIEW:true},providerEvent:true,sourceKey:transitKey}),e=>e.code==='LIFECYCLE_EVENT_CONFLICT');
  shipment=await transitionShipment(operator,shipmentId,'DELIVERED',{lifecycleAuthority:'PROVIDER',lifecycleFacts:{PROVIDER_EVENT_OR_PREVIEW:true},providerEvent:true,sourceKey:`carrier-delivered-${token}`,deliveryProof:{signedBy:'Buyer'}});assert.equal(shipment.status,'DELIVERED');
  const shipmentBefore=(await db.pool.query("SELECT count(*)::int AS n FROM lifecycle_events WHERE domain='SHIPMENT' AND aggregate_id=$1",[shipmentId])).rows[0].n;
  await assert.rejects(()=>transitionShipment(operator,shipmentId,'IN_TRANSIT',{lifecycleAuthority:'PROVIDER',lifecycleFacts:{PROVIDER_EVENT_OR_PREVIEW:true},providerEvent:true}),e=>e.code==='LIFECYCLE_TRANSITION_INVALID');
  const shipmentAfter=(await db.pool.query("SELECT count(*)::int AS n FROM lifecycle_events WHERE domain='SHIPMENT' AND aggregate_id=$1",[shipmentId])).rows[0].n;assert.equal(shipmentAfter,shipmentBefore);

  rows=(await db.pool.query("SELECT action,from_state,to_state,authority FROM lifecycle_events WHERE domain='SHIPMENT' AND aggregate_id=$1 ORDER BY created_at,id",[shipmentId])).rows;
  assert.deepEqual(rows.map(x=>[x.action,x.from_state,x.to_state]),[['QUOTE','QUOTE_REQUIRED','QUOTED'],['BOOK','QUOTED','BOOKED'],['PACK','BOOKED','PACKING'],['DISPATCH','PACKING','IN_TRANSIT'],['DELIVER','IN_TRANSIT','DELIVERED']]);
  assert.deepEqual(rows.map(x=>x.authority),['OPERATOR','OPERATOR','OPERATOR','PROVIDER','PROVIDER']);
  const legacyShipmentEvents=(await db.pool.query('SELECT event_type FROM shipment_events WHERE shipment_id=$1 ORDER BY created_at,id',[shipmentId])).rows.map(x=>x.event_type);
  assert.deepEqual(legacyShipmentEvents,['SHIPMENT_QUOTED','SHIPMENT_BOOKED','SHIPMENT_PACKING','SHIPMENT_IN_TRANSIT','SHIPMENT_DELIVERED']);

  let pending=(await db.pool.query("SELECT count(*)::int AS n FROM outbox_events WHERE aggregate_id=ANY($1::text[]) AND status='PENDING' AND payload->>'kind'='LIFECYCLE_TRANSITION'",[[settlementId,nonpaymentId,shipmentId]])).rows[0].n;assert.equal(pending,10);
  for(let i=0;i<4&&pending;i++){await processOutboxBatch({workerId:`commerce-life-${token}-${i}`,limit:100,leaseMs:5000});pending=(await db.pool.query("SELECT count(*)::int AS n FROM outbox_events WHERE aggregate_id=ANY($1::text[]) AND status='PENDING' AND payload->>'kind'='LIFECYCLE_TRANSITION'",[[settlementId,nonpaymentId,shipmentId]])).rows[0].n}
  assert.equal(pending,0);

  console.log('ANTIQUA v16 commerce lifecycle: settlement + nonpayment + shipment row locks, journal/outbox, replay/conflict and invalid rollback passed');
}finally{
  const ids=[`set-life-${token}`,`set-nonpay-${token}`,`shp-life-${token}`];
  await db.pool.query("DELETE FROM outbox_events WHERE aggregate_id=ANY($1::text[])",[ids]).catch(()=>{});
  await db.pool.query("DELETE FROM lifecycle_events WHERE aggregate_id=ANY($1::text[])",[ids]).catch(()=>{});
  await db.pool.query('DELETE FROM shipments WHERE id=$1',[`shp-life-${token}`]).catch(()=>{});
  await db.pool.query('DELETE FROM auction_settlements WHERE id=ANY($1::text[])',[[`set-life-${token}`,`set-nonpay-${token}`]]).catch(()=>{});
  await db.pool.query('DELETE FROM auctions WHERE id=ANY($1::text[])',[[`auc-life-${token}`,`auc-nonpay-${token}`]]).catch(()=>{});
  await db.pool.end()
}
