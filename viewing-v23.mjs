import {db,listing,uid,now,notify,requirePermission} from './runtime-v09.mjs';

const clone=x=>x==null?x:structuredClone(x);
const iso=v=>v?.toISOString?.()||v||null;
const mem={requests:new Map(),slots:new Map(),events:new Map(),calendar:new Map()};
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
function text(v,max=2000){
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
 return{id:r.id,listingId:r.listing_id??r.listingId,objectId:r.object_id??r.objectId,buyerAccountId:r.buyer_account_id??r.buyerAccountId,sellerId:r.seller_id??r.sellerId,status:r.status,version:Number(r.version),proposalVersion:Number(r.proposal_version??r.proposalVersion??0),selectedSlotId:r.selected_slot_id??r.selectedSlotId??null,note:r.note||'',createIdempotencyKey:r.create_idempotency_key??r.createIdempotencyKey??null,createdAt:iso(r.created_at??r.createdAt),updatedAt:iso(r.updated_at??r.updatedAt)}
}
function mapSlot(r){
 if(!r)return null;
 return{id:r.id,requestId:r.request_id??r.requestId,proposalVersion:Number(r.proposal_version??r.proposalVersion),startsAt:iso(r.starts_at??r.startsAt),endsAt:iso(r.ends_at??r.endsAt),timezone:r.timezone,createdByAccountId:r.created_by_account_id??r.createdByAccountId,createdAt:iso(r.created_at??r.createdAt)}
}
function mapEvent(r){
 if(!r)return null;
 return{id:r.id,requestId:r.request_id??r.requestId,version:Number(r.version),eventType:r.event_type??r.eventType,actorAccountId:r.actor_account_id??r.actorAccountId??null,actorRole:r.actor_role??r.actorRole,clientActionId:r.client_action_id??r.clientActionId??null,metadata:r.metadata||{},createdAt:iso(r.created_at??r.createdAt)}
}
function mapCalendar(r){
 if(!r)return null;
 return{id:r.id,requestId:r.request_id??r.requestId,eventUid:r.event_uid??r.eventUid,status:r.status,startsAt:iso(r.starts_at??r.startsAt),endsAt:iso(r.ends_at??r.endsAt),timezone:r.timezone,sequence:Number(r.sequence||0),title:r.title||{},createdAt:iso(r.created_at??r.createdAt),updatedAt:iso(r.updated_at??r.updatedAt)}
}
async function loadPg(id,cx=db.pool,{lock=false}={}){
 const row=(await cx.query('SELECT * FROM viewing_requests WHERE id=$1'+(lock?' FOR UPDATE':''),[id])).rows[0];return mapRequest(row)
}
async function loadListingPg(id,cx=db.pool,{lock=false}={}){
 const row=(await cx.query('SELECT * FROM listings WHERE id=$1'+(lock?' FOR UPDATE':''),[id])).rows[0];
 return row?{...(row.payload||{}),id:row.id,lotId:row.object_id,sellerId:row.seller_id,status:row.status}:null
}
async function pgSlots(id,cx=db.pool){return(await cx.query('SELECT * FROM viewing_slots WHERE request_id=$1 ORDER BY proposal_version,starts_at,id',[id])).rows.map(mapSlot)}
async function pgEvents(id,cx=db.pool){return(await cx.query('SELECT * FROM viewing_request_events WHERE request_id=$1 ORDER BY version',[id])).rows.map(mapEvent)}
async function pgCalendar(id,cx=db.pool){return mapCalendar((await cx.query('SELECT * FROM viewing_calendar_events WHERE request_id=$1',[id])).rows[0])}
function memSlots(id){return clone(mem.slots.get(id)||[])}
function memEvents(id){return clone(mem.events.get(id)||[])}
function allowedActions(a,r){
 const role=roleFor(a,r),out=[];
 if(role==='SELLER'&&['REQUESTED','RESCHEDULE_REQUESTED','SLOTS_PROPOSED'].includes(r.status))out.push('PROPOSE_SLOTS');
 if(role==='BUYER'&&r.status==='SLOTS_PROPOSED')out.push('CONFIRM');
 if(['BUYER','SELLER'].includes(role)&&r.status==='CONFIRMED')out.push('REQUEST_RESCHEDULE');
 if(['BUYER','SELLER'].includes(role)&&r.status!=='CANCELLED')out.push('CANCEL');
 return out
}
async function publicRequest(a,r){
 const slots=db.kind==='POSTGRES'?await pgSlots(r.id):memSlots(r.id),events=db.kind==='POSTGRES'?await pgEvents(r.id):memEvents(r.id),calendar=db.kind==='POSTGRES'?await pgCalendar(r.id):clone(mem.calendar.get(r.id)||null);
 return{...clone(r),participantRole:roleFor(a,r),slots,history:events,calendarEvent:calendar,allowedActions:allowedActions(a,r)}
}
function validateCreate(a,li,body){
 requirePermission(a,'service.request');if(!a.roles?.includes('BUYER'))fail(403,'BUYER_REQUIRED','Buyer account required');
 if(!li||li.status!=='ACTIVE')fail(404,'LISTING_NOT_AVAILABLE','Active listing not found');
 if(a.sellerId&&a.sellerId===li.sellerId)fail(409,'OWN_LISTING_SERVICE_REQUEST','Seller cannot request viewing of own listing');
 return{note:text(body.note),clientActionId:actionId(body)}
}
function normalizeSlots(body){
 const input=Array.isArray(body.slots)?body.slots:[];
 if(input.length<2||input.length>5)fail(400,'VIEWING_SLOTS_COUNT','Provide between 2 and 5 viewing slots');
 const seen=new Set(),out=input.map((s,i)=>{
  const starts=new Date(s.startsAt),ends=new Date(s.endsAt),timezone=String(s.timezone||'UTC').trim();
  if(!Number.isFinite(starts.getTime())||!Number.isFinite(ends.getTime()))fail(400,'VIEWING_SLOT_INVALID','Invalid viewing slot');
  if(starts.getTime()<Date.now()+5*60*1000)fail(400,'VIEWING_SLOT_TOO_SOON','Viewing slots must be in the future');
  if(ends<=starts||ends-starts>4*60*60*1000)fail(400,'VIEWING_SLOT_DURATION','Viewing slot duration is invalid');
  if(starts.getTime()>Date.now()+90*86400000)fail(400,'VIEWING_SLOT_TOO_FAR','Viewing slots may not exceed 90 days');
  if(!timezone||timezone.length>80)fail(400,'VIEWING_TIMEZONE_INVALID','Timezone is invalid');
  const key=starts.toISOString()+'|'+ends.toISOString();if(seen.has(key))fail(400,'VIEWING_SLOT_DUPLICATE','Duplicate viewing slot');seen.add(key);
  return{startsAt:starts.toISOString(),endsAt:ends.toISOString(),timezone,index:i}
 });
 return out
}
function titleFor(r){return{en:'ANTIQUA object viewing',ru:'Просмотр предмета ANTIQUA',objectId:r.objectId}}

export function viewingCapabilities(){
 return{contractVersion:'v23',states:['REQUESTED','SLOTS_PROPOSED','CONFIRMED','RESCHEDULE_REQUESTED','CANCELLED'],slotProposalsVersioned:true,calendarProjection:true,ics:true,optimisticLocking:true,idempotency:true,immutableHistory:true}
}

export async function createViewingRequest(a,listingId,body={}){
 const clientActionId=actionId(body);
 if(db.kind!=='POSTGRES'){
  const replay=[...mem.requests.values()].find(x=>x.buyerAccountId===a.id&&x.createIdempotencyKey===clientActionId);if(replay)return{request:await publicRequest(a,replay),idempotent:true};
  const li=listing(String(listingId||'')),v=validateCreate(a,li,body),open=[...mem.requests.values()].find(x=>x.buyerAccountId===a.id&&x.listingId===li.id&&x.status!=='CANCELLED');
  if(open)return{request:await publicRequest(a,open),idempotent:true,reusedOpen:true};
  const ts=now(),r={id:uid('vwq'),listingId:li.id,objectId:li.lotId,buyerAccountId:a.id,sellerId:li.sellerId,status:'REQUESTED',version:1,proposalVersion:0,selectedSlotId:null,note:v.note,createIdempotencyKey:v.clientActionId,createdAt:ts,updatedAt:ts};
  mem.requests.set(r.id,r);mem.events.set(r.id,[{id:uid('vwe'),requestId:r.id,version:1,eventType:'REQUESTED',actorAccountId:a.id,actorRole:'BUYER',clientActionId:v.clientActionId,metadata:{listingId:r.listingId,objectId:r.objectId},createdAt:ts}]);
  const sa=await db.findAccountBySellerId(r.sellerId);if(sa)await notify(sa.id,'NEW_VIEWING_REQUEST',{requestId:r.id,listingId:r.listingId,objectId:r.objectId});
  return{request:await publicRequest(a,r),idempotent:false}
 }
 const replay=(await db.pool.query('SELECT * FROM viewing_requests WHERE buyer_account_id=$1 AND create_idempotency_key=$2',[a.id,clientActionId])).rows[0];if(replay){const r=mapRequest(replay);return{request:await publicRequest(a,r),idempotent:true}}
 const cx=await db.pool.connect();let out;
 try{
  await cx.query('BEGIN');const li=await loadListingPg(String(listingId||''),cx,{lock:true}),v=validateCreate(a,li,body);await cx.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)',['viewing|'+a.id+'|'+li.id]);
  const again=(await cx.query('SELECT * FROM viewing_requests WHERE buyer_account_id=$1 AND create_idempotency_key=$2',[a.id,v.clientActionId])).rows[0];if(again){await cx.query('COMMIT');const r=mapRequest(again);return{request:await publicRequest(a,r),idempotent:true}}
  const open=(await cx.query("SELECT * FROM viewing_requests WHERE buyer_account_id=$1 AND listing_id=$2 AND status<>'CANCELLED' ORDER BY created_at DESC LIMIT 1",[a.id,li.id])).rows[0];if(open){await cx.query('COMMIT');const r=mapRequest(open);return{request:await publicRequest(a,r),idempotent:true,reusedOpen:true}}
  const ts=now(),r={id:uid('vwq'),listingId:li.id,objectId:li.lotId,buyerAccountId:a.id,sellerId:li.sellerId,status:'REQUESTED',version:1,proposalVersion:0,selectedSlotId:null,note:v.note,createIdempotencyKey:v.clientActionId,createdAt:ts,updatedAt:ts};
  const row=(await cx.query("INSERT INTO viewing_requests(id,listing_id,object_id,buyer_account_id,seller_id,status,version,proposal_version,note,create_idempotency_key,created_at,updated_at) VALUES($1,$2,$3,$4,$5,'REQUESTED',1,0,$6,$7,$8,$8) RETURNING *",[r.id,r.listingId,r.objectId,r.buyerAccountId,r.sellerId,r.note,r.createIdempotencyKey,ts])).rows[0];
  await cx.query("INSERT INTO viewing_request_events(id,request_id,version,event_type,actor_account_id,actor_role,client_action_id,metadata,created_at) VALUES($1,$2,1,'REQUESTED',$3,'BUYER',$4,$5,$6)",[uid('vwe'),r.id,a.id,v.clientActionId,{listingId:r.listingId,objectId:r.objectId},ts]);await cx.query('COMMIT');out=mapRequest(row)
 }catch(e){try{await cx.query('ROLLBACK')}catch{}throw e}finally{cx.release()}
 const sa=await db.findAccountBySellerId(out.sellerId);if(sa)await notify(sa.id,'NEW_VIEWING_REQUEST',{requestId:out.id,listingId:out.listingId,objectId:out.objectId});
 return{request:await publicRequest(a,out),idempotent:false}
}

export async function getViewingRequest(a,id){const r=db.kind==='POSTGRES'?await loadPg(id):clone(mem.requests.get(id));return r&&roleFor(a,r)?publicRequest(a,r):null}
export async function listViewingRequests(a){
 let rows;if(db.kind==='POSTGRES')rows=(a.sellerId?(await db.pool.query('SELECT * FROM viewing_requests WHERE buyer_account_id=$1 OR seller_id=$2 ORDER BY updated_at DESC',[a.id,a.sellerId])).rows:(await db.pool.query('SELECT * FROM viewing_requests WHERE buyer_account_id=$1 ORDER BY updated_at DESC',[a.id])).rows).map(mapRequest);else rows=[...mem.requests.values()].filter(r=>roleFor(a,r)).sort((x,y)=>String(y.updatedAt).localeCompare(String(x.updatedAt)));
 const out=[];for(const r of rows)out.push(await publicRequest(a,r));return out
}
function replayMem(a,id,key){return(mem.events.get(id)||[]).find(e=>e.actorAccountId===a.id&&e.clientActionId===key)}
async function replayPg(a,id,key,cx=db.pool){
 const row=(await cx.query('SELECT * FROM viewing_request_events WHERE actor_account_id=$1 AND client_action_id=$2',[a.id,key])).rows[0];
 if(row&&row.request_id!==id)fail(409,'CLIENT_ACTION_ID_CONFLICT','clientActionId belongs to another request');return row
}
async function notifyOther(r,a,type,payload={}){
 let accountId;if(a.id===r.buyerAccountId){const sa=await db.findAccountBySellerId(r.sellerId);accountId=sa?.id}else accountId=r.buyerAccountId;
 if(accountId)await notify(accountId,type,{requestId:r.id,objectId:r.objectId,...payload})
}

export async function proposeViewingSlots(a,id,body={}){
 const clientActionId=actionId(body),slots=normalizeSlots(body);
 if(db.kind!=='POSTGRES'){
  const r=mem.requests.get(id);if(!r||roleFor(a,r)!=='SELLER')fail(404,'VIEWING_REQUEST_NOT_FOUND','Viewing request not found');requirePermission(a,'seller.service.respond');
  if(replayMem(a,id,clientActionId))return{request:await publicRequest(a,r),idempotent:true};if(!['REQUESTED','RESCHEDULE_REQUESTED','SLOTS_PROPOSED'].includes(r.status))fail(409,'VIEWING_PROPOSAL_INVALID','Slots cannot be proposed from current state');expectedVersion(body,r.version);
  const ts=now(),proposalVersion=r.proposalVersion+1,requestVersion=r.version+1,newSlots=slots.map(s=>({id:uid('vws'),requestId:id,proposalVersion,startsAt:s.startsAt,endsAt:s.endsAt,timezone:s.timezone,createdByAccountId:a.id,createdAt:ts}));
  mem.slots.set(id,[...(mem.slots.get(id)||[]),...newSlots]);r.status='SLOTS_PROPOSED';r.version=requestVersion;r.proposalVersion=proposalVersion;r.updatedAt=ts;
  (mem.events.get(id)||[]).push({id:uid('vwe'),requestId:id,version:requestVersion,eventType:'SLOTS_PROPOSED',actorAccountId:a.id,actorRole:'SELLER',clientActionId,metadata:{proposalVersion,slotIds:newSlots.map(x=>x.id)},createdAt:ts});await notifyOther(r,a,'VIEWING_SLOTS_PROPOSED',{proposalVersion});
  return{request:await publicRequest(a,r),idempotent:false}
 }
 const early=await replayPg(a,id,clientActionId);if(early){const r=await getViewingRequest(a,id);return{request:r,idempotent:true}}
 const cx=await db.pool.connect();let out;
 try{
  await cx.query('BEGIN');const r=await loadPg(id,cx,{lock:true});if(!r||roleFor(a,r)!=='SELLER')fail(404,'VIEWING_REQUEST_NOT_FOUND','Viewing request not found');requirePermission(a,'seller.service.respond');
  if(await replayPg(a,id,clientActionId,cx)){await cx.query('COMMIT');return{request:await getViewingRequest(a,id),idempotent:true}}
  if(!['REQUESTED','RESCHEDULE_REQUESTED','SLOTS_PROPOSED'].includes(r.status))fail(409,'VIEWING_PROPOSAL_INVALID','Slots cannot be proposed from current state');expectedVersion(body,r.version);
  const proposalVersion=r.proposalVersion+1,requestVersion=r.version+1,ts=now(),ids=[];
  for(const s of slots){const sid=uid('vws');ids.push(sid);await cx.query('INSERT INTO viewing_slots(id,request_id,proposal_version,starts_at,ends_at,timezone,created_by_account_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[sid,id,proposalVersion,s.startsAt,s.endsAt,s.timezone,a.id,ts])}
  const rr=(await cx.query("UPDATE viewing_requests SET status='SLOTS_PROPOSED',version=$2,proposal_version=$3,updated_at=$4 WHERE id=$1 RETURNING *",[id,requestVersion,proposalVersion,ts])).rows[0];
  await cx.query("INSERT INTO viewing_request_events(id,request_id,version,event_type,actor_account_id,actor_role,client_action_id,metadata,created_at) VALUES($1,$2,$3,'SLOTS_PROPOSED',$4,'SELLER',$5,$6,$7)",[uid('vwe'),id,requestVersion,a.id,clientActionId,{proposalVersion,slotIds:ids},ts]);await cx.query('COMMIT');out=mapRequest(rr)
 }catch(e){try{await cx.query('ROLLBACK')}catch{}throw e}finally{cx.release()}
 await notifyOther(out,a,'VIEWING_SLOTS_PROPOSED',{proposalVersion:out.proposalVersion});return{request:await publicRequest(a,out),idempotent:false}
}

export async function confirmViewingSlot(a,id,body={}){
 const clientActionId=actionId(body),slotId=String(body.slotId||'');
 if(db.kind!=='POSTGRES'){
  const r=mem.requests.get(id);if(!r||roleFor(a,r)!=='BUYER')fail(404,'VIEWING_REQUEST_NOT_FOUND','Viewing request not found');requirePermission(a,'service.request');
  if(replayMem(a,id,clientActionId))return{request:await publicRequest(a,r),idempotent:true};if(r.status!=='SLOTS_PROPOSED')fail(409,'VIEWING_CONFIRM_INVALID','Viewing is not awaiting confirmation');expectedVersion(body,r.version);
  const slot=(mem.slots.get(id)||[]).find(x=>x.id===slotId&&x.proposalVersion===r.proposalVersion);if(!slot)fail(400,'VIEWING_SLOT_INVALID','Slot is not part of current proposal');
  const ts=now(),version=r.version+1,prior=mem.calendar.get(id),cal=prior?{...prior,status:'CONFIRMED',startsAt:slot.startsAt,endsAt:slot.endsAt,timezone:slot.timezone,sequence:prior.sequence+1,updatedAt:ts}:{id:uid('vwc'),requestId:id,eventUid:'antiqua-viewing-'+id+'@antiqua',status:'CONFIRMED',startsAt:slot.startsAt,endsAt:slot.endsAt,timezone:slot.timezone,sequence:0,title:titleFor(r),createdAt:ts,updatedAt:ts};
  mem.calendar.set(id,cal);r.status='CONFIRMED';r.version=version;r.selectedSlotId=slot.id;r.updatedAt=ts;(mem.events.get(id)||[]).push({id:uid('vwe'),requestId:id,version,eventType:'CONFIRMED',actorAccountId:a.id,actorRole:'BUYER',clientActionId,metadata:{slotId:slot.id,proposalVersion:r.proposalVersion,calendarSequence:cal.sequence},createdAt:ts});await notifyOther(r,a,'VIEWING_CONFIRMED',{slotId:slot.id,startsAt:slot.startsAt});
  return{request:await publicRequest(a,r),idempotent:false}
 }
 const early=await replayPg(a,id,clientActionId);if(early)return{request:await getViewingRequest(a,id),idempotent:true};
 const cx=await db.pool.connect();let out;
 try{
  await cx.query('BEGIN');const r=await loadPg(id,cx,{lock:true});if(!r||roleFor(a,r)!=='BUYER')fail(404,'VIEWING_REQUEST_NOT_FOUND','Viewing request not found');requirePermission(a,'service.request');if(await replayPg(a,id,clientActionId,cx)){await cx.query('COMMIT');return{request:await getViewingRequest(a,id),idempotent:true}}
  if(r.status!=='SLOTS_PROPOSED')fail(409,'VIEWING_CONFIRM_INVALID','Viewing is not awaiting confirmation');expectedVersion(body,r.version);
  const slot=mapSlot((await cx.query('SELECT * FROM viewing_slots WHERE id=$1 AND request_id=$2 AND proposal_version=$3',[slotId,id,r.proposalVersion])).rows[0]);if(!slot)fail(400,'VIEWING_SLOT_INVALID','Slot is not part of current proposal');
  const ts=now(),version=r.version+1,existing=await pgCalendar(id,cx);let cal;
  if(existing){cal=mapCalendar((await cx.query("UPDATE viewing_calendar_events SET status='CONFIRMED',starts_at=$2,ends_at=$3,timezone=$4,sequence=sequence+1,updated_at=$5 WHERE request_id=$1 RETURNING *",[id,slot.startsAt,slot.endsAt,slot.timezone,ts])).rows[0])}
  else{cal=mapCalendar((await cx.query("INSERT INTO viewing_calendar_events(id,request_id,event_uid,status,starts_at,ends_at,timezone,sequence,title,created_at,updated_at) VALUES($1,$2,$3,'CONFIRMED',$4,$5,$6,0,$7,$8,$8) RETURNING *",[uid('vwc'),id,'antiqua-viewing-'+id+'@antiqua',slot.startsAt,slot.endsAt,slot.timezone,titleFor(r),ts])).rows[0])}
  const rr=(await cx.query("UPDATE viewing_requests SET status='CONFIRMED',version=$2,selected_slot_id=$3,updated_at=$4 WHERE id=$1 RETURNING *",[id,version,slot.id,ts])).rows[0];
  await cx.query("INSERT INTO viewing_request_events(id,request_id,version,event_type,actor_account_id,actor_role,client_action_id,metadata,created_at) VALUES($1,$2,$3,'CONFIRMED',$4,'BUYER',$5,$6,$7)",[uid('vwe'),id,version,a.id,clientActionId,{slotId:slot.id,proposalVersion:r.proposalVersion,calendarSequence:cal.sequence},ts]);await cx.query('COMMIT');out=mapRequest(rr)
 }catch(e){try{await cx.query('ROLLBACK')}catch{}throw e}finally{cx.release()}
 await notifyOther(out,a,'VIEWING_CONFIRMED',{slotId:out.selectedSlotId,startsAt:(await pgCalendar(id))?.startsAt});return{request:await publicRequest(a,out),idempotent:false}
}

export async function requestViewingReschedule(a,id,body={}){
 const clientActionId=actionId(body);
 if(db.kind!=='POSTGRES'){
  const r=mem.requests.get(id),role=roleFor(a,r);if(!r||!['BUYER','SELLER'].includes(role))fail(404,'VIEWING_REQUEST_NOT_FOUND','Viewing request not found');
  role==='BUYER'?requirePermission(a,'service.request'):requirePermission(a,'seller.service.respond');if(replayMem(a,id,clientActionId))return{request:await publicRequest(a,r),idempotent:true};if(r.status!=='CONFIRMED')fail(409,'VIEWING_RESCHEDULE_INVALID','Only a confirmed viewing can be rescheduled');expectedVersion(body,r.version);
  const ts=now();r.status='RESCHEDULE_REQUESTED';r.version++;r.updatedAt=ts;(mem.events.get(id)||[]).push({id:uid('vwe'),requestId:id,version:r.version,eventType:'RESCHEDULE_REQUESTED',actorAccountId:a.id,actorRole:role,clientActionId,metadata:{reason:text(body.reason)},createdAt:ts});await notifyOther(r,a,'VIEWING_RESCHEDULE_REQUESTED',{reason:text(body.reason)});
  return{request:await publicRequest(a,r),idempotent:false}
 }
 const cx=await db.pool.connect();let out,role;
 try{
  await cx.query('BEGIN');const r=await loadPg(id,cx,{lock:true});role=roleFor(a,r);if(!r||!['BUYER','SELLER'].includes(role))fail(404,'VIEWING_REQUEST_NOT_FOUND','Viewing request not found');role==='BUYER'?requirePermission(a,'service.request'):requirePermission(a,'seller.service.respond');
  if(await replayPg(a,id,clientActionId,cx)){await cx.query('COMMIT');return{request:await getViewingRequest(a,id),idempotent:true}}if(r.status!=='CONFIRMED')fail(409,'VIEWING_RESCHEDULE_INVALID','Only a confirmed viewing can be rescheduled');expectedVersion(body,r.version);
  const ts=now(),version=r.version+1,reason=text(body.reason),rr=(await cx.query("UPDATE viewing_requests SET status='RESCHEDULE_REQUESTED',version=$2,updated_at=$3 WHERE id=$1 RETURNING *",[id,version,ts])).rows[0];
  await cx.query("INSERT INTO viewing_request_events(id,request_id,version,event_type,actor_account_id,actor_role,client_action_id,metadata,created_at) VALUES($1,$2,$3,'RESCHEDULE_REQUESTED',$4,$5,$6,$7,$8)",[uid('vwe'),id,version,a.id,role,clientActionId,{reason},ts]);await cx.query('COMMIT');out=mapRequest(rr)
 }catch(e){try{await cx.query('ROLLBACK')}catch{}throw e}finally{cx.release()}
 await notifyOther(out,a,'VIEWING_RESCHEDULE_REQUESTED',{reason:text(body.reason)});return{request:await publicRequest(a,out),idempotent:false}
}

export async function cancelViewingRequest(a,id,body={}){
 const clientActionId=actionId(body);
 if(db.kind!=='POSTGRES'){
  const r=mem.requests.get(id),role=roleFor(a,r);if(!r||!['BUYER','SELLER'].includes(role))fail(404,'VIEWING_REQUEST_NOT_FOUND','Viewing request not found');role==='BUYER'?requirePermission(a,'service.request'):requirePermission(a,'seller.service.respond');
  if(replayMem(a,id,clientActionId))return{request:await publicRequest(a,r),idempotent:true};if(r.status==='CANCELLED')fail(409,'VIEWING_CANCELLED','Viewing is already cancelled');expectedVersion(body,r.version);
  const ts=now();r.status='CANCELLED';r.version++;r.updatedAt=ts;const cal=mem.calendar.get(id);if(cal){cal.status='CANCELLED';cal.sequence++;cal.updatedAt=ts}(mem.events.get(id)||[]).push({id:uid('vwe'),requestId:id,version:r.version,eventType:'CANCELLED',actorAccountId:a.id,actorRole:role,clientActionId,metadata:{reason:text(body.reason),calendarSequence:cal?.sequence??null},createdAt:ts});await notifyOther(r,a,'VIEWING_CANCELLED',{reason:text(body.reason)});
  return{request:await publicRequest(a,r),idempotent:false}
 }
 const cx=await db.pool.connect();let out,role;
 try{
  await cx.query('BEGIN');const r=await loadPg(id,cx,{lock:true});role=roleFor(a,r);if(!r||!['BUYER','SELLER'].includes(role))fail(404,'VIEWING_REQUEST_NOT_FOUND','Viewing request not found');role==='BUYER'?requirePermission(a,'service.request'):requirePermission(a,'seller.service.respond');
  if(await replayPg(a,id,clientActionId,cx)){await cx.query('COMMIT');return{request:await getViewingRequest(a,id),idempotent:true}}if(r.status==='CANCELLED')fail(409,'VIEWING_CANCELLED','Viewing is already cancelled');expectedVersion(body,r.version);
  const ts=now(),version=r.version+1,reason=text(body.reason),existing=await pgCalendar(id,cx);let seq=null;if(existing){const cal=mapCalendar((await cx.query("UPDATE viewing_calendar_events SET status='CANCELLED',sequence=sequence+1,updated_at=$2 WHERE request_id=$1 RETURNING *",[id,ts])).rows[0]);seq=cal.sequence}
  const rr=(await cx.query("UPDATE viewing_requests SET status='CANCELLED',version=$2,updated_at=$3 WHERE id=$1 RETURNING *",[id,version,ts])).rows[0];
  await cx.query("INSERT INTO viewing_request_events(id,request_id,version,event_type,actor_account_id,actor_role,client_action_id,metadata,created_at) VALUES($1,$2,$3,'CANCELLED',$4,$5,$6,$7,$8)",[uid('vwe'),id,version,a.id,role,clientActionId,{reason,calendarSequence:seq},ts]);await cx.query('COMMIT');out=mapRequest(rr)
 }catch(e){try{await cx.query('ROLLBACK')}catch{}throw e}finally{cx.release()}
 await notifyOther(out,a,'VIEWING_CANCELLED',{reason:text(body.reason)});return{request:await publicRequest(a,out),idempotent:false}
}

const icsEscape=v=>String(v??'').replaceAll('\\','\\\\').replaceAll(';','\\;').replaceAll(',','\\,').replace(/\r?\n/g,'\\n');
const utc=v=>new Date(v).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
export async function viewingCalendarIcs(a,id){
 const r=db.kind==='POSTGRES'?await loadPg(id):clone(mem.requests.get(id));if(!r||!roleFor(a,r))fail(404,'VIEWING_REQUEST_NOT_FOUND','Viewing request not found');
 const cal=db.kind==='POSTGRES'?await pgCalendar(id):clone(mem.calendar.get(id)||null);if(!cal)fail(404,'VIEWING_CALENDAR_NOT_READY','Calendar event is not available');
 const title=cal.title?.en||'ANTIQUA object viewing',stamp=utc(cal.updatedAt||now());
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//ANTIQUA//Viewing v0.23//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT','UID:'+icsEscape(cal.eventUid),'DTSTAMP:'+stamp,'DTSTART:'+utc(cal.startsAt),'DTEND:'+utc(cal.endsAt),'SEQUENCE:'+cal.sequence,'STATUS:'+(cal.status==='CANCELLED'?'CANCELLED':'CONFIRMED'),'SUMMARY:'+icsEscape(title),'DESCRIPTION:'+icsEscape('ANTIQUA object '+r.objectId),'END:VEVENT','END:VCALENDAR'];
 return{calendar:cal,ics:lines.join('\r\n')+'\r\n'}
}
