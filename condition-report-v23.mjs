import {db,listing,uid,now,notify,requirePermission,createReadUrl} from './runtime-v09.mjs';

const clone=x=>x==null?x:structuredClone(x);
const iso=v=>v?.toISOString?.()||v||null;
const mem={requests:new Map(),versions:new Map(),events:new Map()};
const fail=(status,code,message,extra={})=>{throw Object.assign(new Error(message),{status,code,...extra})};

function actionId(body){
 const x=String(body?.clientActionId||'').trim();
 if(x.length<8||x.length>160)fail(400,'CLIENT_ACTION_ID_INVALID','clientActionId is required');
 return x
}
function expectedVersion(body,current){
 const v=Number(body?.expectedVersion);
 if(!Number.isSafeInteger(v)||v<1)fail(400,'EXPECTED_VERSION_REQUIRED','expectedVersion is required');
 if(v!==current)fail(409,'SERVICE_VERSION_CONFLICT','Request changed; reload before acting',{currentVersion:current});
 return v
}
function note(v,max=2000){
 const x=String(v||'').trim();
 if(x.length>max)fail(400,'SERVICE_NOTE_TOO_LONG','Text is too long');
 return x
}
function roleFor(a,r){
 if(!a||!r)return null;
 if(a.id===r.buyerAccountId)return'BUYER';
 if(a.sellerId&&a.sellerId===r.sellerId)return'SELLER';
 if(a.roles?.some(x=>['ADMIN','TRUST_REVIEWER'].includes(x)))return'OPERATOR';
 return null
}
function mapRequest(r){
 if(!r)return null;
 return{
  id:r.id,listingId:r.listing_id??r.listingId,objectId:r.object_id??r.objectId,
  buyerAccountId:r.buyer_account_id??r.buyerAccountId,sellerId:r.seller_id??r.sellerId,
  status:r.status,version:Number(r.version),currentReportVersion:r.current_report_version??r.currentReportVersion??null,
  note:r.note||'',createIdempotencyKey:r.create_idempotency_key??r.createIdempotencyKey??null,
  createdAt:iso(r.created_at??r.createdAt),updatedAt:iso(r.updated_at??r.updatedAt)
 }
}
function mapVersion(r){
 if(!r)return null;
 return{
  id:r.id,requestId:r.request_id??r.requestId,versionNo:Number(r.version_no??r.versionNo),
  mediaId:r.media_id??r.mediaId,summary:r.summary||'',conditionGrade:r.condition_grade??r.conditionGrade??'',
  restorationNotes:r.restoration_notes??r.restorationNotes??'',createdByAccountId:r.created_by_account_id??r.createdByAccountId,
  createdAt:iso(r.created_at??r.createdAt)
 }
}
function mapEvent(r){
 if(!r)return null;
 return{
  id:r.id,requestId:r.request_id??r.requestId,version:Number(r.version),eventType:r.event_type??r.eventType,
  actorAccountId:r.actor_account_id??r.actorAccountId??null,actorRole:r.actor_role??r.actorRole,
  clientActionId:r.client_action_id??r.clientActionId??null,metadata:r.metadata||{},createdAt:iso(r.created_at??r.createdAt)
 }
}
async function pgVersions(id,cx=db.pool){
 return(await cx.query('SELECT * FROM condition_report_versions WHERE request_id=$1 ORDER BY version_no',[id])).rows.map(mapVersion)
}
async function pgEvents(id,cx=db.pool){
 return(await cx.query('SELECT * FROM condition_report_events WHERE request_id=$1 ORDER BY version',[id])).rows.map(mapEvent)
}
function memVersions(id){return clone(mem.versions.get(id)||[])}
function memEvents(id){return clone(mem.events.get(id)||[])}
async function publicRequest(a,r,{cx=null}={}){
 const participantRole=roleFor(a,r);
 const versions=db.kind==='POSTGRES'?await pgVersions(r.id,cx||db.pool):memVersions(r.id);
 const events=db.kind==='POSTGRES'?await pgEvents(r.id,cx||db.pool):memEvents(r.id);
 const allowedActions=[];
 if(participantRole==='BUYER'&&r.status==='REQUESTED')allowedActions.push('CANCEL');
 if(participantRole==='SELLER'&&r.status!=='CANCELLED')allowedActions.push('PUBLISH_VERSION');
 return{...clone(r),participantRole,versions,history:events,allowedActions}
}
async function loadPg(id,cx=db.pool,{lock=false}={}){
 const row=(await cx.query('SELECT * FROM condition_report_requests WHERE id=$1'+(lock?' FOR UPDATE':''),[id])).rows[0];
 return mapRequest(row)
}
async function loadListingPg(id,cx=db.pool,{lock=false}={}){
 const row=(await cx.query('SELECT * FROM listings WHERE id=$1'+(lock?' FOR UPDATE':''),[id])).rows[0];
 return row?{...(row.payload||{}),id:row.id,lotId:row.object_id,sellerId:row.seller_id,status:row.status}:null
}
function validateCreate(a,li,body){
 requirePermission(a,'service.request');
 if(!a.roles?.includes('BUYER'))fail(403,'BUYER_REQUIRED','Buyer account required');
 if(!li||li.status!=='ACTIVE')fail(404,'LISTING_NOT_AVAILABLE','Active listing not found');
 if(a.sellerId&&a.sellerId===li.sellerId)fail(409,'OWN_LISTING_SERVICE_REQUEST','Seller cannot request service on own listing');
 return{note:note(body.note),clientActionId:actionId(body)}
}
async function validateMedia(r,mediaId,cx=null){
 const asset=db.kind==='POSTGRES'
  ?(await (cx||db.pool).query('SELECT * FROM media_assets WHERE id=$1',[mediaId])).rows[0]
  :await db.getMedia(mediaId);
 if(!asset)fail(404,'CONDITION_MEDIA_NOT_FOUND','Condition report media not found');
 const entityType=asset.entity_type??asset.entityType,entityId=asset.entity_id??asset.entityId,role=asset.role,status=asset.status;
 if(entityType!=='OBJECT'||entityId!==r.objectId||role!=='CONDITION'||status!=='READY')fail(409,'CONDITION_MEDIA_INVALID','Condition report requires READY CONDITION media for the same object');
 return asset
}

export function conditionReportCapabilities(){
 return{contractVersion:'v23',structuredWorkflow:true,states:['REQUESTED','FULFILLED','CANCELLED'],versionedReports:true,immutableVersions:true,optimisticLocking:true,idempotency:true,privateMedia:true,buyerReadAfterPublish:true}
}

export async function createConditionReportRequest(a,listingId,body={}){
 const clientActionId=actionId(body);
 if(db.kind!=='POSTGRES'){
  const replay=[...mem.requests.values()].find(x=>x.buyerAccountId===a.id&&x.createIdempotencyKey===clientActionId);
  if(replay)return{request:await publicRequest(a,replay),idempotent:true};
  const li=listing(String(listingId||'')),v=validateCreate(a,li,body);
  const open=[...mem.requests.values()].find(x=>x.buyerAccountId===a.id&&x.listingId===li.id&&x.status==='REQUESTED');
  if(open)return{request:await publicRequest(a,open),idempotent:true,reusedOpen:true};
  const ts=now(),r={id:uid('crq'),listingId:li.id,objectId:li.lotId,buyerAccountId:a.id,sellerId:li.sellerId,status:'REQUESTED',version:1,currentReportVersion:null,note:v.note,createIdempotencyKey:v.clientActionId,createdAt:ts,updatedAt:ts};
  mem.requests.set(r.id,r);mem.events.set(r.id,[{id:uid('cre'),requestId:r.id,version:1,eventType:'REQUESTED',actorAccountId:a.id,actorRole:'BUYER',clientActionId:v.clientActionId,metadata:{listingId:r.listingId,objectId:r.objectId},createdAt:ts}]);
  const sa=await db.findAccountBySellerId(r.sellerId);if(sa)await notify(sa.id,'NEW_CONDITION_REPORT_REQUEST',{requestId:r.id,listingId:r.listingId,objectId:r.objectId});
  return{request:await publicRequest(a,r),idempotent:false}
 }
 const replay=(await db.pool.query('SELECT * FROM condition_report_requests WHERE buyer_account_id=$1 AND create_idempotency_key=$2',[a.id,clientActionId])).rows[0];
 if(replay){const r=mapRequest(replay);return{request:await publicRequest(a,r),idempotent:true}}
 const cx=await db.pool.connect();let out;
 try{
  await cx.query('BEGIN');
  const li=await loadListingPg(String(listingId||''),cx,{lock:true}),v=validateCreate(a,li,body);
  await cx.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)',['condition|'+a.id+'|'+li.id]);
  const again=(await cx.query('SELECT * FROM condition_report_requests WHERE buyer_account_id=$1 AND create_idempotency_key=$2',[a.id,v.clientActionId])).rows[0];
  if(again){await cx.query('COMMIT');const r=mapRequest(again);return{request:await publicRequest(a,r),idempotent:true}}
  const open=(await cx.query("SELECT * FROM condition_report_requests WHERE buyer_account_id=$1 AND listing_id=$2 AND status='REQUESTED' ORDER BY created_at DESC LIMIT 1",[a.id,li.id])).rows[0];
  if(open){await cx.query('COMMIT');const r=mapRequest(open);return{request:await publicRequest(a,r),idempotent:true,reusedOpen:true}}
  const ts=now(),r={id:uid('crq'),listingId:li.id,objectId:li.lotId,buyerAccountId:a.id,sellerId:li.sellerId,status:'REQUESTED',version:1,currentReportVersion:null,note:v.note,createIdempotencyKey:v.clientActionId,createdAt:ts,updatedAt:ts};
  const row=(await cx.query("INSERT INTO condition_report_requests(id,listing_id,object_id,buyer_account_id,seller_id,status,version,note,create_idempotency_key,created_at,updated_at) VALUES($1,$2,$3,$4,$5,'REQUESTED',1,$6,$7,$8,$8) RETURNING *",[r.id,r.listingId,r.objectId,r.buyerAccountId,r.sellerId,r.note,r.createIdempotencyKey,ts])).rows[0];
  await cx.query("INSERT INTO condition_report_events(id,request_id,version,event_type,actor_account_id,actor_role,client_action_id,metadata,created_at) VALUES($1,$2,1,'REQUESTED',$3,'BUYER',$4,$5,$6)",[uid('cre'),r.id,a.id,v.clientActionId,{listingId:r.listingId,objectId:r.objectId},ts]);
  await cx.query('COMMIT');out=mapRequest(row)
 }catch(e){try{await cx.query('ROLLBACK')}catch{}throw e}finally{cx.release()}
 const sa=await db.findAccountBySellerId(out.sellerId);if(sa)await notify(sa.id,'NEW_CONDITION_REPORT_REQUEST',{requestId:out.id,listingId:out.listingId,objectId:out.objectId});
 return{request:await publicRequest(a,out),idempotent:false}
}

export async function getConditionReportRequest(a,id){
 const r=db.kind==='POSTGRES'?await loadPg(id):clone(mem.requests.get(id));
 if(!r||!roleFor(a,r))return null;
 return publicRequest(a,r)
}
export async function listConditionReportRequests(a){
 let rows;
 if(db.kind==='POSTGRES')rows=(a.sellerId?(await db.pool.query('SELECT * FROM condition_report_requests WHERE buyer_account_id=$1 OR seller_id=$2 ORDER BY updated_at DESC',[a.id,a.sellerId])).rows:(await db.pool.query('SELECT * FROM condition_report_requests WHERE buyer_account_id=$1 ORDER BY updated_at DESC',[a.id])).rows).map(mapRequest);
 else rows=[...mem.requests.values()].filter(r=>roleFor(a,r)).sort((x,y)=>String(y.updatedAt).localeCompare(String(x.updatedAt)));
 const out=[];for(const r of rows)out.push(await publicRequest(a,r));return out
}

export async function publishConditionReportVersion(a,id,body={}){
 const clientActionId=actionId(body);
 if(db.kind!=='POSTGRES'){
  const r=mem.requests.get(id);if(!r||roleFor(a,r)!=='SELLER')fail(404,'CONDITION_REQUEST_NOT_FOUND','Condition report request not found');
  requirePermission(a,'seller.service.respond');
  const prior=(mem.events.get(id)||[]).find(e=>e.actorAccountId===a.id&&e.clientActionId===clientActionId);if(prior)return{request:await publicRequest(a,r),idempotent:true};
  if(r.status==='CANCELLED')fail(409,'CONDITION_REQUEST_CANCELLED','Condition report request is cancelled');
  expectedVersion(body,r.version);await validateMedia(r,String(body.mediaId||''));
  const ts=now(),reportVersion=(r.currentReportVersion||0)+1,requestVersion=r.version+1;
  const v={id:uid('crv'),requestId:r.id,versionNo:reportVersion,mediaId:String(body.mediaId),summary:note(body.summary,4000),conditionGrade:note(body.conditionGrade,80),restorationNotes:note(body.restorationNotes,4000),createdByAccountId:a.id,createdAt:ts};
  const xs=mem.versions.get(id)||[];xs.push(v);mem.versions.set(id,xs);r.status='FULFILLED';r.version=requestVersion;r.currentReportVersion=reportVersion;r.updatedAt=ts;
  (mem.events.get(id)||[]).push({id:uid('cre'),requestId:id,version:requestVersion,eventType:'PUBLISHED',actorAccountId:a.id,actorRole:'SELLER',clientActionId,metadata:{reportVersion,mediaId:v.mediaId},createdAt:ts});
  await notify(r.buyerAccountId,'CONDITION_REPORT_PUBLISHED',{requestId:id,objectId:r.objectId,reportVersion});
  return{request:await publicRequest(a,r),version:clone(v),idempotent:false}
 }
 const replay=(await db.pool.query('SELECT request_id FROM condition_report_events WHERE actor_account_id=$1 AND client_action_id=$2',[a.id,clientActionId])).rows[0];
 if(replay){if(replay.request_id!==id)fail(409,'CLIENT_ACTION_ID_CONFLICT','clientActionId belongs to another request');const r=await getConditionReportRequest(a,id);return{request:r,version:r?.versions?.at(-1)||null,idempotent:true}}
 const cx=await db.pool.connect();let out,versionOut;
 try{
  await cx.query('BEGIN');const r=await loadPg(id,cx,{lock:true});if(!r||roleFor(a,r)!=='SELLER')fail(404,'CONDITION_REQUEST_NOT_FOUND','Condition report request not found');
  requirePermission(a,'seller.service.respond');
  const prior=(await cx.query('SELECT * FROM condition_report_events WHERE actor_account_id=$1 AND client_action_id=$2',[a.id,clientActionId])).rows[0];
  if(prior){await cx.query('COMMIT');const current=await getConditionReportRequest(a,id);return{request:current,version:current?.versions?.at(-1)||null,idempotent:true}}
  if(r.status==='CANCELLED')fail(409,'CONDITION_REQUEST_CANCELLED','Condition report request is cancelled');
  expectedVersion(body,r.version);await validateMedia(r,String(body.mediaId||''),cx);
  const reportVersion=(r.currentReportVersion||0)+1,requestVersion=r.version+1,ts=now();
  const vr=(await cx.query('INSERT INTO condition_report_versions(id,request_id,version_no,media_id,summary,condition_grade,restoration_notes,created_by_account_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',[uid('crv'),id,reportVersion,String(body.mediaId),note(body.summary,4000),note(body.conditionGrade,80),note(body.restorationNotes,4000),a.id,ts])).rows[0];
  const rr=(await cx.query("UPDATE condition_report_requests SET status='FULFILLED',version=$2,current_report_version=$3,updated_at=$4 WHERE id=$1 RETURNING *",[id,requestVersion,reportVersion,ts])).rows[0];
  await cx.query("INSERT INTO condition_report_events(id,request_id,version,event_type,actor_account_id,actor_role,client_action_id,metadata,created_at) VALUES($1,$2,$3,'PUBLISHED',$4,'SELLER',$5,$6,$7)",[uid('cre'),id,requestVersion,a.id,clientActionId,{reportVersion,mediaId:String(body.mediaId)},ts]);
  await cx.query('COMMIT');out=mapRequest(rr);versionOut=mapVersion(vr)
 }catch(e){try{await cx.query('ROLLBACK')}catch{}throw e}finally{cx.release()}
 await notify(out.buyerAccountId,'CONDITION_REPORT_PUBLISHED',{requestId:id,objectId:out.objectId,reportVersion:out.currentReportVersion});
 return{request:await publicRequest(a,out),version:versionOut,idempotent:false}
}

export async function cancelConditionReportRequest(a,id,body={}){
 const clientActionId=actionId(body);
 if(db.kind!=='POSTGRES'){
  const r=mem.requests.get(id);if(!r||roleFor(a,r)!=='BUYER')fail(404,'CONDITION_REQUEST_NOT_FOUND','Condition report request not found');
  requirePermission(a,'service.request');
  const prior=(mem.events.get(id)||[]).find(e=>e.actorAccountId===a.id&&e.clientActionId===clientActionId);if(prior)return{request:await publicRequest(a,r),idempotent:true};
  if(r.status!=='REQUESTED')fail(409,'CONDITION_CANCEL_INVALID','Only an unanswered request can be cancelled');
  expectedVersion(body,r.version);r.status='CANCELLED';r.version++;r.updatedAt=now();(mem.events.get(id)||[]).push({id:uid('cre'),requestId:id,version:r.version,eventType:'CANCELLED',actorAccountId:a.id,actorRole:'BUYER',clientActionId,metadata:{},createdAt:r.updatedAt});
  const sa=await db.findAccountBySellerId(r.sellerId);if(sa)await notify(sa.id,'CONDITION_REPORT_REQUEST_CANCELLED',{requestId:id,objectId:r.objectId});
  return{request:await publicRequest(a,r),idempotent:false}
 }
 const cx=await db.pool.connect();let out;
 try{
  await cx.query('BEGIN');const r=await loadPg(id,cx,{lock:true});if(!r||roleFor(a,r)!=='BUYER')fail(404,'CONDITION_REQUEST_NOT_FOUND','Condition report request not found');
  requirePermission(a,'service.request');const prior=(await cx.query('SELECT * FROM condition_report_events WHERE actor_account_id=$1 AND client_action_id=$2',[a.id,clientActionId])).rows[0];if(prior){await cx.query('COMMIT');const current=await getConditionReportRequest(a,id);return{request:current,idempotent:true}}
  if(r.status!=='REQUESTED')fail(409,'CONDITION_CANCEL_INVALID','Only an unanswered request can be cancelled');expectedVersion(body,r.version);
  const version=r.version+1,ts=now(),rr=(await cx.query("UPDATE condition_report_requests SET status='CANCELLED',version=$2,updated_at=$3 WHERE id=$1 RETURNING *",[id,version,ts])).rows[0];
  await cx.query("INSERT INTO condition_report_events(id,request_id,version,event_type,actor_account_id,actor_role,client_action_id,metadata,created_at) VALUES($1,$2,$3,'CANCELLED',$4,'BUYER',$5,'{}'::jsonb,$6)",[uid('cre'),id,version,a.id,clientActionId,ts]);
  await cx.query('COMMIT');out=mapRequest(rr)
 }catch(e){try{await cx.query('ROLLBACK')}catch{}throw e}finally{cx.release()}
 const sa=await db.findAccountBySellerId(out.sellerId);if(sa)await notify(sa.id,'CONDITION_REPORT_REQUEST_CANCELLED',{requestId:id,objectId:out.objectId});
 return{request:await publicRequest(a,out),idempotent:false}
}

export async function conditionReportRead(a,id,versionNo){
 const r=db.kind==='POSTGRES'?await loadPg(id):clone(mem.requests.get(id));if(!r||!roleFor(a,r))fail(404,'CONDITION_REQUEST_NOT_FOUND','Condition report request not found');
 const versions=db.kind==='POSTGRES'?await pgVersions(id):memVersions(id),v=versions.find(x=>x.versionNo===Number(versionNo));if(!v)fail(404,'CONDITION_VERSION_NOT_FOUND','Condition report version not found');
 const asset=db.kind==='POSTGRES'?(await db.pool.query('SELECT * FROM media_assets WHERE id=$1',[v.mediaId])).rows[0]:await db.getMedia(v.mediaId);if(!asset||asset.status!=='READY')fail(409,'CONDITION_MEDIA_NOT_READY','Condition report media is not ready');
 const storageKey=asset.storage_key??asset.storageKey;if(!storageKey)fail(409,'CONDITION_MEDIA_INVALID','Condition report media storage key missing');
 return{requestId:id,version:v,read:await createReadUrl(storageKey)}
}
