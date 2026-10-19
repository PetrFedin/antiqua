import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const uri=process.env.DATABASE_URL&&new URL(process.env.DATABASE_URL);
if(!uri||process.env.ANTIQUA_ISOLATED_TEST_DB!=='true'||!['127.0.0.1','localhost'].includes(uri.hostname)||!uri.pathname.endsWith('_test')){
 console.log('v84 review snapshot: SKIP (isolated local _test database required)');process.exit(0);
}
const {db}=await import('../runtime-v09.mjs');
const {createCollection,addCollectionObject}=await import('../collection-graph-v10.mjs');
const {transitionCollectionPublication:move,collectionReviewDossier:dossier,collectionPublicationStatus:status}=await import('../collection-publication-v73.mjs');
const owner=await db.findAccountByEmail('buyer@demo.antiqua');
const operator=await db.findAccountByEmail('operator@demo.antiqua');
const catalogue={...operator,roles:['CATALOGUER']};
const rights=await db.createAccount({id:'v84-'+crypto.randomUUID(),email:crypto.randomUUID()+'@example.test',displayName:'QA rights',passwordHash:'test',accountType:'STAFF',status:'ACTIVE',roles:['TRUST_REVIEWER'],twofaStatus:'DISABLED',createdAt:new Date().toISOString()});
let id;
const fails=async(p,code)=>assert.rejects(p,e=>e.code===code,code);
const note='Independently assessed current dossier';
const refs=[{objectId:'lot-108',evidenceRef:'evidence/v84/painting-108',rightsBasis:'CC0'}];
try{
 id=(await createCollection(owner,{title:'Review snapshot '+crypto.randomUUID(),visibility:'PUBLIC'})).id;
 await addCollectionObject(owner,id,{objectId:'lot-108',ownerDisplayMode:'ANONYMOUS',locationDisplayMode:'HIDDEN'});
 await move(owner,id,'SUBMIT');
 const first=await dossier(catalogue,id);
 assert.match(first.reviewToken,/^[a-f0-9]{64}$/);
 await fails(move(catalogue,id,'APPROVE',{note}),'REVIEW_TOKEN_REQUIRED');
 await fails(move(catalogue,id,'APPROVE',{note,reviewToken:'invalid'}),'REVIEW_TOKEN_REQUIRED');
 assert.equal((await status(owner,id)).events.length,1);
 await move(catalogue,id,'REQUEST_CHANGES',{note,reviewToken:first.reviewToken});
 await move(owner,id,'SUBMIT'); // identical composition, new review round
 const second=await dossier(catalogue,id);
 assert.equal(first.submittedDigest,second.submittedDigest);
 assert.notEqual(first.reviewToken,second.reviewToken);
 await fails(move(catalogue,id,'APPROVE',{note,reviewToken:first.reviewToken}),'STALE_REVIEW');
 assert.equal((await status(owner,id)).events.length,3,'stale approval writes no event');
 await move(catalogue,id,'APPROVE',{note,reviewToken:second.reviewToken});
 const oldRights=await dossier(rights,id);
 await move(rights,id,'REQUEST_CHANGES',{note,reviewToken:oldRights.reviewToken});
 await move(owner,id,'SUBMIT');
 await move(catalogue,id,'APPROVE',{note,reviewToken:(await dossier(catalogue,id)).reviewToken});
 await fails(move(rights,id,'PUBLISH',{note,rightsAttested:true,evidenceRefs:refs,reviewToken:oldRights.reviewToken}),'STALE_REVIEW');
 const current=await dossier(rights,id);
 const payload={note,reviewToken:current.reviewToken,rightsAttested:true,evidenceRefs:refs,idempotencyKey:'v84-publish-0001'};
 const published=await move(rights,id,'PUBLISH',payload);assert.equal(published.publicationState,'PUBLISHED');
 await move(rights,id,'REVOKE',{note,reviewToken:(await dossier(rights,id)).reviewToken});
 const replay=await move(rights,id,'PUBLISH',payload);
 assert.equal(replay.idempotent,true);assert.equal(replay.publicationState,'REVOKED');
 await fails(move(rights,id,'PUBLISH',{...payload,reviewToken:'f'.repeat(64)}),'IDEMPOTENCY_CONFLICT');
 // Pre-v84 replay compatibility: construct the old request-hash fixture only
 // inside the disposable DB. No fresh decision may use this compatibility path.
 const legacyHash=crypto.createHash('sha256').update(JSON.stringify({action:'PUBLISH',note,requestedEvidence:refs,rightsAttested:true},function(k,v){return v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v})).digest('hex');
 await db.pool.query('UPDATE collection_publication_events SET request_hash=$2 WHERE collection_id=$1 AND idempotency_key=$3',[id,legacyHash,payload.idempotencyKey]);
 const {reviewToken,...legacyPayload}=payload;
 assert.equal((await move(rights,id,'PUBLISH',legacyPayload)).idempotent,true);
 const history=await status(owner,id);assert.equal(history.events.length,9);
 console.log('ANTIQUA v84 review snapshot: mandatory token, same-content resubmission, stale rights, replay and legacy compatibility PASS');
}finally{
 if(id)await db.pool.query('DELETE FROM collections WHERE id=$1',[id]);
 await db.pool.query('DELETE FROM accounts WHERE id=$1',[rights.id]);await db.pool.end();
}
