import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {Pool} from 'pg';

const storageVars=['OBJECT_STORAGE_ENDPOINT','OBJECT_STORAGE_REGION','OBJECT_STORAGE_ACCESS_ID','OBJECT_STORAGE_ACCESS_SECRET','OBJECT_STORAGE_BUCKET'];
if(!process.env.DATABASE_URL||storageVars.some(k=>!process.env[k])){console.log('ANTIQUA v23 condition storage proof: skipped (database/object storage not configured)');process.exit(0)}

const port=12029,base='http://127.0.0.1:'+port,appSecret=crypto.randomBytes(32).toString('hex'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSL==='disable'?false:{rejectUnauthorized:false},max:4});
const token=crypto.randomUUID().replaceAll('-',''),objectId='obj-v23-storage-'+token,listingId='lst-v23-storage-'+token;
let child=null,requestId=null,mediaId=null;

class Client{
 constructor(){this.cookies=new Map()}
 header(){return[...this.cookies].map(([k,v])=>k+'='+v).join('; ')}
 async call(path,opts={}){
  const headers={'content-type':'application/json',...(opts.headers||{})};if(this.cookies.size)headers.cookie=this.header();
  if(!['GET','HEAD'].includes((opts.method||'GET').toUpperCase())&&this.cookies.get('antiqua_csrf'))headers['x-csrf-token']=decodeURIComponent(this.cookies.get('antiqua_csrf'));
  const r=await fetch(base+path,{...opts,headers});for(const s of r.headers.getSetCookie?.()||[]){const[kv]=s.split(';'),i=kv.indexOf('=');if(i>0)this.cookies.set(kv.slice(0,i),kv.slice(i+1))}
  let body;try{body=await r.json()}catch{body=null}return{r,body}
 }
}
async function start(){
 child=spawn(process.execPath,['server-v14.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),PREVIEW_MODE:'true',APP_SECRET:appSecret,NODE_ENV:'test',PGSSL:'disable'},stdio:['ignore','pipe','pipe']});
 let stderr='';child.stderr?.on('data',b=>stderr+=String(b));
 for(let i=0;i<180;i++){if(child.exitCode!=null)throw new Error('Server exited before readiness: '+stderr);try{const r=await fetch(base+'/api/health');if(r.ok){const h=await r.json();assert.equal(h.persistence.kind,'POSTGRES');assert.equal(h.objectStorage.configured,true);assert.equal(h.commercialServices.conditionReports.contractVersion,'v23');return}}catch{}await sleep(100)}
 throw new Error('Server not ready: '+stderr)
}
async function stop(){if(!child)return;const p=child;child=null;if(p.exitCode==null)p.kill('SIGTERM');await Promise.race([new Promise(r=>p.once('exit',r)),sleep(5000)]);if(p.exitCode==null)p.kill('SIGKILL')}

try{
 const seller=(await pool.query("SELECT * FROM accounts WHERE email='seller@demo.antiqua'")).rows[0];assert.ok(seller?.seller_id);
 await pool.query("INSERT INTO objects(id,object_code,seller_id,passport,catalogue_status,trust_status,publication_status,created_at,updated_at) VALUES($1,$2,$3,$4,'APPROVED','ALLOWED','PUBLIC',now(),now())",[objectId,'AQ-V23-STORAGE-'+token,seller.seller_id,{id:objectId,objectId:'AQ-V23-STORAGE-'+token,title:{en:'Storage proof object',ru:'Предмет проверки хранилища'},sellerId:seller.seller_id,catalogueStatus:'APPROVED',trustStatus:'ALLOWED',publicationStatus:'PUBLIC'}]);
 const payload={id:listingId,lotId:objectId,sellerId:seller.seller_id,saleType:'MAKE_OFFER',price:6400,currency:'EUR',negotiable:true,status:'ACTIVE',shippingFrom:'Amsterdam'};
 await pool.query("INSERT INTO listings(id,object_id,seller_id,status,payload,updated_at) VALUES($1,$2,$3,'ACTIVE',$4,now())",[listingId,objectId,seller.seller_id,payload]);
 await start();

 const buyer=new Client(),dealer=new Client();
 let x=await buyer.call('/api/auth/demo-login',{method:'POST',body:JSON.stringify({persona:'BUYER'})});assert.equal(x.r.status,200);
 x=await dealer.call('/api/auth/demo-login',{method:'POST',body:JSON.stringify({persona:'SELLER'})});assert.equal(x.r.status,200);

 x=await buyer.call('/api/listings/'+listingId+'/condition-report-requests',{method:'POST',body:JSON.stringify({note:'Please provide a detailed signed condition report.',clientActionId:'storage-create-'+token})});
 assert.equal(x.r.status,201);requestId=x.body.request.id;assert.equal(x.body.request.status,'REQUESTED');assert.equal(x.body.request.versions.length,0);

 const bytes=Buffer.from('%PDF-1.4\nANTIQUA v23 private condition report '+crypto.randomUUID()+'\n%%EOF\n'),hash=crypto.createHash('sha256').update(bytes).digest('hex');
 x=await dealer.call('/api/media/upload-intent',{method:'POST',body:JSON.stringify({objectId,bytes:bytes.length,contentType:'application/pdf',sha256:hash,role:'CONDITION'})});
 assert.equal(x.r.status,201);mediaId=x.body.asset.id;assert.equal(x.body.asset.status,'UPLOADING');assert.equal(x.body.asset.visibility,'PRIVATE');assert.equal('storageKey' in x.body.asset,false);
 let put=await fetch(x.body.uploadUrl,{method:'PUT',headers:{'content-type':'application/pdf'},body:bytes});assert.equal(put.ok,true,'signed condition upload failed');
 x=await dealer.call('/api/media/'+mediaId+'/complete',{method:'POST',headers:{'idempotency-key':'condition-complete-'+token},body:'{}'});
 assert.equal(x.r.status,200);assert.equal(x.body.asset.status,'READY');assert.equal(x.body.asset.sha256,hash);

 x=await buyer.call('/api/media/'+mediaId);assert.equal(x.r.status,403);assert.equal(x.body.code,'MEDIA_OWNERSHIP_REQUIRED');
 x=await buyer.call('/api/condition-report-requests/'+requestId+'/versions/1/read');assert.equal(x.r.status,404);assert.equal(x.body.code,'CONDITION_VERSION_NOT_FOUND');

 x=await dealer.call('/api/condition-report-requests/'+requestId+'/versions',{method:'POST',body:JSON.stringify({mediaId,summary:'Inspected under normal and raking light.',conditionGrade:'B+',restorationNotes:'Historic repair documented on underside.',expectedVersion:1,clientActionId:'storage-publish-'+token})});
 assert.equal(x.r.status,201);assert.equal(x.body.request.status,'FULFILLED');assert.equal(x.body.version.versionNo,1);assert.equal(x.body.version.mediaId,mediaId);

 x=await buyer.call('/api/condition-report-requests/'+requestId);assert.equal(x.r.status,200);assert.equal(x.body.request.versions.length,1);assert.equal(x.body.request.versions[0].summary,'Inspected under normal and raking light.');
 x=await buyer.call('/api/condition-report-requests/'+requestId+'/versions/1/read');assert.equal(x.r.status,200);assert.ok(x.body.read.signedUrl);
 const read=await fetch(x.body.read.signedUrl);assert.equal(read.status,200);assert.deepEqual(Buffer.from(await read.arrayBuffer()),bytes);

 const dbVersion=(await pool.query('SELECT version_no,media_id FROM condition_report_versions WHERE request_id=$1',[requestId])).rows[0];assert.equal(dbVersion.version_no,1);assert.equal(dbVersion.media_id,mediaId);
 const dbAsset=(await pool.query('SELECT status,visibility,role,entity_id FROM media_assets WHERE id=$1',[mediaId])).rows[0];assert.deepEqual([dbAsset.status,dbAsset.visibility,dbAsset.role,dbAsset.entity_id],['READY','PRIVATE','CONDITION',objectId]);

 console.log('ANTIQUA v23 condition storage proof: private signed upload + verification + publish + participant signed read + direct buyer media denial passed');
}finally{
 await stop();
 try{
  await pool.query('ALTER TABLE condition_report_versions DISABLE TRIGGER condition_report_versions_immutable_trg').catch(()=>{});
  await pool.query('ALTER TABLE condition_report_events DISABLE TRIGGER condition_report_events_immutable_trg').catch(()=>{});
  if(requestId){await pool.query('DELETE FROM condition_report_events WHERE request_id=$1',[requestId]).catch(()=>{});await pool.query('DELETE FROM condition_report_versions WHERE request_id=$1',[requestId]).catch(()=>{});await pool.query('DELETE FROM condition_report_requests WHERE id=$1',[requestId]).catch(()=>{})}
  if(mediaId)await pool.query('DELETE FROM media_assets WHERE id=$1',[mediaId]).catch(()=>{});
  await pool.query('DELETE FROM listings WHERE id=$1',[listingId]).catch(()=>{});
  await pool.query('DELETE FROM objects WHERE id=$1',[objectId]).catch(()=>{});
 }finally{
  await pool.query('ALTER TABLE condition_report_versions ENABLE TRIGGER condition_report_versions_immutable_trg').catch(()=>{});
  await pool.query('ALTER TABLE condition_report_events ENABLE TRIGGER condition_report_events_immutable_trg').catch(()=>{});
  await pool.end()
 }
}
