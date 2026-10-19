// v81: real HTTP/publication lifecycle using isolated PostgreSQL and actual cookies.
// Never connect this test to a managed or non-local database.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
const uri=process.env.DATABASE_URL&&new URL(process.env.DATABASE_URL);
if(!uri||process.env.ANTIQUA_ISOLATED_TEST_DB!=='true'||
 !['127.0.0.1','localhost'].includes(uri.hostname)||!uri.pathname.endsWith('_test')){
 console.log('v81 HTTP publication lifecycle: SKIP (isolated local _test database required)');
 process.exit(0);
}
const {db,hashPassword}=await import('../runtime-v09.mjs');
assert.equal(db.kind,'POSTGRES');
const port=12281,base='http://127.0.0.1:'+port,nonce=crypto.randomUUID();
const sleep=n=>new Promise(resolve=>setTimeout(resolve,n));
const secrets=crypto.randomBytes(32).toString('hex');
let child,collectionId=null,accounts=[];
class Client{
 constructor(){this.cookies=new Map()}
 async request(path,{method='GET',body,csrf=true,headers={}}={}){
  const requestHeaders={'content-type':'application/json',...headers};
  if(this.cookies.size)requestHeaders.cookie=[...this.cookies].map(([k,v])=>k+'='+v).join('; ');
  if(csrf&&!['GET','HEAD','OPTIONS'].includes(method)&&this.cookies.has('antiqua_csrf'))
   requestHeaders['x-csrf-token']=decodeURIComponent(this.cookies.get('antiqua_csrf'));
  const r=await fetch(base+path,{method,headers:requestHeaders,body:body===undefined?undefined:JSON.stringify(body)});
  for(const line of r.headers.getSetCookie?.()||[]){
   const part=line.split(';')[0],i=part.indexOf('=');
   if(i>0)this.cookies.set(part.slice(0,i),part.slice(i+1));
  }
  let result={};try{result=await r.json()}catch{}
  return{status:r.status,data:result};
 }
 async post(path,body={},csrf=true){
  if(/\/publication\/(approve|publish|request-changes|revoke)$/.test(path)&&!Object.hasOwn(body,'reviewToken')){
   const dossier=await this.get(path.replace(/\/[^/]+$/,'/review'));
   body={...body,reviewToken:dossier.data.reviewToken};
  }
  return this.request(path,{method:'POST',body,csrf});
 }
 async get(path){return this.request(path)}
}
async function createUser(label,roles){
 const email=label+'-'+nonce+'@example.test',password='Pass!'+crypto.randomBytes(10).toString('hex')+'Ab1';
 const row=await db.createAccount({
  id:'acct-http-'+crypto.randomUUID(),email,displayName:'QA '+label,
  passwordHash:await hashPassword(password),accountType:roles.includes('BUYER')?'BUYER':'STAFF',
  status:'ACTIVE',sellerId:null,twofaStatus:'DISABLED',twofaSecretEnc:null,
  roles,createdAt:new Date().toISOString()
 });
 accounts.push(row.id);
 const client=new Client(),login=await client.post('/api/auth/login',{email,password});
 assert.equal(login.status,200,'role '+label+' must authenticate');
 return client;
}
async function start(){
 child=spawn(process.execPath,['server-v14.mjs'],{
  cwd:new URL('..',import.meta.url),
  env:{...process.env,PORT:String(port),APP_SECRET:secrets,PREVIEW_MODE:'true',
   NODE_ENV:'test',PGSSL:'disable'},
  stdio:['ignore','pipe','pipe']
 });
 let stderr='';
 child.stderr.on('data',chunk=>{stderr+=String(chunk).slice(0,1800)});
 for(let i=0;i<200;i++){
  if(child.exitCode!=null)throw new Error('Server startup failed: '+stderr.slice(-2000));
  try{const r=await fetch(base+'/api/health');if(r.ok)return}catch{}
  await sleep(100);
 }
 throw new Error('Timeout waiting for isolated server: '+stderr.slice(-2000));
}
async function stop(){
 if(!child)return;
 const proc=child;child=null;
 if(proc.exitCode===null)proc.kill('SIGTERM');
 await Promise.race([new Promise(resolve=>proc.once('exit',resolve)),sleep(4000)]);
 if(proc.exitCode===null)proc.kill('SIGKILL');
}
const expectStatus=(actual,status,label)=>assert.equal(actual.status,status,label+': '+JSON.stringify(actual.data).slice(0,400));
const evidence=[{objectId:'lot-108',rightsBasis:'CC0',evidenceRef:'evidence/test/v81-image-108'}];
try{
 await start();
 const guest=new Client();
 const owner=await createUser('owner',['BUYER']);
 const catalogue=await createUser('catalogue',['CATALOGUER','TRUST_REVIEWER']);
 const rights=await createUser('rights',['TRUST_REVIEWER']);
 expectStatus(await guest.get('/api/collection-publication/queue'),401,'anonymous queue');
 expectStatus(await owner.get('/api/collection-publication/queue'),403,'owner reviewer queue');
 const created=await owner.post('/api/collections',{title:'QA paintings '+nonce,visibility:'PUBLIC',collectionType:'CURATED'});
 expectStatus(created,201,'create public-but-unreviewed collection');collectionId=created.data.collection.id;
 expectStatus(await owner.post('/api/collections/'+collectionId+'/objects',{objectId:'lot-108',section:'Study',ownerDisplayMode:'ANONYMOUS',locationDisplayMode:'HIDDEN'}),200,'add painting');
 const pub='/api/collections/'+collectionId+'/publication';
 expectStatus(await guest.get(pub),401,'guest history');
 expectStatus(await guest.post(pub+'/submit',{}),401,'guest submit');
 expectStatus(await owner.post(pub+'/submit',{},false),403,'missing CSRF denied');
 expectStatus(await catalogue.get(pub),404,'cataloguer cannot enumerate draft owner data');
 expectStatus(await rights.get(pub+'/review'),404,'rights reviewer cannot read draft');
 const before=await guest.get('/api/collections');expectStatus(before,200,'public index');
 assert.ok(!before.data.collections.some(c=>c.id===collectionId),'PUBLIC is not publication consent');
 const submitted=await owner.post(pub+'/submit',{idempotencyKey:'qa-submit-0001'});
 expectStatus(submitted,200,'submit');
 assert.equal(submitted.data.publicationState,'SUBMITTED');
 let history=await owner.get(pub);assert.equal(history.data.events.length,1);
 let queue=await catalogue.get('/api/collection-publication/queue?limit=1');
 expectStatus(queue,200,'catalogue queue');
 assert.ok(queue.data.items.some(c=>c.id===collectionId),'cataloguer sees eligible case');
 queue=await rights.get('/api/collection-publication/queue');
 assert.ok(!queue.data.items.some(c=>c.id===collectionId),'rights reviewer cannot act on submitted case');
 const dossier=await catalogue.get(pub+'/review');
 expectStatus(dossier,200,'catalogue reviewer dossier');
 assert.equal(dossier.data.works.length,1);
 for(const secret of ['ownerAccountId','owner_account_id','note','privateNotes','storage','insurance','media_evidence'])
  assert.ok(!JSON.stringify(dossier.data).includes('"'+secret+'"'),'secret '+secret+' must not appear');
 expectStatus(await rights.get(pub+'/review'),404,'off-stage dossier hidden');
 expectStatus(await catalogue.post(pub+'/approve',{note:'Must open a current version',reviewToken:null}),428,'missing review token fails closed');
 expectStatus(await rights.post(pub+'/request-changes',{note:'Off-stage rights feedback must not succeed'}),404,'off-stage rights feedback');
 expectStatus(await rights.post(pub+'/publish',{note:'Cannot skip independent catalogue stage',rightsAttested:true,evidenceRefs:evidence}),404,'cannot skip stage via POST');
 expectStatus(await catalogue.post(pub+'/approve',{note:'Catalogue evidence has been reviewed',idempotencyKey:'qa-approve-0001'},false),403,'catalogue CSRF is mandatory');
 history=await owner.get(pub);assert.equal(history.data.events.length,1,'failed requests do not append decisions');
 expectStatus(await catalogue.post(pub+'/request-changes',{note:'Please clarify attribution and sources'}),200,'catalogue requests changes');
 history=await owner.get(pub);assert.equal(history.data.publicationState,'CHANGES_REQUESTED');
 assert.equal(history.data.events.length,2);
 expectStatus(await owner.post(pub+'/submit',{idempotencyKey:'qa-submit-0002'}),200,'owner resubmission');
 expectStatus(await catalogue.post(pub+'/approve',{note:'Old screen must not approve a resubmission',reviewToken:dossier.data.reviewToken}),409,'stale round denied over HTTP');
 assert.equal((await owner.get(pub)).data.events.length,3,'stale round adds no event');
 const approved=await catalogue.post(pub+'/approve',{note:'Catalogue source review independently completed',idempotencyKey:'qa-approve-0001'});
 expectStatus(approved,200,'catalogue approval');assert.equal(approved.data.publicationState,'CATALOGUE_APPROVED');
 expectStatus(await catalogue.post(pub+'/request-changes',{note:'Cannot return rights-stage case as cataloguer'}),404,'reviewer cannot cross stage');
 expectStatus(await catalogue.post(pub+'/publish',{note:'Same catalogue actor must not publish',rightsAttested:true,evidenceRefs:evidence}),404,'same catalogue reviewer cannot publish');
 expectStatus(await rights.post(pub+'/publish',{note:'No attestation provided',evidenceRefs:evidence}),422,'rights attestation required');
 const reviewed=await rights.get(pub+'/review');
 expectStatus(reviewed,200,'rights reviewer dossier');assert.equal(reviewed.data.stage,'RIGHTS');
 const publishToken=reviewed.data.reviewToken;
 const decision=await rights.post(pub+'/publish',{reviewToken:publishToken,note:'Rights references reviewed independently for each work',rightsAttested:true,evidenceRefs:evidence,idempotencyKey:'qa-publish-0001'});
 expectStatus(decision,200,'publish after independent review');assert.equal(decision.data.publicationState,'PUBLISHED');
 const publicList=await guest.get('/api/collections');
 assert.ok(publicList.data.collections.some(c=>c.id===collectionId),'public index opens only after dual review');
 const same=await owner.post('/api/collections/'+collectionId+'/objects',{objectId:'lot-108'});
 expectStatus(same,200,'idempotent member retry');
 assert.equal((await owner.get(pub)).data.publicationState,'PUBLISHED','no-op does not revoke');
 expectStatus(await catalogue.post(pub+'/revoke',{note:'Catalogue reviewer cannot independently revoke publication'}),404,'cross-review revocation denied');
 const revoked=await rights.post(pub+'/revoke',{note:'Rights permission was subsequently withdrawn',idempotencyKey:'qa-revoke-0001'});
 expectStatus(revoked,200,'independent reviewer revocation');
 assert.equal(revoked.data.publicationState,'REVOKED');
 assert.ok(!(await guest.get('/api/collections')).data.collections.some(c=>c.id===collectionId),'revocation removes public item');
 const replay=await rights.post(pub+'/publish',{reviewToken:publishToken,note:'Rights references reviewed independently for each work',rightsAttested:true,evidenceRefs:evidence,idempotencyKey:'qa-publish-0001'});
 expectStatus(replay,200,'replay after revocation');assert.equal(replay.data.idempotent,true);assert.equal(replay.data.publicationState,'REVOKED');
 const final=await owner.get(pub);
 assert.deepEqual(final.data.events.map(e=>e.sequenceNo),[1,2,3,4,5,6]);
 assert.deepEqual(final.data.events.map(e=>e.action),['SUBMIT','REQUEST_CHANGES','SUBMIT','APPROVE','PUBLISH','REVOKE']);
 console.log('ANTIQUA v81 HTTP publishing: roles, CSRF, stages, idempotency, redaction, revoke PASS');
}finally{
 await stop();
 if(collectionId)await db.pool.query('DELETE FROM collections WHERE id=$1',[collectionId]).catch(()=>{});
 if(accounts.length){
  await db.pool.query('DELETE FROM audit_log WHERE actor_account_id=ANY($1::text[])',[accounts]).catch(()=>{});
  await db.pool.query('DELETE FROM accounts WHERE id=ANY($1::text[])',[accounts]).catch(()=>{});
 }
 await db.pool.end();
}
