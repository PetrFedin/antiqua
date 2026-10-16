import assert from 'node:assert/strict';
import crypto from 'node:crypto';
if(!process.env.DATABASE_URL){console.log('v73 publication authority skipped: no isolated PostgreSQL');process.exit(0)}
const {db}=await import('../runtime-v09.mjs');
const {transitionCollectionPublication,collectionPublicationStatus}=await import('../collection-publication-v73.mjs');
const {createCollection,addCollectionObject,listCollections,getReadableCollection}=await import('../collection-graph-v10.mjs');
const seller=await db.findAccountByEmail('buyer@demo.antiqua'),operator=await db.findAccountByEmail('operator@demo.antiqua');
assert.equal(db.kind,'POSTGRES');assert.ok(seller&&operator);
const independent=await db.createAccount({id:'acct-review-'+crypto.randomUUID(),email:crypto.randomUUID()+'@example.test',displayName:'Rights Reviewer',passwordHash:'test',accountType:'BUYER',status:'ACTIVE',sellerId:null,twofaStatus:'DISABLED',twofaSecretEnc:null,roles:['TRUST_REVIEWER'],createdAt:new Date().toISOString()});
const reviewer={...operator,roles:['CATALOGUER']};
let id=null;
const failure=async(p,code)=>{await assert.rejects(p,e=>e.code===code,code)};
try{
 const c=await createCollection(seller,{title:'Paintings '+crypto.randomUUID(),visibility:'PUBLIC'});id=c.id;
 await addCollectionObject(seller,id,{objectId:'lot-108',ownerDisplayMode:'ANONYMOUS',locationDisplayMode:'HIDDEN'});
 await failure(transitionCollectionPublication(seller,id,'APPROVE',{note:'Attempt to approve own work'}),'INDEPENDENT_REVIEW_REQUIRED');
 const submitted=await transitionCollectionPublication(seller,id,'SUBMIT',{idempotencyKey:'submit-first-0001'});
 assert.equal(submitted.publicationState,'SUBMITTED');
 const repeat=await transitionCollectionPublication(seller,id,'SUBMIT',{idempotencyKey:'submit-first-0001'});assert.equal(repeat.idempotent,true);
 await failure(transitionCollectionPublication(seller,id,'SUBMIT',{idempotencyKey:'submit-first-0001',note:'mismatched'}),'IDEMPOTENCY_CONFLICT');
 await failure(transitionCollectionPublication(independent,id,'PUBLISH',{note:'Attempt to skip catalogue',rightsAttested:true,evidenceRefs:[{objectId:'lot-108',evidenceRef:'evidence/test/painting-108',rightsBasis:'CC0'}]}),'STALE_APPROVAL');
 const approved=await transitionCollectionPublication(reviewer,id,'APPROVE',{note:'Catalogue evidence reviewed and accepted'});assert.equal(approved.publicationState,'CATALOGUE_APPROVED');
 await failure(transitionCollectionPublication(reviewer,id,'PUBLISH',{note:'Same reviewer disallowed',rightsAttested:true,evidenceRefs:[{objectId:'lot-108',evidenceRef:'evidence/test/painting-108',rightsBasis:'CC0'}]}),'FORBIDDEN');
 await failure(transitionCollectionPublication(independent,id,'PUBLISH',{note:'Rights check missing references',rightsAttested:true,evidenceRefs:[]}), 'MEDIA_EVIDENCE_REQUIRED');
 const published=await transitionCollectionPublication(independent,id,'PUBLISH',{note:'Independent rights review recorded',rightsAttested:true,evidenceRefs:[{objectId:'lot-108',evidenceRef:'evidence/test/painting-108',rightsBasis:'CC0'}]});assert.equal(published.publicationState,'PUBLISHED');
 const visible=(await listCollections()).find(x=>x.id===id);assert.ok(visible);assert.equal(visible.metadata.discipline,'PAINTING','frontend publication gate must recognize reviewed artwork category');assert.ok((await getReadableCollection(id,null))?.id===id);
 const audit=await collectionPublicationStatus(seller,id);assert.deepEqual(audit.events.map(x=>x.sequenceNo),[1,2,3]);
 await addCollectionObject(seller,id,{objectId:'lot-109'});
 assert.equal((await getReadableCollection(id,null)),null,'composition invalidates rights admission');
 const after=await collectionPublicationStatus(seller,id);assert.equal(after.publicationState,'REVIEW_REQUIRED');
 assert.ok(!(await listCollections()).some(x=>x.id===id));
 console.log('ANTIQUA v73 publication authority PostgreSQL two-person + snapshot + revocation on edit PASS');
}finally{
 if(id)await db.pool.query('DELETE FROM collections WHERE id=$1',[id]).catch(()=>{});
 await db.pool.query('DELETE FROM accounts WHERE id=$1',[independent.id]).catch(()=>{});
 await db.pool.end();
}
