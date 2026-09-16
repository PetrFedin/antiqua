import crypto from 'node:crypto';

const uid=()=>`out-${crypto.randomUUID().replaceAll('-','').slice(0,20)}`;
const iso=v=>v?.toISOString?.()||v||null;
const mapRow=r=>r?{id:r.id,topic:r.topic,aggregateType:r.aggregate_type??r.aggregateType??null,aggregateId:r.aggregate_id??r.aggregateId??null,payload:r.payload||{},idempotencyKey:r.idempotency_key??r.idempotencyKey??null,status:r.status,availableAt:iso(r.available_at??r.availableAt),lockedAt:iso(r.locked_at??r.lockedAt),lockedBy:r.locked_by??r.lockedBy??null,attemptCount:Number(r.attempt_count??r.attemptCount??0),maxAttempts:Number(r.max_attempts??r.maxAttempts??12),lastError:r.last_error??r.lastError??null,createdAt:iso(r.created_at??r.createdAt),processedAt:iso(r.processed_at??r.processedAt)}:null;
const conflict=message=>Object.assign(new Error(message),{status:409,code:'OUTBOX_IDEMPOTENCY_CONFLICT'});

export async function enqueueOutboxTx(client,{topic,aggregateType=null,aggregateId=null,payload={},idempotencyKey=null,availableAt=null,maxAttempts=12}){
  topic=String(topic||'').trim().toUpperCase();if(!topic)throw Object.assign(new Error('Outbox topic required'),{status:400,code:'OUTBOX_TOPIC_REQUIRED'});
  aggregateType=aggregateType==null?null:String(aggregateType).toUpperCase();aggregateId=aggregateId==null?null:String(aggregateId);idempotencyKey=idempotencyKey==null?null:String(idempotencyKey);maxAttempts=Math.max(1,Math.trunc(Number(maxAttempts)||12));
  const id=uid(),inserted=(await client.query(`INSERT INTO outbox_events(id,topic,aggregate_type,aggregate_id,payload,idempotency_key,status,available_at,max_attempts,created_at)
    VALUES($1,$2,$3,$4,$5,$6,'PENDING',COALESCE($7::timestamptz,now()),$8,now()) ON CONFLICT DO NOTHING RETURNING *`,[id,topic,aggregateType,aggregateId,payload,idempotencyKey,availableAt,maxAttempts])).rows[0];
  if(inserted)return{...mapRow(inserted),idempotent:false};
  if(!idempotencyKey)throw conflict('Outbox insert conflicted without idempotency key');
  const existing=(await client.query(`SELECT *,topic=$2 AND aggregate_type IS NOT DISTINCT FROM $3 AND aggregate_id IS NOT DISTINCT FROM $4 AND payload=$5::jsonb AS same_effect
    FROM outbox_events WHERE idempotency_key=$1`,[idempotencyKey,topic,aggregateType,aggregateId,payload])).rows[0];
  if(!existing)throw conflict('Outbox idempotency conflict could not be resolved');if(!existing.same_effect)throw conflict('Outbox idempotency key belongs to a different effect');return{...mapRow(existing),idempotent:true};
}

export async function enqueueOutbox(db,event){
  if(db?.kind!=='POSTGRES')return{...event,id:`preview-${uid()}`,status:'PENDING',persistent:false,idempotent:false};
  return enqueueOutboxTx(db.pool,event);
}

export async function claimOutboxBatch(db,{workerId,limit=25,leaseMs=120000}={}){
  if(db?.kind!=='POSTGRES')return[];workerId=String(workerId||'worker');limit=Math.max(1,Math.min(100,Math.trunc(Number(limit)||25)));leaseMs=Math.max(1000,Math.trunc(Number(leaseMs)||120000));
  const c=await db.pool.connect();try{
    await c.query('BEGIN');
    await c.query(`UPDATE outbox_events SET status=CASE WHEN attempt_count>=max_attempts THEN 'DEAD' ELSE 'PENDING' END,locked_at=NULL,locked_by=NULL,
      available_at=CASE WHEN attempt_count>=max_attempts THEN available_at ELSE now() END,last_error=COALESCE(last_error,'Worker lease expired')
      WHERE status='PROCESSING' AND locked_at < now()-($1::bigint * interval '1 millisecond')`,[leaseMs]);
    const rows=(await c.query(`WITH picked AS (
      SELECT id FROM outbox_events WHERE status='PENDING' AND available_at<=now() ORDER BY available_at,created_at,id FOR UPDATE SKIP LOCKED LIMIT $1
    ) UPDATE outbox_events o SET status='PROCESSING',locked_at=now(),locked_by=$2,attempt_count=o.attempt_count+1,last_error=NULL
      FROM picked WHERE o.id=picked.id RETURNING o.*`,[limit,workerId])).rows;
    await c.query('COMMIT');return rows.map(mapRow);
  }catch(e){try{await c.query('ROLLBACK')}catch{}throw e}finally{c.release()}
}

export async function completeOutboxEvent(db,id,workerId){
  if(db?.kind!=='POSTGRES')return null;const row=(await db.pool.query(`UPDATE outbox_events SET status='COMPLETED',processed_at=now(),locked_at=NULL,locked_by=NULL,last_error=NULL
    WHERE id=$1 AND status='PROCESSING' AND locked_by=$2 RETURNING *`,[id,String(workerId)])).rows[0];if(!row)throw Object.assign(new Error('Outbox event is not owned by worker'),{status:409,code:'OUTBOX_LEASE_LOST'});return mapRow(row);
}

export async function failOutboxEvent(db,id,workerId,error,{baseDelayMs=1000}={}){
  if(db?.kind!=='POSTGRES')return null;const message=String(error?.message||error||'Outbox handler failed').slice(0,2000),row0=(await db.pool.query('SELECT attempt_count,max_attempts FROM outbox_events WHERE id=$1 AND status=$2 AND locked_by=$3',[id,'PROCESSING',String(workerId)])).rows[0];if(!row0)throw Object.assign(new Error('Outbox event is not owned by worker'),{status:409,code:'OUTBOX_LEASE_LOST'});const dead=Number(row0.attempt_count)>=Number(row0.max_attempts),delay=Math.min(300000,Math.max(0,Math.trunc(Number(baseDelayMs)||1000))*Math.max(1,2**Math.min(8,Number(row0.attempt_count)-1)));const row=(await db.pool.query(`UPDATE outbox_events SET status=$3,locked_at=NULL,locked_by=NULL,last_error=$4,
    available_at=CASE WHEN $3='DEAD' THEN available_at ELSE now()+($5::bigint * interval '1 millisecond') END WHERE id=$1 AND status='PROCESSING' AND locked_by=$2 RETURNING *`,[id,String(workerId),dead?'DEAD':'PENDING',message,delay])).rows[0];return mapRow(row);
}

export async function outboxStats(db){
  if(db?.kind!=='POSTGRES')return{persistent:false};const rows=(await db.pool.query('SELECT status,count(*)::int AS count FROM outbox_events GROUP BY status')).rows;return{persistent:true,byStatus:Object.fromEntries(rows.map(r=>[r.status,r.count])),oldestPendingAt:iso((await db.pool.query("SELECT min(created_at) AS t FROM outbox_events WHERE status='PENDING'")).rows[0]?.t)};
}
