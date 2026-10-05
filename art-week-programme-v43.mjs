import {db,uid,now,bi} from './runtime-v09.mjs';
import {requireOrganizationRole} from './organizations-v15.mjs';
import {listPublicCalendar,getMyCulturalCalendar,entriesToIcs} from './cultural-calendar-v42.mjs';

const programmes=new Map(),dayPlan=new Map();
const PROGRAMME_TYPES=new Set(['ART_WEEK','ART_FAIR','BIENNALE','FESTIVAL','GALLERY_WEEKEND','CITY_PROGRAMME','INSTITUTIONAL_PROGRAMME','OTHER']);
const VISIBILITIES=new Set(['PRIVATE','UNLISTED','PUBLIC']);
const REVIEW_ROLES=new Set(['ADMIN','CATALOGUER','TRUST_REVIEWER']);
const clone=x=>x==null?x:structuredClone(x);
const fail=(status,code,message)=>{const e=new Error(message);e.status=status;e.code=code;throw e};
const biValue=v=>v&&typeof v==='object'&&!Array.isArray(v)?{en:String(v.en||v.ru||''),ru:String(v.ru||v.en||'')}:{en:String(v||''),ru:String(v||'')};
const safeUrl=v=>{const s=String(v||'').trim();if(!s)return null;try{const u=new URL(s);if(!['http:','https:'].includes(u.protocol))throw 0;return u.href}catch{fail(400,'PROGRAMME_URL_INVALID','URL must use http or https')}};
const instant=v=>{const d=new Date(v);if(Number.isNaN(d.getTime()))fail(400,'PROGRAMME_TIME_INVALID','Invalid date/time');return d.toISOString()};
const timeZone=v=>{const z=String(v||'UTC').trim()||'UTC';try{new Intl.DateTimeFormat('en',{timeZone:z}).format(new Date())}catch{fail(400,'PROGRAMME_TIMEZONE_INVALID','Invalid IANA timezone')};return z};
const slugify=s=>String(s||'').trim().toLowerCase().normalize('NFKC').replace(/[^\p{Letter}\p{Number}\s-]/gu,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,110);
const reviewer=a=>Boolean(a?.roles?.some(r=>REVIEW_ROLES.has(r)));
const requireReviewer=a=>{if(!reviewer(a))fail(403,'PROGRAMME_REVIEW_FORBIDDEN','Programme review permission required');return a};
const localDate=(value,zone='UTC')=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value)),o=Object.fromEntries(parts.map(x=>[x.type,x.value]));return o.year+'-'+o.month+'-'+o.day};
const key=(type,id)=>String(type).toUpperCase()+'|'+String(id);
const dayKey=(accountId,programmeId,type,id)=>[accountId,programmeId,String(type).toUpperCase(),id].join('|');

function seed(){
 if(programmes.size)return;
 const start=new Date(Date.now()+24*3600e3),end=new Date(start.getTime()+5*864e5);
 const p={id:'programme-antiqua-art-week-preview',slug:'antiqua-art-week-preview',programmeType:'ART_WEEK',title:bi('ANTIQUA Art Week Preview','ANTIQUA · превью арт-недели'),summary:bi('A reviewed multi-day programme over canonical exhibitions and events.','Проверенная многодневная программа поверх канонических выставок и событий.'),description:bi('A preview surface for day planning, neighbourhood grouping and private visit state.','Демонстрационная программа для планирования дня, группировки по районам и приватного статуса посещения.'),organizerOrganizationId:null,city:bi('Amsterdam','Амстердам'),country:bi('Netherlands','Нидерланды'),timezone:'Europe/Amsterdam',startsAt:start.toISOString(),endsAt:end.toISOString(),officialSourceUrl:null,coverObjectId:'lot-101',visibility:'PUBLIC',status:'PUBLISHED',metadata:{preview:true},createdByAccountId:'acct-operator-demo',reviewedByAccountId:'acct-operator-demo',reviewedAt:now(),reviewNote:'Preview seed',createdAt:now(),updatedAt:now(),entries:[{entityType:'EVENT',entityId:'event-demo-curator-tour',dayLabel:bi('Day 2','День 2'),neighbourhood:bi('Online','Онлайн'),zone:bi('Programme','Программа'),featured:true,official:true,sortOrder:10,sourceUrl:null}]};
 programmes.set(p.id,p)
}
seed();

const mapProgramme=r=>r?{id:r.id,slug:r.slug,programmeType:r.programme_type??r.programmeType,title:r.title||{},summary:r.summary||{},description:r.description||{},organizerOrganizationId:r.organizer_organization_id??r.organizerOrganizationId??null,city:r.city||{},country:r.country||{},timezone:r.timezone||'UTC',startsAt:(r.starts_at??r.startsAt)?.toISOString?.()||r.starts_at??r.startsAt,endsAt:(r.ends_at??r.endsAt)?.toISOString?.()||r.ends_at??r.endsAt,officialSourceUrl:r.official_source_url??r.officialSourceUrl??null,coverObjectId:r.cover_object_id??r.coverObjectId??null,visibility:r.visibility,status:r.status,metadata:r.metadata||{},createdByAccountId:r.created_by_account_id??r.createdByAccountId,reviewedByAccountId:r.reviewed_by_account_id??r.reviewedByAccountId??null,reviewedAt:(r.reviewed_at??r.reviewedAt)?.toISOString?.()||r.reviewed_at??r.reviewedAt??null,reviewNote:r.review_note??r.reviewNote??null,createdAt:(r.created_at??r.createdAt)?.toISOString?.()||r.created_at??r.createdAt,updatedAt:(r.updated_at??r.updatedAt)?.toISOString?.()||r.updated_at??r.updatedAt,entries:r.entries||[]}:null;
const mapEntry=r=>({entityType:r.entity_type??r.entityType,entityId:r.entity_id??r.entityId,dayLabel:r.day_label??r.dayLabel??{},neighbourhood:r.neighbourhood||{},zone:r.zone||{},featured:Boolean(r.featured),official:r.official!==false,sortOrder:Number(r.sort_order??r.sortOrder??0),sourceUrl:r.source_url??r.sourceUrl??null});
const mapDayPlan=r=>({entityType:r.entity_type??r.entityType,entityId:r.entity_id??r.entityId,localDate:String(r.local_date??r.localDate),sortOrder:Number(r.sort_order??r.sortOrder??0),privateNote:r.private_note??r.privateNote??null,updatedAt:(r.updated_at??r.updatedAt)?.toISOString?.()||r.updated_at??r.updatedAt});

async function authoringProgramme(id){
 if(db.kind==='POSTGRES'){const r=(await db.pool.query('SELECT * FROM cultural_programmes WHERE id=$1 OR slug=$1',[id])).rows[0];if(!r)return null;const p=mapProgramme(r);p.entries=(await db.pool.query('SELECT * FROM cultural_programme_entries WHERE programme_id=$1 ORDER BY sort_order,entity_type,entity_id',[p.id])).rows.map(mapEntry);return p}
 const p=[...programmes.values()].find(x=>x.id===id||x.slug===id);return clone(p||null)
}
async function assertCreator(account,organizationId){
 if(organizationId){await requireOrganizationRole(account.id,organizationId,['OWNER','ADMIN','CATALOGUER']);return}
 if(!reviewer(account))fail(403,'PROGRAMME_ORGANIZER_REQUIRED','An Organization role or programme reviewer role is required')
}
async function assertEditor(account,p){
 if(p.organizerOrganizationId){await requireOrganizationRole(account.id,p.organizerOrganizationId,['OWNER','ADMIN','CATALOGUER']);return}
 if(p.createdByAccountId===account.id||reviewer(account))return;
 fail(403,'PROGRAMME_FORBIDDEN','Programme editing denied')
}
function normalizedProgramme(input={},current={}){
 const programmeType=String(input.programmeType??current.programmeType??'OTHER').toUpperCase();if(!PROGRAMME_TYPES.has(programmeType))fail(400,'PROGRAMME_TYPE_INVALID','Invalid programme type');
 const title=biValue(input.title??current.title??{}),plain=String(title.en||title.ru||'').trim();if(!plain)fail(400,'PROGRAMME_TITLE_REQUIRED','Programme title required');
 const slug=slugify(input.slug??current.slug??plain);if(!slug)fail(400,'PROGRAMME_SLUG_REQUIRED','Programme slug required');
 const visibility=String(input.visibility??current.visibility??'PRIVATE').toUpperCase();if(!VISIBILITIES.has(visibility))fail(400,'PROGRAMME_VISIBILITY_INVALID','Invalid visibility');
 const startsAt=instant(input.startsAt??current.startsAt),endsAt=instant(input.endsAt??current.endsAt);if(Date.parse(endsAt)<=Date.parse(startsAt))fail(400,'PROGRAMME_RANGE_INVALID','endsAt must be after startsAt');
 return{slug,programmeType,title,summary:biValue(input.summary??current.summary??{}),description:biValue(input.description??current.description??{}),organizerOrganizationId:input.organizerOrganizationId===undefined?(current.organizerOrganizationId||null):(input.organizerOrganizationId||null),city:biValue(input.city??current.city??{}),country:biValue(input.country??current.country??{}),timezone:timeZone(input.timezone??current.timezone??'UTC'),startsAt,endsAt,officialSourceUrl:input.officialSourceUrl===undefined?(current.officialSourceUrl||null):safeUrl(input.officialSourceUrl),coverObjectId:input.coverObjectId===undefined?(current.coverObjectId||null):(input.coverObjectId||null),visibility,metadata:input.metadata===undefined?(current.metadata||{}):(input.metadata&&typeof input.metadata==='object'&&!Array.isArray(input.metadata)?input.metadata:{})}
}
async function targetExists(type,id){
 type=String(type||'').toUpperCase();if(!['EVENT','EXHIBITION'].includes(type)||!id)return false;
 if(db.kind==='POSTGRES'){const table=type==='EVENT'?'cultural_events':'exhibitions';return Boolean((await db.pool.query('SELECT 1 FROM '+table+' WHERE id=$1',[id])).rowCount)}
 const cal=await listPublicCalendar({from:'2000-01-01T00:00:00Z',to:'2100-01-01T00:00:00Z'});return cal.entries.some(x=>x.entryType===type&&x.id===id)
}
async function publicTargets(p){
 const cal=await listPublicCalendar({from:p.startsAt,to:p.endsAt}),m=new Map(cal.entries.map(x=>[key(x.entryType,x.id),x]));return m
}
async function hydratePublic(p){
 if(!p)return null;const targets=await publicTargets(p),entries=[];
 for(const e of p.entries||[]){const target=targets.get(key(e.entityType,e.entityId));if(!target)continue;entries.push({...e,target,localDate:localDate(target.startsAt||p.startsAt,p.timezone)})}
 entries.sort((a,b)=>a.localDate.localeCompare(b.localDate)||a.sortOrder-b.sortOrder||Date.parse(a.target.startsAt||0)-Date.parse(b.target.startsAt||0));
 let organizer=null,coverObjectId=p.coverObjectId||null;
 if(db.kind==='POSTGRES'){
  if(p.organizerOrganizationId){const r=(await db.pool.query("SELECT id,name,slug FROM organizations WHERE id=$1 AND status='ACTIVE'",[p.organizerOrganizationId])).rows[0];if(r)organizer={id:r.id,name:r.name,slug:r.slug}}
  if(coverObjectId&&!((await db.pool.query("SELECT 1 FROM objects WHERE id=$1 AND publication_status='PUBLIC'",[coverObjectId])).rowCount))coverObjectId=null
 }
 const {createdByAccountId,reviewedByAccountId,reviewedAt,reviewNote,...publicP}=p;
 return{...publicP,organizer,coverObjectId,entries}
}
function groupedDays(p){const m=new Map();for(const e of p.entries||[]){if(!m.has(e.localDate))m.set(e.localDate,[]);m.get(e.localDate).push(e)}return[...m].sort(([a],[b])=>a.localeCompare(b)).map(([date,entries])=>({date,entries}))}
export function programmeCapabilities(){return{contractVersion:'v43',canonicalTargets:['EVENT','EXHIBITION'],reviewedPublication:true,reusesCalendarParticipation:true,dayPlanRequiresPlanned:true,neighbourhoodGrouping:true,ics:true,backgroundLocation:false,travelTimeProvider:false,opaqueAiRanking:false}};

export async function createProgramme(account,input={}){
 if(!account)fail(401,'AUTH_REQUIRED','Authentication required');const x=normalizedProgramme(input);await assertCreator(account,x.organizerOrganizationId);const id=uid('programme'),p={id,...x,status:'DRAFT',createdByAccountId:account.id,reviewedByAccountId:null,reviewedAt:null,reviewNote:null,createdAt:now(),updatedAt:now(),entries:[]};
 if(db.kind==='POSTGRES'){try{await db.pool.query(`INSERT INTO cultural_programmes(id,slug,programme_type,title,summary,description,organizer_organization_id,city,country,timezone,starts_at,ends_at,official_source_url,cover_object_id,visibility,status,metadata,created_by_account_id,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'DRAFT',$16,$17,now(),now())`,[id,x.slug,x.programmeType,x.title,x.summary,x.description,x.organizerOrganizationId,x.city,x.country,x.timezone,x.startsAt,x.endsAt,x.officialSourceUrl,x.coverObjectId,x.visibility,x.metadata,account.id])}catch(e){if(e.code==='23505')fail(409,'PROGRAMME_SLUG_CONFLICT','Programme slug already exists');throw e};return authoringProgramme(id)}
 programmes.set(id,p);return clone(p)
}
export async function updateProgramme(account,id,input={}){
 const p=await authoringProgramme(id);if(!p)fail(404,'PROGRAMME_NOT_FOUND','Programme not found');await assertEditor(account,p);const x=normalizedProgramme(input,p);await assertCreator(account,x.organizerOrganizationId);
 if(db.kind==='POSTGRES'){await db.pool.query(`UPDATE cultural_programmes SET slug=$2,programme_type=$3,title=$4,summary=$5,description=$6,organizer_organization_id=$7,city=$8,country=$9,timezone=$10,starts_at=$11,ends_at=$12,official_source_url=$13,cover_object_id=$14,visibility=$15,metadata=$16,status='DRAFT',reviewed_by_account_id=NULL,reviewed_at=NULL,review_note=NULL,updated_at=now() WHERE id=$1`,[p.id,x.slug,x.programmeType,x.title,x.summary,x.description,x.organizerOrganizationId,x.city,x.country,x.timezone,x.startsAt,x.endsAt,x.officialSourceUrl,x.coverObjectId,x.visibility,x.metadata]);return authoringProgramme(p.id)}
 Object.assign(p,x,{status:'DRAFT',reviewedByAccountId:null,reviewedAt:null,reviewNote:null,updatedAt:now()});programmes.set(p.id,p);return clone(p)
}
export async function upsertProgrammeEntry(account,id,input={}){
 const p=await authoringProgramme(id);if(!p)fail(404,'PROGRAMME_NOT_FOUND','Programme not found');await assertEditor(account,p);const entityType=String(input.entityType||'').toUpperCase(),entityId=String(input.entityId||'');if(!await targetExists(entityType,entityId))fail(404,'PROGRAMME_TARGET_NOT_FOUND','Programme target not found');
 const e={entityType,entityId,dayLabel:biValue(input.dayLabel||{}),neighbourhood:biValue(input.neighbourhood||{}),zone:biValue(input.zone||{}),featured:Boolean(input.featured),official:input.official!==false,sortOrder:Number.isFinite(Number(input.sortOrder))?Number(input.sortOrder):0,sourceUrl:safeUrl(input.sourceUrl)};
 if(db.kind==='POSTGRES'){await db.pool.query(`INSERT INTO cultural_programme_entries(programme_id,entity_type,entity_id,day_label,neighbourhood,zone,featured,official,sort_order,source_url,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),now()) ON CONFLICT(programme_id,entity_type,entity_id) DO UPDATE SET day_label=excluded.day_label,neighbourhood=excluded.neighbourhood,zone=excluded.zone,featured=excluded.featured,official=excluded.official,sort_order=excluded.sort_order,source_url=excluded.source_url,updated_at=now()`,[p.id,e.entityType,e.entityId,e.dayLabel,e.neighbourhood,e.zone,e.featured,e.official,e.sortOrder,e.sourceUrl]);await db.pool.query("UPDATE cultural_programmes SET status='DRAFT',reviewed_by_account_id=NULL,reviewed_at=NULL,review_note=NULL,updated_at=now() WHERE id=$1",[p.id]);return authoringProgramme(p.id)}
 const i=p.entries.findIndex(x=>x.entityType===e.entityType&&x.entityId===e.entityId);if(i>=0)p.entries[i]=e;else p.entries.push(e);Object.assign(p,{status:'DRAFT',reviewedByAccountId:null,reviewedAt:null,reviewNote:null,updatedAt:now()});programmes.set(p.id,p);return clone(p)
}
export async function removeProgrammeEntry(account,id,entityType,entityId){
 const p=await authoringProgramme(id);if(!p)fail(404,'PROGRAMME_NOT_FOUND','Programme not found');await assertEditor(account,p);entityType=String(entityType||'').toUpperCase();entityId=String(entityId||'');
 if(db.kind==='POSTGRES'){await db.pool.query('DELETE FROM cultural_programme_entries WHERE programme_id=$1 AND entity_type=$2 AND entity_id=$3',[p.id,entityType,entityId]);await db.pool.query("UPDATE cultural_programmes SET status='DRAFT',reviewed_by_account_id=NULL,reviewed_at=NULL,review_note=NULL,updated_at=now() WHERE id=$1",[p.id]);return authoringProgramme(p.id)}
 p.entries=p.entries.filter(x=>!(x.entityType===entityType&&x.entityId===entityId));Object.assign(p,{status:'DRAFT',reviewedByAccountId:null,reviewedAt:null,reviewNote:null,updatedAt:now()});programmes.set(p.id,p);return clone(p)
}
export async function submitProgramme(account,id){
 const p=await authoringProgramme(id);if(!p)fail(404,'PROGRAMME_NOT_FOUND','Programme not found');await assertEditor(account,p);if(p.visibility==='PRIVATE')fail(409,'PROGRAMME_PRIVATE','Choose PUBLIC or UNLISTED before review');if(!(p.entries||[]).length)fail(409,'PROGRAMME_EMPTY','Add at least one programme entry before review');
 if(db.kind==='POSTGRES'){await db.pool.query("UPDATE cultural_programmes SET status='REVIEW_PENDING',updated_at=now() WHERE id=$1",[p.id]);return authoringProgramme(p.id)}
 p.status='REVIEW_PENDING';p.updatedAt=now();programmes.set(p.id,p);return clone(p)
}
export async function reviewProgramme(account,id,{decision='APPROVE',note=''}={}){
 requireReviewer(account);const p=await authoringProgramme(id);if(!p)fail(404,'PROGRAMME_NOT_FOUND','Programme not found');const approved=String(decision).toUpperCase()==='APPROVE';
 if(approved){const publicProjection=await hydratePublic(p);if(!publicProjection.entries.length)fail(409,'PROGRAMME_NO_PUBLIC_ENTRIES','At least one reviewed public Event or Exhibition is required')}
 const status=approved?'PUBLISHED':'DRAFT';if(db.kind==='POSTGRES'){await db.pool.query('UPDATE cultural_programmes SET status=$2,reviewed_by_account_id=$3,reviewed_at=now(),review_note=$4,updated_at=now() WHERE id=$1',[p.id,status,account.id,String(note||'').slice(0,2000)]);return authoringProgramme(p.id)}
 Object.assign(p,{status,reviewedByAccountId:account.id,reviewedAt:now(),reviewNote:String(note||'').slice(0,2000),updatedAt:now()});programmes.set(p.id,p);return clone(p)
}
export async function cancelProgramme(account,id,{reason=''}={}){
 const p=await authoringProgramme(id);if(!p)fail(404,'PROGRAMME_NOT_FOUND','Programme not found');await assertEditor(account,p);if(db.kind==='POSTGRES'){await db.pool.query("UPDATE cultural_programmes SET status='CANCELLED',review_note=$2,updated_at=now() WHERE id=$1",[p.id,String(reason||'').slice(0,2000)]);return authoringProgramme(p.id)}
 p.status='CANCELLED';p.reviewNote=String(reason||'').slice(0,2000);p.updatedAt=now();programmes.set(p.id,p);return clone(p)
}
export async function listPublicProgrammes(filters={}){
 const from=filters.from?Date.parse(instant(filters.from)):Date.now()-30*864e5,to=filters.to?Date.parse(instant(filters.to)):Date.now()+365*864e5;let xs;
 if(db.kind==='POSTGRES'){const rows=(await db.pool.query("SELECT * FROM cultural_programmes WHERE status='PUBLISHED' AND visibility='PUBLIC' AND starts_at<=$2 AND ends_at>=$1 ORDER BY starts_at,id",[new Date(from).toISOString(),new Date(to).toISOString()])).rows;xs=[];for(const r of rows){const p=mapProgramme(r);p.entries=(await db.pool.query('SELECT * FROM cultural_programme_entries WHERE programme_id=$1 ORDER BY sort_order,entity_type,entity_id',[p.id])).rows.map(mapEntry);xs.push(await hydratePublic(p))}}
 else xs=[];for(const p of programmes.values())if(p.status==='PUBLISHED'&&p.visibility==='PUBLIC'&&Date.parse(p.startsAt)<=to&&Date.parse(p.endsAt)>=from)xs.push(await hydratePublic(clone(p)));
 return xs.filter(p=>!filters.city||JSON.stringify(p.city).toLowerCase().includes(String(filters.city).toLowerCase())).filter(p=>!filters.programmeType||p.programmeType===String(filters.programmeType).toUpperCase()).map(p=>({...p,entryCount:p.entries.length,days:groupedDays(p)}))
}
export async function getPublicProgramme(id){
 let p=await authoringProgramme(id);if(!p||p.status!=='PUBLISHED'||!['PUBLIC','UNLISTED'].includes(p.visibility))return null;p=await hydratePublic(p);return{...p,days:groupedDays(p),capabilities:programmeCapabilities()}
}
async function planRows(accountId,programmeId){
 if(db.kind==='POSTGRES')return(await db.pool.query('SELECT * FROM cultural_programme_day_plan_items WHERE account_id=$1 AND programme_id=$2 ORDER BY local_date,sort_order,entity_type,entity_id',[accountId,programmeId])).rows.map(mapDayPlan);
 return[...dayPlan.entries()].filter(([k])=>k.startsWith(accountId+'|'+programmeId+'|')).map(([,v])=>clone(v)).sort((a,b)=>a.localDate.localeCompare(b.localDate)||a.sortOrder-b.sortOrder)
}
function conflictsForProgramme(calendar,p){const ids=new Set((p.entries||[]).map(e=>key(e.entityType,e.entityId)));return(calendar.conflicts||[]).filter(c=>ids.has(key(c.a.entityType,c.a.id))&&ids.has(key(c.b.entityType,c.b.id)))}
export async function getMyProgramme(account,id){
 const p=await getPublicProgramme(id);if(!p)return null;const calendar=await getMyCulturalCalendar(account),participation=new Map(calendar.entries.map(x=>[key(x.entryType,x.id),x.participation])),rows=await planRows(account.id,p.id),rowMap=new Map(rows.map(x=>[key(x.entityType,x.entityId),x]));
 const entries=p.entries.map(e=>({...e,participation:participation.get(key(e.entityType,e.entityId))||null,dayPlan:rowMap.get(key(e.entityType,e.entityId))||null})),myDay=entries.filter(e=>e.participation?.state==='PLANNED').sort((a,b)=>(a.dayPlan?.localDate||a.localDate).localeCompare(b.dayPlan?.localDate||b.localDate)||(a.dayPlan?.sortOrder??9999)-(b.dayPlan?.sortOrder??9999)||Date.parse(a.target.startsAt||0)-Date.parse(b.target.startsAt||0));
 return{programme:{...p,entries},myDay,conflicts:conflictsForProgramme(calendar,p),capabilities:programmeCapabilities()}
}
function dateWithin(date,start,end,zone){const a=localDate(start,zone),b=localDate(end,zone);return date>=a&&date<=b}
export async function upsertProgrammeDayPlanItem(account,id,input={}){
 const p=await getPublicProgramme(id);if(!p)fail(404,'PROGRAMME_NOT_FOUND','Programme not found');const entityType=String(input.entityType||'').toUpperCase(),entityId=String(input.entityId||''),entry=p.entries.find(x=>x.entityType===entityType&&x.entityId===entityId);if(!entry)fail(404,'PROGRAMME_ENTRY_NOT_FOUND','Programme entry not found');
 const calendar=await getMyCulturalCalendar(account),planned=calendar.entries.find(x=>x.entryType===entityType&&x.id===entityId&&x.participation?.state==='PLANNED');if(!planned)fail(409,'PROGRAMME_ENTRY_NOT_PLANNED','Add the target to PLANNED before ordering My Day');
 const proposed=String(input.localDate||entry.localDate);if(!/^\d{4}-\d{2}-\d{2}$/.test(proposed)||!dateWithin(proposed,p.startsAt,p.endsAt,p.timezone))fail(400,'PROGRAMME_DAY_INVALID','Day must fall within programme dates');if(entityType==='EVENT'&&proposed!==entry.localDate)fail(409,'PROGRAMME_EVENT_DAY_FIXED','Timed event must stay on its scheduled local date');if(entityType==='EXHIBITION'&&!dateWithin(proposed,entry.target.startsAt,entry.target.endsAt||p.endsAt,p.timezone))fail(409,'PROGRAMME_EXHIBITION_DAY_INVALID','Exhibition is not open on selected programme day');
 const row={entityType,entityId,localDate:proposed,sortOrder:Number.isFinite(Number(input.sortOrder))?Number(input.sortOrder):0,privateNote:input.privateNote?String(input.privateNote).slice(0,2000):null,updatedAt:now()};
 if(db.kind==='POSTGRES'){await db.pool.query(`INSERT INTO cultural_programme_day_plan_items(account_id,programme_id,entity_type,entity_id,local_date,sort_order,private_note,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()) ON CONFLICT(account_id,programme_id,entity_type,entity_id) DO UPDATE SET local_date=excluded.local_date,sort_order=excluded.sort_order,private_note=excluded.private_note,updated_at=now()`,[account.id,p.id,row.entityType,row.entityId,row.localDate,row.sortOrder,row.privateNote])}else dayPlan.set(dayKey(account.id,p.id,row.entityType,row.entityId),row);
 return getMyProgramme(account,p.id)
}
export async function removeProgrammeDayPlanItem(account,id,entityType,entityId){
 const p=await getPublicProgramme(id);if(!p)fail(404,'PROGRAMME_NOT_FOUND','Programme not found');entityType=String(entityType||'').toUpperCase();entityId=String(entityId||'');
 if(db.kind==='POSTGRES')await db.pool.query('DELETE FROM cultural_programme_day_plan_items WHERE account_id=$1 AND programme_id=$2 AND entity_type=$3 AND entity_id=$4',[account.id,p.id,entityType,entityId]);else dayPlan.delete(dayKey(account.id,p.id,entityType,entityId));
 return getMyProgramme(account,p.id)
}
const icsEsc=s=>String(s||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
const icsDate=d=>String(d).replaceAll('-','');
const nextDate=d=>{const x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+1);return x.toISOString().slice(0,10)};
export async function publicProgrammeIcs(id){const p=await getPublicProgramme(id);if(!p)return null;return entriesToIcs(p.entries.map(e=>e.target),{name:p.title?.en||p.title?.ru||'ANTIQUA Programme'})}
export async function myProgrammeIcs(account,id){
 const mine=await getMyProgramme(account,id);if(!mine)return null;const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//ANTIQUA//Art Week Programme v43//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:'+icsEsc(mine.programme.title?.en||mine.programme.title?.ru||'ANTIQUA My Day')];
 for(const e of mine.myDay){const t=e.target,uid=(e.entityType+'-'+e.entityId+'-'+e.dayPlan?.localDate)+'@antiqua';lines.push('BEGIN:VEVENT','UID:'+icsEsc(uid));if(e.entityType==='EXHIBITION'){const d=e.dayPlan?.localDate||e.localDate;lines.push('DTSTART;VALUE=DATE:'+icsDate(d),'DTEND;VALUE=DATE:'+icsDate(nextDate(d)))}else{const raw=entriesToIcs([t]);const dtStart=raw.match(/DTSTART:([^\r\n]+)/)?.[1],dtEnd=raw.match(/DTEND:([^\r\n]+)/)?.[1];if(dtStart)lines.push('DTSTART:'+dtStart);if(dtEnd)lines.push('DTEND:'+dtEnd)}lines.push('SUMMARY:'+icsEsc(t.title?.en||t.title?.ru||'ANTIQUA programme entry'));if(e.dayPlan?.privateNote)lines.push('DESCRIPTION:'+icsEsc(e.dayPlan.privateNote));lines.push('END:VEVENT')}lines.push('END:VCALENDAR');return lines.join('\r\n')+'\r\n'
}
