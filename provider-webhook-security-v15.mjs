import crypto from 'node:crypto';

const PROVIDER_PATHS=new Set(['/api/providers/events','/api/providers/identity-events','/api/providers/payout-events']);
const DEFAULT_MAX_BYTES=1024*1024;
const DEFAULT_REPLAY_WINDOW_SECONDS=300;
const securityError=(message,status,code)=>Object.assign(new Error(message),{status,code});
const replayWindowSeconds=()=>Math.max(30,Math.min(3600,Math.trunc(Number(process.env.PROVIDER_WEBHOOK_REPLAY_WINDOW_SECONDS)||DEFAULT_REPLAY_WINDOW_SECONDS)));
const maxBytes=()=>Math.max(1024,Math.min(5*1024*1024,Math.trunc(Number(process.env.PROVIDER_WEBHOOK_MAX_BYTES)||DEFAULT_MAX_BYTES)));
const signatureFor=(secret,timestamp,rawBody)=>crypto.createHmac('sha256',secret).update(`${timestamp}.`).update(rawBody).digest('hex');
const parseSignature=value=>{const raw=String(value||'').trim(),m=raw.match(/^v1=([a-f0-9]{64})$/i);return m?m[1].toLowerCase():null};
const safeEqualHex=(a,b)=>{if(!/^[a-f0-9]{64}$/i.test(String(a||''))||!/^[a-f0-9]{64}$/i.test(String(b||'')))return false;const aa=Buffer.from(String(a),'hex'),bb=Buffer.from(String(b),'hex');return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)};

export function providerWebhookSecurityCapabilities(){
 return{mode:'SIGNED_CANONICAL_V1',algorithm:'HMAC_SHA256',signatureHeader:'x-provider-signature',timestampHeader:'x-provider-timestamp',signedPayload:'timestamp.rawBody',replayWindowSeconds:replayWindowSeconds(),maxBytes:maxBytes(),legacySecretHeaderAccepted:false};
}

export function signProviderWebhook({secret,timestamp,rawBody}){
 if(!secret)throw securityError('Provider webhook secret is required',503,'PROVIDER_WEBHOOK_NOT_CONFIGURED');
 timestamp=String(timestamp||Math.floor(Date.now()/1000));const bytes=Buffer.isBuffer(rawBody)?rawBody:Buffer.from(String(rawBody??''));return{timestamp,signature:`v1=${signatureFor(secret,timestamp,bytes)}`};
}

function configuredSecret(){const secret=String(process.env.PROVIDER_WEBHOOK_SECRET||'');if(!secret)throw securityError('Provider webhook is not configured',503,'PROVIDER_WEBHOOK_NOT_CONFIGURED');if(secret.length<24)throw securityError('Provider webhook secret is too short',503,'PROVIDER_WEBHOOK_SECRET_WEAK');return secret}

async function readRawBody(req){
 const limit=maxBytes(),chunks=[];let size=0;for await(const chunk of req){const b=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=b.length;if(size>limit)throw securityError('Provider webhook request too large',413,'PROVIDER_WEBHOOK_TOO_LARGE');chunks.push(b)}return Buffer.concat(chunks,size);
}

export async function prepareProviderWebhookRequest(req,url){
 if(req.method!=='POST'||!PROVIDER_PATHS.has(url.pathname))return{providerWebhook:false};
 const contentType=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase();if(contentType!=='application/json')throw securityError('Provider webhook content type must be application/json',415,'PROVIDER_WEBHOOK_CONTENT_TYPE_REQUIRED');
 const secret=configuredSecret(),rawBody=await readRawBody(req),timestamp=String(req.headers['x-provider-timestamp']||'').trim(),provided=parseSignature(req.headers['x-provider-signature']);
 if(!/^\d{10}$/.test(timestamp)||!provided)throw securityError('Signed provider webhook headers required',401,'PROVIDER_WEBHOOK_SIGNATURE_REQUIRED');
 const ts=Number(timestamp),now=Math.floor(Date.now()/1000),window=replayWindowSeconds();if(Math.abs(now-ts)>window)throw securityError('Provider webhook timestamp is outside the replay window',401,'PROVIDER_WEBHOOK_TIMESTAMP_OUT_OF_WINDOW');
 const expected=signatureFor(secret,timestamp,rawBody);if(!safeEqualHex(provided,expected))throw securityError('Invalid provider webhook signature',401,'PROVIDER_WEBHOOK_SIGNATURE_INVALID');
 let body;try{body=rawBody.length?JSON.parse(rawBody.toString('utf8')):{}}catch{throw securityError('Provider webhook body must be valid JSON',400,'PROVIDER_WEBHOOK_INVALID_JSON')}
 if(!body||Array.isArray(body)||typeof body!=='object')throw securityError('Provider webhook body must be a JSON object',400,'PROVIDER_WEBHOOK_INVALID_JSON');
 const externalEventId=String(body.externalEventId||'').trim();if(!externalEventId)throw securityError('Provider webhook externalEventId required',400,'EXTERNAL_EVENT_ID_REQUIRED');
 Object.defineProperty(req,Symbol.asyncIterator,{configurable:true,value:async function*(){if(rawBody.length)yield rawBody;}});
 req.headers['x-provider-secret']=secret;
 req.providerWebhookSecurity={verified:true,version:'v1',timestamp:ts,externalEventId,bodyHash:crypto.createHash('sha256').update(rawBody).digest('hex')};
 return{providerWebhook:true,verified:true,externalEventId,bodyHash:req.providerWebhookSecurity.bodyHash};
}
