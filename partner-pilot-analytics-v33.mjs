import crypto from 'node:crypto';
import {db,uid,now} from './runtime-v09.mjs';
import {appSecret} from './security-v09.mjs';
import {getExhibition} from './collection-graph-v10.mjs';
import {canReadExhibition} from './access-policy.mjs';

const WINDOW_MS=30*60*1000;
const DAY_MS=24*60*60*1000;
const EXPOSURE_TYPES=new Set(['DROP_OPEN','OBJECT_OPEN']);
const EXPLICIT_TYPES=new Set(['FOLLOW','INQUIRY_CREATED','CONDITION_REQUESTED','VIEWING_REQUESTED','OFFER_CREATED','ORDER_CREATED']);
const ALL_TYPES=[...EXPOSURE_TYPES,...EXPLICIT_TYPES];
const memoryEvents=new Map();
const clone=x=>x==null?x:structuredClone(x);
const iso=v=>v?.toISOString?.()||v||null;
const fail=(status,code,message)=>{const e=new Error(message);e.status=status;e.code=code;throw e};
const windowStart=at=>new Date(Math.floor(Number(at)/WINDOW_MS)*WINDOW_MS).toISOString();
const dayKey=at=>new Date(Number(at)).toISOString().slice(0,10);
const hmac=value=>crypto.createHmac('sha256',appSecret()).update(String(value)).digest('hex');
const clientIp=req=>String(req?.headers?.['x-forwarded-for']||req?.socket?.remoteAddress||'unknown').split(',')[0].trim();
const userAgent=req=>String(req?.headers?.['user-agent']||'').slice(0,300);
const viewerHash=(req,account,exhibitionId,at)=>{
 const identity=account?.id?'account:'+account.id:'anonymous:'+dayKey(at)+':'+clientIp(req)+':'+userAgent(req);
 return hmac(identity+'|partner:'+exhibitionId)
};
const mapEvent=r=>({id:r.id,exhibitionId:r.exhibition_id??r.exhibitionId,accountId:r.account_id??r.accountId??null,viewerKeyHash:r.viewer_key_hash??r.viewerKeyHash,eventType:r.event_type??r.eventType,targetKey:r.target_key??r.targetKey,objectId:r.object_id??r.objectId??null,sourceEntityId:r.source_entity_id??r.sourceEntityId??null,windowStartedAt:iso(r.window_started_at??r.windowStartedAt),occurredAt:iso(r.occurred_at??r.occurredAt),metadata:r.metadata||{}});

export function partnerPilotCapabilities(){return{
 contractVersion:'v33',
 attribution:'PARTNER_PATH_ONLY',
 publicExposureEvents:['DROP_OPEN','OBJECT_OPEN'],
 explicitEvents:[...EXPLICIT_TYPES],
 exposureWindowMinutes:WINDOW_MS/60000,
 rawAnonymousIdentifiersStored:false,
 crossSignalUniqueAudience:false,
 anonymousLongTermRetention:false,
 authenticatedRetention:{d7:{startDay:7,endDayExclusive:14},d30:{startDay:30,endDayExclusive:37}},
 commercialAuthoritiesUnchanged:true,
 objectWideDemandCreditedToPartner:false,
 analyticsAccess:'EXHIBITION_OWNER_OR_ADMIN'
}}

export function exhibitionCohortObjectIds(exhibition){
 const ids=new Set();
 for(const section of exhibition?.sections||[])for(const item of section.items||[]){
  if(item.objectId)ids.add(String(item.objectId));
  for(const slot of item.ensemble?.slots||[])if(slot.objectId)ids.add(String(slot.objectId));
 }
 return[...ids]
}

async function exhibitionForEvent(exhibitionId,account=null){
 const exhibition=await getExhibition(String(exhibitionId||''));
 if(!exhibition)fail(404,'EXHIBITION_NOT_FOUND','Exhibition not found');
 const owner=Boolean(account?.id&&(exhibition.ownerAccountId===account.id||account.roles?.includes('ADMIN')));
 if(!canReadExhibition(exhibition,{owner}))fail(404,'EXHIBITION_NOT_FOUND','Exhibition not found');
 return exhibition
}

function firstParty(req){
 const fetchSite=String(req?.headers?.['sec-fetch-site']||'');
 if(fetchSite&& !['same-origin','same-site','none'].includes(fetchSite))return false;
 const origin=String(req?.headers?.origin||'');
 const host=String(req?.headers?.host||'');
 if(origin&&host){try{if(new URL(origin).host!==host)return false}catch{return false}}
 return true
}

function sanitizeMetadata(input={}){
 const surface=['EXHIBITION','PARTNER_DROP','PASSPORT','COMMERCIAL_AUTHORITY'].includes(String(input.surface||''))?String(input.surface):'PARTNER_DROP';
 const stage=String(input.stage||'').slice(0,40);
 return{surface,...(stage?{stage}:{})}
}

async function insertEvent(event){
 if(db.kind==='POSTGRES'){
  const q=event.sourceEntityId
   ?`INSERT INTO partner_attribution_events(id,exhibition_id,account_id,viewer_key_hash,event_type,target_key,object_id,source_entity_id,window_started_at,occurred_at,metadata)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT(exhibition_id,event_type,source_entity_id) WHERE source_entity_id IS NOT NULL
      DO NOTHING RETURNING *`
   :`INSERT INTO partner_attribution_events(id,exhibition_id,account_id,viewer_key_hash,event_type,target_key,object_id,source_entity_id,window_started_at,occurred_at,metadata)
      VALUES($1,$2,$3,$4,$5,$6,$7,NULL,$8,$9,$10)
      ON CONFLICT(exhibition_id,event_type,target_key,viewer_key_hash,window_started_at) WHERE source_entity_id IS NULL
      DO UPDATE SET occurred_at=GREATEST(partner_attribution_events.occurred_at,excluded.occurred_at),account_id=COALESCE(partner_attribution_events.account_id,excluded.account_id)
      RETURNING *`;
  const vals=event.sourceEntityId
   ?[event.id,event.exhibitionId,event.accountId,event.viewerKeyHash,event.eventType,event.targetKey,event.objectId,event.sourceEntityId,event.windowStartedAt,event.occurredAt,event.metadata]
   :[event.id,event.exhibitionId,event.accountId,event.viewerKeyHash,event.eventType,event.targetKey,event.objectId,event.windowStartedAt,event.occurredAt,event.metadata];
  const row=(await db.pool.query(q,vals)).rows[0];
  if(row)return{event:mapEvent(row),deduplicated:false};
  if(event.sourceEntityId){
   const prior=(await db.pool.query('SELECT * FROM partner_attribution_events WHERE exhibition_id=$1 AND event_type=$2 AND source_entity_id=$3',[event.exhibitionId,event.eventType,event.sourceEntityId])).rows[0];
   return{event:mapEvent(prior),deduplicated:true}
  }
 }
 const k=event.sourceEntityId
  ?[event.exhibitionId,event.eventType,event.sourceEntityId].join('|')
  :[event.exhibitionId,event.eventType,event.targetKey,event.viewerKeyHash,event.windowStartedAt].join('|');
 const prior=memoryEvents.get(k);
 if(prior){if(!event.sourceEntityId&&String(event.occurredAt)>String(prior.occurredAt))prior.occurredAt=event.occurredAt;return{event:clone(prior),deduplicated:true}}
 memoryEvents.set(k,clone(event));return{event:clone(event),deduplicated:false}
}

export async function recordPartnerExposure(req,account,exhibitionId,input={}){
 if(!firstParty(req))fail(403,'PARTNER_ATTRIBUTION_ORIGIN_FORBIDDEN','First-party event required');
 const eventType=String(input.eventType||'').toUpperCase();
 if(!EXPOSURE_TYPES.has(eventType))fail(400,'PARTNER_EVENT_INVALID','Only public exposure events are accepted');
 const exhibition=await exhibitionForEvent(exhibitionId,account),objectId=input.objectId?String(input.objectId):null,cohort=exhibitionCohortObjectIds(exhibition);
 if(eventType==='OBJECT_OPEN'&&(!objectId||!cohort.includes(objectId)))fail(422,'OBJECT_OUTSIDE_PARTNER_COHORT','Object is outside this exhibition cohort');
 const occurredAt=now(),at=Date.parse(occurredAt),event={id:uid('pae'),exhibitionId:exhibition.id,accountId:account?.id||null,viewerKeyHash:viewerHash(req,account,exhibition.id,at),eventType,targetKey:eventType==='DROP_OPEN'?exhibition.id:objectId,objectId:eventType==='OBJECT_OPEN'?objectId:null,sourceEntityId:null,windowStartedAt:windowStart(at),occurredAt,metadata:sanitizeMetadata(input.metadata)};
 return{...(await insertEvent(event)),capabilities:partnerPilotCapabilities()}
}

export async function recordPartnerCommercialEvent(req,account,partnerAttribution,input={}){
 const exhibitionId=String(partnerAttribution?.exhibitionId||'');
 if(!exhibitionId)return{recorded:false,reason:'NO_PARTNER_ATTRIBUTION'};
 if(!account?.id)return{recorded:false,reason:'AUTH_REQUIRED'};
 const eventType=String(input.eventType||'').toUpperCase();
 if(!EXPLICIT_TYPES.has(eventType)||eventType==='FOLLOW'||eventType==='ORDER_CREATED')fail(400,'PARTNER_EVENT_INVALID','Invalid commercial attribution event');
 const exhibition=await exhibitionForEvent(exhibitionId,account),objectId=String(input.objectId||''),sourceEntityId=String(input.sourceEntityId||'');
 if(!objectId||!sourceEntityId)fail(400,'PARTNER_EVENT_REQUIRED','objectId and sourceEntityId are required');
 if(!exhibitionCohortObjectIds(exhibition).includes(objectId))fail(422,'OBJECT_OUTSIDE_PARTNER_COHORT','Object is outside this exhibition cohort');
 const occurredAt=now(),at=Date.parse(occurredAt),event={id:uid('pae'),exhibitionId:exhibition.id,accountId:account.id,viewerKeyHash:viewerHash(req,account,exhibition.id,at),eventType,targetKey:objectId,objectId,sourceEntityId,windowStartedAt:windowStart(at),occurredAt,metadata:{...sanitizeMetadata({surface:'COMMERCIAL_AUTHORITY'}),authority:String(input.authority||'').slice(0,80)}};
 const x=await insertEvent(event);return{recorded:true,...x}
}

export async function tryRecordPartnerCommercialEvent(req,account,partnerAttribution,input={}){
 try{return await recordPartnerCommercialEvent(req,account,partnerAttribution,input)}catch(e){console.error('Partner attribution skipped:',e.code||e.message);return{recorded:false,reason:e.code||'ATTRIBUTION_ERROR'}}
}

export async function recordPartnerFollow(req,account,exhibitionId){
 if(!account?.id)return{recorded:false,reason:'AUTH_REQUIRED'};
 const exhibition=await exhibitionForEvent(exhibitionId,account),occurredAt=now(),at=Date.parse(occurredAt),event={id:uid('pae'),exhibitionId:exhibition.id,accountId:account.id,viewerKeyHash:viewerHash(req,account,exhibition.id,at),eventType:'FOLLOW',targetKey:exhibition.id,objectId:null,sourceEntityId:account.id,windowStartedAt:windowStart(at),occurredAt,metadata:sanitizeMetadata({surface:'PARTNER_DROP'})};
 const x=await insertEvent(event);return{recorded:true,...x}
}

async function attributedOfferEvent(offerId){
 offerId=String(offerId||'');if(!offerId)return null;
 if(db.kind==='POSTGRES')return mapEvent((await db.pool.query("SELECT * FROM partner_attribution_events WHERE event_type='OFFER_CREATED' AND source_entity_id=$1 ORDER BY occurred_at DESC LIMIT 1",[offerId])).rows[0]);
 return clone([...memoryEvents.values()].find(x=>x.eventType==='OFFER_CREATED'&&x.sourceEntityId===offerId)||null)
}

export async function tryRecordPartnerOrderFromOffer(req,offerId,order){
 try{
  const prior=await attributedOfferEvent(offerId);if(!prior||!order?.id)return{recorded:false,reason:'NO_ATTRIBUTED_OFFER'};
  const occurredAt=now(),at=Date.parse(occurredAt),event={id:uid('pae'),exhibitionId:prior.exhibitionId,accountId:prior.accountId,viewerKeyHash:prior.viewerKeyHash,eventType:'ORDER_CREATED',targetKey:prior.objectId,objectId:prior.objectId,sourceEntityId:String(order.id),windowStartedAt:windowStart(at),occurredAt,metadata:{surface:'COMMERCIAL_AUTHORITY',authority:'OFFER_ACCEPTANCE',derivedFromOfferId:String(offerId)}};
  const x=await insertEvent(event);return{recorded:true,...x}
 }catch(e){console.error('Partner order attribution skipped:',e.code||e.message);return{recorded:false,reason:e.code||'ATTRIBUTION_ERROR'}}
}

async function eventsForExhibition(exhibitionId){
 if(db.kind==='POSTGRES')return(await db.pool.query('SELECT * FROM partner_attribution_events WHERE exhibition_id=$1 ORDER BY occurred_at,id',[exhibitionId])).rows.map(mapEvent);
 return[...memoryEvents.values()].filter(x=>x.exhibitionId===exhibitionId).sort((a,b)=>String(a.occurredAt).localeCompare(String(b.occurredAt))).map(clone)
}

export function retentionProjection(events,at=Date.now()){
 const auth=events.filter(x=>x.accountId),exposures=auth.filter(x=>EXPOSURE_TYPES.has(x.eventType)),first=new Map();
 for(const e of exposures){const t=Date.parse(e.occurredAt),p=first.get(e.accountId);if(!p||t<p)first.set(e.accountId,t)}
 const window=(startDay,endDayExclusive)=>{
  let matured=0,pending=0,returned=0;
  for(const [accountId,firstAt] of first){
   if(at<firstAt+startDay*DAY_MS){pending++;continue}
   matured++;
   const start=firstAt+startDay*DAY_MS,end=firstAt+endDayExclusive*DAY_MS;
   if(auth.some(e=>e.accountId===accountId&&Date.parse(e.occurredAt)>=start&&Date.parse(e.occurredAt)<end))returned++;
  }
  return{eligible:first.size,matured,pending,returned,rate:matured?Number((returned/matured).toFixed(4)):null,startDay,endDayExclusive}
 };
 return{authenticatedExposed:first.size,d7:window(7,14),d30:window(30,37),anonymousRetentionMeasured:false}
}

export async function partnerPilotAnalytics(account,exhibitionId,{at=Date.now()}={}){
 const exhibition=await getExhibition(String(exhibitionId||''));if(!exhibition)fail(404,'EXHIBITION_NOT_FOUND','Exhibition not found');
 const allowed=Boolean(account?.roles?.includes('ADMIN')||account?.id===exhibition.ownerAccountId);if(!allowed)fail(403,'PARTNER_ANALYTICS_FORBIDDEN','Exhibition owner or administrator required');
 const events=await eventsForExhibition(exhibition.id),cohort=exhibitionCohortObjectIds(exhibition),counts=Object.fromEntries(ALL_TYPES.map(t=>[t,0])),viewers=Object.fromEntries(ALL_TYPES.map(t=>[t,new Set()]));
 const byObject=new Map(cohort.map(id=>[id,{objectId:id,events:Object.fromEntries(ALL_TYPES.map(t=>[t,0]))}]));
 for(const e of events){counts[e.eventType]=(counts[e.eventType]||0)+1;viewers[e.eventType]??=new Set();viewers[e.eventType].add(e.viewerKeyHash);if(e.objectId&&byObject.has(e.objectId))byObject.get(e.objectId).events[e.eventType]=(byObject.get(e.objectId).events[e.eventType]||0)+1}
 const uniqueViewers=Object.fromEntries(Object.entries(viewers).map(([k,v])=>[k,v.size]));
 let currentFollowers=0;if(db.kind==='POSTGRES')currentFollowers=Number((await db.pool.query("SELECT count(*)::int n FROM exhibition_follows WHERE exhibition_id=$1 AND status='ACTIVE'",[exhibition.id])).rows[0]?.n||0);else currentFollowers=counts.FOLLOW||0;
 return{
  exhibition:{id:exhibition.id,title:clone(exhibition.title),status:exhibition.status,startsAt:iso(exhibition.startsAt),endsAt:iso(exhibition.endsAt),partner:clone(exhibition.metadata?.drop?.partner||null)},
  cohort:{objects:cohort.length,objectIds:cohort},
  attributed:{counts,uniqueViewers,currentFollowers,explicitIntent:(counts.INQUIRY_CREATED||0)+(counts.CONDITION_REQUESTED||0)+(counts.VIEWING_REQUESTED||0)+(counts.OFFER_CREATED||0),orders:counts.ORDER_CREATED||0},
  retention:retentionProjection(events,at),
  objects:[...byObject.values()],
  methodology:{crossSignalUniqueAudience:false,objectWideDemandExcluded:true,commercialFactsRecordedAfterAuthoritySuccess:true,anonymousLongTermRetention:false},
  capabilities:partnerPilotCapabilities()
 }
}
