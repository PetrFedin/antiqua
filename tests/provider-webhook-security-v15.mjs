import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {signProviderWebhook} from '../provider-webhook-security-v15.mjs';

const port=12025,base=`http://127.0.0.1:${port}`,secret=crypto.randomBytes(32).toString('hex'),wrongSecret=crypto.randomBytes(32).toString('hex');
const child=spawn(process.execPath,['server-v14.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),PREVIEW_MODE:'true',APP_SECRET:crypto.randomBytes(32).toString('hex'),NODE_ENV:'test',PROVIDER_WEBHOOK_SECRET:secret,PROVIDER_WEBHOOK_REPLAY_WINDOW_SECONDS:'30',PROVIDER_WEBHOOK_MAX_BYTES:'2048'},stdio:['ignore','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function postRaw(raw,{signingSecret=secret,timestamp=Math.floor(Date.now()/1000),signature=true,contentType='application/json',legacySecret=false}={}){
 const headers={'content-type':contentType};
 if(signature){const signed=signProviderWebhook({secret:signingSecret,timestamp:String(timestamp),rawBody:raw});headers['x-provider-timestamp']=signed.timestamp;headers['x-provider-signature']=signed.signature}
 if(legacySecret)headers['x-provider-secret']=secret;
 const r=await fetch(base+'/api/providers/events',{method:'POST',headers,body:raw});let body={};try{body=await r.json()}catch{}return{r,body};
}
const payload=id=>({providerType:'PAYMENT',provider:'SECURITY_TEST',externalEventId:id,eventType:'OBSERVED',entityType:'OTHER',entityId:'security-proof'});

try{
 let ready=false;for(let i=0;i<120;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break}}catch{}await sleep(100)}assert.equal(ready,true);
 const id=`signed-${crypto.randomUUID()}`,raw=JSON.stringify(payload(id));
 let x=await postRaw(raw);assert.equal(x.r.status,202);assert.equal(x.body.processed,true);assert.equal(x.body.application.applied,false);
 x=await postRaw(raw);assert.equal(x.r.status,200);assert.equal(x.body.idempotent,true);assert.equal(x.body.processed,true);

 const tampered=JSON.stringify({...payload(`tamper-${crypto.randomUUID()}`),entityId:'changed-after-signing'}),original=JSON.stringify({...JSON.parse(tampered),entityId:'original'}),signed=signProviderWebhook({secret,rawBody:original});
 let r=await fetch(base+'/api/providers/events',{method:'POST',headers:{'content-type':'application/json','x-provider-timestamp':signed.timestamp,'x-provider-signature':signed.signature},body:tampered});let body=await r.json();assert.equal(r.status,401);assert.equal(body.code,'PROVIDER_WEBHOOK_SIGNATURE_INVALID');

 x=await postRaw(JSON.stringify(payload(`wrong-${crypto.randomUUID()}`)),{signingSecret:wrongSecret});assert.equal(x.r.status,401);assert.equal(x.body.code,'PROVIDER_WEBHOOK_SIGNATURE_INVALID');
 x=await postRaw(JSON.stringify(payload(`stale-${crypto.randomUUID()}`)),{timestamp:Math.floor(Date.now()/1000)-120});assert.equal(x.r.status,401);assert.equal(x.body.code,'PROVIDER_WEBHOOK_TIMESTAMP_OUT_OF_WINDOW');
 x=await postRaw(JSON.stringify(payload(`future-${crypto.randomUUID()}`)),{timestamp:Math.floor(Date.now()/1000)+120});assert.equal(x.r.status,401);assert.equal(x.body.code,'PROVIDER_WEBHOOK_TIMESTAMP_OUT_OF_WINDOW');
 x=await postRaw(JSON.stringify(payload(`missing-${crypto.randomUUID()}`)),{signature:false});assert.equal(x.r.status,401);assert.equal(x.body.code,'PROVIDER_WEBHOOK_SIGNATURE_REQUIRED');
 x=await postRaw(JSON.stringify(payload(`legacy-${crypto.randomUUID()}`)),{signature:false,legacySecret:true});assert.equal(x.r.status,401);assert.equal(x.body.code,'PROVIDER_WEBHOOK_SIGNATURE_REQUIRED');
 x=await postRaw(JSON.stringify(payload(`type-${crypto.randomUUID()}`)),{contentType:'text/plain'});assert.equal(x.r.status,415);assert.equal(x.body.code,'PROVIDER_WEBHOOK_CONTENT_TYPE_REQUIRED');

 const invalid='{this-is-not-json',invalidSigned=signProviderWebhook({secret,rawBody:invalid});r=await fetch(base+'/api/providers/events',{method:'POST',headers:{'content-type':'application/json','x-provider-timestamp':invalidSigned.timestamp,'x-provider-signature':invalidSigned.signature},body:invalid});body=await r.json();assert.equal(r.status,400);assert.equal(body.code,'PROVIDER_WEBHOOK_INVALID_JSON');
 const oversized=JSON.stringify({...payload(`large-${crypto.randomUUID()}`),padding:'x'.repeat(3000)}),oversizedSigned=signProviderWebhook({secret,rawBody:oversized});r=await fetch(base+'/api/providers/events',{method:'POST',headers:{'content-type':'application/json','x-provider-timestamp':oversizedSigned.timestamp,'x-provider-signature':oversizedSigned.signature},body:oversized});body=await r.json();assert.equal(r.status,413);assert.equal(body.code,'PROVIDER_WEBHOOK_TOO_LARGE');

 console.log('ANTIQUA 0.15 webhook security: valid HMAC + idempotent replay + tamper/wrong-secret/stale/future/legacy/content-type/JSON/size rejection passed');
}finally{child.kill('SIGTERM')}
