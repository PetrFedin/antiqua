import crypto from 'node:crypto';
import {enqueueOutboxTx} from './outbox-v15.mjs';

const id=()=>`lce-${crypto.randomUUID().replaceAll('-','').slice(0,24)}`;
const mapEvent=r=>r?{id:r.id,contractVersion:r.contract_version,domain:r.domain,aggregateId:r.aggregate_id,action:r.action,from:r.from_state,to:r.to_state,authority:r.authority,auditAction:r.audit_action,outboxTopic:r.outbox_topic,sourceKey:r.source_key,metadata:r.metadata||{},createdAt:r.created_at?.toISOString?.()||r.created_at}:null;

export async function findLifecycleEventBySourceTx(client,{domain,aggregateId,sourceKey}){
  if(!client?.query||sourceKey==null)return null;const row=(await client.query('SELECT * FROM lifecycle_events WHERE domain=$1 AND aggregate_id=$2 AND source_key=$3',[String(domain).toUpperCase(),String(aggregateId),String(sourceKey)])).rows[0];return mapEvent(row)
}

export async function recordLifecycleTransitionTx(client,{plan,aggregateId,metadata={},sourceKey=null}){
  if(!client?.query)throw new Error('PostgreSQL transaction client required');
  if(!plan?.domain||!plan?.action||!plan?.from||!plan?.to)throw new Error('Lifecycle plan required');
  aggregateId=String(aggregateId||'').trim();if(!aggregateId)throw new Error('Lifecycle aggregate id required');
  sourceKey=sourceKey==null?null:String(sourceKey);
  const eventId=id(),inserted=(await client.query(`INSERT INTO lifecycle_events(
    id,contract_version,domain,aggregate_id,action,from_state,to_state,authority,audit_action,outbox_topic,source_key,metadata,created_at
  ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())
  ON CONFLICT DO NOTHING RETURNING *`,[
    eventId,plan.contractVersion,plan.domain,aggregateId,plan.action,plan.from,plan.to,plan.authority,plan.auditAction,plan.outboxTopic,sourceKey,metadata
  ])).rows[0];
  let event=inserted;
  if(!event&&sourceKey){event=(await client.query('SELECT * FROM lifecycle_events WHERE domain=$1 AND aggregate_id=$2 AND source_key=$3',[plan.domain,aggregateId,sourceKey])).rows[0]}
  if(!event)throw Object.assign(new Error('Lifecycle event conflict could not be resolved'),{status:409,code:'LIFECYCLE_EVENT_CONFLICT'});
  const same=event.contract_version===plan.contractVersion&&event.action===plan.action&&event.from_state===plan.from&&event.to_state===plan.to&&event.authority===plan.authority&&event.audit_action===plan.auditAction&&event.outbox_topic===plan.outboxTopic;
  if(!same)throw Object.assign(new Error('Lifecycle source key belongs to a different transition'),{status:409,code:'LIFECYCLE_EVENT_CONFLICT'});
  const outbox=await enqueueOutboxTx(client,{topic:plan.outboxTopic,aggregateType:plan.domain,aggregateId,payload:{kind:'LIFECYCLE_TRANSITION',lifecycleEventId:event.id,contractVersion:plan.contractVersion,domain:plan.domain,aggregateId,action:plan.action,from:plan.from,to:plan.to,authority:plan.authority,auditAction:plan.auditAction,metadata},idempotencyKey:sourceKey?`lifecycle:${plan.domain}:${aggregateId}:${sourceKey}`:null});
  return{event:mapEvent(event),outbox};
}

export async function listLifecycleEvents(db,{domain,aggregateId,limit=100}={}){
  if(db?.kind!=='POSTGRES')return[];const args=[],where=[];if(domain){args.push(String(domain).toUpperCase());where.push(`domain=$${args.length}`)}if(aggregateId){args.push(String(aggregateId));where.push(`aggregate_id=$${args.length}`)}args.push(Math.max(1,Math.min(500,Math.trunc(Number(limit)||100))));const rows=(await db.pool.query(`SELECT * FROM lifecycle_events${where.length?' WHERE '+where.join(' AND '):''} ORDER BY created_at DESC,id DESC LIMIT $${args.length}`,args)).rows;return rows.map(mapEvent)
}
