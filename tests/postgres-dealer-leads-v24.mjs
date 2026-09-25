import assert from 'node:assert/strict';
import crypto from 'node:crypto';

if(!process.env.DATABASE_URL){console.log('ANTIQUA v24 PostgreSQL dealer lead cockpit: skipped (DATABASE_URL not set)');process.exit(0)}

const {db}=await import('../runtime-v09.mjs');
const {createConversation,postMessage}=await import('../domain-e2e-v14.mjs');
const {createConditionReportRequest}=await import('../condition-report-v23.mjs');
const {createViewingRequest}=await import('../viewing-v23.mjs');
const {createOffer,actOnOffer}=await import('../offer-negotiation-v22.mjs');
const {dealerLeadCockpit}=await import('../dealer-leads-v24.mjs');
assert.equal(db.kind,'POSTGRES');

const token=crypto.randomUUID().replaceAll('-',''),objectId='obj-v24-'+token,listingId='lst-v24-'+token;
const key=p=>p+'-'+crypto.randomUUID(),future=h=>new Date(Date.now()+h*3600000).toISOString();
const buyer=await db.findAccountByEmail('buyer@demo.antiqua'),seller=await db.findAccountByEmail('seller@demo.antiqua');
assert.ok(buyer?.id&&seller?.sellerId);
let conversationId=null,conditionId=null,viewingId=null,offerId=null,orderId=null;

try{
 await db.pool.query(
  "INSERT INTO objects(id,object_code,seller_id,passport,catalogue_status,trust_status,publication_status,created_at,updated_at) VALUES($1,$2,$3,$4,'APPROVED','ALLOWED','PUBLIC',now(),now())",
  [objectId,'AQ-V24-'+token,seller.sellerId,{id:objectId,objectId:'AQ-V24-'+token,title:{en:'Dealer lead proof object',ru:'Предмет проверки лида'},sellerId:seller.sellerId,catalogueStatus:'APPROVED',trustStatus:'ALLOWED',publicationStatus:'PUBLIC'}]
 );
 const payload={id:listingId,lotId:objectId,sellerId:seller.sellerId,saleType:'MAKE_OFFER',price:10000,currency:'EUR',negotiable:true,status:'ACTIVE',shippingFrom:'Amsterdam'};
 await db.pool.query("INSERT INTO listings(id,object_id,seller_id,status,payload,updated_at) VALUES($1,$2,$3,'ACTIVE',$4,now())",[listingId,objectId,seller.sellerId,payload]);

 const conv=await createConversation(buyer,{listingId,objectId,sellerId:seller.sellerId,subject:'V24 lead proof'},{notifyOnCreate:false});conversationId=conv.id;
 await postMessage(buyer,conversationId,{body:'Buyer asks for dealer guidance.',clientMessageId:key('buyer-message')});

 let cockpit=await dealerLeadCockpit(seller,{nowMs:Date.now()+2*3600000,slaMinutes:60});
 let lead=cockpit.leads.find(x=>x.listingId===listingId&&x.buyerAccountId===buyer.id);
 assert.ok(lead);assert.equal(cockpit.leads.filter(x=>x.listingId===listingId&&x.buyerAccountId===buyer.id).length,1);
 assert.equal(lead.stage,'UNANSWERED');assert.equal(lead.responseStatus,'OVERDUE');assert.equal(lead.nextAction.code,'REPLY_TO_BUYER');assert.ok(lead.unreadCount>=1);

 await postMessage(seller,conversationId,{body:'Dealer replies with next steps.',clientMessageId:key('seller-message')});
 cockpit=await dealerLeadCockpit(seller,{nowMs:Date.now()+2*3600000,slaMinutes:60});lead=cockpit.leads.find(x=>x.listingId===listingId);
 assert.equal(lead.stage,'REPLIED');assert.equal(lead.responseStatus,'MET');assert.equal(lead.refs.conversationId,conversationId);

 const condition=await createConditionReportRequest(buyer,listingId,{note:'Please provide condition details.',clientActionId:key('condition')});conditionId=condition.request.id;
 cockpit=await dealerLeadCockpit(seller,{slaMinutes:60});lead=cockpit.leads.find(x=>x.listingId===listingId);
 assert.equal(lead.stage,'REPLIED');assert.equal(lead.nextAction.code,'PUBLISH_CONDITION_REPORT');assert.equal(lead.refs.conditionRequestId,conditionId);

 const viewing=await createViewingRequest(buyer,listingId,{note:'Please arrange an in-person viewing.',clientActionId:key('viewing')});viewingId=viewing.request.id;
 cockpit=await dealerLeadCockpit(seller,{slaMinutes:60});lead=cockpit.leads.find(x=>x.listingId===listingId);
 assert.equal(lead.stage,'VIEWING');assert.equal(lead.nextAction.code,'PROPOSE_VIEWING_SLOTS');assert.equal(lead.refs.viewingRequestId,viewingId);

 const offer=await createOffer(buyer,listingId,{amount:'7000',currency:'EUR',expiresAt:future(72),comment:'Commercial offer',clientActionId:key('offer')});offerId=offer.offer.id;
 cockpit=await dealerLeadCockpit(seller,{slaMinutes:60});lead=cockpit.leads.find(x=>x.listingId===listingId);
 assert.equal(lead.stage,'NEGOTIATING');assert.equal(lead.nextAction.code,'RESPOND_TO_OFFER');assert.equal(lead.refs.offerId,offerId);assert.equal(lead.potentialAmountMinor,700000);assert.equal(lead.potentialSource,'OFFER');
 assert.equal(cockpit.leads.filter(x=>x.listingId===listingId&&x.buyerAccountId===buyer.id).length,1);

 const accepted=await actOnOffer(seller,offerId,{action:'ACCEPT',expectedVersion:1,comment:'Accepted from Dealer Inbox authority.',clientActionId:key('accept')});orderId=accepted.order?.id;
 assert.ok(orderId);
 cockpit=await dealerLeadCockpit(seller,{slaMinutes:60});lead=cockpit.leads.find(x=>x.listingId===listingId);
 assert.equal(lead.stage,'WON');assert.equal(lead.nextAction.code,'PROCEED_TRANSACTION');assert.equal(lead.potentialAmountMinor,700000);
 assert.equal(lead.refs.conversationId,conversationId);assert.equal(lead.refs.conditionRequestId,conditionId);assert.equal(lead.refs.viewingRequestId,viewingId);assert.equal(lead.refs.offerId,offerId);
 assert.equal(cockpit.leads.filter(x=>x.listingId===listingId&&x.buyerAccountId===buyer.id).length,1);

 console.log('ANTIQUA v24 PostgreSQL dealer lead cockpit: one deterministic lead across message -> condition -> viewing -> negotiation -> won passed');
}finally{
 try{
  await db.pool.query('ALTER TABLE offer_events DISABLE TRIGGER offer_events_immutable_trg').catch(()=>{});
  await db.pool.query('ALTER TABLE condition_report_events DISABLE TRIGGER condition_report_events_immutable_trg').catch(()=>{});
  await db.pool.query('ALTER TABLE condition_report_versions DISABLE TRIGGER condition_report_versions_immutable_trg').catch(()=>{});
  await db.pool.query('ALTER TABLE viewing_request_events DISABLE TRIGGER viewing_events_immutable_trg').catch(()=>{});
  await db.pool.query('ALTER TABLE viewing_slots DISABLE TRIGGER viewing_slots_immutable_trg').catch(()=>{});
  if(orderId)await db.pool.query('DELETE FROM orders WHERE id=$1',[orderId]).catch(()=>{});
  if(offerId){await db.pool.query('DELETE FROM offer_events WHERE offer_id=$1',[offerId]).catch(()=>{});await db.pool.query('DELETE FROM offers WHERE id=$1',[offerId]).catch(()=>{})}
  if(viewingId){
   await db.pool.query('UPDATE viewing_requests SET selected_slot_id=NULL WHERE id=$1',[viewingId]).catch(()=>{});
   await db.pool.query('DELETE FROM viewing_calendar_events WHERE request_id=$1',[viewingId]).catch(()=>{});
   await db.pool.query('DELETE FROM viewing_request_events WHERE request_id=$1',[viewingId]).catch(()=>{});
   await db.pool.query('DELETE FROM viewing_slots WHERE request_id=$1',[viewingId]).catch(()=>{});
   await db.pool.query('DELETE FROM viewing_requests WHERE id=$1',[viewingId]).catch(()=>{});
  }
  if(conditionId){
   await db.pool.query('DELETE FROM condition_report_events WHERE request_id=$1',[conditionId]).catch(()=>{});
   await db.pool.query('DELETE FROM condition_report_versions WHERE request_id=$1',[conditionId]).catch(()=>{});
   await db.pool.query('DELETE FROM condition_report_requests WHERE id=$1',[conditionId]).catch(()=>{});
  }
  if(conversationId){await db.pool.query('DELETE FROM conversation_messages WHERE conversation_id=$1',[conversationId]).catch(()=>{});await db.pool.query('DELETE FROM conversations WHERE id=$1',[conversationId]).catch(()=>{})}
  await db.pool.query("DELETE FROM notifications WHERE payload->>'objectId'=$1",[objectId]).catch(()=>{});
  await db.pool.query('DELETE FROM listings WHERE id=$1',[listingId]).catch(()=>{});
  await db.pool.query('DELETE FROM objects WHERE id=$1',[objectId]).catch(()=>{});
 }finally{
  await db.pool.query('ALTER TABLE offer_events ENABLE TRIGGER offer_events_immutable_trg').catch(()=>{});
  await db.pool.query('ALTER TABLE condition_report_events ENABLE TRIGGER condition_report_events_immutable_trg').catch(()=>{});
  await db.pool.query('ALTER TABLE condition_report_versions ENABLE TRIGGER condition_report_versions_immutable_trg').catch(()=>{});
  await db.pool.query('ALTER TABLE viewing_request_events ENABLE TRIGGER viewing_events_immutable_trg').catch(()=>{});
  await db.pool.query('ALTER TABLE viewing_slots ENABLE TRIGGER viewing_slots_immutable_trg').catch(()=>{});
  await db.pool.end()
 }
}
