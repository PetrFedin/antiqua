// ANTIQUA v90 — genuine POSTGRES + loopback HTTP for the whole buyer→seller
// diligence chain. Never run against a managed or non-isolated database.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';

const uri=process.env.DATABASE_URL&&new URL(process.env.DATABASE_URL);
if(!uri||process.env.ANTIQUA_ISOLATED_TEST_DB!=='true'||
 !['127.0.0.1','localhost'].includes(uri.hostname)||
 uri.pathname!=='/antiqua_test'||uri.username!=='antiqua'||
 process.env.PREVIEW_MODE!=='true'){
 console.log('ANTIQUA v90 PG HTTP: SKIP — isolated antiqua_test only');
 process.exit(0);
}
const {db}=await import('../runtime-v09.mjs');
assert.equal(db.kind,'POSTGRES');
const buyer=await db.findAccountByEmail('buyer@demo.antiqua');
const seller=await db.findAccountByEmail('seller@demo.antiqua');
assert.ok(buyer?.id&&seller?.sellerId);
const token=crypto.randomUUID().replaceAll('-','');
const id='lot-v90-'+token,code='AQ-V90-'+token,li='lst-v90-'+token;
const otherId='lot-v90-other-'+token,otherLi='lst-v90-other-'+token;
const source='/api/listings/'+li+'/diligence-progress';
const origin='http://127.0.0.1:12290';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const secret=crypto.randomBytes(32).toString('hex');
let server=null;
async function start(){
 server=spawn(process.execPath,['server-v14.mjs'],{
  cwd:new URL('..',import.meta.url),
  env:{...process.env,PORT:'12290',APP_SECRET:secret,
   NODE_ENV:'test',PREVIEW_MODE:'true',PGSSL:'disable'},
  stdio:['ignore','pipe','pipe']
 });
 let stderr='';
 server.stderr.on('data',x=>{stderr+=String(x).slice(0,500)});
 for(let i=0;i<200;i++){
  if(server.exitCode!==null)throw Error('v90 server exited '+stderr.slice(-1500));
  try{const r=await fetch(origin+'/api/health',{signal:AbortSignal.timeout(1000)});
   if(r.status===200)return;}catch{}
  await delay(100);
 }
 throw Error('v90 server did not start '+stderr.slice(-1200));
}
async function stop(){
 if(!server)return;
 const p=server;server=null;
 if(p.exitCode===null)p.kill('SIGTERM');
 await Promise.race([new Promise(resolve=>p.once('exit',resolve)),delay(4000)]);
 if(p.exitCode===null)p.kill('SIGKILL');
}
async function request(path,{method='GET',session,body}={}){
 const headers={accept:'application/json'};
 if(session)headers.cookie=session.cookie;
 if(body!==undefined){
  headers['content-type']='application/json';
  if(session)headers['x-csrf-token']=session.csrf;
 }
 const r=await fetch(origin+path,{method,headers,
  body:body===undefined?undefined:JSON.stringify(body),
  signal:AbortSignal.timeout(10000)});
 return {status:r.status,body:await r.json().catch(()=>null),headers:r.headers};
}
async function login(persona){
 const r=await fetch(origin+'/api/auth/demo-login',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({persona}),signal:AbortSignal.timeout(8000)
 });
 assert.equal(r.status,200);
 const body=await r.json(),cookies=r.headers.getSetCookie().map(x=>x.split(';')[0]);
 assert.equal(cookies.length,2);
 return{csrf:body.csrf,cookie:cookies.join('; ')};
}
const fixture=async(objectId,listingId)=>{
 await db.pool.query(
  "INSERT INTO objects(id,object_code,seller_id,passport,catalogue_status,trust_status,publication_status) VALUES($1,$2,$3,$4,'APPROVED','ALLOWED','PUBLIC')",
  [objectId,code+'-'+objectId,seller.sellerId,{
   title:{ru:'Живопись',en:'Painting'},department:{ru:'Живопись',en:'Painting'},
   owner:{privateEmail:'SECRET_ARTWORK_OWNER_V90'}
  }]
 );
 await db.pool.query(
  "INSERT INTO listings(id,object_id,seller_id,status,payload,updated_at) VALUES($1,$2,$3,'ACTIVE',$4,now())",
  [listingId,objectId,seller.sellerId,{
   id:listingId,lotId:objectId,sellerId:seller.sellerId,
   status:'ACTIVE',saleType:'MAKE_OFFER',price:2000,currency:'EUR'
  }]
 );
};
try{
 await fixture(id,li);await fixture(otherId,otherLi);
 await start();
 assert.equal((await request(source)).status,401,'no session is no disclosure');
 const buyerSession=await login('BUYER');
 const sellerSession=await login('SELLER');
 assert.equal((await request(source,{session:sellerSession})).status,404,
  'seller may also carry BUYER role but can never inspect own listing buyer view');
 assert.equal((await request(source+'?objectId='+otherId,{session:buyerSession})).status,400);
 assert.equal((await request('/api/listings/absent-v90/diligence-progress',{session:buyerSession})).status,404);
 let state=await request(source,{session:buyerSession});
 assert.equal(state.status,200);
 assert.deepEqual(state.body.progress.tracks.map(x=>x.state),['NOT_REQUESTED','NOT_REQUESTED']);
 assert.equal(state.headers.get('cache-control'),'no-store');
 assert.equal(state.headers.get('x-robots-tag'),'noindex');
 const message='Please provide the source catalogue and ownership timeline. '+token;
 // Proves v21 resolves the REAL PostgreSQL listing, not in-memory demo lot.
 const inquiry=await request('/api/inquiries',{
  method:'POST',session:buyerSession,
  body:{listingId:li,inquiryType:'PROVENANCE',message,clientMessageId:'v90-'+crypto.randomUUID()}
 });
 assert.equal(inquiry.status,201,'PG-backed enquiry must create a real thread');
 assert.equal(inquiry.body.conversation?.objectId,id);
 assert.equal(inquiry.body.conversation?.listingId,li);
 state=await request(source,{session:buyerSession});
 assert.equal(state.body.progress.tracks[0].state,'SENT');
 assert.deepEqual((await request('/api/listings/'+otherLi+'/diligence-progress',{session:buyerSession}))
  .body.progress.tracks.map(x=>x.state),['NOT_REQUESTED','NOT_REQUESTED']);
 const created=await request('/api/listings/'+li+'/condition-report-requests',{
  method:'POST',session:buyerSession,
  body:{note:'Document paint layer and previous restoration.',clientActionId:'v90-'+crypto.randomUUID()}
 });
 assert.equal(created.status,201);
 const cr=created.body.request;
 assert.equal(cr.objectId,id);
 assert.equal(cr.status,'REQUESTED');
 state=await request(source,{session:buyerSession});
 assert.deepEqual(state.body.progress.tracks.map(x=>x.state),['SENT','REQUESTED']);
 const reply=await request('/api/conversations/'+inquiry.body.conversation.id+'/messages',{
  method:'POST',session:sellerSession,
  body:{body:'We have relevant catalogues and will respond.',clientMessageId:'v90-'+crypto.randomUUID()}
 });
 assert.equal(reply.status,201);
 state=await request(source,{session:buyerSession});
 assert.equal(state.body.progress.tracks[0].state,'SELLER_REPLIED');
 const media='media-v90-'+token;
 await db.pool.query(
  "INSERT INTO media_assets(id,entity_type,entity_id,storage_key,content_type,bytes,sha256,etag,role,visibility,status,uploaded_at,created_at) VALUES($1,'OBJECT',$2,$3,'application/pdf',128,$4,'etag','CONDITION','PRIVATE','READY',now(),now())",
  [media,id,'proof/v90/'+media+'.pdf','f'.repeat(64)]
 );
 const published=await request('/api/condition-report-requests/'+cr.id+'/versions',{
  method:'POST',session:sellerSession,
  body:{mediaId:media,summary:'Sample conservation observations in controlled local fixture.',
   conditionGrade:'REVIEW_REQUIRED',restorationNotes:'None asserted',
   expectedVersion:1,clientActionId:'v90-'+crypto.randomUUID()}
 });
 assert.equal(published.status,201);
 state=await request(source,{session:buyerSession});
 assert.deepEqual(state.body.progress.tracks.map(x=>x.state),
  ['SELLER_REPLIED','REPORT_PUBLISHED']);
 assert.deepEqual(state.body.progress.summary,{tracks:2,initiated:2,repliedOrPublished:2});
 assert.equal(state.body.progress.limitations.conditionProfessionallyCertified,false);
 assert.equal(state.body.progress.limitations.sourceDocumentsDelivered,false);
 for(const text of ['SECRET_ARTWORK_OWNER_V90',message,'proof/v90/',
  buyer.id,seller.id,media]){
  assert.ok(!JSON.stringify(state.body).includes(text),'private source leaked: '+text);
 }
 const mutate=await request(source,{method:'POST',session:buyerSession,body:{}});
 assert.equal(mutate.status,405);
 assert.equal('progress' in (mutate.body||{}),false);
 console.log('ANTIQUA v90 loopback PostgreSQL/HTTP: real inquiry, reply, versioned condition report, buyer/seller scope, non-certification PASS');
}finally{
 await stop();
 // The whole antiqua_test database is disposable and is destroyed by CI.
 // Do not disable or bypass immutable event triggers just for fixture deletion.
 await db.pool.end().catch(()=>{});
}
