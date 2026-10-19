import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
const port=12173,host='http://127.0.0.1:'+port;
const srv=spawn(process.execPath,['server-v14.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),PREVIEW_MODE:'true',APP_SECRET:crypto.randomBytes(32).toString('hex'),NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});
const delay=t=>new Promise(r=>setTimeout(r,t));
class Client{
 constructor(){this.cookies=new Map()}
 async call(path,opts={}){
  const headers={'content-type':'application/json',...(opts.headers||{})};
  if(this.cookies.size)headers.cookie=[...this.cookies].map(([k,v])=>k+'='+v).join('; ');
  if(!['GET','HEAD'].includes((opts.method||'GET').toUpperCase())&&this.cookies.has('antiqua_csrf'))headers['x-csrf-token']=decodeURIComponent(this.cookies.get('antiqua_csrf'));
  const response=await fetch(host+path,{...opts,headers});
  for(const line of response.headers.getSetCookie?.()||[]){const raw=line.split(';')[0],i=raw.indexOf('=');if(i>0)this.cookies.set(raw.slice(0,i),raw.slice(i+1))}
  let data=null;try{data=await response.json()}catch{}
  return{status:response.status,data};
 }
}
async function login(role){const c=new Client(),r=await c.call('/api/auth/demo-login',{method:'POST',body:JSON.stringify({persona:role})});assert.equal(r.status,200);return c}
try{
 let online=false;
 for(let attempt=0;attempt<150;attempt++){try{const r=await fetch(host+'/api/health');if(r.ok){online=true;break}}catch{}await delay(100)}
 assert.equal(online,true,'server ready');
 const anonymous=new Client(),buyer=await login('BUYER'),stranger=await login('SELLER');
 let result=await anonymous.call('/api/collections');assert.equal(result.status,200);
 assert.deepEqual(result.data.collections,[],'unreviewed historical demo collections must not appear as reviewed public art');
 assert.equal((await anonymous.call('/api/collections/col-european-interiors')).status,404);
 const name='v71-private-'+crypto.randomUUID();
 result=await buyer.call('/api/collections',{method:'POST',body:JSON.stringify({title:name,visibility:'PRIVATE',collectionType:'PERSONAL'})});
 assert.equal(result.status,201);const id=result.data.collection.id;
 assert.equal((await stranger.call('/api/collections/'+id)).status,404);
 assert.equal((await anonymous.call('/api/collections/'+id)).status,404);
 result=await buyer.call('/api/collections/'+id);assert.equal(result.status,200);
 assert.equal(result.data.collection.ownerAccountId!==null,true);
 result=await buyer.call('/api/collections/'+id+'/objects',{method:'POST',body:JSON.stringify({objectId:'lot-108',section:'Study',ownerDisplayMode:'ANONYMOUS',locationDisplayMode:'HIDDEN'})});
 assert.equal(result.status,200);
 const item=result.data.collection.items.find(i=>i.objectId==='lot-108');
 assert.ok(item?.object?.department?.en==='Painting');
 assert.equal(item.object.owner,null);
 assert.equal(item.object.location,null);
 const mine=await buyer.call('/api/collections/mine');assert.ok(mine.data.collections.some(c=>c.id===id));
 const other=await stranger.call('/api/collections/mine');assert.equal(other.data.collections.some(c=>c.id===id),false);
 console.log('ANTIQUA v71 collection authority / publication / hydration / private access: PASS');
}finally{srv.kill('SIGTERM')}
