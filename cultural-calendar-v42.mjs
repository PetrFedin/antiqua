import {db,uid,now,bi} from './runtime-v09.mjs';
import {requireOrganizationRole} from './organizations-v15.mjs';
import {getMyArtNetwork} from './art-network-v41.mjs';
import {listExhibitions,getExhibition} from './collection-graph-v10.mjs';

const events=new Map(),participation=new Map();
const EVENT_TYPES=new Set(['OPENING','ARTIST_TALK','CURATOR_TOUR','LECTURE','WORKSHOP','AUCTION_PREVIEW','AUCTION','FAIR_DAY','PRIVATE_VIEW','BOOK_LAUNCH','RESEARCH_SESSION','SCREENING','PERFORMANCE','OTHER']);
const EVENT_STATUSES=new Set(['DRAFT','REVIEW_PENDING','PUBLISHED','CANCELLED','ARCHIVED']);
const VENUE_MODES=new Set(['PHYSICAL','ONLINE','HYBRID']);
const VISIBILITIES=new Set(['PRIVATE','UNLISTED','PUBLIC']);
const PARTICIPATION_STATES=new Set(['SAVED','PLANNED','VISITED']);
const REVIEW_ROLES=new Set(['ADMIN','CATALOGUER','TRUST_REVIEWER']);
const CREATOR_ROLES=new Set(['FEATURED_ARTIST','SPEAKER','CURATOR','MODERATOR','TEACHER','PERFORMER','OTHER']);
const OBJECT_ROLES=new Set(['FEATURED','RELATED','REFERENCE']);
const clone=x=>x==null?x:structuredClone(x);
const iso=x=>x?.toISOString?.()||x||null;
const fail=(status,code,message)=>{const e=new Error(message);e.status=status;e.code=code;throw e};
const bilingual=v=>v&&typeof v==='object'&&!Array.isArray(v)?{en:String(v.en||v.ru||''),ru:String(v.ru||v.en||'')}:{en:String(v||''),ru:String(v||'')};
const objectValue=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const arrayStrings=(v,max=30)=>Array.isArray(v)?v.map(x=>String(x||'').trim()).filter(Boolean).slice(0,max):[];
const slugify=s=>String(s||'').trim().toLowerCase().normalize('NFKC').replace(/[^\p{Letter}\p{Number}\s-]/gu,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,110);
const safeUrl=v=>{const s=String(v||'').trim();if(!s)return null;try{const u=new URL(s);if(!['http:','https:'].includes(u.protocol))throw 0;return u.href}catch{fail(400,'CALENDAR_URL_INVALID','URL must use http or https')}};
const timeZone=v=>{const z=String(v||'UTC').trim()||'UTC';try{new Intl.DateTimeFormat('en',{timeZone:z}).format(new Date())}catch{fail(400,'CALENDAR_TIMEZONE_INVALID','Invalid IANA timezone')};return z};
const instant=(v,required=true)=>{if(!v&&!required)return null;const d=new Date(v);if(Number.isNaN(d.getTime()))fail(400,'CALENDAR_TIME_INVALID','Invalid date/time');return d.toISOString()};
const eventKey=(a,id)=>a+'|EVENT|'+id;
const exhibitionKey=(a,id)=>a+'|EXHIBITION|'+id;
const publicStatus=x=>x==='PUBLISHED';
const reviewAllowed=a=>Boolean(a?.roles?.some(r=>REVIEW_ROLES.has(r)));
const requireReviewer=a=>{if(!reviewAllowed(a))fail(403,'CALENDAR_REVIEW_FORBIDDEN','Calendar review permission required');return a};
const normalizeCreatorLinks=v=>(Array.isArray(v)?v:[]).map((x,i)=>({creatorId:String(x.creatorId||''),role:String(x.role||'FEATURED_ARTIST').toUpperCase(),sortOrder:Number(x.sortOrder??i)})).filter(x=>x.creatorId&&CREATOR_ROLES.has(x.role)).slice(0,50);
const normalizeObjectLinks=v=>(Array.isArray(v)?v:[]).map((x,i)=>({objectId:String(x.objectId||''),role:String(x.role||'FEATURED').toUpperCase(),sortOrder:Number(x.sortOrder??i)})).filter(x=>x.objectId&&OBJECT_ROLES.has(x.role)).slice(0,100);

function seed(){
 if(events.size)return;
 const start=new Date(Date.now()+36*3600e3),end=new Date(start.getTime()+75*60000);
 const e={id:'event-demo-curator-tour',slug:'curator-tour-objects-in-dialogue',eventType:'CURATOR_TOUR',title:bi('Curator tour: Objects in Dialogue','Кураторская экскурсия: «Предметы в диалоге»'),summary:bi('A guided route through the exhibition and its object histories.','Маршрут по выставке и историям произведений.'),description:bi('Preview event demonstrating the cultural calendar authority.','Демонстрационное событие культурного календаря.'),organizationId:null,organizationLocationId:null,exhibitionId:'ex-objects-in-dialogue',venueMode:'ONLINE',venueName:bi('ANTIQUA Online','ANTIQUA Online'),city:bi('Online','Онлайн'),country:bi('',''),addressLine:null,timezone:'UTC',startsAt:start.toISOString(),endsAt:end.toISOString(),allDay:false,capacity:null,bookingUrl:null,publicSourceUrl:null,admissionNote:bi('Free','Бесплатно'),accessibility:{},tags:['curator tour','online'],coverObjectId:'lot-101',visibility:'PUBLIC',status:'PUBLISHED',createdByAccountId:'acct-operator-demo',reviewedByAccountId:'acct-operator-demo',reviewedAt:now(),reviewNote:'Preview seed',createdAt:now(),updatedAt:now(),creators:[],objects:[]};
 events.set(e.id,e);
}
seed();

const mapEvent=r=>r?{id:r.id,slug:r.slug,eventType:r.event_type??r.eventType,title:r.title||{},summary:r.summary||{},description:r.description||{},organizationId:r.organization_id??r.organizationId??null,organizationLocationId:r.organization_location_id??r.organizationLocationId??null,exhibitionId:r.exhibition_id??r.exhibitionId??null,venueMode:r.venue_mode??r.venueMode,venueName:r.venue_name??r.venueName??{},city:r.city||{},country:r.country||{},addressLine:r.address_line??r.addressLine??null,timezone:r.timezone||'UTC',startsAt:iso(r.starts_at??r.startsAt),endsAt:iso(r.ends_at??r.endsAt),allDay:Boolean(r.all_day??r.allDay),capacity:r.capacity==null?null:Number(r.capacity),bookingUrl:r.booking_url??r.bookingUrl??null,publicSourceUrl:r.public_source_url??r.publicSourceUrl??null,admissionNote:r.admission_note??r.admissionNote??{},accessibility:r.accessibility||{},tags:r.tags||[],coverObjectId:r.cover_object_id??r.coverObjectId??null,visibility:r.visibility,status:r.status,createdByAccountId:r.created_by_account_id??r.createdByAccountId,reviewedByAccountId:r.reviewed_by_account_id??r.reviewedByAccountId??null,reviewedAt:iso(r.reviewed_at??r.reviewedAt),reviewNote:r.review_note??r.reviewNote??null,createdAt:iso(r.created_at??r.createdAt),updatedAt:iso(r.updated_at??r.updatedAt),creators:r.creators||[],objects:r.objects||[]}:null;
const mapParticipation=r=>r?{entityType:r.entity_type??r.entityType,entityId:r.entity_id??r.entityId,state:r.state,privateNote:r.private_note??r.privateNote??null,savedAt:iso(r.saved_at??r.savedAt),plannedAt:iso(r.planned_at??r.plannedAt),visitedAt:iso(r.visited_at??r.visitedAt),updatedAt:iso(r.updated_at??r.updatedAt)}:null;

async function assertPublishingActor(account,organizationId){
 if(organizationId){await requireOrganizationRole(account.id,organizationId,['OWNER','ADMIN','CATALOGUER']);return}
 if(reviewAllowed(account))return;
 const profile=(await getMyArtNetwork(account)).profile;
 if(profile?.profileStatus!=='PUBLISHED')fail(403,'PUBLISHED_ART_PROFILE_REQUIRED','A reviewed Art Profile or Organization role is required to publish cultural programming');
}
async function validateOrganizationLocation(organizationId,locationId,requirePublic=false){
 if(!locationId)return;
 if(!organizationId)fail(400,'CALENDAR_LOCATION_ORGANIZATION_REQUIRED','organizationId required for organizationLocationId');
 if(db.kind!=='POSTGRES')return;
 const row=(await db.pool.query('SELECT public FROM organization_locations WHERE id=$1 AND organization_id=$2',[locationId,organizationId])).rows[0];
 if(!row)fail(400,'CALENDAR_LOCATION_INVALID','Organization location does not belong to organization');
 if(requirePublic&&!row.public)fail(409,'CALENDAR_LOCATION_NOT_PUBLIC','A public or unlisted event cannot expose a private organization location');
}
async function eventById(id){
 if(db.kind==='POSTGRES'){const r=(await db.pool.query('SELECT * FROM cultural_events WHERE id=$1',[id])).rows[0];if(!r)return null;return hydrateEvent(mapEvent(r))}
 return clone(events.get(id)||null)
}
async function hydrateEvent(e){
 if(!e)return null;
 if(db.kind==='POSTGRES'){
  e.creators=(await db.pool.query('SELECT creator_id AS "creatorId",role,sort_order AS "sortOrder" FROM cultural_event_creators WHERE event_id=$1 ORDER BY sort_order,creator_id',[e.id])).rows;
  e.objects=(await db.pool.query('SELECT object_id AS "objectId",role,sort_order AS "sortOrder" FROM cultural_event_objects WHERE event_id=$1 ORDER BY sort_order,object_id',[e.id])).rows;
 }
 return e
}
async function replaceEventLinks(eventId,creators,objects,client=null){
 if(db.kind!=='POSTGRES')return;
 const q=client||db.pool;
 await q.query('DELETE FROM cultural_event_creators WHERE event_id=$1',[eventId]);
 for(const x of creators)await q.query('INSERT INTO cultural_event_creators(event_id,creator_id,role,sort_order) VALUES($1,$2,$3,$4)',[eventId,x.creatorId,x.role,x.sortOrder]);
 await q.query('DELETE FROM cultural_event_objects WHERE event_id=$1',[eventId]);
 for(const x of objects)await q.query('INSERT INTO cultural_event_objects(event_id,object_id,role,sort_order) VALUES($1,$2,$3,$4)',[eventId,x.objectId,x.role,x.sortOrder]);
}

function normalizedEventInput(input={},current={}){
 const eventType=String(input.eventType??current.eventType??'OTHER').toUpperCase();if(!EVENT_TYPES.has(eventType))fail(400,'CALENDAR_EVENT_TYPE_INVALID','Invalid event type');
 const venueMode=String(input.venueMode??current.venueMode??'PHYSICAL').toUpperCase();if(!VENUE_MODES.has(venueMode))fail(400,'CALENDAR_VENUE_MODE_INVALID','Invalid venue mode');
 const visibility=String(input.visibility??current.visibility??'PRIVATE').toUpperCase();if(!VISIBILITIES.has(visibility))fail(400,'CALENDAR_VISIBILITY_INVALID','Invalid visibility');
 const title=bilingual(input.title??current.title??{}),plain=String(title.en||title.ru||'').trim();if(!plain)fail(400,'CALENDAR_TITLE_REQUIRED','Event title required');
 const startsAt=instant(input.startsAt??current.startsAt),endsAt=instant(input.endsAt===undefined?current.endsAt:input.endsAt,false);if(endsAt&&Date.parse(endsAt)<=Date.parse(startsAt))fail(400,'CALENDAR_RANGE_INVALID','endsAt must be after startsAt');
 const slug=slugify(input.slug??current.slug??plain);if(!slug)fail(400,'CALENDAR_SLUG_REQUIRED','Event slug required');
 const capacityRaw=input.capacity===undefined?(current.capacity??null):(input.capacity==null||input.capacity===''?null:Number(input.capacity));if(capacityRaw!=null&&(!Number.isInteger(capacityRaw)||capacityRaw<=0))fail(400,'CALENDAR_CAPACITY_INVALID','capacity must be a positive integer');
 return{slug,eventType,title,summary:bilingual(input.summary??current.summary??{}),description:bilingual(input.description??current.description??{}),organizationId:input.organizationId===undefined?(current.organizationId||null):(input.organizationId||null),organizationLocationId:input.organizationLocationId===undefined?(current.organizationLocationId||null):(input.organizationLocationId||null),exhibitionId:input.exhibitionId===undefined?(current.exhibitionId||null):(input.exhibitionId||null),venueMode,venueName:bilingual(input.venueName??current.venueName??{}),city:bilingual(input.city??current.city??{}),country:bilingual(input.country??current.country??{}),addressLine:input.addressLine===undefined?(current.addressLine||null):(String(input.addressLine||'').trim()||null),timezone:timeZone(input.timezone??current.timezone??'UTC'),startsAt,endsAt,allDay:Boolean(input.allDay??current.allDay??false),capacity:capacityRaw,bookingUrl:input.bookingUrl===undefined?(current.bookingUrl||null):safeUrl(input.bookingUrl),publicSourceUrl:input.publicSourceUrl===undefined?(current.publicSourceUrl||null):safeUrl(input.publicSourceUrl),admissionNote:objectValue(input.admissionNote??current.admissionNote??{}),accessibility:objectValue(input.accessibility??current.accessibility??{}),tags:input.tags===undefined?(current.tags||[]):arrayStrings(input.tags,30),coverObjectId:input.coverObjectId===undefined?(current.coverObjectId||null):(input.coverObjectId||null),visibility,creators:input.creators===undefined?(current.creators||[]):normalizeCreatorLinks(input.creators),objects:input.objects===undefined?(current.objects||[]):normalizeObjectLinks(input.objects)}
}

export function culturalCalendarCapabilities(){return{contractVersion:'v42',eventAuthority:'CULTURAL_EVENTS',exhibitionAuthority:'EXHIBITIONS_V10_EXTENDED',publicationReview:true,participantStates:[...PARTICIPATION_STATES],eventTypes:[...EVENT_TYPES],venueModes:[...VENUE_MODES],personalConflictDetection:true,icsExport:true,genericCheckInFeed:false,locationTracking:false}};

export async function createCulturalEvent(account,input={}){
 if(!account)fail(401,'AUTH_REQUIRED','Authentication required');const x=normalizedEventInput(input);await assertPublishingActor(account,x.organizationId);await validateOrganizationLocation(x.organizationId,x.organizationLocationId,x.visibility!=='PRIVATE');
 const id=uid('event'),e={id,...x,status:'DRAFT',createdByAccountId:account.id,reviewedByAccountId:null,reviewedAt:null,reviewNote:null,createdAt:now(),updatedAt:now()};
 if(db.kind==='POSTGRES'){const c=await db.pool.connect();try{await c.query('BEGIN');await c.query(`INSERT INTO cultural_events(id,slug,event_type,title,summary,description,organization_id,organization_location_id,exhibition_id,venue_mode,venue_name,city,country,address_line,timezone,starts_at,ends_at,all_day,capacity,booking_url,public_source_url,admission_note,accessibility,tags,cover_object_id,visibility,status,created_by_account_id,created_at,updated_at)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,'DRAFT',$27,now(),now())`,[id,x.slug,x.eventType,x.title,x.summary,x.description,x.organizationId,x.organizationLocationId,x.exhibitionId,x.venueMode,x.venueName,x.city,x.country,x.addressLine,x.timezone,x.startsAt,x.endsAt,x.allDay,x.capacity,x.bookingUrl,x.publicSourceUrl,x.admissionNote,x.accessibility,JSON.stringify(x.tags),x.coverObjectId,x.visibility,account.id]);await replaceEventLinks(id,x.creators,x.objects,c);await c.query('COMMIT')}catch(err){try{await c.query('ROLLBACK')}catch{}if(err.code==='23505')fail(409,'CALENDAR_EVENT_SLUG_CONFLICT','Event slug already exists');throw err}finally{c.release()};return eventById(id)}
 events.set(id,e);return clone(e)
}

export async function updateCulturalEvent(account,id,input={}){
 const current=await eventById(id);if(!current)fail(404,'CALENDAR_EVENT_NOT_FOUND','Event not found');if(current.organizationId)await requireOrganizationRole(account.id,current.organizationId,['OWNER','ADMIN','CATALOGUER']);else if(current.createdByAccountId!==account.id&&!reviewAllowed(account))fail(403,'CALENDAR_EVENT_FORBIDDEN','Event editing denied');
 const x=normalizedEventInput(input,current);await assertPublishingActor(account,x.organizationId);await validateOrganizationLocation(x.organizationId,x.organizationLocationId,x.visibility!=='PRIVATE');
 if(db.kind==='POSTGRES'){const c=await db.pool.connect();try{await c.query('BEGIN');await c.query(`UPDATE cultural_events SET slug=$2,event_type=$3,title=$4,summary=$5,description=$6,organization_id=$7,organization_location_id=$8,exhibition_id=$9,venue_mode=$10,venue_name=$11,city=$12,country=$13,address_line=$14,timezone=$15,starts_at=$16,ends_at=$17,all_day=$18,capacity=$19,booking_url=$20,public_source_url=$21,admission_note=$22,accessibility=$23,tags=$24,cover_object_id=$25,visibility=$26,status='DRAFT',reviewed_by_account_id=NULL,reviewed_at=NULL,review_note=NULL,updated_at=now() WHERE id=$1`,[id,x.slug,x.eventType,x.title,x.summary,x.description,x.organizationId,x.organizationLocationId,x.exhibitionId,x.venueMode,x.venueName,x.city,x.country,x.addressLine,x.timezone,x.startsAt,x.endsAt,x.allDay,x.capacity,x.bookingUrl,x.publicSourceUrl,x.admissionNote,x.accessibility,JSON.stringify(x.tags),x.coverObjectId,x.visibility]);await replaceEventLinks(id,x.creators,x.objects,c);await c.query('COMMIT')}catch(err){try{await c.query('ROLLBACK')}catch{}if(err.code==='23505')fail(409,'CALENDAR_EVENT_SLUG_CONFLICT','Event slug already exists');throw err}finally{c.release()};return eventById(id)}
 const e={...current,...x,status:'DRAFT',reviewedByAccountId:null,reviewedAt:null,reviewNote:null,updatedAt:now()};events.set(id,e);return clone(e)
}
export async function submitCulturalEvent(account,id){
 const e=await eventById(id);if(!e)fail(404,'CALENDAR_EVENT_NOT_FOUND','Event not found');if(e.organizationId)await requireOrganizationRole(account.id,e.organizationId,['OWNER','ADMIN','CATALOGUER']);else if(e.createdByAccountId!==account.id&&!reviewAllowed(account))fail(403,'CALENDAR_EVENT_FORBIDDEN','Event submission denied');if(e.visibility==='PRIVATE')fail(409,'CALENDAR_EVENT_PRIVATE','Choose PUBLIC or UNLISTED before review');
 if(db.kind==='POSTGRES'){await db.pool.query("UPDATE cultural_events SET status='REVIEW_PENDING',updated_at=now() WHERE id=$1",[id]);return eventById(id)}
 e.status='REVIEW_PENDING';e.updatedAt=now();events.set(id,e);return clone(e)
}
export async function reviewCulturalEvent(reviewer,id,{decision='APPROVE',note=''}={}){
 requireReviewer(reviewer);const e=await eventById(id);if(!e)fail(404,'CALENDAR_EVENT_NOT_FOUND','Event not found');const status=String(decision).toUpperCase()==='APPROVE'?'PUBLISHED':'DRAFT';
 if(db.kind==='POSTGRES'){await db.pool.query('UPDATE cultural_events SET status=$2,reviewed_by_account_id=$3,reviewed_at=now(),review_note=$4,updated_at=now() WHERE id=$1',[id,status,reviewer.id,String(note||'').slice(0,2000)]);return eventById(id)}
 Object.assign(e,{status,reviewedByAccountId:reviewer.id,reviewedAt:now(),reviewNote:String(note||'').slice(0,2000),updatedAt:now()});events.set(id,e);return clone(e)
}
export async function cancelCulturalEvent(account,id,{reason=''}={}){
 const e=await eventById(id);if(!e)fail(404,'CALENDAR_EVENT_NOT_FOUND','Event not found');if(e.organizationId)await requireOrganizationRole(account.id,e.organizationId,['OWNER','ADMIN']);else if(e.createdByAccountId!==account.id&&!reviewAllowed(account))fail(403,'CALENDAR_EVENT_FORBIDDEN','Event cancellation denied');
 if(db.kind==='POSTGRES'){await db.pool.query("UPDATE cultural_events SET status='CANCELLED',review_note=$2,updated_at=now() WHERE id=$1",[id,String(reason||'').slice(0,2000)]);return eventById(id)}
 e.status='CANCELLED';e.reviewNote=String(reason||'').slice(0,2000);e.updatedAt=now();events.set(id,e);return clone(e)
}

async function publicEventRows(filters={}){
 const from=filters.from?instant(filters.from):new Date(Date.now()-30*864e5).toISOString(),to=filters.to?instant(filters.to):new Date(Date.now()+180*864e5).toISOString();
 let xs;
 if(db.kind==='POSTGRES'){
  const rows=(await db.pool.query(`SELECT e.*,o.name AS organization_name,o.slug AS organization_slug,l.label AS location_label,l.city AS location_city,l.address_line AS location_address
   FROM cultural_events e
   LEFT JOIN organizations o ON o.id=e.organization_id
   LEFT JOIN organization_locations l ON l.id=e.organization_location_id
   WHERE e.status='PUBLISHED' AND e.visibility='PUBLIC' AND e.starts_at<=$2 AND COALESCE(e.ends_at,e.starts_at)>=$1
   ORDER BY e.starts_at,e.id`,[from,to])).rows;
  xs=[];for(const r of rows){const e=await hydrateEvent(mapEvent(r));e.organization=r.organization_id?{id:r.organization_id,name:r.organization_name,slug:r.organization_slug}:null;e.organizationLocation=r.organization_location_id?{id:r.organization_location_id,label:r.location_label,city:r.location_city,addressLine:r.location_address}:null;xs.push(e)}
 }else xs=[...events.values()].filter(e=>e.status==='PUBLISHED'&&e.visibility==='PUBLIC'&&Date.parse(e.startsAt)<=Date.parse(to)&&Date.parse(e.endsAt||e.startsAt)>=Date.parse(from)).map(clone);
 return xs.filter(e=>!filters.city||[e.city?.en,e.city?.ru,e.organizationLocation?.city].filter(Boolean).some(x=>String(x).toLowerCase().includes(String(filters.city).toLowerCase()))).filter(e=>!filters.eventType||e.eventType===String(filters.eventType).toUpperCase()).filter(e=>!filters.organizationId||e.organizationId===filters.organizationId).filter(e=>!filters.creatorId||e.creators.some(x=>x.creatorId===filters.creatorId)).filter(e=>!filters.q||JSON.stringify([e.title,e.summary,e.description,e.tags]).toLowerCase().includes(String(filters.q).toLowerCase()))
}

function normalizeExhibition(x){return{id:x.id,entryType:'EXHIBITION',title:x.title||{},summary:x.subtitle||{},description:x.curatorialStatement||{},organizationId:x.organizationId||null,organization:x.organization||null,venueMode:'PHYSICAL',venueName:x.venueName||{},city:x.city||{},country:x.country||{},timezone:x.timezone||'UTC',startsAt:iso(x.startsAt),endsAt:iso(x.endsAt),allDay:true,bookingUrl:x.bookingUrl||null,publicSourceUrl:x.publicSourceUrl||null,coverObjectId:x.coverObjectId||null,visibility:x.visibility,status:x.status,exhibitionId:x.id}}
function normalizeEvent(x){const {createdByAccountId,reviewedByAccountId,reviewedAt,reviewNote,...publicEvent}=x;return{...publicEvent,entryType:'EVENT'}}
function sortEntries(xs){return xs.sort((a,b)=>(Date.parse(a.startsAt||0)-Date.parse(b.startsAt||0))||String(a.id).localeCompare(String(b.id)))}
function classification(entry,at=Date.now()){const s=Date.parse(entry.startsAt||0),e=entry.endsAt?Date.parse(entry.endsAt):(entry.entryType==='EXHIBITION'?Number.POSITIVE_INFINITY:s+3600e3),day=864e5;return{openNow:Boolean(s<=at&&e>=at),today:new Date(s).toDateString()===new Date(at).toDateString(),thisWeek:s>=at-12*3600e3&&s<=at+7*day,closingSoon:Boolean(entry.entryType==='EXHIBITION'&&e>=at&&e<=at+7*day)}}

export async function listPublicCalendar(filters={}){
 const eventsPublic=(await publicEventRows(filters)).map(normalizeEvent),from=filters.from?Date.parse(instant(filters.from)):Date.now()-30*864e5,to=filters.to?Date.parse(instant(filters.to)):Date.now()+180*864e5;
 const exhibitions=(await listExhibitions()).map(normalizeExhibition).filter(e=>Date.parse(e.startsAt||0)<=to&&(e.endsAt?Date.parse(e.endsAt):Number.POSITIVE_INFINITY)>=from).filter(e=>!filters.city||JSON.stringify([e.city,e.venueName]).toLowerCase().includes(String(filters.city).toLowerCase())).filter(e=>!filters.organizationId||e.organizationId===filters.organizationId).filter(e=>!filters.q||JSON.stringify([e.title,e.summary,e.description]).toLowerCase().includes(String(filters.q).toLowerCase()));
 const entries=sortEntries([...eventsPublic,...exhibitions]).map(e=>({...e,classification:classification(e)}));
 return{entries,capabilities:culturalCalendarCapabilities()}
}
export async function getPublicCulturalEvent(idOrSlug){
 let e;if(db.kind==='POSTGRES'){const r=(await db.pool.query("SELECT * FROM cultural_events WHERE status='PUBLISHED' AND visibility IN('PUBLIC','UNLISTED') AND (id=$1 OR slug=$1)",[idOrSlug])).rows[0];e=r?await hydrateEvent(mapEvent(r)):null}else e=[...events.values()].find(x=>(x.id===idOrSlug||x.slug===idOrSlug)&&x.status==='PUBLISHED'&&['PUBLIC','UNLISTED'].includes(x.visibility));
 return e?normalizeEvent(clone(e)):null
}

async function readableTarget(entityType,entityId){
 if(entityType==='EVENT')return getPublicCulturalEvent(entityId);
 if(entityType==='EXHIBITION'){const e=await getExhibition(entityId);return e&&e.visibility==='PUBLIC'&&(db.kind!=='POSTGRES'||e.publicationStatus==='PUBLISHED')?normalizeExhibition(e):null}
 return null
}
export async function setCalendarParticipation(account,{entityType,entityId,state,privateNote=null}={}){
 entityType=String(entityType||'').toUpperCase();state=String(state||'').toUpperCase();entityId=String(entityId||'');if(!['EVENT','EXHIBITION'].includes(entityType)||!entityId)fail(400,'CALENDAR_TARGET_INVALID','Valid calendar target required');
 if(state==='NONE'){if(db.kind==='POSTGRES')await db.pool.query('DELETE FROM cultural_calendar_participation WHERE account_id=$1 AND entity_type=$2 AND entity_id=$3',[account.id,entityType,entityId]);else participation.delete(entityType==='EVENT'?eventKey(account.id,entityId):exhibitionKey(account.id,entityId));return{entityType,entityId,state:'NONE'}}
 if(!PARTICIPATION_STATES.has(state))fail(400,'CALENDAR_PARTICIPATION_INVALID','Invalid calendar participation state');if(!await readableTarget(entityType,entityId))fail(404,'CALENDAR_TARGET_NOT_FOUND','Calendar target not found');
 const t=now(),savedAt=state==='SAVED'?t:null,plannedAt=state==='PLANNED'?t:null,visitedAt=state==='VISITED'?t:null;
 if(db.kind==='POSTGRES'){const r=(await db.pool.query(`INSERT INTO cultural_calendar_participation(account_id,entity_type,entity_id,state,private_note,saved_at,planned_at,visited_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now())
 ON CONFLICT(account_id,entity_type,entity_id) DO UPDATE SET state=excluded.state,private_note=excluded.private_note,saved_at=COALESCE(excluded.saved_at,cultural_calendar_participation.saved_at),planned_at=COALESCE(excluded.planned_at,cultural_calendar_participation.planned_at),visited_at=COALESCE(excluded.visited_at,cultural_calendar_participation.visited_at),updated_at=now() RETURNING *`,[account.id,entityType,entityId,state,privateNote?String(privateNote).slice(0,2000):null,savedAt,plannedAt,visitedAt])).rows[0];return mapParticipation(r)}
 const key=entityType==='EVENT'?eventKey(account.id,entityId):exhibitionKey(account.id,entityId),prev=participation.get(key)||{};const p={entityType,entityId,state,privateNote:privateNote?String(privateNote).slice(0,2000):null,savedAt:savedAt||prev.savedAt||null,plannedAt:plannedAt||prev.plannedAt||null,visitedAt:visitedAt||prev.visitedAt||null,updatedAt:t};participation.set(key,p);return clone(p)
}
async function participationsFor(accountId){if(db.kind==='POSTGRES')return(await db.pool.query('SELECT * FROM cultural_calendar_participation WHERE account_id=$1 ORDER BY updated_at DESC',[accountId])).rows.map(mapParticipation);return[...participation.entries()].filter(([k])=>k.startsWith(accountId+'|')).map(([,v])=>clone(v))}
function conflicts(entries){const timed=entries.filter(x=>x.participation?.state==='PLANNED'&&!x.allDay&&x.startsAt).sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt)),out=[];for(let i=0;i<timed.length;i++)for(let j=i+1;j<timed.length;j++){const a=timed[i],b=timed[j],ae=Date.parse(a.endsAt||a.startsAt)+(!a.endsAt?3600e3:0),be=Date.parse(b.endsAt||b.startsAt)+(!b.endsAt?3600e3:0);if(Date.parse(b.startsAt)>=ae)break;if(Date.parse(a.startsAt)<be&&Date.parse(b.startsAt)<ae)out.push({a:{entityType:a.entryType,id:a.id,title:a.title,startsAt:a.startsAt,endsAt:a.endsAt},b:{entityType:b.entryType,id:b.id,title:b.title,startsAt:b.startsAt,endsAt:b.endsAt}})}return out}
export async function getMyCulturalCalendar(account){
 const ps=await participationsFor(account.id),entries=[];for(const p of ps){const target=await readableTarget(p.entityType,p.entityId);if(target)entries.push({...target,participation:p})}return{entries:sortEntries(entries),conflicts:conflicts(entries),capabilities:culturalCalendarCapabilities()}
}

function lifecycleForExhibition(start,end){const n=Date.now(),s=start?Date.parse(start):null,e=end?Date.parse(end):null;if(s&&s>n)return'SCHEDULED';if(e&&e<n)return'ARCHIVED';return'LIVE'}
export async function createCalendarExhibition(account,input={}){
 if(db.kind!=='POSTGRES')fail(503,'POSTGRES_REQUIRED','Exhibition authoring requires PostgreSQL');const organizationId=input.organizationId||null,visibility=String(input.visibility||'PRIVATE').toUpperCase();if(!VISIBILITIES.has(visibility))fail(400,'CALENDAR_VISIBILITY_INVALID','Invalid visibility');await assertPublishingActor(account,organizationId);await validateOrganizationLocation(organizationId,input.organizationLocationId||null,String(input.visibility||'PRIVATE').toUpperCase()!=='PRIVATE');const title=bilingual(input.title||{});if(!String(title.en||title.ru||'').trim())fail(400,'EXHIBITION_TITLE_REQUIRED','Exhibition title required');const startsAt=instant(input.startsAt,false),endsAt=instant(input.endsAt,false);if(startsAt&&endsAt&&Date.parse(endsAt)<=Date.parse(startsAt))fail(400,'CALENDAR_RANGE_INVALID','endsAt must be after startsAt');const id=uid('exhibition'),timezone=timeZone(input.timezone||'UTC');
 await db.pool.query(`INSERT INTO exhibitions(id,owner_account_id,title,subtitle,curatorial_statement,visibility,status,starts_at,ends_at,cover_object_id,metadata,organization_id,organization_location_id,timezone,public_source_url,booking_url,publication_status,created_at,updated_at)
 VALUES($1,$2,$3,$4,$5,$6,'DRAFT',$7,$8,$9,$10,$11,$12,$13,$14,$15,'DRAFT',now(),now())`,[id,account.id,title,bilingual(input.subtitle||{}),bilingual(input.curatorialStatement||{}),visibility,startsAt,endsAt,input.coverObjectId||null,objectValue(input.metadata),organizationId,input.organizationLocationId||null,timezone,safeUrl(input.publicSourceUrl),safeUrl(input.bookingUrl)]);return getExhibition(id)
}
export async function updateCalendarExhibition(account,id,input={}){
 if(db.kind!=='POSTGRES')fail(503,'POSTGRES_REQUIRED','Exhibition authoring requires PostgreSQL');
 const current=(await db.pool.query('SELECT * FROM exhibitions WHERE id=$1',[id])).rows[0];if(!current)fail(404,'EXHIBITION_NOT_FOUND','Exhibition not found');
 if(current.organization_id)await requireOrganizationRole(account.id,current.organization_id,['OWNER','ADMIN','CATALOGUER']);else if(current.owner_account_id!==account.id&&!reviewAllowed(account))fail(403,'EXHIBITION_FORBIDDEN','Exhibition editing denied');
 const organizationId=input.organizationId===undefined?(current.organization_id||null):(input.organizationId||null),locationId=input.organizationLocationId===undefined?(current.organization_location_id||null):(input.organizationLocationId||null),visibility=String(input.visibility??current.visibility??'PRIVATE').toUpperCase();
 if(!VISIBILITIES.has(visibility))fail(400,'CALENDAR_VISIBILITY_INVALID','Invalid visibility');await assertPublishingActor(account,organizationId);await validateOrganizationLocation(organizationId,locationId,visibility!=='PRIVATE');
 const title=input.title===undefined?current.title:bilingual(input.title);if(!String(title?.en||title?.ru||'').trim())fail(400,'EXHIBITION_TITLE_REQUIRED','Exhibition title required');
 const startsAt=input.startsAt===undefined?iso(current.starts_at):instant(input.startsAt,false),endsAt=input.endsAt===undefined?iso(current.ends_at):instant(input.endsAt,false);if(startsAt&&endsAt&&Date.parse(endsAt)<=Date.parse(startsAt))fail(400,'CALENDAR_RANGE_INVALID','endsAt must be after startsAt');
 const timezone=input.timezone===undefined?(current.timezone||'UTC'):timeZone(input.timezone),source=input.publicSourceUrl===undefined?(current.public_source_url||null):safeUrl(input.publicSourceUrl),booking=input.bookingUrl===undefined?(current.booking_url||null):safeUrl(input.bookingUrl);
 await db.pool.query(`UPDATE exhibitions SET title=$2,subtitle=$3,curatorial_statement=$4,visibility=$5,status='DRAFT',starts_at=$6,ends_at=$7,cover_object_id=$8,metadata=$9,organization_id=$10,organization_location_id=$11,timezone=$12,public_source_url=$13,booking_url=$14,publication_status='DRAFT',reviewed_by_account_id=NULL,reviewed_at=NULL,review_note=NULL,updated_at=now() WHERE id=$1`,[id,title,input.subtitle===undefined?current.subtitle:bilingual(input.subtitle),input.curatorialStatement===undefined?current.curatorial_statement:bilingual(input.curatorialStatement),visibility,startsAt,endsAt,input.coverObjectId===undefined?(current.cover_object_id||null):(input.coverObjectId||null),input.metadata===undefined?(current.metadata||{}):objectValue(input.metadata),organizationId,locationId,timezone,source,booking]);
 return getExhibition(id)
}
export async function submitCalendarExhibition(account,id){
 if(db.kind!=='POSTGRES')fail(503,'POSTGRES_REQUIRED','PostgreSQL required');const e=(await db.pool.query('SELECT * FROM exhibitions WHERE id=$1',[id])).rows[0];if(!e)fail(404,'EXHIBITION_NOT_FOUND','Exhibition not found');if(e.organization_id)await requireOrganizationRole(account.id,e.organization_id,['OWNER','ADMIN','CATALOGUER']);else if(e.owner_account_id!==account.id&&!reviewAllowed(account))fail(403,'EXHIBITION_FORBIDDEN','Exhibition submission denied');if(e.visibility==='PRIVATE')fail(409,'EXHIBITION_PRIVATE','Choose PUBLIC or UNLISTED before review');await db.pool.query("UPDATE exhibitions SET publication_status='REVIEW_PENDING',updated_at=now() WHERE id=$1",[id]);return getExhibition(id)
}
export async function reviewCalendarExhibition(reviewer,id,{decision='APPROVE',note=''}={}){
 requireReviewer(reviewer);if(db.kind!=='POSTGRES')fail(503,'POSTGRES_REQUIRED','PostgreSQL required');const e=(await db.pool.query('SELECT * FROM exhibitions WHERE id=$1',[id])).rows[0];if(!e)fail(404,'EXHIBITION_NOT_FOUND','Exhibition not found');const approved=String(decision).toUpperCase()==='APPROVE',publicationStatus=approved?'PUBLISHED':'REJECTED',status=approved?lifecycleForExhibition(e.starts_at,e.ends_at):'DRAFT';await db.pool.query('UPDATE exhibitions SET publication_status=$2,status=$3,reviewed_by_account_id=$4,reviewed_at=now(),review_note=$5,updated_at=now() WHERE id=$1',[id,publicationStatus,status,reviewer.id,String(note||'').slice(0,2000)]);return getExhibition(id)
}

const icsEsc=s=>String(s||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
const icsDate=s=>new Date(s).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
export function entriesToIcs(entries,{name='ANTIQUA Art Calendar'}={}){
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//ANTIQUA//Art Calendar v42//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:'+icsEsc(name)];
 for(const e of entries.filter(x=>x.startsAt)){lines.push('BEGIN:VEVENT','UID:'+icsEsc((e.entryType||'EVENT')+'-'+e.id+'@antiqua'),'DTSTAMP:'+icsDate(new Date()),'DTSTART:'+icsDate(e.startsAt));if(e.endsAt)lines.push('DTEND:'+icsDate(e.endsAt));lines.push('SUMMARY:'+icsEsc(e.title?.en||e.title?.ru||'ANTIQUA event'));const location=[e.venueName?.en||e.venueName?.ru,e.addressLine,e.city?.en||e.city?.ru].filter(Boolean).join(', ');if(location)lines.push('LOCATION:'+icsEsc(location));if(e.description?.en||e.summary?.en)lines.push('DESCRIPTION:'+icsEsc(e.description?.en||e.summary?.en));lines.push('END:VEVENT')}lines.push('END:VCALENDAR');return lines.join('\r\n')+'\r\n'
}
export async function myCalendarIcs(account){const mine=await getMyCulturalCalendar(account);return entriesToIcs(mine.entries.filter(x=>x.participation?.state==='PLANNED'),{name:'ANTIQUA — My Art Plan'})}
