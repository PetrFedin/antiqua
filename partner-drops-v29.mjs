import {db,now} from './runtime-v09.mjs';
import {getExhibition} from './collection-graph-v10.mjs';
import {canReadExhibition} from './access-policy.mjs';
import {enqueueOutboxTx} from './outbox-v15.mjs';

const memoryFollows=new Map();
export const DROP_FORMATS=Object.freeze(['CURATED_DROP','PARTNER_FAIR','GALLERY_SHOW','ARTIST_LAUNCH','EDITION']);
const clone=x=>x==null?x:structuredClone(x);
const key=(exhibitionId,accountId)=>String(exhibitionId)+'|'+String(accountId);
const fail=(status,code,message)=>{const e=new Error(message);e.status=status;e.code=code;throw e};
const iso=v=>v?.toISOString?.()||v||null;

export function partnerDropCapabilities(){return{contractVersion:'v29',formats:DROP_FORMATS,stages:['PREVIEW','LIVE','ARCHIVED'],publicScheduledPreview:true,followAuthority:'exhibition_follows',releaseNotification:'POSTGRES_OUTBOX',availabilityAuthority:'OBJECT_COMMERCE',fakeScarcityAllowed:false,archivePersists:true,externalPartnerClaimsRequireAgreement:true}}

function normalizedMeta(exhibition){
 const raw=exhibition?.metadata?.drop||{},format=DROP_FORMATS.includes(String(raw.format||'').toUpperCase())?String(raw.format).toUpperCase():'CURATED_DROP';
 return{format,partner:raw.partner&&typeof raw.partner==='object'?clone(raw.partner):null,curator:raw.curator&&typeof raw.curator==='object'?clone(raw.curator):null,access:['PUBLIC','FOLLOWERS_FIRST','INVITE_PREVIEW'].includes(String(raw.access||''))?String(raw.access):'PUBLIC',coBranded:raw.coBranded===true,theme:raw.theme||null,previewAt:raw.previewAt||null,releaseAt:raw.releaseAt||exhibition?.startsAt||null,salesCloseAt:raw.salesCloseAt||null,archiveAt:raw.archiveAt||exhibition?.endsAt||null,ctaMode:['DISCOVER','SHOP','RSVP'].includes(String(raw.ctaMode||''))?String(raw.ctaMode):'DISCOVER'}
}
export function dropStage(exhibition){const s=String(exhibition?.status||'').toUpperCase();if(['ARCHIVED','CLOSED'].includes(s))return'ARCHIVED';if(s==='LIVE')return'LIVE';return'PREVIEW'}

async function followStats(exhibitionId,accountId=null){
 if(db.kind==='POSTGRES'){const count=Number((await db.pool.query("SELECT count(*)::int AS n FROM exhibition_follows WHERE exhibition_id=$1 AND status='ACTIVE'",[exhibitionId])).rows[0]?.n||0);let following=false;if(accountId)following=(await db.pool.query("SELECT 1 FROM exhibition_follows WHERE exhibition_id=$1 AND account_id=$2 AND status='ACTIVE'",[exhibitionId,accountId])).rowCount>0;return{count,following}}
 let count=0,following=false;for(const f of memoryFollows.values())if(f.exhibitionId===exhibitionId&&f.status==='ACTIVE'){count++;if(f.accountId===accountId)following=true}return{count,following}
}

export async function partnerDropProjection(exhibition,accountId=null){const meta=normalizedMeta(exhibition),follow=await followStats(exhibition.id,accountId);return{exhibitionId:exhibition.id,stage:dropStage(exhibition),...meta,follow,startsAt:iso(exhibition.startsAt),endsAt:iso(exhibition.endsAt),status:exhibition.status,visibility:exhibition.visibility}}

export async function getPartnerDrop(account,id){const e=await getExhibition(id);if(!e)return null;const owner=Boolean(account?.id&&(e.ownerAccountId===account.id||account.roles?.includes('ADMIN')));if(!canReadExhibition(e,{owner}))return null;return{exhibition:e,drop:await partnerDropProjection(e,account?.id||null)}}

export async function setExhibitionFollow(account,id,enabled=true){
 const e=await getExhibition(id);if(!e)fail(404,'EXHIBITION_NOT_FOUND','Exhibition not found');const owner=e.ownerAccountId===account.id||account.roles?.includes('ADMIN');if(!canReadExhibition(e,{owner}))fail(404,'EXHIBITION_NOT_FOUND','Exhibition not found');
 const status=enabled===false?'ARCHIVED':'ACTIVE',updatedAt=now();
 if(db.kind==='POSTGRES'){await db.pool.query(`INSERT INTO exhibition_follows(exhibition_id,account_id,status,created_at,updated_at) VALUES($1,$2,$3,$4,$4) ON CONFLICT(exhibition_id,account_id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at`,[id,account.id,status,updatedAt])}
 else{const k=key(id,account.id),prior=memoryFollows.get(k);memoryFollows.set(k,{exhibitionId:id,accountId:account.id,status,createdAt:prior?.createdAt||updatedAt,updatedAt})}
 return{exhibitionId:id,enabled:status==='ACTIVE',follow:await followStats(id,account.id)}
}

function assertOwner(account,row){if(!row)fail(404,'EXHIBITION_NOT_FOUND','Exhibition not found');if(row.owner_account_id!==account.id&&!account.roles?.includes('ADMIN'))fail(403,'DROP_OWNER_REQUIRED','Exhibition owner or administrator required')}

export async function transitionPartnerDrop(account,id,nextStatus){
 nextStatus=String(nextStatus||'').toUpperCase();if(!['LIVE','ARCHIVED'].includes(nextStatus))fail(400,'DROP_TRANSITION_INVALID','Only LIVE or ARCHIVED transitions are supported');
 if(db.kind!=='POSTGRES')fail(503,'DROP_RELEASE_PERSISTENCE_REQUIRED','Durable PostgreSQL authority is required for partner drop transitions');
 const cx=await db.pool.connect();try{await cx.query('BEGIN');const row=(await cx.query('SELECT * FROM exhibitions WHERE id=$1 FOR UPDATE',[id])).rows[0];assertOwner(account,row);
  const current=String(row.status||'').toUpperCase();if(nextStatus==='LIVE'&&!['SCHEDULED','LIVE'].includes(current))fail(409,'DROP_RELEASE_STATE_INVALID','Only a scheduled drop can go live');if(nextStatus==='ARCHIVED'&&!['LIVE','ARCHIVED','CLOSED'].includes(current))fail(409,'DROP_ARCHIVE_STATE_INVALID','Only a live or closed drop can be archived');
  const changed=current!==nextStatus;if(changed){await cx.query(`UPDATE exhibitions SET status=$2,starts_at=CASE WHEN $2='LIVE' THEN coalesce(starts_at,now()) ELSE starts_at END,ends_at=CASE WHEN $2='ARCHIVED' THEN coalesce(ends_at,now()) ELSE ends_at END,updated_at=now() WHERE id=$1`,[id,nextStatus]);
   if(nextStatus==='LIVE'){const followers=(await cx.query("SELECT account_id FROM exhibition_follows WHERE exhibition_id=$1 AND status='ACTIVE'",[id])).rows;for(const f of followers)await enqueueOutboxTx(cx,{topic:'NOTIFICATION',aggregateType:'EXHIBITION',aggregateId:id,idempotencyKey:`notification:partner-drop-live:${id}:${f.account_id}`,payload:{accountId:f.account_id,type:'PARTNER_DROP_LIVE',data:{exhibitionId:id,title:row.title,format:normalizedMeta({metadata:row.metadata}).format}}})}}
  await cx.query('COMMIT');const fresh=await getExhibition(id);return{changed,exhibition:fresh,drop:await partnerDropProjection(fresh,account.id)}
 }catch(e){try{await cx.query('ROLLBACK')}catch{}throw e}finally{cx.release()}
}
