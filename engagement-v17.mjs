import crypto from 'node:crypto';
import {appSecret} from './security-v09.mjs';

const WINDOW_MS=30*60*1000;
const STAFF_ROLES=new Set(['ADMIN','TRUST_REVIEWER','CATALOGUER']);
const memory=new Map();
const iso=v=>v?.toISOString?.()||v||null;
const hmac=value=>crypto.createHmac('sha256',appSecret()).update(String(value)).digest('hex');
const windowStart=at=>new Date(Math.floor(Number(at)/WINDOW_MS)*WINDOW_MS).toISOString();
const dayKey=at=>new Date(Number(at)).toISOString().slice(0,10);
const clientIp=req=>String(req?.headers?.['x-forwarded-for']||req?.socket?.remoteAddress||'unknown').split(',')[0].trim();
const userAgent=req=>String(req?.headers?.['user-agent']||'').slice(0,300);
const isPrefetch=req=>/prefetch/i.test(String(req?.headers?.['sec-purpose']||req?.headers?.purpose||''));
const isBot=req=>/(bot|crawler|spider|slurp)/i.test(userAgent(req));

async function sellerForObject(db,objectId,provided){
 if(provided)return provided;
 if(db.kind!=='POSTGRES')return null;
 return (await db.pool.query('SELECT seller_id FROM objects WHERE id=$1',[objectId])).rows[0]?.seller_id||null;
}
function viewerHash(req,account,objectId,at){
 const identity=account?.id?'account:'+account.id:'anonymous:'+dayKey(at)+':'+clientIp(req)+':'+userAgent(req);
 return hmac(identity+'|object:'+objectId);
}
function publicRow(r){return{objectId:r.object_id??r.objectId,accountId:r.account_id??r.accountId??null,firstViewedAt:iso(r.first_viewed_at??r.firstViewedAt),lastViewedAt:iso(r.last_viewed_at??r.lastViewedAt),windowStartedAt:iso(r.window_started_at??r.windowStartedAt),source:r.source||'PASSPORT'}}

export function engagementCapabilities(){
 return{passportViews:true,recentlyViewed:true,windowMinutes:WINDOW_MS/60000,anonymousRawIdentifiersStored:false,sellerViewerIdentityExposed:false};
}

export async function recordObjectView(db,req,account,objectId,{at=Date.now(),ownerSellerId=null}={}){
 objectId=String(objectId||'');
 if(!objectId)return{recorded:false,reason:'OBJECT_REQUIRED'};
 if(isPrefetch(req))return{recorded:false,reason:'PREFETCH'};
 if(isBot(req))return{recorded:false,reason:'BOT'};
 if(account?.roles?.some(r=>STAFF_ROLES.has(String(r).toUpperCase())))return{recorded:false,reason:'STAFF'};
 const sellerId=await sellerForObject(db,objectId,ownerSellerId);
 if(account?.sellerId&&sellerId&&String(account.sellerId)===String(sellerId))return{recorded:false,reason:'SELF_SELLER'};
 const win=windowStart(at),viewedAt=new Date(Number(at)).toISOString(),viewerKeyHash=viewerHash(req,account,objectId,at),accountId=account?.id||null;
 if(db.kind==='POSTGRES'){
  const row=(await db.pool.query("INSERT INTO object_view_events(id,object_id,account_id,viewer_key_hash,window_started_at,first_viewed_at,last_viewed_at,source) VALUES($1,$2,$3,$4,$5,$6,$6,'PASSPORT') ON CONFLICT(object_id,viewer_key_hash,window_started_at) DO UPDATE SET last_viewed_at=GREATEST(object_view_events.last_viewed_at,excluded.last_viewed_at), account_id=COALESCE(object_view_events.account_id,excluded.account_id) RETURNING *",['view-'+crypto.randomUUID().replaceAll('-','').slice(0,18),objectId,accountId,viewerKeyHash,win,viewedAt])).rows[0];
  return{recorded:true,view:publicRow(row)};
 }
 const key=objectId+'|'+viewerKeyHash+'|'+win,prior=memory.get(key);
 if(prior){prior.lastViewedAt=viewedAt;if(!prior.accountId&&accountId)prior.accountId=accountId;return{recorded:true,deduplicated:true,view:publicRow(prior)}}
 const row={id:'view-'+crypto.randomUUID().replaceAll('-','').slice(0,18),objectId,accountId,viewerKeyHash,windowStartedAt:win,firstViewedAt:viewedAt,lastViewedAt:viewedAt,source:'PASSPORT'};memory.set(key,row);
 return{recorded:true,deduplicated:false,view:publicRow(row)};
}

export async function aggregateObjectViews(db,objectIds,{excludeAccountId=null}={}){
 const ids=[...new Set((objectIds||[]).map(String).filter(Boolean))],out={};
 for(const id of ids)out[id]={views:0,firstViewedAt:null,lastViewedAt:null};
 if(!ids.length)return out;
 if(db.kind==='POSTGRES'){
  const rows=(await db.pool.query("SELECT object_id,count(*)::int AS views,min(first_viewed_at) AS first_viewed_at,max(last_viewed_at) AS last_viewed_at FROM object_view_events WHERE object_id=ANY($1::text[]) AND ($2::text IS NULL OR account_id IS DISTINCT FROM $2) GROUP BY object_id",[ids,excludeAccountId])).rows;
  for(const r of rows)out[r.object_id]={views:Number(r.views||0),firstViewedAt:iso(r.first_viewed_at),lastViewedAt:iso(r.last_viewed_at)};
  return out
 }
 const wanted=new Set(ids);
 for(const row of memory.values()){
  if(!wanted.has(row.objectId)||(excludeAccountId&&row.accountId===excludeAccountId))continue;
  const x=out[row.objectId];x.views++;if(!x.firstViewedAt||row.firstViewedAt<x.firstViewedAt)x.firstViewedAt=row.firstViewedAt;if(!x.lastViewedAt||row.lastViewedAt>x.lastViewedAt)x.lastViewedAt=row.lastViewedAt;
 }
 return out;
}

export async function listRecentlyViewed(db,accountId,{limit=12}={}){
 accountId=String(accountId||'');if(!accountId)return[];
 limit=Math.max(1,Math.min(50,Number(limit)||12));
 if(db.kind==='POSTGRES'){
  const rows=(await db.pool.query('SELECT object_id,max(last_viewed_at) AS last_viewed_at,count(*)::int AS sessions FROM object_view_events WHERE account_id=$1 GROUP BY object_id ORDER BY max(last_viewed_at) DESC LIMIT $2',[accountId,limit])).rows;
  return rows.map(r=>({objectId:r.object_id,lastViewedAt:iso(r.last_viewed_at),sessions:Number(r.sessions||0)}));
 }
 const grouped=new Map();
 for(const row of memory.values())if(row.accountId===accountId){const prev=grouped.get(row.objectId);if(!prev)grouped.set(row.objectId,{objectId:row.objectId,lastViewedAt:row.lastViewedAt,sessions:1});else{prev.sessions++;if(row.lastViewedAt>prev.lastViewedAt)prev.lastViewedAt=row.lastViewedAt}}
 return[...grouped.values()].sort((a,b)=>b.lastViewedAt.localeCompare(a.lastViewedAt)).slice(0,limit);
}


export async function clearRecentlyViewed(db,accountId){
 accountId=String(accountId||'');if(!accountId)return 0;
 if(db.kind==='POSTGRES')return (await db.pool.query('DELETE FROM object_view_events WHERE account_id=$1',[accountId])).rowCount;
 let count=0;for(const [key,row] of memory)if(row.accountId===accountId){memory.delete(key);count++}return count;
}
