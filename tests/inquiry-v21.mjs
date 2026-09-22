import assert from 'node:assert/strict';
import {db,listing} from '../runtime-v09.mjs';
import {createObjectInquiry,inquiryCapabilities} from '../inquiry-v21.mjs';
import {getConversation,listConversations} from '../domain-e2e-v14.mjs';

const buyer=await db.findAccountByEmail('buyer@demo.antiqua');
const seller=await db.findAccountByEmail('seller@demo.antiqua');
const operator=await db.findAccountByEmail('operator@demo.antiqua');
assert.ok(buyer?.id&&seller?.id&&operator?.id);

const id='inq-v21-proof-message';
const first=await createObjectInquiry(buyer,{listingId:'lst-110',inquiryType:'CONDITION',message:'Please clarify the surface condition and any known restoration.',clientMessageId:id});
assert.equal(first.idempotent,false);assert.equal(first.inquiryType,'CONDITION');assert.equal(first.conversation.listingId,'lst-110');assert.equal(first.conversation.objectId,'lot-110');
assert.equal(first.message.body,'Please clarify the surface condition and any known restoration.');
assert.equal(first.message.attachments[0].kind,'INQUIRY_CONTEXT');assert.equal(first.message.attachments[0].inquiryType,'CONDITION');

const replay=await createObjectInquiry(buyer,{listingId:'lst-110',inquiryType:'CONDITION',message:'Please clarify the surface condition and any known restoration.',clientMessageId:id});
assert.equal(replay.idempotent,true);assert.equal(replay.conversation.id,first.conversation.id);assert.equal(replay.message.id,first.message.id);

let thread=await getConversation(buyer,first.conversation.id);
assert.equal(thread.messages.filter(m=>m.clientMessageId===id).length,1,'retry must not duplicate inquiry message');

const second=await createObjectInquiry(buyer,{listingId:'lst-110',inquiryType:'SHIPPING',message:'Could you confirm insured shipping options to Paris?',clientMessageId:'inq-v21-proof-second'});
assert.equal(second.conversation.id,first.conversation.id,'same buyer/listing must reuse open thread');
thread=await getConversation(buyer,first.conversation.id);assert.equal(thread.messages.length,2);assert.equal(thread.messages[1].attachments[0].inquiryType,'SHIPPING');

const sellerThreads=await listConversations(seller),sellerView=sellerThreads.find(x=>x.id===first.conversation.id);
assert.ok(sellerView);assert.equal(sellerView.unreadCount,2);
const sellerNotifications=(await db.listNotifications(seller.id)).filter(n=>n.payload?.conversationId===first.conversation.id);
assert.equal(sellerNotifications.filter(n=>n.type==='NEW_CONVERSATION').length,0,'composed inquiry must not create a duplicate empty-thread notification');
assert.equal(sellerNotifications.filter(n=>n.type==='NEW_MESSAGE').length,2,'seller gets one notification per durable inquiry message');

await assert.rejects(()=>createObjectInquiry(seller,{listingId:'lst-110',inquiryType:'OTHER',message:'Own listing question',clientMessageId:'inq-own-listing'}),e=>e.code==='OWN_LISTING_INQUIRY');
await assert.rejects(()=>createObjectInquiry(operator,{listingId:'lst-110',inquiryType:'OTHER',message:'Operator question',clientMessageId:'inq-operator'}),e=>e.code==='BUYER_REQUIRED');
await assert.rejects(()=>createObjectInquiry(buyer,{listingId:'lst-110',inquiryType:'UNKNOWN',message:'Unknown topic',clientMessageId:'inq-invalid-topic'}),e=>e.code==='INQUIRY_TYPE_INVALID');
await assert.rejects(()=>createObjectInquiry(buyer,{listingId:'lst-110',inquiryType:'OTHER',message:'No',clientMessageId:'inq-short-msg'}),e=>e.code==='INQUIRY_MESSAGE_SHORT');

const li=listing('lst-110'),priorStatus=li.status;li.status='INACTIVE';
try{await assert.rejects(()=>createObjectInquiry(buyer,{listingId:'lst-110',inquiryType:'OTHER',message:'Listing is inactive now',clientMessageId:'inq-inactive'}),e=>e.code==='LISTING_NOT_AVAILABLE')}finally{li.status=priorStatus}

const cap=inquiryCapabilities();assert.equal(cap.threadReuse,true);assert.equal(cap.messageIdempotency,true);assert.equal(cap.notificationAfterMessage,true);
console.log('ANTIQUA v21 object inquiry: thread reuse + idempotent message + topic context + seller notification discipline passed');
