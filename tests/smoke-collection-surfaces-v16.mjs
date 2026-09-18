import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {COLLECTION_SURFACES,collectionSurface,collectionSurfaceCapabilities} from '../collection-surfaces-v16.mjs';

assert.equal(Object.keys(COLLECTION_SURFACES).length,3);
assert.equal(collectionSurface('CURATED_COLLECTION').privacy,'VISIBILITY_CONTROLLED');
assert.equal(collectionSurface('COLLECTION_RECORD').privacy,'ACCOUNT_ONLY');
assert.equal(collectionSurface('PERSONAL_LIST_MARKER').privacy,'ACCOUNT_ONLY');
assert.equal(collectionSurface('CURATED_COLLECTION').authoritativeOwnership,false);
assert.equal(collectionSurface('COLLECTION_RECORD').authoritativeOwnership,false);
assert.equal(collectionSurface('PERSONAL_LIST_MARKER').authoritativeOwnership,false);
assert.equal(collectionSurfaceCapabilities().distinctSurfaces,true);

const port=12022,base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['server-v14.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),PREVIEW_MODE:'true',APP_SECRET:crypto.randomBytes(32).toString('hex'),NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
class Client{
  constructor(){this.cookies=new Map()}
  header(){return[...this.cookies].map(([k,v])=>`${k}=${v}`).join('; ')}
  async call(path,opts={}){const method=(opts.method||'GET').toUpperCase(),headers={'content-type':'application/json',...(opts.headers||{})};if(this.cookies.size)headers.cookie=this.header();if(!['GET','HEAD'].includes(method)&&this.cookies.get('antiqua_csrf'))headers['x-csrf-token']=decodeURIComponent(this.cookies.get('antiqua_csrf'));const r=await fetch(base+path,{...opts,headers});for(const s of r.headers.getSetCookie?.()||[]){const [kv]=s.split(';'),i=kv.indexOf('=');if(i>0)this.cookies.set(kv.slice(0,i),kv.slice(i+1))}let body=null;try{body=await r.json()}catch{}return{r,body}}
}
async function register(label){const c=new Client(),x=await c.call('/api/auth/register',{method:'POST',body:JSON.stringify({email:`collection-split-${label}-${crypto.randomUUID()}@example.test`,displayName:`Collection Split ${label}`,password:`Aa1!${crypto.randomBytes(12).toString('hex')}`,accountType:'BUYER'})});assert.equal(x.r.status,201);return c}

try{
  let ready=false;for(let i=0;i<120;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break}}catch{}await sleep(100)}assert.equal(ready,true);

  let x=await fetch(base+'/api/collection-surfaces');assert.equal(x.status,200);let body=await x.json();
  assert.equal(body.collectionSurfaces.curatedCollections.kind,'CURATED_COLLECTION');
  assert.equal(body.collectionSurfaces.privateCollectionRecords.kind,'COLLECTION_RECORD');
  assert.equal(body.collectionSurfaces.personalListMarker.kind,'PERSONAL_LIST_MARKER');

  x=await fetch(base+'/api/collections');assert.equal(x.status,200);body=await x.json();
  assert.equal(body.surface.kind,'CURATED_COLLECTION');
  assert.equal(body.surface.privacy,'VISIBILITY_CONTROLLED');

  const owner=await register('owner'),other=await register('other'),objectId='lot-101';

  // Personal marker is independent: it must not create either a curated Collection membership or Collection Record.
  let r=await owner.call(`/api/lots/${objectId}/collect`,{method:'POST',body:JSON.stringify({enabled:true})});
  assert.equal(r.r.status,200);assert.equal(r.body.surface.kind,'PERSONAL_LIST_MARKER');
  let state=(await owner.call('/api/client-state')).body;
  assert.ok(state.personalList.includes(objectId));assert.ok(state.collection.includes(objectId));
  r=await owner.call('/api/collection-records');assert.equal(r.r.status,200);assert.equal(r.body.surface.kind,'COLLECTION_RECORD');assert.equal(r.body.records.some(y=>y.objectId===objectId),false);

  // Curated Collection membership is a separate narrative/visibility surface.
  r=await owner.call('/api/collections',{method:'POST',body:JSON.stringify({title:'Split proof curated collection',visibility:'PRIVATE',collectionType:'CURATED'})});
  assert.equal(r.r.status,201);assert.equal(r.body.surface.kind,'CURATED_COLLECTION');const collectionId=r.body.collection.id;
  r=await owner.call(`/api/collections/${collectionId}/objects`,{method:'POST',body:JSON.stringify({objectId,section:'Study group',sortOrder:1})});
  assert.equal(r.r.status,200);assert.equal(r.body.surface.kind,'CURATED_COLLECTION');assert.ok(r.body.collection.items.some(y=>y.objectId===objectId));
  r=await owner.call('/api/collection-records');assert.equal(r.body.records.some(y=>y.objectId===objectId),false);
  state=(await owner.call('/api/client-state')).body;assert.ok(state.personalList.includes(objectId));

  // Private operational record can coexist with both surfaces without changing them.
  r=await owner.call(`/api/collection-records/${objectId}`,{method:'PUT',body:JSON.stringify({status:'OWNED',appraisal:{value:125000,currency:'EUR'},storage:{location:'Private vault'},privateNotes:'Operational record only'})});
  assert.equal(r.r.status,200);assert.equal(r.body.surface.kind,'COLLECTION_RECORD');assert.equal(r.body.surface.privacy,'ACCOUNT_ONLY');
  r=await owner.call('/api/collection-records');assert.ok(r.body.records.some(y=>y.objectId===objectId));
  r=await owner.call(`/api/collections/${collectionId}`);assert.equal(r.r.status,200);assert.ok(r.body.collection.items.some(y=>y.objectId===objectId));
  state=(await owner.call('/api/client-state')).body;assert.ok(state.personalList.includes(objectId));

  // Another account inherits none of the private operational or marker state and cannot read the private curated Collection.
  r=await other.call('/api/collection-records');assert.equal(r.r.status,200);assert.equal(r.body.records.some(y=>y.objectId===objectId),false);
  state=(await other.call('/api/client-state')).body;assert.equal((state.personalList||[]).includes(objectId),false);
  assert.equal((await other.call(`/api/collections/${collectionId}`)).r.status,404);

  // Personal marker can be removed without deleting either Collection membership or Collection Record.
  r=await owner.call(`/api/lots/${objectId}/collect`,{method:'POST',body:JSON.stringify({enabled:false})});assert.equal(r.r.status,200);assert.equal(r.body.enabled,false);
  state=(await owner.call('/api/client-state')).body;assert.equal(state.personalList.includes(objectId),false);
  r=await owner.call('/api/collection-records');assert.ok(r.body.records.some(y=>y.objectId===objectId));
  r=await owner.call(`/api/collections/${collectionId}`);assert.ok(r.body.collection.items.some(y=>y.objectId===objectId));

  console.log('ANTIQUA v16 collection surfaces: curated Collection + private Collection Record + Personal List remain independent and privacy-scoped');
}finally{child.kill('SIGTERM')}
