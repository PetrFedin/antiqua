import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {Pool} from 'pg';
import {S3Client,PutObjectCommand} from '@aws-sdk/client-s3';

const storageVars=['OBJECT_STORAGE_ENDPOINT','OBJECT_STORAGE_REGION','OBJECT_STORAGE_ACCESS_ID','OBJECT_STORAGE_ACCESS_SECRET','OBJECT_STORAGE_BUCKET'];
if(!process.env.DATABASE_URL||storageVars.some(k=>!process.env[k])){console.log('ANTIQUA 0.15 media storage proof: skipped (database/object storage not configured)');process.exit(0)}

const port=12024,base=`http://127.0.0.1:${port}`,appSecret=crypto.randomBytes(32).toString('hex'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSL==='disable'?false:{rejectUnauthorized:false},max:4});
const s3=new S3Client({endpoint:process.env.OBJECT_STORAGE_ENDPOINT,region:process.env.OBJECT_STORAGE_REGION,forcePathStyle:true,credentials:{accessKeyId:process.env.OBJECT_STORAGE_ACCESS_ID,secretAccessKey:process.env.OBJECT_STORAGE_ACCESS_SECRET}});
let child=null;

class Client{
  constructor(){this.cookies=new Map()}
  header(){return[...this.cookies].map(([k,v])=>`${k}=${v}`).join('; ')}
  async call(path,opts={}){
    const headers={'content-type':'application/json',...(opts.headers||{})};if(this.cookies.size)headers.cookie=this.header();
    if(!['GET','HEAD'].includes((opts.method||'GET').toUpperCase())&&this.cookies.get('antiqua_csrf'))headers['x-csrf-token']=decodeURIComponent(this.cookies.get('antiqua_csrf'));
    const r=await fetch(base+path,{...opts,headers});for(const s of r.headers.getSetCookie?.()||[]){const[kv]=s.split(';'),i=kv.indexOf('=');if(i>0)this.cookies.set(kv.slice(0,i),kv.slice(i+1))}
    let body;try{body=await r.json()}catch{body=null}return{r,body};
  }
}
async function start(){child=spawn(process.execPath,['server-v14.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),PREVIEW_MODE:'true',APP_SECRET:appSecret,NODE_ENV:'test',PGSSL:'disable'},stdio:['ignore','pipe','pipe']});let stderr='';child.stderr?.on('data',b=>stderr+=String(b));for(let i=0;i<180;i++){if(child.exitCode!=null)throw new Error(`Server exited before readiness: ${stderr}`);try{const r=await fetch(base+'/api/health');if(r.ok){const h=await r.json();assert.equal(h.persistence.kind,'POSTGRES');assert.equal(h.objectStorage.configured,true);return}}catch{}await sleep(100)}throw new Error(`Server not ready: ${stderr}`)}
async function stop(){if(!child)return;const p=child;child=null;if(p.exitCode==null)p.kill('SIGTERM');await Promise.race([new Promise(r=>p.once('exit',r)),sleep(5000)]);if(p.exitCode==null)p.kill('SIGKILL')}
const putSigned=async(url,bytes,contentType)=>fetch(url,{method:'PUT',headers:{'content-type':contentType},body:bytes});
const storageKey=async id=>(await pool.query('SELECT storage_key FROM media_assets WHERE id=$1',[id])).rows[0]?.storage_key;
const intent=async(seller,draftId,{bytes,contentType='image/jpeg',sha256,role='DETAIL'})=>seller.call('/api/media/upload-intent',{method:'POST',body:JSON.stringify({draftId,bytes,contentType,sha256,role})});

try{
  await start();
  const seller=new Client(),buyer=new Client();
  let x=await seller.call('/api/auth/demo-login',{method:'POST',body:JSON.stringify({persona:'SELLER'})});assert.equal(x.r.status,200);
  const buyerPassword=`Aa1!${crypto.randomBytes(18).toString('base64url')}`;x=await buyer.call('/api/auth/register',{method:'POST',body:JSON.stringify({email:`media-buyer-${crypto.randomUUID()}@example.test`,displayName:'Media isolation buyer',password:buyerPassword,accountType:'BUYER'})});assert.equal(x.r.status,201);
  x=await seller.call('/api/seller/drafts',{method:'POST',body:JSON.stringify({titleEn:'Media storage proof',titleRu:'Проверка media storage',categoryEn:'Decorative Arts',categoryRu:'Декоративное искусство'})});assert.equal(x.r.status,201);const draftId=x.body.draft.id;

  const good=Buffer.from(`ANTIQUA private media ${crypto.randomUUID()}`),goodHash=crypto.createHash('sha256').update(good).digest('hex');
  x=await intent(seller,draftId,{bytes:good.length,sha256:goodHash,role:'HERO'});assert.equal(x.r.status,201);const goodAsset=x.body.asset,goodUpload=x.body.uploadUrl;assert.equal(goodAsset.status,'UPLOADING');assert.equal('storageKey' in goodAsset,false);assert.equal(x.body.expiresIn,Number(process.env.OBJECT_STORAGE_UPLOAD_TTL_SECONDS||900));
  let put=await putSigned(goodUpload,good,'image/jpeg');assert.equal(put.ok,true,`signed upload failed: ${put.status} ${await put.text()}`);
  x=await seller.call(`/api/media/${goodAsset.id}/complete`,{method:'POST',body:'{}'});assert.equal(x.r.status,200);assert.equal(x.body.asset.status,'READY');assert.equal(x.body.asset.sha256,goodHash);assert.equal('storageKey' in x.body.asset,false);assert.equal(x.body.read.expiresIn,Number(process.env.OBJECT_STORAGE_READ_TTL_SECONDS||300));
  let read=await fetch(x.body.read.signedUrl);assert.equal(read.status,200);assert.deepEqual(Buffer.from(await read.arrayBuffer()),good);

  const key=await storageKey(goodAsset.id);assert.ok(key);const direct=`${process.env.OBJECT_STORAGE_ENDPOINT}/${process.env.OBJECT_STORAGE_BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`;let anonymous=await fetch(direct);assert.ok([401,403].includes(anonymous.status),`private object unexpectedly readable: ${anonymous.status}`);
  x=await buyer.call(`/api/media/${goodAsset.id}`);assert.equal(x.r.status,403);assert.equal(x.body.code,'MEDIA_OWNERSHIP_REQUIRED');
  x=await buyer.call(`/api/media/${goodAsset.id}/read`);assert.equal(x.r.status,403);assert.equal(x.body.code,'MEDIA_OWNERSHIP_REQUIRED');
  x=await seller.call(`/api/media/${goodAsset.id}/read`);assert.equal(x.r.status,200);const expiringUrl=x.body.read.signedUrl;read=await fetch(expiringUrl);assert.equal(read.status,200);if(Number(process.env.OBJECT_STORAGE_READ_TTL_SECONDS||300)<=2){await sleep(3000);read=await fetch(expiringUrl);assert.ok(read.status>=400,'expired signed read URL remained usable')}

  x=await intent(seller,draftId,{bytes:good.length,contentType:'text/plain'});assert.equal(x.r.status,400);assert.equal(x.body.code,'UNSUPPORTED_MEDIA_TYPE');
  x=await intent(seller,draftId,{bytes:25*1024*1024+1,contentType:'image/jpeg'});assert.equal(x.r.status,400);assert.equal(x.body.code,'MEDIA_TOO_LARGE');
  x=await intent(seller,draftId,{bytes:good.length,contentType:'image/jpeg',role:'EXECUTABLE'});assert.equal(x.r.status,400);assert.equal(x.body.code,'INVALID_MEDIA_ROLE');

  const short=Buffer.from('short-media');x=await intent(seller,draftId,{bytes:short.length+5,contentType:'image/jpeg'});assert.equal(x.r.status,201);const sizeAsset=x.body.asset;put=await putSigned(x.body.uploadUrl,short,'image/jpeg');assert.equal(put.ok,true);x=await seller.call(`/api/media/${sizeAsset.id}/complete`,{method:'POST',body:'{}'});assert.equal(x.r.status,409);assert.equal(x.body.code,'MEDIA_SIZE_MISMATCH');x=await seller.call(`/api/media/${sizeAsset.id}`);assert.equal(x.body.asset.status,'REJECTED');x=await seller.call(`/api/media/${sizeAsset.id}/complete`,{method:'POST',body:'{}'});assert.equal(x.r.status,409);assert.equal(x.body.code,'MEDIA_INVALID_STATE');

  const wrongHash='0'.repeat(64);x=await intent(seller,draftId,{bytes:good.length,contentType:'image/jpeg',sha256:wrongHash});assert.equal(x.r.status,201);const hashAsset=x.body.asset;put=await putSigned(x.body.uploadUrl,good,'image/jpeg');assert.equal(put.ok,true);x=await seller.call(`/api/media/${hashAsset.id}/complete`,{method:'POST',body:'{}'});assert.equal(x.r.status,409);assert.equal(x.body.code,'MEDIA_HASH_MISMATCH');x=await seller.call(`/api/media/${hashAsset.id}`);assert.equal(x.body.asset.status,'REJECTED');

  x=await intent(seller,draftId,{bytes:good.length,contentType:'image/png'});assert.equal(x.r.status,201);const typeAsset=x.body.asset,typeKey=await storageKey(typeAsset.id);await s3.send(new PutObjectCommand({Bucket:process.env.OBJECT_STORAGE_BUCKET,Key:typeKey,Body:good,ContentType:'image/jpeg'}));x=await seller.call(`/api/media/${typeAsset.id}/complete`,{method:'POST',body:'{}'});assert.equal(x.r.status,409);assert.equal(x.body.code,'MEDIA_TYPE_MISMATCH');x=await seller.call(`/api/media/${typeAsset.id}`);assert.equal(x.body.asset.status,'REJECTED');

  const dbReady=(await pool.query('SELECT status,visibility,content_type,bytes,sha256 FROM media_assets WHERE id=$1',[goodAsset.id])).rows[0];assert.equal(dbReady.status,'READY');assert.equal(dbReady.visibility,'PRIVATE');assert.equal(dbReady.content_type,'image/jpeg');assert.equal(Number(dbReady.bytes),good.length);assert.equal(dbReady.sha256,goodHash);
  console.log('ANTIQUA 0.15 media proof: signed upload + strict verify + private read + cross-user denial + URL expiry + size/hash/type rejection passed');
}finally{await stop();await pool.end();s3.destroy()}
