import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {db} from '../runtime-v09.mjs';
import {createObjectInquiry} from '../inquiry-v21.mjs';
import {getConversation,listConversations} from '../domain-e2e-v14.mjs';

if(!process.env.DATABASE_URL){
 console.log('ANTIQUA v21 PostgreSQL inquiry: skipped (DATABASE_URL not set)');
 process.exit(0);
}
assert.equal(db.kind,'POSTGRES');
const seller=await db.findAccountByEmail('seller@demo.antiqua');assert.ok(seller?.id);
const token=crypto.randomUUID().replaceAll('-','').slice(0,14),buyerId='acct-inquiry-'+token,email='inq-'+token+'@example.test';
await db.pool.query("INSERT INTO accounts(id,email,display_name,password_hash,account_type,status,twofa_status,created_at) VALUES($1,$2,'Inquiry proof','test-hash','BUYER','ACTIVE','DISABLED',now())",[buyerId,email]);
await db.pool.query("INSERT INTO account_roles(account_id,role) VALUES($1,'BUYER')",[buyerId]);
const buyer={id:buyerId,email,displayName:'Inquiry proof',accountType:'BUYER',status:'ACTIVE',sellerId:null,twofaStatus:'DISABLED',roles:['BUYER']};
let conversationId=null;
try{
 const clientMessageId='pg-inquiry-'+token;
 const first=await createObjectInquiry(buyer,{listingId:'lst-110',inquiryType:'PROVENANCE',message:'Please share the provenance documents available for this object.',clientMessageId});
 conversationId=first.conversation.id;assert.equal(first.idempotent,false);
 const replay=await createObjectInquiry(buyer,{listingId:'lst-110',inquiryType:'PROVENANCE',message:'Please share the provenance documents available for this object.',clientMessageId});
 assert.equal(replay.idempotent,true);assert.equal(replay.conversation.id,conversationId);assert.equal(replay.message.id,first.message.id);

 const counts=(await db.pool.query("SELECT (SELECT count(*)::int FROM conversations WHERE buyer_account_id=$1 AND listing_id='lst-110' AND status='OPEN') conversations,(SELECT count(*)::int FROM conversation_messages WHERE conversation_id=$2 AND sender_account_id=$1 AND client_message_id=$3) messages",[buyerId,conversationId,clientMessageId])).rows[0];
 assert.equal(Number(counts.conversations),1);assert.equal(Number(counts.messages),1);

 const stored=(await db.pool.query('SELECT attachments FROM conversation_messages WHERE id=$1',[first.message.id])).rows[0];
 assert.equal(stored.attachments[0].kind,'INQUIRY_CONTEXT');assert.equal(stored.attachments[0].inquiryType,'PROVENANCE');

 const sellerThread=await getConversation(seller,conversationId);assert.ok(sellerThread);assert.equal(sellerThread.messages[0].body,'Please share the provenance documents available for this object.');
 const sellerList=(await listConversations(seller)).find(x=>x.id===conversationId);assert.ok(sellerList);assert.equal(sellerList.unreadCount,1);

 const notifications=(await db.pool.query("SELECT type,payload FROM notifications WHERE account_id=$1 AND payload->>'conversationId'=$2",[seller.id,conversationId])).rows;
 assert.equal(notifications.filter(n=>n.type==='NEW_CONVERSATION').length,0);assert.equal(notifications.filter(n=>n.type==='NEW_MESSAGE').length,1);
 console.log('ANTIQUA v21 PostgreSQL inquiry: durable one-thread/one-message replay + seller unread/context passed');
}finally{
 if(conversationId)await db.pool.query("DELETE FROM notifications WHERE account_id=$1 AND payload->>'conversationId'=$2",[seller.id,conversationId]).catch(()=>{});
 await db.pool.query('DELETE FROM accounts WHERE id=$1',[buyerId]).catch(()=>{});
 await db.pool.end();
}
