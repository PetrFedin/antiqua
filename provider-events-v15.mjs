import {db,uid,now} from './runtime-v09.mjs';
import {providerWebhookSecurityCapabilities} from './provider-webhook-security-v15.mjs';

const memory=new Map();
const CLAIM_TTL_MS=Number(process.env.PROVIDER_EVENT_CLAIM_TTL_MS||120000);
const keyOf=(provider,externalEventId)=>`${provider}|${externalEventId}`;
const iso=v=>v?.toISOString?.()||v||null;
const mapEvent=r=>r?{
  id:r.id,
  providerType:r.provider_type??r.providerType,
  provider:r.provider,
  externalEventId:r.external_event_id??r.externalEventId,
  eventType:r.event_type??r.eventType,
  entityType:r.entity_type??r.entityType??null,
  entityId:r.entity_id??r.entityId??null,
  payload:r.payload||{},
  processedAt:iso(r.processed_at??r.processedAt),
  processingStartedAt:iso(r.processing_started_at??r.processingStartedAt),
  attemptCount:Number(r.attempt_count??r.attemptCount??0),
  lastError:r.last_error??r.lastError??null,
  createdAt:iso(r.created_at??r.createdAt)
}:null;

export async function claimProviderEvent({providerType,provider,externalEventId,eventType,entityType=null,entityId=null,payload={}}){
  if(!externalEventId)throw Object.assign(new Error('External event id required'),{status:400,code:'EXTERNAL_EVENT_ID_REQUIRED'});
  provider=String(provider||'NOT_CONFIGURED');externalEventId=String(externalEventId);
  if(db.kind!=='POSTGRES'){
    const key=keyOf(provider,externalEventId),ts=Date.now();let e=memory.get(key);
    if(!e){e={id:uid('pev'),providerType,provider,externalEventId,eventType,entityType,entityId,payload,processedAt:null,processingStartedAt:new Date(ts).toISOString(),attemptCount:1,lastError:null,createdAt:now()};memory.set(key,e);return{event:structuredClone(e),claimed:true,idempotent:false,processed:false}}
    if(e.processedAt)return{event:structuredClone(e),claimed:false,idempotent:true,processed:true};
    const started=e.processingStartedAt?Date.parse(e.processingStartedAt):0;if(started&&ts-started<CLAIM_TTL_MS)return{event:structuredClone(e),claimed:false,idempotent:true,processed:false,processing:true};
    e.processingStartedAt=new Date(ts).toISOString();e.attemptCount+=1;e.lastError=null;return{event:structuredClone(e),claimed:true,idempotent:true,processed:false,recovered:true};
  }
  const cx=await db.pool.connect();
  try{
    await cx.query('BEGIN');
    const inserted=(await cx.query(`INSERT INTO provider_events(id,provider_type,provider,external_event_id,event_type,entity_type,entity_id,payload,processed_at,processing_started_at,attempt_count,last_error,created_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,NULL,now(),1,NULL,now())
      ON CONFLICT(provider,external_event_id) DO NOTHING RETURNING *`,[uid('pev'),providerType,provider,externalEventId,eventType,entityType,entityId,payload])).rows[0];
    if(inserted){await cx.query('COMMIT');return{event:mapEvent(inserted),claimed:true,idempotent:false,processed:false}}
    let row=(await cx.query('SELECT * FROM provider_events WHERE provider=$1 AND external_event_id=$2 FOR UPDATE',[provider,externalEventId])).rows[0];
    if(row.processed_at){await cx.query('COMMIT');return{event:mapEvent(row),claimed:false,idempotent:true,processed:true}}
    const started=row.processing_started_at?.getTime?.()||0;if(started&&Date.now()-started<CLAIM_TTL_MS){await cx.query('COMMIT');return{event:mapEvent(row),claimed:false,idempotent:true,processed:false,processing:true}}
    row=(await cx.query(`UPDATE provider_events SET processing_started_at=now(),attempt_count=attempt_count+1,last_error=NULL
      WHERE provider=$1 AND external_event_id=$2 AND processed_at IS NULL RETURNING *`,[provider,externalEventId])).rows[0];
    await cx.query('COMMIT');return{event:mapEvent(row),claimed:true,idempotent:true,processed:false,recovered:true};
  }catch(e){try{await cx.query('ROLLBACK')}catch{}throw e}finally{cx.release()}
}

export async function markProviderEventProcessed(provider,externalEventId){
  provider=String(provider);externalEventId=String(externalEventId);
  if(db.kind!=='POSTGRES'){const e=memory.get(keyOf(provider,externalEventId));if(!e)return null;e.processedAt=now();e.processingStartedAt=null;e.lastError=null;return structuredClone(e)}
  const row=(await db.pool.query(`UPDATE provider_events SET processed_at=now(),processing_started_at=NULL,last_error=NULL
    WHERE provider=$1 AND external_event_id=$2 RETURNING *`,[provider,externalEventId])).rows[0];return mapEvent(row);
}

export async function markProviderEventFailed(provider,externalEventId,error){
  provider=String(provider);externalEventId=String(externalEventId);const message=String(error?.message||error||'Provider event application failed').slice(0,1000);
  if(db.kind!=='POSTGRES'){const e=memory.get(keyOf(provider,externalEventId));if(!e)return null;e.processingStartedAt=null;e.lastError=message;return structuredClone(e)}
  const row=(await db.pool.query(`UPDATE provider_events SET processing_started_at=NULL,last_error=$3
    WHERE provider=$1 AND external_event_id=$2 AND processed_at IS NULL RETURNING *`,[provider,externalEventId,message])).rows[0];return mapEvent(row);
}

export function providerEventCapabilities(){return{durableClaims:db.kind==='POSTGRES',recoverableApplication:true,claimTtlMs:CLAIM_TTL_MS,webhookSecurity:providerWebhookSecurityCapabilities()}}
