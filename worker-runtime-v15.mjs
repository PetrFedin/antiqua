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
      VALUES($1,$2,$3,$4,$5,now()) ON CONFLICT(source_outbox_id) DO NOTHING`,[notificationId(),accountId,type,payload,event.id]);
    const completed=(await c.query(`UPDATE outbox_events SET status='COMPLETED',processed_at=now(),locked_at=NULL,locked_by=NULL,last_error=NULL
      WHERE id=$1 AND status='PROCESSING' AND locked_by=$2 RETURNING id`,[event.id,String(workerId)])).rows[0];
    if(!completed)throw Object.assign(new Error('Outbox lease was lost before completion'),{code:'OUTBOX_LEASE_LOST'});
    await c.query('COMMIT');return{eventId:event.id,topic:event.topic,delivered:true};
  }catch(e){try{await c.query('ROLLBACK')}catch{}throw e}finally{c.release()}
}

async function dispatch(event,workerId){
  if(event.topic==='NOTIFICATION')return deliverNotification(event,workerId);
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
  let outbox={claimed:0,completed:0,failed:0},cycles=0;
  do{outbox=await processOutboxBatch({workerId,limit,leaseMs});cycles++}while(outbox.claimed===limit&&cycles<20);
  return{scheduled,outbox,stats:await outboxStats(db)};
}

export function workerCapabilities(){return{role:'WORKER',postgresRequired:true,scheduledWork:true,outbox:true,leasing:'FOR_UPDATE_SKIP_LOCKED',scheduleLock:'POSTGRES_ADVISORY',notificationDelivery:'TRANSACTIONAL_EXACTLY_ONCE_INTERNAL'}}
