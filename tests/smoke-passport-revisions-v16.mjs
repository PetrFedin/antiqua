import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';

const port=12031,base=`http://127.0.0.1:${port}`,sleep=ms=>new Promise(r=>setTimeout(r,ms));
const child=spawn(process.execPath,['server-v14.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,DATABASE_URL:'',PORT:String(port),PREVIEW_MODE:'true',APP_SECRET:crypto.randomBytes(32).toString('hex'),NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});
class Client{
  constructor(){this.cookies=new Map()}
  header(){return[...this.cookies].map(([k,v])=>`${k}=${v}`).join('; ')}
  async call(path,opts={}){const headers={'content-type':'application/json',...(opts.headers||{})};if(this.cookies.size)headers.cookie=this.header();const r=await fetch(base+path,{...opts,headers});for(const s of r.headers.getSetCookie?.()||[]){const[kv]=s.split(';'),i=kv.indexOf('=');if(i>0)this.cookies.set(kv.slice(0,i),kv.slice(i+1))}let body;try{body=await r.json()}catch{body=null}return{r,body}}
}
try{
  let ready=false;for(let i=0;i<120;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break}}catch{}await sleep(100)}assert.equal(ready,true);
  let x=await fetch(base+'/api/lots/lot-101/passport/revisions');assert.equal(x.status,200);let body=await x.json();assert.equal(body.history.currentRevisionNo,1);assert.match(body.history.currentHash,/^[0-9a-f]{64}$/);const publicRev=body.history.revisions[0];assert.equal('reason' in publicRev,false);assert.equal('actorAccountId' in publicRev,false);assert.equal('sourceKey' in publicRev,false);assert.ok(publicRev.evidence&&Number.isInteger(publicRev.evidence.count));assert.equal(Array.isArray(publicRev.evidence.types),true);

  const buyer=new Client();x=await buyer.call('/api/auth/demo-login',{method:'POST',body:JSON.stringify({persona:'BUYER'})});assert.equal(x.r.status,200);x=await buyer.call('/api/operator/lots/lot-101/passport/revisions');assert.equal(x.r.status,403);assert.equal(x.body.code,'FORBIDDEN');

  const operator=new Client();x=await operator.call('/api/auth/demo-login',{method:'POST',body:JSON.stringify({persona:'OPERATOR'})});assert.equal(x.r.status,200);x=await operator.call('/api/operator/lots/lot-101/passport/revisions');assert.equal(x.r.status,200);const privateRev=x.body.history.revisions[0];assert.equal(typeof privateRev.reason,'string');assert.ok(Array.isArray(privateRev.evidence));
  x=await operator.call('/api/operator/passport-revision-capabilities');assert.equal(x.r.status,200);assert.equal(x.body.capabilities.appendOnly,true);assert.equal(x.body.capabilities.publicHistorySanitized,true);

  console.log('ANTIQUA v16 passport revision HTTP: public sanitization + buyer denial + operator private history passed');
}finally{if(child.exitCode==null)child.kill('SIGTERM')}
