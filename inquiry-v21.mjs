import {listing,bi} from './runtime-v09.mjs';
import {createConversation,postMessage} from './domain-e2e-v14.mjs';

const TYPES={
 CONDITION:bi('Condition & restoration','Состояние и реставрация'),
 PROVENANCE:bi('Provenance & documents','Провенанс и документы'),
 VIEWING:bi('Viewing appointment','Просмотр предмета'),
 SHIPPING:bi('Shipping & insurance','Доставка и страхование'),
 AVAILABILITY:bi('Availability & purchase','Наличие и покупка'),
 OTHER:bi('Object inquiry','Вопрос по предмету')
};
const fail=(status,code,message)=>{throw Object.assign(new Error(message),{status,code})};

export function inquiryCapabilities(){return{
 objectContextRequired:true,
 activeListingRequired:true,
 buyerRoleRequired:true,
 threadReuse:true,
 messageIdempotency:true,
 notificationAfterMessage:true,
 types:Object.keys(TYPES)
}}

export async function createObjectInquiry(account,body={}){
 if(!account?.roles?.includes('BUYER'))fail(403,'BUYER_REQUIRED','Buyer account required');
 const listingId=String(body.listingId||'').trim(),li=listing(listingId);
 if(!listingId||!li||li.status!=='ACTIVE')fail(404,'LISTING_NOT_AVAILABLE','Active listing not found');
 if(account.sellerId&&account.sellerId===li.sellerId)fail(409,'OWN_LISTING_INQUIRY','Seller cannot inquire about own listing');
 const inquiryType=String(body.inquiryType||'OTHER').toUpperCase();
 if(!TYPES[inquiryType])fail(400,'INQUIRY_TYPE_INVALID','Invalid inquiry type');
 const message=String(body.message||'').trim();
 if(message.length<5)fail(400,'INQUIRY_MESSAGE_SHORT','Inquiry message is too short');
 if(message.length>4000)fail(400,'INQUIRY_MESSAGE_LONG','Inquiry message is too long');
 const clientMessageId=String(body.clientMessageId||'').trim();
 if(clientMessageId.length<8||clientMessageId.length>160)fail(400,'CLIENT_MESSAGE_ID_INVALID','clientMessageId is required');
 const subject=TYPES[inquiryType];
 const conversation=await createConversation(account,{listingId,subjectEn:subject.en,subjectRu:subject.ru},{notifyOnCreate:false});
 const sent=await postMessage(account,conversation.id,{body:message,clientMessageId});
 return{conversation,message:sent.message,inquiryType,idempotent:sent.idempotent};
}
