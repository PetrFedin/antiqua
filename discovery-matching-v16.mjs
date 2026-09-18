import crypto from 'node:crypto';
import {db} from './runtime-v09.mjs';
import {enqueueOutboxTx} from './outbox-v15.mjs';

const MAX_RESULTS=500;
const TEXT_FIELDS={category:'department',era:'period',country:'origin',material:'materials',technique:'technique',maker:'maker'};
const LEGACY_TECH={
 'lot-101':{en:'Gilt-bronze mounting & enamelling',ru:'Монтаж золочёной бронзы и эмаль'},
 'lot-102':{en:'Tin glazing',ru:'Оловянная глазурь'},'lot-103':{en:'Bronze casting & patination',ru:'Литьё бронзы и патинирование'},
 'lot-104':{en:'Oil painting',ru:'Масляная живопись'},'lot-105':{en:'Stone carving',ru:'Резьба по камню'},
 'lot-106':{en:'Cabinetmaking & gilt-bronze mounting',ru:'Краснодеревное дело и золочёная бронза'},
 'lot-107':{en:'Porcelain forming & glazing',ru:'Формовка фарфора и глазурование'},'lot-108':{en:'Manuscript illumination',ru:'Книжная миниатюра'},
 'lot-109':{en:'Cabinetmaking',ru:'Краснодеревное дело'},'lot-110':{en:'Silversmithing',ru:'Серебряное дело'},
 'lot-111':{en:'Porcelain modelling',ru:'Моделирование фарфора'),'lot-112':{en:'Bronze casting & patination',ru:'Литьё бронзы и патинирование'}
};
const bi=(en,ru)=>({en,ru});
const str=v=>String(v??'').trim();
const like=v=>str(v).replace(/[\\%_]/g,m=>'\\'+m);
const num=v=>{if(v===''||v==null)return null;const n=Number(v);if(!Number.isFinite(n)||n<0)throw Object.assign(new Error('Discovery price criteria must be a non-negative number'),{status:400,code:'DISCOVERY_CRITERIA_INVALID'});return n};
const iso=v=>v?.toISOString?.()||v||null;
const criteriaKeys=['q','category','era','country','material','technique','condition','location','purchaseMethod','seller','maker','objectId','priceMin','priceMax'];

export function normalizeDiscoveryCriteria(input={}){
 const out={};
 for(const key of criteriaKeys){
  let v=input?.[key];
  if(key==='priceMin'||key==='priceMax'){const n=num(v);if(n!=null)out[key]=n;continue}
  v=str(v);if(!v||v==='ALL')continue;if(v.length>240)throw Object.assign(new Error(`Discovery criterion ${key} is too long`),{status:400,code:'DISCOVERY_CRITERIA_INVALID'});out[key]=v
 }
 if(out.priceMin!=null&&out.priceMax!=null&&out.priceMin>out.priceMax)throw Object.assign(new Error('Discovery priceMin cannot exceed priceMax'),{status:400,code:'DISCOVERY_CRITERIA_INVALID'});
 return out
}
export function discoveryCriteriaHash(criteria={}){return crypto.createHash('sha256').update(JSON.stringify(normalizeDiscoveryCriteria(criteria))).digest('hex')}

function legacyTechniqueIds(term){
 const q=str(term).toLowerCase();if(!q)return[];
 return Object.entries(LEGACY_TECH).filter(([,x])=>JSON.stringify(x).toLowerCase().includes(q)).map(([id])=>id)
}
function snapshot(r){
 const p=r.passport||{},listing=r.listing_payload||null,auction=r.auction_state||null,methods=[];
 if(listing?.saleType)methods.push(listing.saleType);
 if(r.auction_id&&r.auction_ends_at&&new Date(r.auction_ends_at).getTime()>Date.now())methods.push('AUCTION');
 const price=listing?.price!=null?Number(listing.price):r.auction_current_bid!=null?Number(r.auction_current_bid):null;
 return{id:r.id,objectId:r.object_code||p.objectId||r.id,title:p.title||{},maker:p.maker||{},department:p.department||{},period:p.period||{},origin:p.origin||{},materials:p.materials||{},technique:p.technique||LEGACY_TECH[r.id]||bi('Specialist technique review pending','Техника ожидает проверки специалистом'),conditionGrade:p.conditionGrade||null,location:p.location||null,sellerId:r.listing_seller_id||r.object_seller_id||null,purchaseMethods:[...new Set(methods)],price:Number.isFinite(price)?price:null,currency:listing?.currency||auction?.currency||p.currency||'EUR',image:p.image||null}
}

export async function searchDiscoveryPostgres(criteria={}, {client=null,objectId=null,limit=100}={}){
 if(db.kind!=='POSTGRES')throw Object.assign(new Error('PostgreSQL discovery authority required'),{status:503,code:'DISCOVERY_POSTGRES_REQUIRED'});
 const cx=client||db.pool,c=normalizeDiscoveryCriteria(criteria),args=[],where=["o.publication_status='PUBLIC'"];
 const add=v=>{args.push(v);return '$'+args.length};
 const qText=`(coalesce(o.object_code,'')||' '||coalesce((o.passport->'title')::text,'')||' '||coalesce((o.passport->'maker')::text,'')||' '||coalesce((o.passport->'department')::text,'')||' '||coalesce((o.passport->'period')::text,'')||' '||coalesce((o.passport->'origin')::text,'')||' '||coalesce((o.passport->'materials')::text,'')||' '||coalesce((o.passport->'technique')::text,''))`;
 if(objectId)where.push(`o.id=${add(String(objectId))}`);
 if(c.objectId){const p=add(c.objectId);where.push(`(o.id=${p} OR o.object_code=${p})`)}
 if(c.q){
  const raw=add(c.q),pat=add(like(c.q)),legacy=legacyTechniqueIds(c.q),ids=legacy.length?add(legacy):null;
  where.push(`(to_tsvector('simple',${qText}) @@ plainto_tsquery('simple',${raw}) OR lower(${qText}) ILIKE '%'||lower(${pat})||'%' ESCAPE '\\'${ids?` OR o.id=ANY(${ids}::text[])`:''})`)
 }
 for(const [criterion,field] of Object.entries(TEXT_FIELDS)){
  if(!c[criterion])continue;
  const pat=add(like(c[criterion]));
  if(criterion==='technique'){const legacy=legacyTechniqueIds(c[criterion]),ids=legacy.length?add(legacy):null;where.push(`(lower(coalesce((o.passport->'${field}')::text,'')) ILIKE '%'||lower(${pat})||'%' ESCAPE '\\'${ids?` OR o.id=ANY(${ids}::text[])`:''})`)}
  else where.push(`lower(coalesce((o.passport->'${field}')::text,'')) ILIKE '%'||lower(${pat})||'%' ESCAPE '\\'`)
 }
 if(c.condition)where.push(`coalesce(o.passport->>'conditionGrade','')=${add(c.condition)}`);
 if(c.location)where.push(`coalesce(o.passport->>'location','')=${add(c.location)}`);
 if(c.seller)where.push(`coalesce(l.seller_id,o.seller_id,'')=${add(c.seller)}`);
 if(c.purchaseMethod){const p=add(c.purchaseMethod);where.push(`(coalesce(l.payload->>'saleType','')=${p} OR (${p}='AUCTION' AND a.id IS NOT NULL AND a.ends_at>clock_timestamp()))`)}
 const priceExpr=`coalesce(nullif(l.payload->>'price','')::numeric,a.current_bid::numeric)`;
 if(c.priceMin!=null)where.push(`(${priceExpr} IS NULL OR ${priceExpr}>=${add(c.priceMin)})`);
 if(c.priceMax!=null)where.push(`(${priceExpr} IS NULL OR ${priceExpr}<=${add(c.priceMax)})`);
 limit=Math.max(1,Math.min(MAX_RESULTS,Math.trunc(Number(limit)||100)));const lp=add(limit);
 const rows=(await cx.query(`SELECT o.id,o.object_code,o.seller_id AS object_seller_id,o.passport,
   l.id AS listing_id,l.seller_id AS listing_seller_id,l.payload AS listing_payload,
   a.id AS auction_id,a.status AS auction_status,a.current_bid AS auction_current_bid,a.ends_at AS auction_ends_at,a.state AS auction_state,
   count(*) OVER()::int AS match_count
   FROM objects o
   LEFT JOIN LATERAL (SELECT li.id,li.seller_id,li.payload FROM listings li WHERE li.object_id=o.id AND li.status IN ('ACTIVE','RESERVED') ORDER BY li.updated_at DESC,li.id LIMIT 1) l ON true
   LEFT JOIN LATERAL (SELECT au.id,au.status,au.current_bid,au.ends_at,au.state FROM auctions au WHERE au.object_id=o.id ORDER BY (au.ends_at>clock_timestamp()) DESC,au.updated_at DESC,au.id LIMIT 1) a ON true
   WHERE ${where.join(' AND ')}
   ORDER BY o.updated_at DESC,o.id
   LIMIT ${lp}`,args)).rows;
 return{criteria:c,total:Number(rows[0]?.match_count||0),matches:rows.map(snapshot)}
}

async function insertMatchTx(client,subscriptionId,objectId){
 return (await client.query(`INSERT INTO discovery_matches(subscription_id,object_id,matched_at,notified_at)
   VALUES($1,$2,now(),NULL) ON CONFLICT(subscription_id,object_id) DO NOTHING RETURNING subscription_id,object_id,matched_at`,[subscriptionId,objectId])).rows[0]||null
}
async function enqueueSummaryTx(client,s,hits,{reason='INITIAL'}={}){
 if(!hits.length)return null;const hash=discoveryCriteriaHash(s.criteria||{});
 return enqueueOutboxTx(client,{topic:'NOTIFICATION',aggregateType:'DISCOVERY_SUBSCRIPTION',aggregateId:s.id,idempotencyKey:`notification:discovery-summary:${s.id}:${hash}:${reason}`,payload:{accountId:s.accountId||s.account_id,type:'DISCOVERY_MATCHES',data:{subscriptionId:s.id,subscriptionType:s.subscriptionType||s.subscription_type,count:hits.length,objectIds:hits.slice(0,6).map(x=>x.id),label:s.label||{}},discoveryMatchSet:{subscriptionId:s.id,objectIds:hits.map(x=>x.id)}}})
}

export async function syncDiscoverySubscriptionTx(client,s,{reset=false,reason='INITIAL'}={}){
 if(reset)await client.query('DELETE FROM discovery_matches WHERE subscription_id=$1',[s.id]);
 if(String(s.status||'ACTIVE')!=='ACTIVE')return{total:0,matches:[],inserted:0};
 const result=await searchDiscoveryPostgres(s.criteria||{},{client,limit:MAX_RESULTS}),inserted=[];
 for(const hit of result.matches)if(await insertMatchTx(client,s.id,hit.id))inserted.push(hit);
 if(inserted.length)await enqueueSummaryTx(client,s,inserted,{reason});
 return{...result,inserted:inserted.length}
}

export async function matchDiscoveryObjectTx(client,objectId){
 const exists=(await client.query("SELECT id FROM objects WHERE id=$1 AND publication_status='PUBLIC'",[String(objectId)])).rows[0];
 if(!exists)return{checked:0,matched:0,inserted:0,notifications:0,reason:'OBJECT_NOT_PUBLIC'};
 const subs=(await client.query("SELECT id,account_id,subscription_type,label,criteria,status FROM discovery_subscriptions WHERE status='ACTIVE' ORDER BY updated_at,id")).rows;
 let matched=0,inserted=0,notifications=0;
 for(const s of subs){
  const hit=await searchDiscoveryPostgres(s.criteria||{},{client,objectId,limit:1});if(!hit.total)continue;matched++;
  const row=await insertMatchTx(client,s.id,objectId);if(!row)continue;inserted++;
  const out=await enqueueOutboxTx(client,{topic:'NOTIFICATION',aggregateType:'DISCOVERY_MATCH',aggregateId:`${s.id}:${objectId}`,idempotencyKey:`notification:discovery-match:${s.id}:${objectId}`,payload:{accountId:s.account_id,type:'DISCOVERY_MATCH',data:{subscriptionId:s.id,subscriptionType:s.subscription_type,objectId,label:s.label||{}},discoveryMatch:{subscriptionId:s.id,objectId}}});if(!out.idempotent)notifications++
 }
 return{checked:subs.length,matched,inserted,notifications}
}

export async function notifyDiscoveryForObjectPostgres(objectId){
 if(db.kind!=='POSTGRES')return{checked:0,matched:0,inserted:0,notifications:0,reason:'POSTGRES_REQUIRED'};
 const cx=await db.pool.connect();try{await cx.query('BEGIN');const result=await matchDiscoveryObjectTx(cx,objectId);await cx.query('COMMIT');return result}catch(e){try{await cx.query('ROLLBACK')}catch{}throw e}finally{cx.release()}
}

export async function markDiscoveryNotificationDeliveredTx(client,payload={}){
 const one=payload.discoveryMatch,set=payload.discoveryMatchSet;
 if(one?.subscriptionId&&one?.objectId){const r=await client.query('UPDATE discovery_matches SET notified_at=coalesce(notified_at,now()) WHERE subscription_id=$1 AND object_id=$2 RETURNING subscription_id',[String(one.subscriptionId),String(one.objectId)]);return r.rowCount}
 if(set?.subscriptionId&&Array.isArray(set.objectIds)&&set.objectIds.length){const ids=[...new Set(set.objectIds.map(String).filter(Boolean))];if(!ids.length)return 0;const r=await client.query('UPDATE discovery_matches SET notified_at=coalesce(notified_at,now()) WHERE subscription_id=$1 AND object_id=ANY($2::text[]) RETURNING subscription_id',[String(set.subscriptionId),ids]);return r.rowCount}
 return 0
}

export function discoveryPostgresCapabilities(){return{postgresAuthority:db.kind==='POSTGRES',fullText:'POSTGRES_TSVECTOR',trigram:'PG_TRGM',criteria:criteriaKeys,publicObjectsOnly:true,commerceFromPostgres:true,durableMatches:true,notificationOutbox:true}}
