// ANTIQUA v90: two-track collector follow-up from buyer-authorized records.
// Counts submitted requests / replies, NEVER certified artwork or legal title.
export const BUYER_DILIGENCE_SCHEMA_V90='antiqua-buyer-diligence-v1';
const IDENT=/^[A-Za-z0-9._:-]{1,120}$/;
const safeDate=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?
 new Date(v).toISOString():null;
const timestamp=v=>{const d=safeDate(v);return d?Date.parse(d):0};
const allowedCondition=new Set(['REQUESTED','FULFILLED','CANCELLED']);
const initiated=new Set(['SENT','SELLER_REPLIED','REQUESTED','REPORT_PUBLISHED']);
const responded=new Set(['SELLER_REPLIED','REPORT_PUBLISHED']);
const fail=()=>{throw Object.assign(new Error('Buyer-authorized listing scope required'),{status:403,code:'BUYER_SCOPE_REQUIRED'})};

export function buildBuyerDiligenceV90({
 buyerAccountId,objectId,listingId,conversations=[],conditionRequests=[]
}={}){
 if(!IDENT.test(buyerAccountId||'')||!IDENT.test(objectId||'')||
    !IDENT.test(listingId||'')||!Array.isArray(conversations)||
    !Array.isArray(conditionRequests))fail();
 const scoped=conversations.filter(c=>c?.buyerAccountId===buyerAccountId&&
  c.objectId===objectId&&c.listingId===listingId);
 const provenance=[];
 for(const c of scoped){
  for(const message of Array.isArray(c.messages)?c.messages:[]){
   if(message?.senderAccountId!==buyerAccountId||!Array.isArray(message.attachments))continue;
   if(!message.attachments.some(x=>x?.kind==='INQUIRY_CONTEXT'&&x?.inquiryType==='PROVENANCE'))continue;
   provenance.push({conversation:c,message});
  }
 }
 provenance.sort((a,b)=>timestamp(b.message.createdAt)-timestamp(a.message.createdAt)||
  String(a.message.id||'').localeCompare(String(b.message.id||'')));
 const latest=provenance[0];
 let provenanceState='NOT_REQUESTED',provUpdated=null;
 if(latest){
  provenanceState='SENT';
  const replies=(latest.conversation.messages||[]).filter(m=>
   m?.senderRole==='SELLER'&&m?.senderAccountId!==buyerAccountId&&
   timestamp(m.createdAt)>timestamp(latest.message.createdAt)&&
   timestamp(latest.message.createdAt)>0);
  replies.sort((a,b)=>timestamp(b.createdAt)-timestamp(a.createdAt));
  if(replies.length)provenanceState='SELLER_REPLIED';
  provUpdated=safeDate(replies[0]?.createdAt)||safeDate(latest.message.createdAt);
 }
 const records=conditionRequests.filter(r=>r?.buyerAccountId===buyerAccountId&&
  r.objectId===objectId&&r.listingId===listingId&&allowedCondition.has(r.status));
 records.sort((a,b)=>timestamp(b.updatedAt)-timestamp(a.updatedAt)||
  String(b.id||'').localeCompare(String(a.id||'')));
 const current=records[0];
 const conditionState=!current?'NOT_REQUESTED':
  current.status==='CANCELLED'?'CANCELLED':
  current.status==='FULFILLED'&&Number.isSafeInteger(Number(current.currentReportVersion))&&
   Number(current.currentReportVersion)>0&&Array.isArray(current.versions)&&
   current.versions.some(v=>Number(v.versionNo)===Number(current.currentReportVersion))
   ?'REPORT_PUBLISHED':'REQUESTED';
 const tracks=[
  {code:'PROVENANCE',state:provenanceState,updatedAt:provUpdated},
  {code:'CONDITION',state:conditionState,updatedAt:safeDate(current?.updatedAt)}
 ];
 const summary={
  tracks:tracks.length,initiated:tracks.filter(x=>initiated.has(x.state)).length,
  repliedOrPublished:tracks.filter(x=>responded.has(x.state)).length
 };
 return{
  schemaVersion:BUYER_DILIGENCE_SCHEMA_V90,objectId,listingId,
  scope:'CURRENT_BUYER_ONLY',authority:'BUYER_SCOPED_WORKFLOW_EVENTS',
  tracks,summary,
  limitations:{
   authenticityCertified:false,legalTitleVerified:false,
   sourceDocumentsDelivered:false,conditionProfessionallyCertified:false,
   privateDocumentAccessGranted:false,transactionCompleted:false
  }
 };
}
