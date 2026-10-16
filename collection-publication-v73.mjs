// ANTIQUA v73 — PostgreSQL-only, two-person collection publication authority.
// Never grant publication based on a PUBLIC visibility choice or demo-memory state.
import crypto from 'node:crypto';
import {db,lots,uid} from './runtime-v09.mjs';
import {hasPermission,requirePermission} from './security-v09.mjs';

const admissibleMedia=/^(?:painting|watercolou?r|drawing|graphics?|graphic arts|prints?|engraving|etching|lithograph(?:y)?|pastel|gouache|живопись|акварель|графика|рисунок|гравюра|офорт|литография|пастель|гуашь)$/iu;
const actions=new Set(['SUBMIT','APPROVE','PUBLISH','REQUEST_CHANGES','REVOKE']);
const bad=(status,code,message)=>Object.assign(new Error(message),{status,code});
const stable=value=>JSON.stringify(value,(key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const sha=value=>crypto.createHash('sha256').update(typeof value==='string'?value:stable(value)).digest('hex');
const copy=value=>structuredClone(value);

export function collectionContentDigest(c){
 // Whole-content binding: state review cannot survive edits to membership,
 // visibility, image, attribution, title, layout, or contextual notes.
 const items=(c.items||[]).map(i=>{
  const artwork=lots.find(x=>x.id===i.objectId);
  return{
   objectId:i.objectId,sortOrder:i.sortOrder,section:i.section,
   ownerDisplayMode:i.ownerDisplayMode,locationDisplayMode:i.locationDisplayMode,
   note:i.note,
   artwork:artwork?{image:artwork.image,department:artwork.department,title:artwork.title,maker:artwork.maker}:null
  };
 }).sort((a,b)=>a.sortOrder-b.sortOrder||a.objectId.localeCompare(b.objectId));
 return sha({
  id:c.id,ownerAccountId:c.ownerAccountId,
  title:c.title,summary:c.summary,story:c.story,
  collectionType:c.collectionType,visibility:c.visibility,coverObjectId:c.coverObjectId,
  items
 });
}

export function publicationEligible(c){
 if(!c||c.visibility!=='PUBLIC'||!Array.isArray(c.items)||c.items.length<1||c.items.length>100)return false;
 return c.items.every(i=>{
  const work=lots.find(x=>x.id===i.objectId);
  const medium=typeof work?.department==='string'?work.department:work?.department?.en||work?.department?.ru||'';
  return Boolean(work?.image&&admissibleMedia.test(String(medium).trim())&&
   i.ownerDisplayMode==='ANONYMOUS'&&i.locationDisplayMode==='HIDDEN');
 });
}
export function publishedSnapshotMatches(c){
 const m=c?.metadata||{};
 return m.publicationState==='PUBLISHED'&&m.reviewedForPublicHomepage===true&&
  m.mediaRightsReviewed===true&&/^[a-f0-9]{64}$/.test(m.approvedDigest||'')&&
  m.approvedDigest===collectionContentDigest(c)&&publicationEligible(c);
}
async function lockedCollection(client,id){
 const row=(await client.query('SELECT * FROM collections WHERE id=$1 FOR UPDATE',[id])).rows[0];
 if(!row)return null;
 const rows=(await client.query('SELECT * FROM collection_objects WHERE collection_id=$1 ORDER BY sort_order,object_id',[id])).rows;
 return{
  id:row.id,ownerAccountId:row.owner_account_id,title:row.title,summary:row.summary,story:row.story,
  visibility:row.visibility,collectionType:row.collection_type,coverObjectId:row.cover_object_id,
  metadata:row.metadata||{},items:rows.map(r=>({
   objectId:r.object_id,sortOrder:r.sort_order,section:r.section,
   ownerDisplayMode:r.owner_display_mode,locationDisplayMode:r.location_display_mode,note:r.note
  }))
 };
}
const normKey=raw=>{
 if(raw==null||raw==='')return null;
 const key=String(raw);
 if(!/^[A-Za-z0-9._:-]{8,128}$/.test(key))throw bad(400,'BAD_IDEMPOTENCY_KEY','Invalid idempotency key');
 return key;
};
function evidence(body,items){
 if(body.rightsAttested!==true)throw bad(422,'RIGHTS_ATTESTATION_REQUIRED','Explicit reviewer attestation required');
 const refs=body.evidenceRefs;
 if(!Array.isArray(refs)||refs.length!==items.length)throw bad(422,'MEDIA_EVIDENCE_REQUIRED','One rights evidence reference required for each artwork');
 const workIds=new Set(items.map(x=>x.objectId));
 const seen=new Set();
 return refs.map(ref=>{
  if(!ref||typeof ref!=='object'||Array.isArray(ref))throw bad(422,'INVALID_MEDIA_EVIDENCE','Invalid rights evidence');
  const objectId=String(ref.objectId||''),evidenceRef=String(ref.evidenceRef||''),basis=String(ref.rightsBasis||'');
  if(!workIds.has(objectId)||seen.has(objectId))throw bad(422,'INVALID_MEDIA_EVIDENCE','Evidence references do not match artworks');
  if(!/^[A-Za-z0-9:/._-]{10,220}$/.test(evidenceRef)||!['DIRECT_LICENSE','PUBLIC_DOMAIN','CC0'].includes(basis))
   throw bad(422,'INVALID_MEDIA_EVIDENCE','Invalid rights evidence reference or basis');
  seen.add(objectId);
  return{objectId,evidenceRef,rightsBasis:basis};
 });
}
function authorize(actor,action,ownerId){
 if(!actor?.id)throw bad(401,'AUTH_REQUIRED','Authentication required');
 if(action==='SUBMIT'){requirePermission(actor,'collection.manage');if(actor.id!==ownerId)throw bad(404,'COLLECTION_NOT_FOUND','Collection not found');return}
 if(actor.id===ownerId)throw bad(403,'INDEPENDENT_REVIEW_REQUIRED','Collection owners cannot review their own publications');
 if(action==='APPROVE')requirePermission(actor,'catalogue.review');
 if(action==='PUBLISH'||action==='REVOKE')requirePermission(actor,'trust.review');
 if(action==='REQUEST_CHANGES'&&!hasPermission(actor,'catalogue.review')&&!hasPermission(actor,'trust.review'))
  throw bad(403,'FORBIDDEN','Reviewer permission required');
}
const safeNote=(note,required)=>{
 if(typeof note!=='string'||note.length>1200||required&&note.trim().length<12)
  throw bad(400,'INVALID_REVIEW_NOTE','Review note must be a reasoned statement of 12-1200 characters');
 return note.trim();
};
const publicMeta=(previous,state,extra={})=>({
 ...previous,publicationState:state,reviewedForPublicHomepage:state==='PUBLISHED',
 mediaRightsReviewed:state==='PUBLISHED',
 ...extra
});
const eventRow=r=>({
 id:r.id,sequenceNo:r.sequence_no,action:r.action,fromState:r.from_state,
 toState:r.to_state,snapshotHash:r.snapshot_hash,eventHash:r.event_hash,
 previousEventHash:r.previous_event_hash,at:r.created_at instanceof Date?r.created_at.toISOString():r.created_at,
 note:r.action==='REQUEST_CHANGES'?r.note:null
});
const response=(c,ev,idempotent=false)=>({
 collectionId:c.id,publicationState:c.metadata?.publicationState||'DRAFT',
 snapshotHash:collectionContentDigest(c),event:ev?eventRow(ev):null,idempotent
});

export async function collectionPublicationStatus(actor,id){
 if(db.kind!=='POSTGRES')throw bad(503,'POSTGRES_REQUIRED','Durable publication authority requires PostgreSQL');
 const r=(await db.pool.query('SELECT id,owner_account_id,metadata,visibility FROM collections WHERE id=$1',[id])).rows[0];
 if(!r)throw bad(404,'COLLECTION_NOT_FOUND','Collection not found');
 if(r.owner_account_id!==actor?.id&&!hasPermission(actor,'catalogue.review')&&!hasPermission(actor,'trust.review'))
  throw bad(404,'COLLECTION_NOT_FOUND','Collection not found');
 const events=(await db.pool.query('SELECT * FROM collection_publication_events WHERE collection_id=$1 ORDER BY sequence_no',[id])).rows;
 return{collectionId:id,publicationState:r.metadata?.publicationState||'DRAFT',visibility:r.visibility,
  events:events.map(eventRow)};
}

export async function transitionCollectionPublication(actor,id,action,body={}){
 if(db.kind!=='POSTGRES')throw bad(503,'POSTGRES_REQUIRED','Durable publication authority requires PostgreSQL');
 if(!actions.has(action))throw bad(400,'INVALID_ACTION','Invalid publication action');
 if(!body||typeof body!=='object'||Array.isArray(body))throw bad(400,'INVALID_BODY','Invalid publication body');
 const note=safeNote(body.note??'',action!=='SUBMIT');
 const key=normKey(body.idempotencyKey??null);
 const client=await db.pool.connect();
 try{
  await client.query('BEGIN');
  const c=await lockedCollection(client,id);
  if(!c)throw bad(404,'COLLECTION_NOT_FOUND','Collection not found');
  authorize(actor,action,c.ownerAccountId);
  const requestedEvidence=action==='PUBLISH'?evidence(body,c.items):[];
  const requestDigest=sha({action,note,requestedEvidence,rightsAttested:body.rightsAttested===true});
  if(key){
   const prior=(await client.query('SELECT * FROM collection_publication_events WHERE collection_id=$1 AND actor_account_id=$2 AND idempotency_key=$3',[id,actor.id,key])).rows[0];
   if(prior){
    if(prior.action!==action||prior.request_hash!==requestDigest)throw bad(409,'IDEMPOTENCY_CONFLICT','Idempotency key used for a different decision');
    await client.query('COMMIT');
    return response(c,prior,true);
   }
  }
  const state=c.metadata?.publicationState||'DRAFT';
  const digest=collectionContentDigest(c);
  let next,metadata;
  const frozen=c.metadata?.submittedDigest===digest;
  if(action==='SUBMIT'){
   if(!['DRAFT','REVIEW_REQUIRED','CHANGES_REQUESTED','REVOKED'].includes(state))
    throw bad(409,'INVALID_TRANSITION','Collection is already under review');
   if(!publicationEligible(c))throw bad(422,'ARTWORK_OR_PRIVACY_REVIEW_REQUIRED','Collection contains non-paintings, missing media or disclosive fields');
   next='SUBMITTED';
   metadata=publicMeta(c.metadata,next,{
    submittedDigest:digest,approvedDigest:null,catalogueReviewerId:null,
    catalogueReviewedAt:null,rightsReviewerId:null,rightsReviewedAt:null
   });
  }else if(action==='APPROVE'){
   if(state!=='SUBMITTED'||!frozen)throw bad(409,'STALE_SUBMISSION','Submitted collection changed or is not in catalogue review');
   next='CATALOGUE_APPROVED';
   metadata=publicMeta(c.metadata,next,{catalogueReviewerId:actor.id,catalogueReviewedAt:new Date().toISOString()});
  }else if(action==='PUBLISH'){
   if(state!=='CATALOGUE_APPROVED'||!frozen||!publicationEligible(c))
    throw bad(409,'STALE_APPROVAL','Collection requires a current catalogue approval');
   if(c.metadata?.catalogueReviewerId===actor.id)throw bad(403,'SECOND_REVIEWER_REQUIRED','Rights reviewer must be independent of catalogue reviewer');
   next='PUBLISHED';
   metadata=publicMeta(c.metadata,next,{
    approvedDigest:digest,rightsReviewerId:actor.id,rightsReviewedAt:new Date().toISOString()
   });
  }else if(action==='REQUEST_CHANGES'){
   if(!['SUBMITTED','CATALOGUE_APPROVED'].includes(state))throw bad(409,'INVALID_TRANSITION','Collection is not awaiting review');
   next='CHANGES_REQUESTED';
   metadata=publicMeta(c.metadata,next,{submittedDigest:null,approvedDigest:null,catalogueReviewerId:null,rightsReviewerId:null});
  }else{
   if(state!=='PUBLISHED')throw bad(409,'INVALID_TRANSITION','Only a published collection can be revoked');
   next='REVOKED';
   metadata=publicMeta(c.metadata,next,{approvedDigest:null,rightsReviewerId:null});
  }
  const history=(await client.query('SELECT sequence_no,event_hash FROM collection_publication_events WHERE collection_id=$1 ORDER BY sequence_no DESC LIMIT 1',[id])).rows[0]||null;
  const sequenceNo=Number(history?.sequence_no||0)+1,at=new Date().toISOString();
  const hash=sha({collectionId:id,sequenceNo,fromState:state,toState:next,action,actorId:actor.id,digest,
   previousEventHash:history?.event_hash||null,requestDigest,at});
  const ev=(await client.query(
   "INSERT INTO collection_publication_events(id,collection_id,sequence_no,actor_account_id,action,from_state,to_state,snapshot_hash,previous_event_hash,event_hash,idempotency_key,request_hash,note,media_evidence,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *",
   [uid('cpe'),id,sequenceNo,actor.id,action,state,next,digest,history?.event_hash||null,hash,key,requestDigest,note,requestedEvidence,at]
  )).rows[0];
  await client.query('UPDATE collections SET metadata=$2::jsonb,updated_at=now() WHERE id=$1',[id,metadata]);
  await client.query('COMMIT');
  return response({...c,metadata},ev);
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error}
 finally{client.release()}
}
