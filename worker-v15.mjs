import os from 'node:os';
import crypto from 'node:crypto';
import {db} from './runtime-v09.mjs';
import {runWorkerCycle,workerCapabilities} from './worker-runtime-v15.mjs';

if(db.kind!=='POSTGRES')throw new Error('ANTIQUA worker requires DATABASE_URL / PostgreSQL persistence');
const schema=(await db.pool.query("SELECT to_regclass('public.outbox_events') AS outbox,to_regclass('public.auction_settlements') AS settlements")).rows[0];
if(!schema?.outbox||!schema?.settlements)throw new Error('ANTIQUA worker schema is not migrated; run the deployment migration step before starting workers');

const workerId=String(process.env.WORKER_ID||`${os.hostname()}-${process.pid}-${crypto.randomUUID().slice(0,8)}`),pollMs=Math.max(250,Math.trunc(Number(process.env.WORKER_POLL_MS)||5000)),leaseMs=Math.max(1000,Math.trunc(Number(process.env.OUTBOX_LEASE_MS)||120000)),limit=Math.max(1,Math.min(100,Math.trunc(Number(process.env.OUTBOX_BATCH_SIZE)||25))),once=String(process.env.WORKER_ONCE||'').toLowerCase()==='true';
let stopping=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function close(){if(stopping)return;stopping=true;try{await db.pool.end()}catch{}}
process.once('SIGTERM',()=>{void close()});
process.once('SIGINT',()=>{void close()});

console.log('ANTIQUA worker started',JSON.stringify({workerId,pollMs,leaseMs,limit,once,capabilities:workerCapabilities()}));
try{
  if(once){const result=await runWorkerCycle({workerId,limit,leaseMs});console.log('ANTIQUA worker cycle',JSON.stringify(result));}
  else while(!stopping){const started=Date.now();try{const result=await runWorkerCycle({workerId,limit,leaseMs});if(result.outbox.claimed||result.scheduled?.auctionsCreated||result.scheduled?.operational?.settlements?.changed||result.scheduled?.operational?.insurance?.changed)console.log('ANTIQUA worker cycle',JSON.stringify(result))}catch(e){console.error('ANTIQUA worker cycle failed',e)}const remaining=Math.max(0,pollMs-(Date.now()-started));if(remaining)await sleep(remaining)}
}finally{await close()}
