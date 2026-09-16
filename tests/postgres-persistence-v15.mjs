import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';

if(!process.env.DATABASE_URL){
  console.log('ANTIQUA 0.15 PostgreSQL persistence: skipped (DATABASE_URL not set)');
  process.exit(0);
}

const port=12018,base=`http://127.0.0.1:${port}`,appSecret=crypto.randomBytes(32).toString('hex');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let child=null;

class Client{
  constructor(){this.cookies=new Map()}
  header(){return[...this.cookies].map(([k,v])=>`${k}=${v}`).join('; ')}
  async call(path,opts={}){
    const headers={'content-type':'application/json',...(opts.headers||{})};
    if(this.cookies.size)headers.cookie=this.header();
    if(!['GET','HEAD'].includes((opts.method||'GET').toUpperCase())&&this.cookies.get('antiqua_csrf'))headers['x-csrf-token']=decodeURIComponent(this.cookies.get('antiqua_csrf'));
    const r=await fetch(base+path,{...opts,headers});
    for(const s of r.headers.getSetCookie?.()||[]){const[kv]=s.split(';'),i=kv.indexOf('=');if(i>0)this.cookies.set(kv.slice(0,i),kv.slice(i+1))}
    let body;try{body=await r.json()}catch{body=null}
    return{r,body};
  }
}

async function start(){
  child=spawn(process.execPath,['server-v14.mjs'],{
    cwd:new URL('..',import.meta.url),
    env:{...process.env,PORT:String(port),PREVIEW_MODE:'true',APP_SECRET:appSecret,NODE_ENV:'test',PGSSL:'disable'},
    stdio:['ignore','pipe','pipe']
  });
  let stderr='';child.stderr?.on('data',b=>stderr+=String(b));
  for(let i=0;i<180;i++){
    if(child.exitCode!=null)throw new Error(`Server exited before readiness: ${stderr}`);
    try{
      const r=await fetch(base+'/api/health');
      if(r.ok){const h=await r.json();assert.equal(h.persistence.kind,'POSTGRES');assert.equal(h.persistence.persistent,true);return h}
    }catch{}
    await sleep(100);
  }
  throw new Error(`PostgreSQL-backed server did not become ready: ${stderr}`);
}

async function stop(){
  if(!child)return;
  const p=child;child=null;
  if(p.exitCode==null)p.kill('SIGTERM');
  await Promise.race([new Promise(r=>p.once('exit',r)),sleep(5000)]);
  if(p.exitCode==null)p.kill('SIGKILL');
  await sleep(150);
}

try{
  await start();
  const owner=new Client();
  let x=await owner.call('/api/auth/demo-login',{method:'POST',body:JSON.stringify({persona:'BUYER'})});
  assert.equal(x.r.status,200);

  const marker=crypto.randomUUID();
  x=await owner.call('/api/collections',{method:'POST',body:JSON.stringify({title:`Restart proof ${marker}`,visibility:'PRIVATE'})});
  assert.equal(x.r.status,201);const collectionId=x.body.collection.id;

  x=await owner.call('/api/collection-records/lot-109',{method:'PUT',body:JSON.stringify({status:'OWNED',privateNotes:`restart-proof:${marker}`,acquisition:{source:'CI_POSTGRES'},storage:{city:'Amsterdam'}})});
  assert.equal(x.r.status,200);const recordId=x.body.record.id;

  x=await owner.call('/api/conversations',{method:'POST',body:JSON.stringify({listingId:'lst-109',subject:`Restart proof ${marker}`})});
  assert.equal(x.r.status,201);const conversationId=x.body.conversation.id;
  x=await owner.call(`/api/conversations/${conversationId}/messages`,{method:'POST',body:JSON.stringify({body:`durable:${marker}`,clientMessageId:`restart-${marker}`})});
  assert.equal(x.r.status,201);

  await stop();
  await start();

  x=await owner.call(`/api/collections/${collectionId}`);
  assert.equal(x.r.status,200);assert.equal(x.body.collection.id,collectionId);

  x=await owner.call('/api/collection-records');
  assert.equal(x.r.status,200);const record=x.body.records.find(r=>r.id===recordId);
  assert.ok(record);assert.equal(record.privateNotes,`restart-proof:${marker}`);

  x=await owner.call(`/api/conversations/${conversationId}`);
  assert.equal(x.r.status,200);assert.ok(x.body.conversation.messages.some(m=>m.body===`durable:${marker}`));

  const health=await(await fetch(base+'/api/health')).json();
  assert.equal(health.persistence.kind,'POSTGRES');assert.equal(health.persistence.persistent,true);
  console.log('ANTIQUA 0.15 PostgreSQL persistence: session + private collection + collection record + conversation survived restart');
}finally{
  await stop();
}
