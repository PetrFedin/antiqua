import {db,lots,uid,now} from './runtime-v09.mjs';
import {listObjectFlags} from './preferences-v14.mjs';
import {listSubscriptions} from './domain-e2e-v14.mjs';
import {listOffers} from './offer-negotiation-v22.mjs';
import {listViewingRequests} from './viewing-v23.mjs';
import {listCollectionRecords} from './domain-e2e-v14.mjs';

const memoryEvents=new Map();
const DIMENSIONS=['maker','department','period','origin'];
export const SIGNAL_WEIGHTS=Object.freeze({ENGAGED_VIEW:1,SAVED:5,COLLECTED:7,FOLLOW_MAKER:4,FOLLOW_CATEGORY:4,OFFER:8,VIEWING:8,PURCHASE:12,DISMISSED:-2});
const POSITIVE=new Set(['ENGAGED_VIEW','SAVED','COLLECTED','FOLLOW_MAKER','FOLLOW_CATEGORY','OFFER','VIEWING','PURCHASE']);
const strongExclude=new Set(['SAVED','COLLECTED','PURCHASE']);
const iso=v=>v?.toISOString?.()||v||null;
const clone=x=>x==null?x:structuredClone(x);
const canon=v=>String(v?.en??v?.ru??v??'').trim().toLowerCase();
const bi=v=>typeof v==='object'&&v?clone(v):{en:String(v||''),ru:String(v||'')};
const fail=(status,code,message)=>{const e=new Error(message);e.status=status;e.code=code;throw e};

function publicObject(row){
 const p=row?.passport||row||{};
 return{id:row?.id||p.id,objectId:row?.object_code||p.objectId||p.id,title:p.title||bi('Object'),maker:p.maker||bi(''),department:p.department||p.category||bi(''),period:p.period||bi(''),origin:p.origin||bi(''),materials:p.materials||bi(''),image:p.image||p.media?.find?.(x=>x.role==='PRIMARY')?.url||null,conditionGrade:p.conditionGrade||null};
}

async function catalogue({publicOnly=false}={}){
 if(db.kind!=='POSTGRES')return lots.map(publicObject);
 const where=publicOnly?"WHERE publication_status='PUBLIC' AND catalogue_status='APPROVED'":'';
 const rows=(await db.pool.query('SELECT id,object_code,passport,publication_status,catalogue_status FROM objects '+where)).rows;
 return rows.map(publicObject)
}

function eventMapKey(accountId,sourceKey){return accountId+'|'+sourceKey}
export function tasteGraphCapabilities(){return{contractVersion:'v28',explainable:true,aiUsed:false,priceUsedForMatching:false,dimensions:DIMENSIONS,signalWeights:SIGNAL_WEIGHTS,engagedViewThreshold:{minimumDwellSeconds:8,minimumDepth:0.35},authoritativeSources:{ENGAGED_VIEW:'taste_signal_events',DISMISSED:'taste_signal_events',SAVED:'account_object_flags',COLLECTED:'account_object_flags',FOLLOW_MAKER:'discovery_subscriptions',FOLLOW_CATEGORY:'discovery_subscriptions',OFFER:'offers',VIEWING:'viewing_requests',PURCHASE:'collection_records/acquisition'},rawNetworkIdentifiersStored:false}}

function sanitizeMeta(type,metadata={}){
 if(type==='ENGAGED_VIEW'){const depth=Math.max(0,Math.min(1,Number(metadata.depth)||0)),dwellSeconds=Math.max(0,Math.min(3600,Number(metadata.dwellSeconds)||0));if(depth<0.35||dwellSeconds<8)fail(422,'ENGAGEMENT_THRESHOLD_NOT_MET','Engaged view requires at least 8 seconds and 35% depth');return{depth:Number(depth.toFixed(3)),dwellSeconds:Number(dwellSeconds.toFixed(1)),surface:'PASSPORT'}}
 return{reason:String(metadata.reason||'NOT_FOR_ME').slice(0,80)}
}

export async function recordTasteSignal(account,body={}){
 const type=String(body.signalType||'').toUpperCase();if(!['ENGAGED_VIEW','DISMISSED'].includes(type))fail(400,'TASTE_SIGNAL_INVALID','Invalid taste signal');
 const objectId=String(body.objectId||''),sourceKey=String(body.sourceKey||'').slice(0,160);if(!objectId||!sourceKey)fail(400,'TASTE_SIGNAL_REQUIRED','objectId and sourceKey are required');
 const metadata=sanitizeMeta(type,body.metadata||{}),occurredAt=now();
 if(db.kind==='POSTGRES'){
  const exists=(await db.pool.query("SELECT 1 FROM objects WHERE id=$1 AND publication_status='PUBLIC'",[objectId])).rowCount;if(!exists)fail(404,'OBJECT_NOT_FOUND','Object not found');
  const id=uid('tse'),r=(await db.pool.query('INSERT INTO taste_signal_events(id,account_id,object_id,signal_type,source_key,metadata,occurred_at,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$7) ON CONFLICT(account_id,source_key) DO NOTHING RETURNING *',[id,account.id,objectId,type,sourceKey,metadata,occurredAt])).rows[0];
  if(r)return{signal:{id:r.id,objectId:r.object_id,signalType:r.signal_type,metadata:r.metadata,occurredAt:iso(r.occurred_at)},idempotent:false};
  const prior=(await db.pool.query('SELECT * FROM taste_signal_events WHERE account_id=$1 AND source_key=$2',[account.id,sourceKey])).rows[0];if(!prior)fail(409,'TASTE_SIGNAL_REPLAY_UNRESOLVED','Taste signal replay could not be resolved');if(prior.object_id!==objectId||prior.signal_type!==type)fail(409,'SOURCE_KEY_CONFLICT','sourceKey already belongs to another taste signal');return{signal:{id:prior.id,objectId:prior.object_id,signalType:prior.signal_type,metadata:prior.metadata,occurredAt:iso(prior.occurred_at)},idempotent:true}
 }
 if(!lots.some(x=>x.id===objectId))fail(404,'OBJECT_NOT_FOUND','Object not found');const k=eventMapKey(account.id,sourceKey),prior=memoryEvents.get(k);if(prior){if(prior.objectId!==objectId||prior.signalType!==type)fail(409,'SOURCE_KEY_CONFLICT','sourceKey already belongs to another taste signal');return{signal:clone(prior),idempotent:true}}const signal={id:uid('tse'),accountId:account.id,objectId,signalType:type,sourceKey,metadata,occurredAt};memoryEvents.set(k,signal);return{signal:clone(signal),idempotent:false}
}

async function pgFacts(account){
 const [events,flags,subs,offers,viewings,records]=await Promise.all([
  db.pool.query('SELECT object_id,signal_type,occurred_at FROM taste_signal_events WHERE account_id=$1',[account.id]),
  db.pool.query("SELECT object_id,flag_type,updated_at FROM account_object_flags WHERE account_id=$1 AND flag_type IN('SAVED','COLLECTED')",[account.id]),
  db.pool.query("SELECT subscription_type,criteria,updated_at FROM discovery_subscriptions WHERE account_id=$1 AND status='ACTIVE' AND subscription_type IN('FOLLOW_MAKER','FOLLOW_CATEGORY')",[account.id]),
  db.pool.query('SELECT l.object_id,o.updated_at FROM offers o JOIN listings l ON l.id=o.listing_id WHERE o.buyer_account_id=$1',[account.id]),
  db.pool.query("SELECT object_id,updated_at FROM viewing_requests WHERE buyer_account_id=$1 AND status<>'CANCELLED'",[account.id]),
  db.pool.query("SELECT object_id,acquisition,updated_at,status FROM collection_records WHERE account_id=$1 AND status IN('OWNED','ON_LOAN','CONSIGNED')",[account.id])
 ]);
 return{
  objectFacts:[
   ...events.rows.map(r=>({objectId:r.object_id,type:r.signal_type,at:iso(r.occurred_at)})),
   ...flags.rows.map(r=>({objectId:r.object_id,type:r.flag_type,at:iso(r.updated_at)})),
   ...offers.rows.map(r=>({objectId:r.object_id,type:'OFFER',at:iso(r.updated_at)})),
   ...viewings.rows.map(r=>({objectId:r.object_id,type:'VIEWING',at:iso(r.updated_at)})),
   ...records.rows.filter(r=>['ORDER','AUCTION'].includes(String(r.acquisition?.source||'').toUpperCase())).map(r=>({objectId:r.object_id,type:'PURCHASE',at:iso(r.updated_at)}))
  ],
  ownedIds:new Set(records.rows.map(r=>String(r.object_id))),
  follows:subs.rows.map(r=>({type:r.subscription_type,value:r.subscription_type==='FOLLOW_MAKER'?r.criteria?.maker:r.criteria?.category,at:iso(r.updated_at)})).filter(x=>String(x.value||'').trim())
 }
}

async function memoryFacts(account){
 const [flags,subs,offers,viewings,records]=await Promise.all([listObjectFlags(db,account.id),listSubscriptions(account),listOffers(account),listViewingRequests(account),listCollectionRecords(account)]);
 return{
  objectFacts:[
   ...[...memoryEvents.values()].filter(x=>x.accountId===account.id).map(x=>({objectId:x.objectId,type:x.signalType,at:x.occurredAt})),
   ...flags.filter(x=>['SAVED','COLLECTED'].includes(x.flagType)).map(x=>({objectId:x.objectId,type:x.flagType,at:x.updatedAt||x.createdAt})),
   ...offers.map(x=>({objectId:x.objectId,type:'OFFER',at:x.updatedAt||x.createdAt})),
   ...viewings.filter(x=>x.status!=='CANCELLED').map(x=>({objectId:x.objectId,type:'VIEWING',at:x.updatedAt||x.createdAt})),
   ...records.filter(x=>['ORDER','AUCTION'].includes(String(x.acquisition?.source||'').toUpperCase())).map(x=>({objectId:x.objectId,type:'PURCHASE',at:x.updatedAt||x.createdAt}))
  ],
  ownedIds:new Set(records.filter(x=>['OWNED','ON_LOAN','CONSIGNED'].includes(x.status)).map(x=>String(x.objectId))),
  follows:subs.filter(x=>x.status==='ACTIVE'&&['FOLLOW_MAKER','FOLLOW_CATEGORY'].includes(x.subscriptionType)).map(x=>({type:x.subscriptionType,value:x.subscriptionType==='FOLLOW_MAKER'?x.criteria?.maker:x.criteria?.category,at:x.updatedAt})).filter(x=>String(x.value||'').trim())
 }
}

function dedupeFacts(facts){const m=new Map();for(const f of facts){if(!SIGNAL_WEIGHTS[f.type]||!f.objectId)continue;const k=f.type+'|'+f.objectId,p=m.get(k);if(!p||String(f.at||'')>String(p.at||''))m.set(k,f)}return[...m.values()]}
function dedupeFollows(follows){const m=new Map();for(const f of follows||[]){const value=String(f.value||'').trim();if(!value||!SIGNAL_WEIGHTS[f.type])continue;const k=f.type+'|'+value.toLowerCase(),p=m.get(k);if(!p||String(f.at||'')>String(p.at||''))m.set(k,{...f,value})}return[...m.values()]}
function addFacet(store,dimension,value,fact){const key=canon(value);if(!key)return;const map=store[dimension],current=map.get(key)||{key,value:bi(value),points:0,signals:new Map()};const weight=SIGNAL_WEIGHTS[fact.type]||0;current.points+=weight;const s=current.signals.get(fact.type)||{type:fact.type,count:0,weight,points:0};s.count++;s.points+=weight;current.signals.set(fact.type,s);map.set(key,current)}
function finalizeFacet(map){return[...map.values()].filter(x=>x.points!==0).map(x=>({...x,signals:[...x.signals.values()].sort((a,b)=>Math.abs(b.points)-Math.abs(a.points)||a.type.localeCompare(b.type))})).sort((a,b)=>b.points-a.points||canon(a.value).localeCompare(canon(b.value)))}

export async function buildTasteProfile(account){
 const facts=db.kind==='POSTGRES'?await pgFacts(account):await memoryFacts(account),objects=await catalogue(),byId=new Map(objects.map(x=>[x.id,x])),objectFacts=dedupeFacts(facts.objectFacts),follows=dedupeFollows(facts.follows),store=Object.fromEntries(DIMENSIONS.map(d=>[d,new Map()]));
 const latestPositive=new Map(),latestDismiss=new Map(),exclude=new Set(facts.ownedIds);
 for(const fact of objectFacts){const o=byId.get(fact.objectId);if(!o)continue;if(POSITIVE.has(fact.type)){const p=latestPositive.get(fact.objectId);if(!p||String(fact.at||'')>p)latestPositive.set(fact.objectId,String(fact.at||''))}if(fact.type==='DISMISSED'){const p=latestDismiss.get(fact.objectId);if(!p||String(fact.at||'')>p)latestDismiss.set(fact.objectId,String(fact.at||''))}if(strongExclude.has(fact.type))exclude.add(fact.objectId);for(const d of DIMENSIONS)addFacet(store,d,o[d],fact)}
 for(const f of follows){const d=f.type==='FOLLOW_MAKER'?'maker':'department';addFacet(store,d,bi(f.value),{type:f.type,at:f.at})}
 for(const [id,at] of latestDismiss){if(!latestPositive.get(id)||at>=latestPositive.get(id))exclude.add(id)}
 const dimensions=Object.fromEntries(DIMENSIONS.map(d=>[d,finalizeFacet(store[d])]));
 const counts={};for(const f of objectFacts)counts[f.type]=(counts[f.type]||0)+1;for(const f of follows)counts[f.type]=(counts[f.type]||0)+1;
 return{profile:{signalCount:Object.values(counts).reduce((a,b)=>a+b,0),signalCounts:counts,dimensions},internal:{exclude},capabilities:tasteGraphCapabilities()}
}

function preferenceMap(profile){return Object.fromEntries(DIMENSIONS.map(d=>[d,new Map((profile.dimensions[d]||[]).map(x=>[x.key,x]))]))}
function coldStart(objects,exclude,limit){const seen=new Set(),out=[];for(const o of objects){if(exclude.has(o.id))continue;const k=canon(o.department)||o.id;if(seen.has(k))continue;seen.add(k);out.push({object:o,affinityPoints:0,reasons:[],coldStart:true});if(out.length>=limit)return out}for(const o of objects){if(out.length>=limit)break;if(!exclude.has(o.id)&&!out.some(x=>x.object.id===o.id))out.push({object:o,affinityPoints:0,reasons:[],coldStart:true})}return out}

export async function tasteRecommendations(account,{limit=8}={}){
 limit=Math.max(1,Math.min(50,Number(limit)||8));const built=await buildTasteProfile(account),objects=await catalogue({publicOnly:true}),prefs=preferenceMap(built.profile);if(!built.profile.signalCount)return{...built,recommendations:coldStart(objects,built.internal.exclude,limit)};
 const ranked=[];for(const o of objects){if(built.internal.exclude.has(o.id))continue;let points=0;const reasons=[];for(const d of DIMENSIONS){const pref=prefs[d].get(canon(o[d]));if(!pref)continue;points+=pref.points;reasons.push({dimension:d,value:pref.value,points:pref.points,signals:pref.signals})}if(points>0)ranked.push({object:o,affinityPoints:points,reasons:reasons.sort((a,b)=>b.points-a.points).slice(0,4),coldStart:false})}
 ranked.sort((a,b)=>b.affinityPoints-a.affinityPoints||String(a.object.id).localeCompare(String(b.object.id)));
 const recommendations=ranked.slice(0,limit);if(recommendations.length<limit){for(const x of coldStart(objects,new Set([...built.internal.exclude,...recommendations.map(x=>x.object.id)]),limit-recommendations.length))recommendations.push(x)}
 return{profile:built.profile,recommendations,capabilities:built.capabilities}
}
