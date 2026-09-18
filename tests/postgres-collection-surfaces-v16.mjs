import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import pg from 'pg';

if(!process.env.DATABASE_URL){console.log('ANTIQUA v16 PostgreSQL collection surfaces: skipped (DATABASE_URL not set)');process.exit(0)}

const {Pool}=pg,sql=new Pool({connectionString:process.env.DATABASE_URL,ssl:false});
const port=12023,base=`http://127.0.0.1:${port}`,appSecret=crypto.randomBytes(32).toString('hex'),token=crypto.randomUUID();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let child=null,accountId=null,collectionId=null;

class Client{
  constructor(){this.cookies=new Map()}
  header(){return[...this.cookies].map(([k,v])=>`${k}=${v}`).join('; ')}
  async call(path,opts={}){const method=(opts.method||'GET').toUpperCase(),headers={'content-type':'application/json',...(opts.headers||{})};if(this.cookies.size)headers.cookie=this.header();if(!['GET','HEAD'].includes(method)&&this.cookies.get('antiqua_csrf'))headers['x-csrf-token']=decodeURIComponent(this.cookies.get('antiqua_csrf'));const r=await fetch(base+path,{...opts,headers});for(const s of r.headers.getSetCookie?.()||[]){const[kv]=s.split(';'),i=kv.indexOf('=');if(i>0)this.cookies.set(kv.slice(0,i),kv.slice(i+1))}let body=null;try{body=await r.json()}catch{}return{r,body}}
}
async function start(){
  child=spawn(process.execPath,['server-v14.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),PREVIEW_MODE:'true',APP_SECRET:appSecret,NODE_ENV:'test',PGSSL:'disable'},stdio:['ignore','pipe','pipe']});
  let stderr='';child.stderr?.on('data',b=>stderr+=String(b));
  for(let i=0;i<180;i++){if(child.exitCode!=null)throw new Error(`Server exited: ${stderr}`);try{const r=await fetch(base+'/api/health');if(r.ok){const h=await r.json();assert.equal(h.persistence.kind,'POSTGRES');return}}catch{}await sleep(100)}
  throw new Error(`PostgreSQL server did not become ready: ${stderr}`);
}
async function stop(){if(!child)return;const p=child;child=null;if(p.exitCode==null)p.kill('SIGTERM');await Promise.race([new Promise(r=>p.once('exit',r)),sleep(5000)]);if(p.exitCode==null)p.kill('SIGKILL');await sleep(100)}

try{
  await start();
  const owner=new Client(),objectId='lot-101';
  let x=await owner.call('/api/auth/register',{method:'POST',body:JSON.stringify({email:`collection-surface-pg-${token}@example.test`,displayName:'PG Collection Surface',password:`Aa1!${crypto.randomBytes(12).toString('hex')}`,accountType:'BUYER'})});
  assert.equal(x.r.status,201);accountId=x.body.account.id;

  x=await owner.call(`/api/lots/${objectId}/collect`,{method:'POST',body:JSON.stringify({enabled:true})});assert.equal(x.r.status,200);assert.equal(x.body.surface.kind,'PERSONAL_LIST_MARKER');
  x=await owner.call('/api/collections',{method:'POST',body:JSON.stringify({title:`PG split ${token}`,visibility:'PRIVATE',collectionType:'CURATED'})});assert.equal(x.r.status,201);collectionId=x.body.collection.id;
  x=await owner.call(`/api/collections/${collectionId}/objects`,{method:'POST',body:JSON.stringify({objectId,section:'Independent surface',sortOrder:1})});assert.equal(x.r.status,200);
  x=await owner.call(`/api/collection-records/${objectId}`,{method:'PUT',body:JSON.stringify({status:'OWNED',privateNotes:`pg-split:${token}`,storage:{location:'Private custody'}})});assert.equal(x.r.status,200);assert.equal(x.body.surface.kind,'COLLECTION_RECORD');

  let q=await sql.query(`SELECT
    (SELECT count(*)::int FROM account_object_flags WHERE account_id=$1 AND object_id=$2 AND flag_type='COLLECTED') AS marker_count,
    (SELECT count(*)::int FROM collection_objects WHERE collection_id=$3 AND object_id=$2) AS curated_count,
    (SELECT count(*)::int FROM collection_records WHERE account_id=$1 AND object_id=$2) AS record_count`,[accountId,objectId,collectionId]);
  assert.deepEqual(q.rows[0],{marker_count:1,curated_count:1,record_count:1});

  // Removing the personal marker must not cascade into either curated membership or operational record.
  x=await owner.call(`/api/lots/${objectId}/collect`,{method:'POST',body:JSON.stringify({enabled:false})});assert.equal(x.r.status,200);
  q=await sql.query(`SELECT
    (SELECT count(*)::int FROM account_object_flags WHERE account_id=$1 AND object_id=$2 AND flag_type='COLLECTED') AS marker_count,
    (SELECT count(*)::int FROM collection_objects WHERE collection_id=$3 AND object_id=$2) AS curated_count,
    (SELECT count(*)::int FROM collection_records WHERE account_id=$1 AND object_id=$2) AS record_count`,[accountId,objectId,collectionId]);
  assert.deepEqual(q.rows[0],{marker_count:0,curated_count:1,record_count:1});

  // Updating the private record must not modify the curated Collection row or membership.
  const before=(await sql.query('SELECT title,summary,story,visibility FROM collections WHERE id=$1',[collectionId])).rows[0];
  x=await owner.call(`/api/collection-records/${objectId}`,{method:'PUT',body:JSON.stringify({status:'OWNED',privateNotes:`pg-updated:${token}`,storage:{location:'Second private location'}})});assert.equal(x.r.status,200);
  const after=(await sql.query('SELECT title,summary,story,visibility FROM collections WHERE id=$1',[collectionId])).rows[0];
  assert.deepEqual(after,before);
  assert.equal((await sql.query('SELECT count(*)::int AS n FROM collection_objects WHERE collection_id=$1 AND object_id=$2',[collectionId,objectId])).rows[0].n,1);
  assert.equal((await sql.query('SELECT private_notes FROM collection_records WHERE account_id=$1 AND object_id=$2',[accountId,objectId])).rows[0].private_notes,`pg-updated:${token}`);

  console.log('ANTIQUA v16 PostgreSQL collection surfaces: personal marker + curated membership + private record remain independent');
}finally{
  await stop();
  if(collectionId)await sql.query('DELETE FROM collections WHERE id=$1',[collectionId]).catch(()=>{});
  if(accountId)await sql.query('DELETE FROM accounts WHERE id=$1',[accountId]).catch(()=>{});
  await sql.end();
}
