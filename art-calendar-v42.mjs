import {db,uid,now} from './runtime-v09.mjs';
import {requireOrganizationRole} from './organizations-v15.mjs';
import {listExhibitions,getExhibition} from './collection-graph-v10.mjs';

const events=new Map(),eventCreators=new Map(),eventOrganizations=new Map(),eventParticipation=new Map(),exhibitionParticipation=new Map();
const EVENT_TYPES=new Set(['OPENING','ARTIST_TALK','LECTURE','WORKSHOP','PERFORMANCE','SCREENING','ART_FAIR','BIENNIAL','GALLERY_WEEKEND','AUCTION_PREVIEW','AUCTION','VIEWING','STUDIO_VISIT','COURSE','ONLINE_EVENT','OTHER']);
const CREATOR_ROLES=new Set(['ARTIST','CURATOR','SPEAKER','HOST','PARTICIPANT']);
const ORGANIZATION_ROLES=new Set(['HOST','VENUE','PARTNER','ORGANIZER']);
const ATTENDANCE_MODES=new Set(['IN_PERSON','ONLINE','HYBRID']);
const VISIBILITIES=new Set(['PRIVATE','UNLISTED','PUBLIC']);
const PARTICIPATION_STATES=new Set(['SAVED','PLANNED','VISITED','DISMISSED']);
const REVIEW_ROLES=new Set(['ADMIN','CATALOGUER','TRUST_REVIEWER']);
const clone=x=>x==null?x:structuredClone(x);
const iso=v=>v?.toISOString?.()||v||null;
const fail=(status,code,message)=>{const e=new Error(message);e.status=status;e.code=code;throw e};
const bi=v=>v&&typeof v==='object'&&!Array.isArray(v)?{en:String(v.en||v.ru||''),ru:String(v.ru||v.en||'')}:{en:String(v||''),ru:String(v||'')};
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const safeUrl=v=>{const s=String(v||'').trim();if(!s)return null;try{const u=new URL(s);if(!['http:','https:'].includes(u.protocol))throw 0;return u.href}catch{fail(400,'CALENDAR_URL_INVALID','URL must use http or https')}};
const reviewer=a=>Boolean(a?.roles?.some(r=>REVIEW_ROLES.has(r)));
const requireReviewer=a=>{if(!reviewer(a))fail(403,'CALENDAR_REVIEW_FORBIDDEN','Calendar review permission required');return a};
const toDate=v=>{const d=new Date(v);if(!v||Number.isNaN(d.getTime()))fail(400,'CALENDAR_TIME_INVALID','A valid ISO date/time is required');return d.toISOString()};
const optionalDate=v=>v?toDate(v):null;
const coord=(v,min,max,label)=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);if(!Number.isFinite(n)||n<min||n>max)fail(400,'CALENDAR_COORDINATE_INVALID',label+' out of range');return n};
const links=(xs,roles,kind)=>Array.isArray(xs)?xs.map(x=>({id:String(x.id||x.creatorId||x.organizationId||'').trim(),role:String(x.role||'PARTICIPANT').toUpperCase()})).filter(x=>x.id).map(x=>{if(!roles.has(x.role))fail(400,'CALENDAR_LINK_ROLE_INVALID',`Invalid ${kind} role: ${x.role}`);return x}).slice(0,40):[];
const mapEvent=r=>r?{id:r.id,ownerAccountId:r.owner_account_id??r.ownerAccountId??null,organizationId:r.organization_id??r.organizationId??null,exhibitionId:r.exhibition_id??r.exhibitionId??null,eventType:r.event_type??r.eventType,title:r.title||{},summary:r.summary||{},visibility:r.visibility,status:r.status,attendanceMode:r.attendance_mode??r.attendanceMode,startsAt:iso(r.starts_at??r.startsAt),endsAt:iso(r.ends_at??r.endsAt),timezone:r.timezone||'UTC',venueName:r.venue_name??r.venueName??{},address:r.address||{},city:r.city||{},country:r.country||{},latitude:r.latitude??null,longitude:r.longitude??null,bookingUrl:r.booking_url??r.bookingUrl??null,ticketUrl:r.ticket_url??r.ticketUrl??null,onlineUrl:r.online_url??r.onlineUrl??null,coverImage:r.cover_image??r.coverImage??null,metadata:r.metadata||{},reviewedByAccountId:r.reviewed_by_account_id??r.reviewedByAccountId??null,reviewedAt:iso(r.reviewed_at??r.reviewedAt),reviewNote:r.review_note??r.reviewNote??null,createdAt:iso(r.created_at??r.createdAt),updatedAt:iso(r.updated_at??r.updatedAt)}:null;

function seed(){
 if(events.size)return;
 const base=Date.now(),make=(id,hours,duration,eventType,titleRu,titleEn,cityRu,cityEn,extra={})=>{
  const startsAt=new Date(base+hours*3600000).toISOString(),endsAt=new Date(base+(hours+duration)*3600000).toISOString();
  events.set(id,{id,ownerAccountId:'acct-operator-demo',organizationId:null,exhibitionId:null,eventType,title:{ru:titleRu,en:titleEn},summary:bi(extra.summary||''),visibility:'PUBLIC',status:'PUBLISHED',attendanceMode:extra.attendanceMode||'IN_PERSON',startsAt,endsAt,timezone:'Europe/Amsterdam',venueName:bi(extra.venueName||''),address:bi(extra.address||''),city:{ru:cityRu,en:cityEn},country:{ru:'Нидерланды',en:'Netherlands'},latitude:extra.latitude??null,longitude:extra.longitude??null,bookingUrl:null,ticketUrl:null,onlineUrl:extra.onlineUrl||null,coverImage:null,metadata:{demo:true},reviewedByAccountId:'acct-operator-demo',reviewedAt:now(),reviewNote:'Demo calendar seed',createdAt:now(),updatedAt:now()});
 };
 make('event-demo-opening',2,3,'OPENING','Открытие: Графика как свидетельство','Opening: Works on Paper as Evidence','Амстердам','Amsterdam',{venueName:{ru:'ANTIQUA Project Room',en:'ANTIQUA Project Room'},latitude:52.3676,longitude:4.9041,summary:{ru:'Камерное открытие вокруг рисунка, офорта и литографии.',en:'An intimate opening around drawing, etching and lithography.'}});
 make('event-demo-talk',30,2,'ARTIST_TALK','Разговор: как читать провенанс','Talk: How to Read Provenance','Амстердам','Amsterdam',{venueName:{ru:'ANTIQUA Salon',en:'ANTIQUA Salon'},summary:{ru:'Публичный разговор коллекционера, историка искусства и куратора.',en:'A public conversation between a collector, art historian and curator.'}});
 make('event-demo-online',78,1.5,'ONLINE_EVENT','Онлайн-разбор: атрибуция гравюры','Online Session: Print Attribution','Онлайн','Online',{attendanceMode:'ONLINE',onlineUrl:'https://example.com/antiqua-demo',summary:{ru:'Учебный разбор без выдачи сертификата подлинности.',en:'An educational attribution session, not an authenticity certificate.'}});
}
seed();

export function artCalendarCapabilities(){return{contractVersion:'v42',eventAuthority:'ART_EVENT_V42',exhibitionAuthority:'COLLECTION_GRAPH_V10',calendarModel:'UNIFIED_READ_MODEL_NO_EXHIBITION_DUPLICATION',participation:['SAVED','PLANNED','VISITED','DISMISSED'],participationPrivacy:'ACCOUNT_PRIVATE',eventTypes:[...EVENT_TYPES],attendanceModes:[...ATTENDANCE_MODES],reviewRequired:true,ics:true,mapCoordinates:true,travelRouting:false}};

function derived(item,at=Date.now()){
 const start=Date.parse(item.startsAt||''),endRaw=Date.parse(item.endsAt||''),isEvent=item.sourceType==='EVENT',end=Number.isFinite(endRaw)?endRaw:(isEvent&&Number.isFinite(start)?start+3*3600000:Infinity),week=7*86400000;
 return{
  openNow:Number.isFinite(start)&&start<=at&&end>=at,
  openingSoon:Number.isFinite(start)&&start>at&&start<=at+week,
  closingSoon:Number.isFinite(endRaw)&&endRaw>=at&&endRaw<=at+week,
  ended:Number.isFinite(endRaw)&&endRaw<at
 };
}

async function eventById(id){
 if(db.kind==='POSTGRES')return mapEvent((await db.pool.query('SELECT * FROM art_events WHERE id=$1',[id])).rows[0]);
 return clone(events.get(id)||null);
}
async function creatorLinksFor(id){
 if(db.kind==='POSTGRES'){
  const rows=(await db.pool.query(`SELECT ec.role,c.id,c.slug,c.creator_type,c.display_name,c.disciplines FROM art_event_creators ec JOIN creators c ON c.id=ec.creator_id WHERE ec.event_id=$1 AND c.profile_status='PUBLISHED' ORDER BY ec.role,c.updated_at DESC`,[id])).rows;
  return rows.map(r=>({role:r.role,creator:{id:r.id,slug:r.slug,creatorType:r.creator_type,displayName:r.display_name,disciplines:r.disciplines||[]}}));
 }
 return clone(eventCreators.get(id)||[]);
}
async function organizationLinksFor(e){
 if(db.kind==='POSTGRES'){
  const rows=(await db.pool.query(`SELECT eo.role,o.id,o.slug,o.name,o.organization_type,o.city,o.country FROM art_event_organizations eo JOIN organizations o ON o.id=eo.organization_id WHERE eo.event_id=$1 AND o.status='ACTIVE' ORDER BY eo.role,o.name`,[e.id])).rows;
  const xs=rows.map(r=>({role:r.role,organization:{id:r.id,slug:r.slug,name:r.name,organizationType:r.organization_type,city:r.city||{},country:r.country||{}}}));
  if(e.organizationId&&!xs.some(x=>x.organization.id===e.organizationId)){
   const r=(await db.pool.query("SELECT id,slug,name,organization_type,city,country FROM organizations WHERE id=$1 AND status='ACTIVE'",[e.organizationId])).rows[0];
   if(r)xs.unshift({role:'HOST',organization:{id:r.id,slug:r.slug,name:r.name,organizationType:r.organization_type,city:r.city||{},country:r.country||{}}});
  }
  return xs;
 }
 return clone(eventOrganizations.get(e.id)||[]);
}
function publicEventBase(e){
 const x={id:e.id,eventType:e.eventType,title:e.title,summary:e.summary,visibility:e.visibility,status:e.status,attendanceMode:e.attendanceMode,startsAt:e.startsAt,endsAt:e.endsAt,timezone:e.timezone,venueName:e.venueName,address:e.address,city:e.city,country:e.country,latitude:e.latitude,longitude:e.longitude,bookingUrl:e.bookingUrl,ticketUrl:e.ticketUrl,onlineUrl:e.onlineUrl,coverImage:e.coverImage,exhibitionId:e.exhibitionId,reviewState:'PLATFORM_REVIEWED_EVENT',route:'#event/'+encodeURIComponent(e.id)};
 return{...x,...derived({...x,sourceType:'EVENT'})};
}
async function publicEvent(e){return{...publicEventBase(e),creators:await creatorLinksFor(e.id),organizations:await organizationLinksFor(e)}}

export async function listPublicArtEvents(){
 let xs;if(db.kind==='POSTGRES')xs=(await db.pool.query("SELECT * FROM art_events WHERE status='PUBLISHED' AND visibility='PUBLIC' ORDER BY starts_at,updated_at DESC")).rows.map(mapEvent);else xs=[...events.values()].filter(x=>x.status==='PUBLISHED'&&x.visibility==='PUBLIC').map(clone);
 const out=[];for(const e of xs)out.push(await publicEvent(e));return out;
}
export async function getPublicArtEvent(id){
 const e=await eventById(String(id||''));if(!e||e.status!=='PUBLISHED'||!['PUBLIC','UNLISTED'].includes(e.visibility))return null;return publicEvent(e);
}

function exhibitionItem(x){
 const base={sourceType:'EXHIBITION',id:x.id,eventType:'EXHIBITION',title:x.title,summary:x.subtitle||{},visibility:x.visibility,status:x.status,attendanceMode:'IN_PERSON',startsAt:iso(x.startsAt),endsAt:iso(x.endsAt),timezone:x.metadata?.timezone||'UTC',venueName:x.metadata?.venueName||{},address:x.metadata?.address||{},city:x.metadata?.city||{},country:x.metadata?.country||{},latitude:x.metadata?.latitude??null,longitude:x.metadata?.longitude??null,coverImage:x.metadata?.coverImage||null,route:'#exhibition/'+encodeURIComponent(x.id),reviewState:'EXHIBITION_AUTHORITY'};
 return{...base,...derived(base)};
}
function eventItem(e){const b=publicEventBase(e);return{sourceType:'EVENT',...b}}

export async function listArtCalendar(){
 const [evs,exs]=await Promise.all([listPublicArtEvents(),listExhibitions()]),items=[...evs.map(eventItem),...(exs||[]).map(exhibitionItem)];
 items.sort((a,b)=>{const aa=Date.parse(a.startsAt||'9999-12-31'),bb=Date.parse(b.startsAt||'9999-12-31');return aa-bb||String(a.id).localeCompare(String(b.id))});
 return{items,summary:{openNow:items.filter(x=>x.openNow).length,openingSoon:items.filter(x=>x.openingSoon).length,closingSoon:items.filter(x=>x.closingSoon).length},capabilities:artCalendarCapabilities()};
}

async function requireManager(account,e){
 if(!account)fail(401,'AUTH_REQUIRED','Authentication required');if(reviewer(account)||e.ownerAccountId===account.id)return true;
 if(e.organizationId&&db.kind==='POSTGRES'){await requireOrganizationRole(account.id,e.organizationId,['OWNER','ADMIN','CATALOGUER']);return true}
 fail(403,'CALENDAR_EVENT_FORBIDDEN','Event management permission required');
}
async function replaceLinks(eventId,creatorXs,orgXs){
 if(db.kind==='POSTGRES'){
  await db.pool.query('DELETE FROM art_event_creators WHERE event_id=$1',[eventId]);await db.pool.query('DELETE FROM art_event_organizations WHERE event_id=$1',[eventId]);
  for(const x of creatorXs)await db.pool.query('INSERT INTO art_event_creators(event_id,creator_id,role) VALUES($1,$2,$3)',[eventId,x.id,x.role]);
  for(const x of orgXs)await db.pool.query('INSERT INTO art_event_organizations(event_id,organization_id,role) VALUES($1,$2,$3)',[eventId,x.id,x.role]);
 }else{eventCreators.set(eventId,creatorXs.map(x=>({role:x.role,creator:{id:x.id,displayName:bi(x.label||x.id)}})));eventOrganizations.set(eventId,orgXs.map(x=>({role:x.role,organization:{id:x.id,name:x.label||x.id}})))}
}

function normalizedInput(input={},current=null){
 const eventType=String(input.eventType??current?.eventType??'OTHER').toUpperCase();if(!EVENT_TYPES.has(eventType))fail(400,'CALENDAR_EVENT_TYPE_INVALID','Invalid event type');
 const attendanceMode=String(input.attendanceMode??current?.attendanceMode??'IN_PERSON').toUpperCase();if(!ATTENDANCE_MODES.has(attendanceMode))fail(400,'CALENDAR_ATTENDANCE_INVALID','Invalid attendance mode');
 const visibility=String(input.visibility??current?.visibility??'PRIVATE').toUpperCase();if(!VISIBILITIES.has(visibility))fail(400,'CALENDAR_VISIBILITY_INVALID','Invalid visibility');
 const title=bi(input.title??current?.title??{en:input.titleEn||'',ru:input.titleRu||''});if(!String(title.en||title.ru).trim())fail(400,'CALENDAR_TITLE_REQUIRED','Event title required');
 const startsAt=toDate(input.startsAt??current?.startsAt),endsAt=optionalDate(input.endsAt===undefined?current?.endsAt:input.endsAt);if(endsAt&&Date.parse(endsAt)<Date.parse(startsAt))fail(400,'CALENDAR_TIME_RANGE_INVALID','Event end must not precede start');
 const timezone=String(input.timezone??current?.timezone??'UTC').trim().slice(0,80)||'UTC';
 return{eventType,title,summary:bi(input.summary??current?.summary??{en:input.summaryEn||'',ru:input.summaryRu||''}),visibility,attendanceMode,startsAt,endsAt,timezone,venueName:bi(input.venueName??current?.venueName??{}),address:bi(input.address??current?.address??{}),city:bi(input.city??current?.city??{}),country:bi(input.country??current?.country??{}),latitude:coord(input.latitude===undefined?current?.latitude:input.latitude,-90,90,'Latitude'),longitude:coord(input.longitude===undefined?current?.longitude:input.longitude,-180,180,'Longitude'),bookingUrl:input.bookingUrl===undefined?(current?.bookingUrl||null):safeUrl(input.bookingUrl),ticketUrl:input.ticketUrl===undefined?(current?.ticketUrl||null):safeUrl(input.ticketUrl),onlineUrl:input.onlineUrl===undefined?(current?.onlineUrl||null):safeUrl(input.onlineUrl),coverImage:input.coverImage===undefined?(current?.coverImage||null):safeUrl(input.coverImage),organizationId:input.organizationId===undefined?(current?.organizationId||null):(input.organizationId?String(input.organizationId):null),exhibitionId:input.exhibitionId===undefined?(current?.exhibitionId||null):(input.exhibitionId?String(input.exhibitionId):null),metadata:input.metadata===undefined?(current?.metadata||{}):obj(input.metadata),creatorLinks:links(input.creatorLinks,CREATOR_ROLES,'creator'),organizationLinks:links(input.organizationLinks,ORGANIZATION_ROLES,'organization')};
}

export async function createArtEvent(account,input={}){
 if(!account)fail(401,'AUTH_REQUIRED','Authentication required');const n=normalizedInput(input);
 if(n.organizationId&&db.kind==='POSTGRES')await requireOrganizationRole(account.id,n.organizationId,['OWNER','ADMIN','CATALOGUER']);
 const e={id:uid('event'),ownerAccountId:account.id,organizationId:n.organizationId,exhibitionId:n.exhibitionId,eventType:n.eventType,title:n.title,summary:n.summary,visibility:n.visibility,status:'DRAFT',attendanceMode:n.attendanceMode,startsAt:n.startsAt,endsAt:n.endsAt,timezone:n.timezone,venueName:n.venueName,address:n.address,city:n.city,country:n.country,latitude:n.latitude,longitude:n.longitude,bookingUrl:n.bookingUrl,ticketUrl:n.ticketUrl,onlineUrl:n.onlineUrl,coverImage:n.coverImage,metadata:n.metadata,reviewedByAccountId:null,reviewedAt:null,reviewNote:null,createdAt:now(),updatedAt:now()};
 if(db.kind==='POSTGRES'){
  await db.pool.query(`INSERT INTO art_events(id,owner_account_id,organization_id,exhibition_id,event_type,title,summary,visibility,status,attendance_mode,starts_at,ends_at,timezone,venue_name,address,city,country,latitude,longitude,booking_url,ticket_url,online_url,cover_image,metadata,created_at,updated_at)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,'DRAFT',$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,now(),now())`,[e.id,e.ownerAccountId,e.organizationId,e.exhibitionId,e.eventType,e.title,e.summary,e.visibility,e.attendanceMode,e.startsAt,e.endsAt,e.timezone,e.venueName,e.address,e.city,e.country,e.latitude,e.longitude,e.bookingUrl,e.ticketUrl,e.onlineUrl,e.coverImage,e.metadata]);
 }else events.set(e.id,e);
 await replaceLinks(e.id,n.creatorLinks,n.organizationLinks);return eventById(e.id);
}

export async function updateArtEvent(account,id,input={}){
 const current=await eventById(id);if(!current)fail(404,'CALENDAR_EVENT_NOT_FOUND','Event not found');await requireManager(account,current);const n=normalizedInput(input,current);
 if(n.organizationId&&n.organizationId!==current.organizationId&&db.kind==='POSTGRES')await requireOrganizationRole(account.id,n.organizationId,['OWNER','ADMIN','CATALOGUER']);
 const next={...current,...n,status:'DRAFT',reviewedByAccountId:null,reviewedAt:null,reviewNote:null,updatedAt:now()};delete next.creatorLinks;delete next.organizationLinks;
 if(db.kind==='POSTGRES')await db.pool.query(`UPDATE art_events SET organization_id=$2,exhibition_id=$3,event_type=$4,title=$5,summary=$6,visibility=$7,status='DRAFT',attendance_mode=$8,starts_at=$9,ends_at=$10,timezone=$11,venue_name=$12,address=$13,city=$14,country=$15,latitude=$16,longitude=$17,booking_url=$18,ticket_url=$19,online_url=$20,cover_image=$21,metadata=$22,reviewed_by_account_id=NULL,reviewed_at=NULL,review_note=NULL,updated_at=now() WHERE id=$1`,[id,n.organizationId,n.exhibitionId,n.eventType,n.title,n.summary,n.visibility,n.attendanceMode,n.startsAt,n.endsAt,n.timezone,n.venueName,n.address,n.city,n.country,n.latitude,n.longitude,n.bookingUrl,n.ticketUrl,n.onlineUrl,n.coverImage,n.metadata]);else events.set(id,next);
 if(input.creatorLinks!==undefined||input.organizationLinks!==undefined){const existingCreators=input.creatorLinks===undefined?(await creatorLinksFor(id)).map(x=>({id:x.creator.id,role:x.role})):n.creatorLinks,existingOrgs=input.organizationLinks===undefined?(await organizationLinksFor(next)).filter(x=>x.organization.id!==next.organizationId).map(x=>({id:x.organization.id,role:x.role})):n.organizationLinks;await replaceLinks(id,existingCreators,existingOrgs)}
 return eventById(id);
}

export async function submitArtEvent(account,id){
 const e=await eventById(id);if(!e)fail(404,'CALENDAR_EVENT_NOT_FOUND','Event not found');await requireManager(account,e);if(e.visibility==='PRIVATE')fail(409,'CALENDAR_EVENT_PRIVATE','Choose PUBLIC or UNLISTED before review');
 if(db.kind==='POSTGRES')await db.pool.query("UPDATE art_events SET status='REVIEW_PENDING',updated_at=now() WHERE id=$1",[id]);else{e.status='REVIEW_PENDING';e.updatedAt=now();events.set(id,e)}return eventById(id);
}
export async function reviewArtEvent(account,id,{decision='APPROVE',note=''}={}){
 requireReviewer(account);const e=await eventById(id);if(!e)fail(404,'CALENDAR_EVENT_NOT_FOUND','Event not found');const status=String(decision).toUpperCase()==='APPROVE'?'PUBLISHED':'DRAFT',at=now();
 if(db.kind==='POSTGRES')await db.pool.query('UPDATE art_events SET status=$2,reviewed_by_account_id=$3,reviewed_at=now(),review_note=$4,updated_at=now() WHERE id=$1',[id,status,account.id,String(note||'').slice(0,2000)]);else{Object.assign(e,{status,reviewedByAccountId:account.id,reviewedAt:at,reviewNote:String(note||'').slice(0,2000),updatedAt:at});events.set(id,e)}return eventById(id);
}
export async function cancelArtEvent(account,id){
 const e=await eventById(id);if(!e)fail(404,'CALENDAR_EVENT_NOT_FOUND','Event not found');await requireManager(account,e);
 if(db.kind==='POSTGRES')await db.pool.query("UPDATE art_events SET status='CANCELLED',updated_at=now() WHERE id=$1",[id]);else{e.status='CANCELLED';e.updatedAt=now();events.set(id,e)}return eventById(id);
}

async function participationFor(accountId,sourceType,id){
 if(db.kind==='POSTGRES'){
  const table=sourceType==='EVENT'?'art_event_participation':'art_exhibition_participation',key=sourceType==='EVENT'?'event_id':'exhibition_id';
  const r=(await db.pool.query(`SELECT state,planned_for,visited_at,updated_at FROM ${table} WHERE account_id=$1 AND ${key}=$2`,[accountId,id])).rows[0];
  return r?{state:r.state,plannedFor:iso(r.planned_for),visitedAt:iso(r.visited_at),updatedAt:iso(r.updated_at)}:null;
 }
 const map=sourceType==='EVENT'?eventParticipation:exhibitionParticipation;return clone(map.get(accountId+'|'+id)||null);
}
export async function setCalendarParticipation(account,sourceType,id,{state='SAVED',plannedFor=null}={}){
 if(!account)fail(401,'AUTH_REQUIRED','Authentication required');sourceType=String(sourceType||'EVENT').toUpperCase();if(!['EVENT','EXHIBITION'].includes(sourceType))fail(400,'CALENDAR_SOURCE_INVALID','Invalid calendar source');
 state=String(state||'SAVED').toUpperCase();if(!PARTICIPATION_STATES.has(state))fail(400,'CALENDAR_PARTICIPATION_INVALID','Invalid participation state');
 if(sourceType==='EVENT'){const e=await getPublicArtEvent(id);if(!e)fail(404,'CALENDAR_EVENT_NOT_FOUND','Event not found')}else{const e=await getExhibition(id);if(!e||e.visibility!=='PUBLIC')fail(404,'CALENDAR_EXHIBITION_NOT_FOUND','Exhibition not found')}
 const planned=plannedFor?toDate(plannedFor):null,visited=state==='VISITED'?now():null;
 if(db.kind==='POSTGRES'){
  const table=sourceType==='EVENT'?'art_event_participation':'art_exhibition_participation',key=sourceType==='EVENT'?'event_id':'exhibition_id';
  await db.pool.query(`INSERT INTO ${table}(account_id,${key},state,planned_for,visited_at,created_at,updated_at) VALUES($1,$2,$3,$4,$5,now(),now()) ON CONFLICT(account_id,${key}) DO UPDATE SET state=excluded.state,planned_for=excluded.planned_for,visited_at=CASE WHEN excluded.state='VISITED' THEN COALESCE(${table}.visited_at,excluded.visited_at) ELSE ${table}.visited_at END,updated_at=now()`,[account.id,id,state,planned,visited]);
 }else{const map=sourceType==='EVENT'?eventParticipation:exhibitionParticipation;map.set(account.id+'|'+id,{state,plannedFor:planned,visitedAt:visited,updatedAt:now()})}
 return{sourceType,id,participation:await participationFor(account.id,sourceType,id)};
}
export async function getMyArtCalendar(account){
 if(!account)fail(401,'AUTH_REQUIRED','Authentication required');const calendar=await listArtCalendar(),out=[];
 for(const item of calendar.items){const p=await participationFor(account.id,item.sourceType,item.id);if(p&&p.state!=='DISMISSED')out.push({...item,participation:p})}
 out.sort((a,b)=>Date.parse(a.participation?.plannedFor||a.startsAt||'9999-12-31')-Date.parse(b.participation?.plannedFor||b.startsAt||'9999-12-31'));
 return{items:out,counts:{saved:out.filter(x=>x.participation.state==='SAVED').length,planned:out.filter(x=>x.participation.state==='PLANNED').length,visited:out.filter(x=>x.participation.state==='VISITED').length},capabilities:artCalendarCapabilities()};
}

const icsEsc=s=>String(s||'').replaceAll('\\','\\\\').replaceAll('\n','\\n').replaceAll(',','\\,').replaceAll(';','\\;');
const icsDate=v=>{const d=new Date(v);if(Number.isNaN(d.getTime()))return null;return d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z')};
export function calendarItemToIcs(item,origin='https://antiqua.example'){
 const start=icsDate(item.startsAt),end=icsDate(item.endsAt||new Date(Date.parse(item.startsAt)+2*3600000).toISOString());if(!start)return null;
 const title=item.title?.en||item.title?.ru||'ANTIQUA event',description=item.summary?.en||item.summary?.ru||'',location=[item.venueName?.en||item.venueName?.ru,item.city?.en||item.city?.ru,item.country?.en||item.country?.ru].filter(Boolean).join(', '),url=item.sourceType==='EVENT'?origin+'/\#event/'+encodeURIComponent(item.id):origin+'/\#exhibition/'+encodeURIComponent(item.id);
 return['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//ANTIQUA//Art Calendar v42//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:'+icsEsc(item.sourceType.toLowerCase()+'-'+item.id+'@antiqua'),'DTSTAMP:'+icsDate(now()),'DTSTART:'+start,'DTEND:'+end,'SUMMARY:'+icsEsc(title),'DESCRIPTION:'+icsEsc(description),'LOCATION:'+icsEsc(location),'URL:'+icsEsc(url),'END:VEVENT','END:VCALENDAR',''].join('\r\n');
}
