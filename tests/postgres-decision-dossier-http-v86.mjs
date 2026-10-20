// DD-02: genuine HTTP regression against a disposable loopback PostgreSQL.
// Never run this file against Supabase, Render or any external database.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';

const uri=process.env.DATABASE_URL&&new URL(process.env.DATABASE_URL);
if(!uri||process.env.ANTIQUA_ISOLATED_TEST_DB!=='true'||
 !['127.0.0.1','localhost'].includes(uri.hostname)||
 uri.pathname!=='/antiqua_test'||uri.username!=='antiqua'||
 process.env.PREVIEW_MODE!=='true'){
 console.log('DD-02 HTTP: SKIP (requires the explicitly isolated antiqua_test database)');
 process.exit(0);
}
const {db}=await import('../runtime-v09.mjs');
assert.equal(db.kind,'POSTGRES');
const id='v86-'+crypto.randomUUID(),objectCode='AQ-'+crypto.randomUUID();
const sentinel='SECRET_OWNER_V86_'+crypto.randomUUID().replaceAll('-','');
const pathname='/api/lots/'+encodeURIComponent(id)+'/decision-dossier';
const base='http://127.0.0.1:12286';
const secret=crypto.randomBytes(32).toString('hex');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let processRef=null;
async function start(enabled){
 processRef=spawn(process.execPath,['server-v14.mjs'],{
  cwd:new URL('..',import.meta.url),
  env:{...process.env,PORT:'12286',APP_SECRET:secret,
   NODE_ENV:'test',PREVIEW_MODE:'true',PGSSL:'disable',
   ANTIQUA_DECISION_DOSSIER_HTTP:enabled?'true':'false'},
  stdio:['ignore','pipe','pipe']
 });
 let stderr='';
 processRef.stderr.on('data',chunk=>{stderr+=String(chunk).slice(0,1000)});
 for(let attempt=0;attempt<240;attempt++){
  if(processRef.exitCode!==null)throw Error('v86 server exited: '+stderr.slice(-1800));
  try{const r=await fetch(base+'/api/health',{signal:AbortSignal.timeout(1500)});
   if(r.status===200)return;
  }catch{}
  await delay(100);
 }
 throw Error('v86 server start timed out: '+stderr.slice(-1800));
}
async function stop(){
 if(!processRef)return;
 const proc=processRef;processRef=null;
 if(proc.exitCode===null)proc.kill('SIGTERM');
 await Promise.race([new Promise(resolve=>proc.once('exit',resolve)),delay(4000)]);
 if(proc.exitCode===null)proc.kill('SIGKILL');
}
async function request(path=pathname,options={}){
 const res=await fetch(base+path,{...options,signal:AbortSignal.timeout(8000)});
 const body=await res.json().catch(()=>null);
 return{status:res.status,body,headers:res.headers};
}
const expectHidden=(result,label)=>{
 assert.equal(result.status,404,label);
 assert.deepEqual(result.body,{error:'Artwork not found',code:'ARTWORK_NOT_FOUND'},
  label+' must not reveal whether record exists');
 assert.equal(result.headers.get('cache-control'),'no-store');
};
try{
 await db.pool.query(
  "INSERT INTO objects(id,object_code,passport,catalogue_status,trust_status,publication_status) VALUES($1,$2,$3,'APPROVED','CLEARED','PRIVATE')",
  [id,objectCode,{title:{ru:'Пейзаж',en:'Landscape'},
   maker:{ru:'Автор',en:'Artist'},attributionStatus:'DISPUTED',
   owner:{name:sentinel},storage:{vault:'SECRET_VAULT_V86'}}]
 );
 await db.pool.query(
  "INSERT INTO provenance_entries(id,object_id,sequence_no,event,evidence_class,evidence_status,evidence_ref) VALUES($1,$2,1,$3,'OWNER_DEALER_STATEMENT','DISPUTED',$4)",
  ['v86-prov-'+crypto.randomUUID(),id,{kind:'OWNERSHIP',conflict:true,
   ownerName:sentinel,privateAddress:'SECRET_ADDRESS_V86'},'s3://private/SECRET_DOCUMENT_V86']
 );
 // Even approved+public data cannot be opened before explicit activation.
 await db.pool.query("UPDATE objects SET publication_status='PUBLIC' WHERE id=$1",[id]);
 await start(false);
 const closed=await request();
 assert.equal(closed.status,503);
 assert.equal(closed.body?.code,'DECISION_DOSSIER_NOT_ADMITTED');
 await stop();

 await start(true);
 let got=await request('/api/lots/unknown-v86-object/decision-dossier');
 expectHidden(got,'unknown');
 await db.pool.query("UPDATE objects SET publication_status='PRIVATE' WHERE id=$1",[id]);
 got=await request(pathname+'?publicVisibilityConfirmed=true');
 expectHidden(got,'private object with forged query parameter');
 await db.pool.query(
  "UPDATE objects SET publication_status='PUBLIC',catalogue_status='REVIEW_REQUIRED' WHERE id=$1",
  [id]
 );
 got=await request(pathname);
 expectHidden(got,'public object without approved catalogue');
 await db.pool.query("UPDATE objects SET catalogue_status='APPROVED' WHERE id=$1",[id]);
 const ready=await request(pathname);
 assert.equal(ready.status,200,'public+approved must yield dossier');
 assert.equal(ready.body?.dossier?.work?.title?.ru,'Пейзаж');
 assert.equal(ready.body?.dossier?.provenance?.status,'CONFLICTED');
 assert.equal(ready.body?.dossier?.provenance?.eventCount,1);
 assert.equal(ready.body?.dossier?.provenance?.conflictCount,1);
 assert.match(ready.body?.dossier?.projectionSha256||'',/^[a-f0-9]{64}$/);
 assert.equal(ready.body?.dossier?.disclosure?.privateOwnerIdentityIncluded,false);
 assert.equal(ready.body?.capabilities?.privateRoomsEnabled,false);
 assert.equal(ready.body?.capabilities?.financialValuation,false);
 assert.equal(ready.headers.get('x-robots-tag'),'noindex');
 assert.equal(ready.headers.get('cache-control'),'no-store');
 for(const secretValue of [sentinel,'SECRET_VAULT_V86','SECRET_ADDRESS_V86','SECRET_DOCUMENT_V86'])
  assert.ok(!JSON.stringify(ready.body).includes(secretValue),'v86 leaked '+secretValue);
 const another=await request(pathname);
 assert.equal(another.body?.dossier?.projectionSha256,ready.body?.dossier?.projectionSha256);
 // A disclosure revocation must take effect on the very next request.
 await db.pool.query("UPDATE objects SET publication_status='PRIVATE' WHERE id=$1",[id]);
 expectHidden(await request(pathname),'publication revoked');
 got=await request('/api/lots/%25E0%25A4/decision-dossier');
 expectHidden(got,'malformed identifier');
 const mutation=await request(pathname,{method:'POST'});
 assert.notEqual(mutation.status,200,'GET-only read model cannot mutate');
 assert.equal('dossier' in (mutation.body||{}),false);
 console.log('ANTIQUA v86 isolated PostgreSQL / real HTTP Decision Dossier admission PASS');
}finally{
 await stop();
 await db.pool.query('DELETE FROM provenance_entries WHERE object_id=$1',[id]).catch(()=>{});
 await db.pool.query('DELETE FROM objects WHERE id=$1',[id]).catch(()=>{});
 await db.pool.end().catch(()=>{});
}