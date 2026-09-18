import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';

if(!process.env.DATABASE_URL){console.log('ANTIQUA v16 collection boundaries: skipped (DATABASE_URL not set)');process.exit(0)}

const {db}=await import('../runtime-v09.mjs');
const port=12031,base=`http://127.0.0.1:${port}`,appSecret=crypto.randomBytes(32).toString('hex'),marker=crypto.randomUUID();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let child=null;
class Client{
 constructor(){this.cookies=new Map()}
 header(){return[...this.cookies].map(([k,v])=>`${k}=${v}`).join('; ')}
 async call(path,opts={}){const headers={'content-type':'application/json',...(opts.headers||{})};if(this.cookies.size)headers.cookie=this.header();if(!['GET','HEAD'].includes((opts.method||'GET').toUpperCase())&&this.cookies.get('antiqua_csrf'))headers['x-csrf-token']=decodeURIComponent(this.cookies.get('antiqua_csrf'));const r=await fetch(base+path,{...opts,headers});for(const s of r.headers.getSetCookie?.()||[]){const[kv]=s.split(';'),i=kv.indexOf('=');if(i>0)this.cookies.set(kv.slice(0,i),kv.slice(i+1))}let body;try{body=await r.json()}catch{body=null}return{r,body}}
}
async function start(){child=spawn(process.execPath,['server-v14.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),PREVIEW_MODE:'true',APP_SECRET:appSecret,NODE_ENV:'test',PGSSL:'disable'},stdio:['ignore','pipe','pipe']});let stderr='';child.stderr?.on('data',b=>stderr+=String(b));for(let i=0;i<180;i++){if(child.exitCode!=null)throw new Error(`Server exited before readiness: ${stderr}`);try{const r=await fetch(base+'/api/health');if(r.ok)return}catch{}await sleep(100)}throw new Error(`Server not ready: ${stderr}`)}
async function stop(){if(!child)return;const p=child;child=null;if(p.exitCode==null)p.kill('SIGTERM');await Promise.race([new Promise(r=>p.once('exit',r)),sleep(5000)]);if(p.exitCode==null)p.kill('SIGKILL');await sleep(100)}
async function login(persona){const c=new Client(),x=await c.call('/api/auth/demo-login',{method:'POST',body:JSON.stringify({persona})});assert.equal(x.r.status,200);return c}

let collectionId=null,ownerId=null;
try{
 assert.equal(db.kind,'POSTGRES');await start();
 const owner=await login('BUYER'),other=await login('SELLER');
 let x=await owner.call('/api/auth/me');ownerId=x.body.account.id;assert.ok(ownerId);

 x=await owner.call('/api/collections',{method:'POST',body:JSON.stringify({title:`Curated boundary ${marker}`,collectionType:'CURATED',visibility:'PRIVATE'})});
 assert.equal(x.r.status,201);collectionId=x.body.collection.id;
 x=await owner.call('/api/collections/mine');assert.equal(x.r.status,200);assert.ok(x.body.collections.some(c=>c.id===collectionId&&c.accessRole==='OWNER'));
 x=await other.call('/api/collections/mine');assert.equal(x.r.status,200);assert.equal(x.body.collections.some(c=>c.id===collectionId),false);
 assert.equal((await other.call(`/api/collections/${collectionId}`)).r.status,404);
 const publicList=await(await fetch(base+'/api/collections')).json();assert.equal(publicList.collections.some(c=>c.id===collectionId),false);

 let membership=Number((await db.pool.query('SELECT count(*)::int n FROM collection_objects WHERE collection_id=$1',[collectionId])).rows[0].n);assert.equal(membership,0);
 const recordsBefore=Number((await db.pool.query('SELECT count(*)::int n FROM collection_records WHERE account_id=$1 AND object_id=$2',[ownerId,'lot-109'])).rows[0].n);
 x=await owner.call('/api/collection-records/lot-109',{method:'PUT',body:JSON.stringify({status:'OWNED',privateNotes:`boundary-record-${marker}`,appraisal:{value:7700,currency:'EUR'},storage:{location:'Private vault'}})});
 assert.equal(x.r.status,200);
 membership=Number((await db.pool.query('SELECT count(*)::int n FROM collection_objects WHERE collection_id=$1',[collectionId])).rows[0].n);assert.equal(membership,0,'Collection Record mutation must not create curated membership');
 const recordsAfter=Number((await db.pool.query('SELECT count(*)::int n FROM collection_records WHERE account_id=$1 AND object_id=$2',[ownerId,'lot-109'])).rows[0].n);assert.ok(recordsAfter>=recordsBefore);assert.equal(recordsAfter,1);

 const otherRecordBefore=(await db.pool.query('SELECT id,updated_at,private_notes FROM collection_records WHERE account_id=$1 AND object_id=$2',[ownerId,'lot-108'])).rows[0]||null;
 x=await owner.call(`/api/collections/${collectionId}/objects`,{method:'POST',body:JSON.stringify({objectId:'lot-108',section:'Boundary proof',ownerDisplayMode:'ANONYMOUS',locationDisplayMode:'HIDDEN'})});
 assert.equal(x.r.status,200);
 const member=(await db.pool.query('SELECT collection_id,object_id,section FROM collection_objects WHERE collection_id=$1 AND object_id=$2',[collectionId,'lot-108'])).rows[0];assert.equal(member?.section,'Boundary proof');
 const otherRecordAfter=(await db.pool.query('SELECT id,updated_at,private_notes FROM collection_records WHERE account_id=$1 AND object_id=$2',[ownerId,'lot-108'])).rows[0]||null;
 assert.deepEqual(otherRecordAfter,otherRecordBefore,'Curated Collection membership must not mutate private Collection Record');

 x=await owner.call('/api/collections/mine');const mine=x.body.collections.find(c=>c.id===collectionId);assert.ok(mine);assert.ok(mine.items.some(i=>i.objectId==='lot-108'));
 x=await owner.call('/api/collection-records');const record=x.body.records.find(r=>r.objectId==='lot-109');assert.ok(record);assert.equal(record.privateNotes,`boundary-record-${marker}`);

 console.log('ANTIQUA v16 collection boundaries: private records + curated memberships + owner projection remain independent passed');
}finally{
 await stop();
 if(collectionId)await db.pool.query('DELETE FROM collections WHERE id=$1',[collectionId]).catch(()=>{});
 if(ownerId)await db.pool.query("DELETE FROM collection_records WHERE account_id=$1 AND object_id='lot-109' AND private_notes=$2",[ownerId,`boundary-record-${marker}`]).catch(()=>{});
 await db.pool.end();
}
