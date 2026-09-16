import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {canReadCollection,canReadExhibition,isPublicExhibition} from '../access-policy.mjs';

assert.equal(canReadCollection({visibility:'PRIVATE',ownerAccountId:'a'},null),false);
assert.equal(canReadCollection({visibility:'PRIVATE',ownerAccountId:'a'},'b'),false);
assert.equal(canReadCollection({visibility:'PRIVATE',ownerAccountId:'a'},'a'),true);
assert.equal(canReadCollection({visibility:'UNLISTED',ownerAccountId:'a'},null),false);
assert.equal(canReadCollection({visibility:'PUBLIC',ownerAccountId:'a'},null),true);
assert.equal(canReadExhibition({visibility:'PRIVATE',status:'LIVE'}),false);
assert.equal(canReadExhibition({visibility:'PRIVATE',status:'LIVE'},{owner:true}),true);
assert.equal(isPublicExhibition({visibility:'PUBLIC',status:'LIVE'}),true);
assert.equal(isPublicExhibition({visibility:'PUBLIC',status:'ARCHIVED'}),true);
assert.equal(isPublicExhibition({visibility:'PUBLIC',status:'DRAFT'}),false);

const port=12015,base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['server-v14.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),PREVIEW_MODE:'true',APP_SECRET:crypto.randomBytes(32).toString('hex'),NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
class Client{
  constructor(){this.cookies=new Map()}
  header(){return[...this.cookies].map(([k,v])=>`${k}=${v}`).join('; ')}
  async call(path,opts={}){const headers={'content-type':'application/json',...(opts.headers||{})};if(this.cookies.size)headers.cookie=this.header();if(!['GET','HEAD'].includes((opts.method||'GET').toUpperCase())&&this.cookies.get('antiqua_csrf'))headers['x-csrf-token']=decodeURIComponent(this.cookies.get('antiqua_csrf'));const r=await fetch(base+path,{...opts,headers});for(const s of r.headers.getSetCookie?.()||[]){const [kv]=s.split(';'),i=kv.indexOf('=');if(i>0)this.cookies.set(kv.slice(0,i),kv.slice(i+1))}let body;try{body=await r.json()}catch{body=null}return{r,body}}
}
const login=async persona=>{const c=new Client(),x=await c.call('/api/auth/demo-login',{method:'POST',body:JSON.stringify({persona})});assert.equal(x.r.status,200);return c};
const createBuyer=async()=>{const c=new Client(),password='Aa1!'+crypto.randomBytes(16).toString('hex'),x=await c.call('/api/auth/register',{method:'POST',body:JSON.stringify({email:`privacy-${crypto.randomUUID()}@example.test`,displayName:'Privacy Buyer',password,accountType:'BUYER'})});assert.equal(x.r.status,201);return c};

try{
  let ready=false;for(let i=0;i<120;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break}}catch{}await sleep(100)}assert.equal(ready,true);
  const owner=await login('BUYER'),other=await createBuyer();

  let x=await owner.call('/api/collections',{method:'POST',body:JSON.stringify({title:'Private regression collection',visibility:'PRIVATE'})});assert.equal(x.r.status,201);const privateId=x.body.collection.id;
  assert.equal((await fetch(`${base}/api/collections/${privateId}`)).status,404);
  assert.equal((await other.call(`/api/collections/${privateId}`)).r.status,404);
  x=await owner.call(`/api/collections/${privateId}`);assert.equal(x.r.status,200);assert.equal(x.body.collection.id,privateId);
  let list=await(await fetch(base+'/api/collections')).json();assert.equal(list.collections.some(c=>c.id===privateId),false);

  x=await owner.call('/api/collections',{method:'POST',body:JSON.stringify({title:'Unlisted regression collection',visibility:'UNLISTED'})});assert.equal(x.r.status,201);const unlistedId=x.body.collection.id;
  assert.equal((await fetch(`${base}/api/collections/${unlistedId}`)).status,404);
  assert.equal((await other.call(`/api/collections/${unlistedId}`)).r.status,404);
  assert.equal((await owner.call(`/api/collections/${unlistedId}`)).r.status,200);
  list=await(await fetch(base+'/api/collections')).json();assert.equal(list.collections.some(c=>c.id===unlistedId),false);

  x=await owner.call('/api/collections',{method:'POST',body:JSON.stringify({title:'Public regression collection',visibility:'PUBLIC'})});assert.equal(x.r.status,201);const publicId=x.body.collection.id;
  assert.equal((await fetch(`${base}/api/collections/${publicId}`)).status,200);
  list=await(await fetch(base+'/api/collections')).json();assert.equal(list.collections.some(c=>c.id===publicId),true);

  assert.equal((await fetch(base+'/api/exhibitions/ex-objects-in-dialogue')).status,200);
  console.log('ANTIQUA 0.15 access smoke: private/unlisted isolation + owner access + public visibility passed');
}finally{child.kill('SIGTERM')}
