import crypto from 'node:crypto';
import {db} from './runtime-v09.mjs';
import {settleDueAuctions} from './domain-e2e-v14.mjs';
import {runOperationalSweeps} from './sweeps-v14.mjs';
import {claimOutboxBatch,failOutboxEvent,outboxStats} from './outbox-v15.mjs';

const SCHEDULE_LOCK_KEY=4815162501;
const notificationId=()=>`notif-${crypto.randomUUID().replaceAll('-','').slice(0,20)}`;

async function deliverNotification(event,workerId){
  const accountId=String(event.payload?.accountId||''),type=String(event.payload?.type||'').trim().toUpperCase(),payload=event.payload?.data||{};
  if(!accountId||!type)throw Object.assign(new Error('Notification outbox payload is incomplete'),{code:'INVALID_NOTIFICATION_OUTBOX'});
  const c=await db.pool.connect();try{
    await c.query('BEGIN');
    const owned=(await c.query("SELECT id FROM outbox_events WHERE id=$1 AND status='PROCESSING' AND locked_by=$2 FOR UPDATE",[event.id,String(workerId)])).rows[0];
    if(!owned)throw Object.assign(new Error('Outbox event is not owned by worker'),{code:'OUTBOX_LEASE_LOST'});
    await c.query(`INSERT INTO notifications(id,account_id,type,payload,source_outbox_id,created_at)
      VALUES($1,$2,$3,$4,$5,now()) ON CONFLICT DO NOTHING`,[notificationId(),accountId,type,payload,event.id]);
    const completed=(await c.query(`UPDATE outbox_events SET status='COMPLETED',processed_at=now(),locked_at=NULL,locked_by=NULL,last_error=NULL
      WHERE id=$1 AND status='PROCESSING' AND locked_by=$2 RETURNING id`,[event.id,String(workerId)])).rows[0];
    if(!completed)throw Object.assign(new Error('Outbox lease was lost before completion'),{code:'OUTBOX_LEASE_LOST'});
    await c.query('COMMIT');return{eventId:event.id,topic:event.topic,delivered:true};
  }catch(e){try{await c.query('ROLLBACK')}catch{}throw e}finally{c.release()}
}

async function deliverLifecycle(event,workerId){
  const lifecycleEventId=String(event.payload?.lifecycleEventId||'');if(!lifecycleEventId)throw Object.assign(new Error('Lifecycle outbox payload is incomplete'),{code:'INVALID_LIFECYCLE_OUTBOX'});
  const c=await db.pool.connect();try{
    await c.query('BEGIN');
    const owned=(await c.query("SELECT id FROM outbox_events WHERE id=$1 AND status='PROCESSING' AND locked_by=$2 FOR UPDATE",[event.id,String(workerId)])).rows[0];
    if(!owned)throw Object.assign(new Error('Outbox event is not owned by worker'),{code:'OUTBOX_LEASE_LOST'});
    const journal=(await c.query('SELECT id,domain,aggregate_id,outbox_topic FROM lifecycle_events WHERE id=$1',[lifecycleEventId])).rows[0];
    if(!journal)throw Object.assign(new Error('Lifecycle journal entry is missing'),{code:'LIFECYCLE_JOURNAL_MISSING'});
    if(journal.domain!==event.aggregateType||String(journal.aggregate_id)!==String(event.aggregateId)||journal.outbox_topic!==event.topic)throw Object.assign(new Error('Lifecycle outbox does not match journal entry'),{code:'LIFECYCLE_OUTBOX_MISMATCH'});
    const completed=(await c.query(`UPDATE outbox_events SET status='COMPLETED',processed_at=now(),locked_at=NULL,locked_by=NULL,last_error=NULL
      WHERE id=$1 AND status='PROCESSING' AND locked_by=$2 RETURNING id`,[event.id,String(workerId)])).rows[0];
    if(!completed)throw Object.assign(new Error('Outbox lease was lost before completion'),{code:'OUTBOX_LEASE_LOST'});
    await c.query('COMMIT');return{eventId:event.id,topic:event.topic,lifecycleEventId,delivered:true};
  }catch(e){try{await c.query('ROLLBACK')}catch{}throw e}finally{c.release()}
}

async function dispatch(event,workerId){
  if(event.topic==='NOTIFICATION')return deliverNotification(event,workerId);
  if(event.payload?.kind==='LIFECYCLE_TRANSITION')return deliverLifecycle(event,workerId);
  throw Object.assign(new Error(`Unsupported outbox topic ${event.topic}`),{code:'UNSUPPORTED_OUTBOX_TOPIC'});
}

export async function processOutboxBatch({workerId,limit=25,leaseMs=120000}={}){
  if(db.kind!=='POSTGRES')return{claimed:0,completed:0,failed:0,reason:'POSTGRES_REQUIRED'};
  const events=await claimOutboxBatch(db,{workerId,limit,leaseMs});let completed=0,failed=0;
  for(const event of events){try{await dispatch(event,workerId);completed++}catch(e){failed++;try{await failOutboxEvent(db,event.id,workerId,e)}catch(leaseError){if(leaseError?.code!=='OUTBOX_LEASE_LOST')throw leaseError}console.error('outbox event failed',event.id,event.topic,e.message)}}
  return{claimed:events.length,completed,failed};
}

export async function runScheduledWork({workerId='worker'}={}){
  if(db.kind!=='POSTGRES')return{acquired:false,reason:'POSTGRES_REQUIRED'};
  const c=await db.pool.connect();let acquired=false;try{
    acquired=Boolean((await c.query('SELECT pg_try_advisory_lock($1) AS acquired',[SCHEDULE_LOCK_KEY])).rows[0]?.acquired);
    if(!acquired)return{acquired:false,reason:'ANOTHER_WORKER_OWNS_SCHEDULE'};
    const auctions=await settleDueAuctions(),operational=await runOperationalSweeps();return{acquired:true,workerId,auctionsCreated:auctions.length,operational};
  }finally{if(acquired){try{await c.query('SELECT pg_advisory_unlock($1)',[SCHEDULE_LOCK_KEY])}catch{}}c.release()}
}

export async function runWorkerCycle({workerId='worker',limit=25,leaseMs=120000}={}){
  const scheduled=await runScheduledWork({workerId});
  const totals={claimed:0,completed:0,failed:0};let cycles=0,batch;
  do{batch=await processOutboxBatch({workerId,limit,leaseMs});totals.claimed+=batch.claimed;totals.completed+=batch.completed;totals.failed+=batch.failed;cycles++}while(batch.claimed===limit&&cycles<20);
  return{scheduled,outbox:{...totals,cycles},stats:await outboxStats(db)};
}

export function workerCapabilities(){return{role:'WORKER',postgresRequired:true,scheduledWork:true,outbox:true,leasing:'FOR_UPDATE_SKIP_LOCKED',scheduleLock:'POSTGRES_ADVISORY',notificationDelivery:'TRANSACTIONAL_EXACTLY_ONCE_INTERNAL',lifecycleDelivery:'JOURNAL_VERIFIED_INTERNAL'}}
