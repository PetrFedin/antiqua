import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';

const port=12391,base='http://127.0.0.1:'+port,delay=ms=>new Promise(r=>setTimeout(r,ms));
const processRef=spawn(process.execPath,['server-v14.mjs'],{
 cwd:new URL('..',import.meta.url),
 env:{...process.env,PORT:String(port),PREVIEW_MODE:'true',
  NODE_ENV:'test',APP_SECRET:crypto.randomBytes(32).toString('hex')},
 stdio:['ignore','pipe','pipe']
});
let serverError='';
processRef.stderr.on('data',x=>{serverError+=String(x).slice(0,900)});
async function call(path,options={}){
 return fetch(base+path,{...options,signal:AbortSignal.timeout(6000)});
}
try{
 let started=false;
 for(let i=0;i<120;i++){
  if(processRef.exitCode!==null)throw Error('server exited: '+serverError.slice(-850));
  try{if((await call('/api/health')).status===200){started=true;break}}catch{}
  await delay(100);
 }
 assert.equal(started,true,'test preview HTTP server must start');
 for(const path of ['/','/index.html']){
  const response=await call(path);
  assert.equal(response.status,200);
  assert.equal(response.headers.get('set-cookie'),null,
   'a public page view must NEVER issue an authenticated session: '+path);
 }
 let response=await call('/api/auth/me');
 assert.equal(response.status,200);
 let data=await response.json();
 assert.equal(data.account,null);
 assert.equal(data.csrf,null);
 assert.equal((await call('/api/conversations')).status,401,
  'private buyer messages must remain forbidden before an explicit login');
 response=await call('/api/auth/demo-login',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({persona:'BUYER'})
 });
 assert.equal(response.status,200,'an explicit preview-only role action remains possible');
 data=await response.json();
 assert.equal(data.account?.roles.includes('BUYER'),true);
 const cookies=response.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
 assert.match(cookies,/antiqua_session=/);
 assert.match(cookies,/antiqua_csrf=/);
 response=await call('/api/auth/me',{headers:{cookie:cookies}});
 assert.equal((await response.json()).account?.id,data.account.id);
 response=await call('/',{headers:{cookie:cookies}});
 assert.equal(response.headers.get('set-cookie'),null,
  'a page refresh must not replace an existing session');
 response=await call('/api/auth/logout',{
  method:'POST',headers:{'content-type':'application/json',
   cookie:cookies,'x-csrf-token':data.csrf},body:'{}'
 });
 assert.equal(response.status,200,'logout must revoke the explicit session');
 response=await call('/api/auth/me',{headers:{cookie:cookies}});
 assert.equal((await response.json()).account,null,'revoked session cannot be reused');
 response=await call('/');
 assert.equal(response.headers.get('set-cookie'),null,
  'page reload must not silently log a guest back in');
 console.log('ANTIQUA v91 anonymous HTTP: no implicit demo cookies, private 401, explicit login and revocation PASS');
}finally{
 if(processRef.exitCode===null)processRef.kill('SIGTERM');
}
