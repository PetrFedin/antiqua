import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {Pool} from 'pg';
import {enqueueOutboxTx} from '../outbox-v15.mjs';

if(!process.env.DATABASE_URL){console.log('ANTIQUA 0.15 PostgreSQL worker/outbox: skipped (DATABASE_URL not set)');process.exit(0)}

const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSL==='disable'?false:{rejectUnauthorized:false},max:8});
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),token=crypto.randomUUID(),port=12022,base=`http://127.0.0.1:${port}`,appSecret=crypto.randomBytes(32).toString('hex');
const accountId=`worker-account-${token}`,recordId=`worker-record-${token}`,objectId=`worker-object-${token}`,objectCode=`AQ-WORKER-${token.slice(0,12)}`,policyId=`worker-policy-${token}`;
let web=null;

async function startWeb(){
  web=spawn(process.execPath,['server-v14.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),PREVIEW_MODE:'true',APP_SECRET:appSecret,NODE_ENV:'test',PGSSL:'disable'},stdio:['ignore','pipe','pipe']});
  let stderr='';web.stderr?.on('data',b=>stderr+=String(b));
  for(let i=0;i<180;i++){if(web.exitCode!=null)throw new Error(`Web exited before readiness: ${stderr}`);try{if((await fetch(base+'/api/health')).ok)return}catch{}await sleep(100)}
  throw new Error(`Web did not become ready: ${stderr}`);
}
async function stopWeb(){if(!web)return;const p=web;web=null;if(p.exitCode==null)p.kill('SIGTERM');await Promise.race([new Promise(r=>p.once('exit',r)),sleep(5000)]);if(p.exitCode==null)p.kill('SIGKILL');await sleep(150)}
async function runWorker(id,extra={}){
  const child=spawn(process.execPath,['worker-v15.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PREVIEW_MODE:'true',APP_SECRET:appSecret,NODE_ENV:'test',PGSSL:'disable',WORKER_ONCE:'true',WORKER_ID:id,OUTBOX_BATCH_SIZE:'25',OUTBOX_LEASE_MS:'1000',...extra},stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';child.stdout?.on('data',b=>stdout+=String(b));child.stderr?.on('data',b=>stderr+=String(b));const code=await new Promise(r=>child.once('exit',r));if(code!==0)throw new Error(`Worker ${id} exited ${code}: ${stderr}\n${stdout}`);return{stdout,stderr};
}

try{
  await pool.query(`INSERT INTO accounts(id,email,display_name,password_hash,account_type,status,twofa_status,created_at,updated_at)
    VALUES($1,$2,'Worker Outbox Test','worker-test','BUYER','ACTIVE','DISABLED',now(),now()) ON CONFLICT(id) DO NOTHING`,[accountId,`${accountId}@example.test`]);
  await pool.query(`INSERT INTO objects(id,object_code,seller_id,passport,catalogue_status,trust_status,publication_status,created_at,updated_at)
    VALUES($1,$2,NULL,$3,'APPROVED','CLEARED','PRIVATE',now(),now()) ON CONFLICT(id) DO NOTHING`,[objectId,objectCode,{id:objectId,objectId:objectCode,title:{en:'Worker outbox integrity fixture'}}]);
  await pool.query(`INSERT INTO collection_records(id,account_id,object_id,acquisition,appraisal,storage,insurance,private_notes,status,created_at,updated_at)
    VALUES($1,$2,$3,'{}','{}','{}','{}','worker outbox proof','OWNED',now(),now()) ON CONFLICT(id) DO NOTHING`,[recordId,accountId,objectId]);
  await pool.query(`INSERT INTO insurance_policies(id,record_id,provider,policy_number_masked,insured_value_minor,currency,coverage,starts_at,expires_at,status,created_at,updated_at)
    VALUES($1,$2,'CI Insurance','***-WORKER',125000,'EUR','{}',now()-interval '30 days',now()-interval '5 minutes','ACTIVE',now(),now()) ON CONFLICT(id) DO NOTHING`,[policyId,recordId]);

  await startWeb();await sleep(1200);
  let row=(await pool.query('SELECT status FROM insurance_policies WHERE id=$1',[policyId])).rows[0];assert.equal(row.status,'ACTIVE','web/API process must not execute lifecycle sweeps');
  await stopWeb();

  await runWorker(`worker-once-${token}`);
  row=(await pool.query('SELECT status FROM insurance_policies WHERE id=$1',[policyId])).rows[0];assert.equal(row.status,'EXPIRED');
  const key=`notification:insurance-expired:${policyId}`;
  let outbox=(await pool.query('SELECT * FROM outbox_events WHERE idempotency_key=$1',[key])).rows;assert.equal(outbox.length,1);assert.equal(outbox[0].status,'COMPLETED');assert.equal(Number(outbox[0].attempt_count),1);
  let notifications=(await pool.query('SELECT * FROM notifications WHERE source_outbox_id=$1',[outbox[0].id])).rows;assert.equal(notifications.length,1);assert.equal(notifications[0].account_id,accountId);assert.equal(notifications[0].type,'INSURANCE_EXPIRED');assert.equal(notifications[0].payload.policyId,policyId);

  await runWorker(`worker-retry-${token}`);
  outbox=(await pool.query('SELECT * FROM outbox_events WHERE idempotency_key=$1',[key])).rows;assert.equal(outbox.length,1);notifications=(await pool.query('SELECT * FROM notifications WHERE source_outbox_id=$1',[outbox[0].id])).rows;assert.equal(notifications.length,1);

  const batchKeys=[];
  for(let i=0;i<30;i++){
    const idempotencyKey=`worker-batch-${token}-${i}`;batchKeys.push(idempotencyKey);
    await enqueueOutboxTx(pool,{topic:'NOTIFICATION',aggregateType:'WORKER_TEST',aggregateId:`${token}-${i}`,idempotencyKey,payload:{accountId,type:'WORKER_BATCH_TEST',data:{token,index:i}}});
  }
  await Promise.all([runWorker(`worker-a-${token}`),runWorker(`worker-b-${token}`)]);
  let q=await pool.query('SELECT count(*)::int AS n FROM outbox_events WHERE idempotency_key=ANY($1::text[]) AND status=$2',[batchKeys,'COMPLETED']);assert.equal(q.rows[0].n,30);
  q=await pool.query(`SELECT count(*)::int AS n,count(DISTINCT n.source_outbox_id)::int AS distinct_n FROM notifications n JOIN outbox_events o ON o.id=n.source_outbox_id WHERE o.idempotency_key=ANY($1::text[])`,[batchKeys]);assert.equal(q.rows[0].n,30);assert.equal(q.rows[0].distinct_n,30);

  const leaseKey=`worker-lease-${token}`;
  const leased=await enqueueOutboxTx(pool,{topic:'NOTIFICATION',aggregateType:'WORKER_TEST',aggregateId:`lease-${token}`,idempotencyKey:leaseKey,payload:{accountId,type:'WORKER_LEASE_RECOVERY',data:{token}}});
  await pool.query("UPDATE outbox_events SET status='PROCESSING',locked_by='dead-worker',locked_at=now()-interval '10 minutes',attempt_count=1 WHERE id=$1",[leased.id]);
  await runWorker(`worker-recovery-${token}`,{OUTBOX_LEASE_MS:'1000'});
  row=(await pool.query('SELECT status,attempt_count,locked_by FROM outbox_events WHERE id=$1',[leased.id])).rows[0];assert.equal(row.status,'COMPLETED');assert.equal(Number(row.attempt_count),2);assert.equal(row.locked_by,null);
  q=await pool.query('SELECT count(*)::int AS n FROM notifications WHERE source_outbox_id=$1',[leased.id]);assert.equal(q.rows[0].n,1);

  console.log('ANTIQUA 0.15 worker/outbox proof: web isolation + transactional insurance event + retry + 2-worker SKIP LOCKED + stale lease recovery passed');
}finally{
  await stopWeb();
  await pool.query('DELETE FROM insurance_policies WHERE id=$1',[policyId]).catch(()=>{});
  await pool.query('DELETE FROM collection_records WHERE id=$1',[recordId]).catch(()=>{});
  await pool.query('DELETE FROM objects WHERE id=$1',[objectId]).catch(()=>{});
  await pool.query('DELETE FROM accounts WHERE id=$1',[accountId]).catch(()=>{});
  await pool.end();
}
