import assert from 'node:assert/strict';
import crypto from 'node:crypto';

if(!process.env.DATABASE_URL){console.log('ANTIQUA v16 dispute lifecycle: skipped (DATABASE_URL not set)');process.exit(0)}

const {db}=await import('../runtime-v09.mjs');
const {createPayoutHold,getPayout,transitionPayout,postLedgerTransaction}=await import('../finance-v10.mjs');
const {createDisputeAuthority,addDisputeEvidenceAuthority,decideDisputeAuthority}=await import('../dispute-lifecycle-v16.mjs');
const {processOutboxBatch}=await import('../worker-runtime-v15.mjs');
const token=crypto.randomUUID();
const refundEntries=({sellerId,amountMinor,currency,provider})=>[
 {ownerType:'SELLER',ownerId:sellerId,currency,accountType:'LIABILITY',name:'SELLER_PAYABLE_HOLD',side:'DEBIT',amountMinor},
 {ownerType:'PAYMENT_PROVIDER',ownerId:provider,currency,accountType:'ASSET',name:'CLEARING',side:'CREDIT',amountMinor}
];

try{
  assert.equal(db.kind,'POSTGRES');
  const buyer=await db.findAccountByEmail('buyer@demo.antiqua'),seller=await db.findAccountByEmail('seller@demo.antiqua'),operator=await db.findAccountByEmail('operator@demo.antiqua');assert.ok(buyer?.id);assert.ok(seller?.sellerId);assert.ok(operator?.roles?.includes('ADMIN'));

  const settlementId=`set-dispute-${token}`,auctionId=`auc-dispute-${token}`,failSettlementId=`set-dispute-fail-${token}`,failAuctionId=`auc-dispute-fail-${token}`;
  const auctionTimes={startsAt:new Date(Date.now()-86400000).toISOString(),endsAt:new Date(Date.now()-3600000).toISOString()};
  await db.pool.query(`INSERT INTO auctions(id,object_id,sale_id,status,current_bid,ends_at,state,baseline_bid,reserve_price,increment,bid_count,leader_account_id,starts_at,version)
    VALUES($1,'lot-104','sale-dispute','CLOSED',1250,$3,$4,1200,1200,50,1,$2,$5,1)`,[auctionId,buyer.id,auctionTimes.endsAt,{id:auctionId,lotId:'lot-104',currency:'EUR',state:'CLOSED'},auctionTimes.startsAt]);
  await db.pool.query(`INSERT INTO auctions(id,object_id,sale_id,status,current_bid,ends_at,state,baseline_bid,reserve_price,increment,bid_count,leader_account_id,starts_at,version)
    VALUES($1,'lot-105','sale-dispute','CLOSED',640,$3,$4,600,600,40,1,$2,$5,1)`,[failAuctionId,buyer.id,auctionTimes.endsAt,{id:failAuctionId,lotId:'lot-105',currency:'EUR',state:'CLOSED'},auctionTimes.startsAt]);
  const payout=await createPayoutHold({sellerId:seller.sellerId,amountMinor:125000,currency:'EUR',sourceType:'SETTLEMENT',sourceId:settlementId,idempotencyKey:`payout:${settlementId}`});
  await db.pool.query(`INSERT INTO auction_settlements(id,auction_id,object_id,buyer_account_id,seller_id,winning_amount_minor,currency,status,payment_due_at,metadata,created_at,updated_at)
    VALUES($1,$2,'lot-104',$3,$4,125000,'EUR','PAID',now(),$5,now(),now())`,[settlementId,auctionId,buyer.id,seller.sellerId,{payoutId:payout.id,provider:'TEST_PSP'}]);

  const disputeId=`dsp-life-${token}`,opened=await createDisputeAuthority(buyer,{id:disputeId,settlementId,category:'DAMAGE',summary:'Synthetic lifecycle damage dispute',requestedResolution:'Refund',sourceKey:`open-${token}`});
  assert.equal(opened.status,'OPEN');assert.equal(opened.lifecycle.action,'OPEN');
  assert.equal((await db.pool.query('SELECT status FROM auction_settlements WHERE id=$1',[settlementId])).rows[0].status,'DISPUTED');
  let disputeEvents=(await db.pool.query("SELECT action,from_state,to_state,authority FROM lifecycle_events WHERE domain='DISPUTE' AND aggregate_id=$1 ORDER BY created_at,id",[disputeId])).rows;assert.deepEqual(disputeEvents.map(x=>[x.action,x.from_state,x.to_state,x.authority]),[['OPEN','NONE','OPEN','BUYER']]);
  const settlementEvents=(await db.pool.query("SELECT action,from_state,to_state FROM lifecycle_events WHERE domain='SETTLEMENT' AND aggregate_id=$1 ORDER BY created_at,id",[settlementId])).rows;assert.deepEqual(settlementEvents.map(x=>[x.action,x.from_state,x.to_state]),[['OPEN_DISPUTE','PAID','DISPUTED']]);

  const evidenceKey=`evidence-${token}`,ev=await addDisputeEvidenceAuthority(buyer,disputeId,{evidenceType:'PHOTO',note:'Condition evidence',mediaIds:[],sourceKey:evidenceKey});assert.equal(ev.evidence.evidenceType,'PHOTO');assert.equal(ev.lifecycle.to,'UNDER_REVIEW');
  const evReplay=await addDisputeEvidenceAuthority(buyer,disputeId,{evidenceType:'PHOTO',note:'Condition evidence',mediaIds:[],sourceKey:evidenceKey});assert.equal(evReplay.idempotentTransition,true);assert.equal(evReplay.evidence.id,ev.evidence.id);
  assert.equal((await db.pool.query('SELECT status FROM disputes WHERE id=$1',[disputeId])).rows[0].status,'UNDER_REVIEW');

  let effectStartedResolve;const effectStarted=new Promise(r=>{effectStartedResolve=r}),refundKey=`refund-${token}`;
  const refundEffect=async current=>{effectStartedResolve();await new Promise(r=>setTimeout(r,75));const tx=await postLedgerTransaction({transactionType:'FULL_REFUND',externalReference:`dispute-${current.id}`,idempotencyKey:`refund:dispute:${current.id}:FULL_REFUND`,entries:refundEntries({sellerId:current.sellerId,amountMinor:125000,currency:'EUR',provider:'TEST_PSP'}),metadata:{disputeId:current.id,provider:'TEST_PSP'}});const p=await getPayout(payout.id);if(p&&['ON_HOLD','READY','FAILED'].includes(p.status))await transitionPayout(p.id,'REVERSED',{lifecycleAuthority:'SYSTEM',sourceKey:`dispute:${current.id}:reverse:${p.id}`});return{refundEffectRecorded:Boolean(tx.id),refund:{ledgerTransactionId:tx.id,amountMinor:125000,currency:'EUR',idempotent:Boolean(tx.idempotent),reversedPayoutIds:[payout.id]}}};
  const refundDecision=decideDisputeAuthority(operator,disputeId,{status:'FULL_REFUND',reason:'Evidence supports full refund',sourceKey:refundKey,effect:refundEffect});await effectStarted;
  const competingDecision=decideDisputeAuthority(operator,disputeId,{status:'RESOLVED_SELLER',reason:'Competing decision',sourceKey:`seller-${token}`});
  const [refundResult,competingResult]=await Promise.allSettled([refundDecision,competingDecision]);assert.equal(refundResult.status,'fulfilled');assert.equal(refundResult.value.dispute.status,'FULL_REFUND');assert.equal(competingResult.status,'rejected');assert.equal(competingResult.reason.code,'LIFECYCLE_TRANSITION_INVALID');
  assert.equal((await getPayout(payout.id)).status,'REVERSED');assert.equal(Number((await db.pool.query('SELECT count(*)::int AS n FROM ledger_transactions WHERE idempotency_key=$1',[`refund:dispute:${disputeId}:FULL_REFUND`])).rows[0].n),1);

  const replay=await decideDisputeAuthority(operator,disputeId,{status:'FULL_REFUND',reason:'Evidence supports full refund',sourceKey:refundKey,refundAmountMinor:125000,effect:refundEffect});assert.equal(replay.idempotentTransition,true);assert.equal(Number((await db.pool.query('SELECT count(*)::int AS n FROM ledger_transactions WHERE idempotency_key=$1',[`refund:dispute:${disputeId}:FULL_REFUND`])).rows[0].n),1);
  await assert.rejects(()=>decideDisputeAuthority(operator,disputeId,{status:'RESOLVED_SELLER',sourceKey:refundKey}),e=>e.code==='LIFECYCLE_EVENT_CONFLICT');
  await assert.rejects(()=>addDisputeEvidenceAuthority(buyer,disputeId,{note:'Late evidence'}),e=>e.code==='DISPUTE_TERMINAL');
  disputeEvents=(await db.pool.query("SELECT action,from_state,to_state,authority FROM lifecycle_events WHERE domain='DISPUTE' AND aggregate_id=$1 ORDER BY created_at,id",[disputeId])).rows;assert.deepEqual(disputeEvents.map(x=>[x.action,x.from_state,x.to_state]),[['OPEN','NONE','OPEN'],['ADD_EVIDENCE','OPEN','UNDER_REVIEW'],['FULL_REFUND','UNDER_REVIEW','FULL_REFUND']]);

  // A failed refund effect must leave both state and lifecycle journal untouched.
  const failPayout=await createPayoutHold({sellerId:seller.sellerId,amountMinor:64000,currency:'EUR',sourceType:'SETTLEMENT',sourceId:failSettlementId,idempotencyKey:`payout:${failSettlementId}`});
  await db.pool.query(`INSERT INTO auction_settlements(id,auction_id,object_id,buyer_account_id,seller_id,winning_amount_minor,currency,status,payment_due_at,metadata,created_at,updated_at)
    VALUES($1,$2,'lot-105',$3,$4,64000,'EUR','PAID',now(),$5,now(),now())`,[failSettlementId,failAuctionId,buyer.id,seller.sellerId,{payoutId:failPayout.id,provider:'TEST_PSP'}]);
  const failDisputeId=`dsp-fail-${token}`;await createDisputeAuthority(buyer,{id:failDisputeId,settlementId:failSettlementId,category:'MISMATCH',summary:'Synthetic failed refund dispute'});await addDisputeEvidenceAuthority(buyer,failDisputeId,{note:'Evidence'});const beforeFail=Number((await db.pool.query("SELECT count(*)::int AS n FROM lifecycle_events WHERE domain='DISPUTE' AND aggregate_id=$1",[failDisputeId])).rows[0].n);
  await assert.rejects(()=>decideDisputeAuthority(operator,failDisputeId,{status:'PARTIAL_REFUND',refundAmountMinor:10000,sourceKey:`failed-refund-${token}`,effect:async()=>({refundEffectRecorded:false})}),e=>e.code==='LIFECYCLE_PRECONDITION_FAILED');assert.equal((await db.pool.query('SELECT status FROM disputes WHERE id=$1',[failDisputeId])).rows[0].status,'UNDER_REVIEW');assert.equal(Number((await db.pool.query("SELECT count(*)::int AS n FROM lifecycle_events WHERE domain='DISPUTE' AND aggregate_id=$1",[failDisputeId])).rows[0].n),beforeFail);assert.equal((await getPayout(failPayout.id)).status,'ON_HOLD');

  let pending=Number((await db.pool.query("SELECT count(*)::int AS n FROM outbox_events WHERE aggregate_id=ANY($1::text[]) AND status='PENDING' AND payload->>'kind'='LIFECYCLE_TRANSITION'",[[disputeId,settlementId,payout.id,failDisputeId,failSettlementId]])).rows[0].n);assert.ok(pending>=7);
  for(let i=0;i<5&&pending;i++){await processOutboxBatch({workerId:`dispute-life-${token}-${i}`,limit:100,leaseMs:5000});pending=Number((await db.pool.query("SELECT count(*)::int AS n FROM outbox_events WHERE aggregate_id=ANY($1::text[]) AND status='PENDING' AND payload->>'kind'='LIFECYCLE_TRANSITION'",[[disputeId,settlementId,payout.id,failDisputeId,failSettlementId]])).rows[0].n)}assert.equal(pending,0);

  console.log('ANTIQUA v16 dispute lifecycle: atomic settlement open + evidence transition + refund/decision serialization + finance replay + rollback + worker delivery passed');
}finally{
  const aggregateIds=[`dsp-life-${token}`,`dsp-fail-${token}`,`set-dispute-${token}`,`set-dispute-fail-${token}`];
  await db.pool.query("DELETE FROM outbox_events WHERE aggregate_id=ANY($1::text[])",[aggregateIds]).catch(()=>{});
  await db.pool.query("DELETE FROM lifecycle_events WHERE aggregate_id=ANY($1::text[])",[aggregateIds]).catch(()=>{});
  await db.pool.query('DELETE FROM disputes WHERE id=ANY($1::text[])',[[`dsp-life-${token}`,`dsp-fail-${token}`]]).catch(()=>{});
  await db.pool.query('DELETE FROM auction_settlements WHERE id=ANY($1::text[])',[[`set-dispute-${token}`,`set-dispute-fail-${token}`]]).catch(()=>{});
  await db.pool.query('DELETE FROM auctions WHERE id=ANY($1::text[])',[[`auc-dispute-${token}`,`auc-dispute-fail-${token}`]]).catch(()=>{});
  await db.pool.end()
}
