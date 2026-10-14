import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  buildProvenanceEvidencePassport,
  buildPortableProvenanceBundle,
  projectPublicProvenanceEvidencePassport
} from '../provenance-evidence-passport-v43.mjs';
import {buildArtworkResearchProjection} from '../artwork-dossier-v51.mjs';

const original=buildProvenanceEvidencePassport({
  object:{
    id:'lot-published',objectCode:'AQ-100',
    passport:{
      title:{ru:'Пейзаж',en:'Landscape'},
      maker:{ru:'Художник',en:'Artist'},
      owner:{name:'SECRET_OWNER_61'},
      attributionStatus:'ATTRIBUTED'
    }
  },
  latestRevision:{id:'rev-1',revisionNo:4,
    passportHash:'x'.repeat(64),createdAt:'2026-10-11T00:00:00Z'},
  entries:[
    {id:'evt-1',sequenceNo:1,
      event:{kind:'OWNERSHIP',conflict:true,ownerName:'SECRET_OWNER_61',
        exactStorageLocation:'PRIVATE_VAULT_ADDR',phone:'PRIVATE_PHONE_70',
        documentToken:'PRIVATE_DOCUMENT_TOKEN_95'},
      evidenceClass:'OWNER_DEALER_STATEMENT',evidenceStatus:'DISPUTED',
      evidenceRef:'s3://private-storage/PRIVATE_DOCUMENT_TOKEN_95'},
    {id:'evt-2',sequenceNo:2,
      event:{kind:'EXHIBITION',description:'SECRET_RESTRICTED_EVENT_DESCRIPTION',
        privateEmail:'SECRET_EMAIL@EXAMPLE.COM'},
      evidenceClass:'INSTITUTIONAL_RECORD',evidenceStatus:'VERIFIED',
      evidenceRef:'https://example.com/PERSONAL_SCAN',unresolved:false}
  ]
});
assert.ok(JSON.stringify(original).includes('SECRET_OWNER_61'),'fixture must contain private data');
const publicView=projectPublicProvenanceEvidencePassport(original);
assert.equal(publicView.work.title.ru,'Пейзаж');
assert.equal(publicView.work.maker.en,'Artist');
assert.equal(publicView.provenanceEvents.length,2);
assert.equal(publicView.provenanceEvents[0].event.kind,'OWNERSHIP');
assert.equal(publicView.provenanceEvents[0].evidenceRef,null);
assert.equal(publicView.provenanceEvents[0].evidenceReferenceRecorded,true);
assert.equal(publicView.evidenceSummary.conflictEventIds.length,1);
assert.equal(publicView.evidenceSummary.gapIndex.byCode.CONFLICTING_ASSERTION,1);
assert.equal(publicView.disclosureBoundary.rawEvidenceReferenceIncluded,false);
assert.equal(publicView.disclosureBoundary.ownerIdentityIncluded,false);
assert.equal(publicView.disclosureBoundary.evidenceHashScope,'DISCLOSED_FIELDS_ONLY');
assert.equal(publicView.assertions.authenticityCertified,false);
assert.notEqual(publicView.evidencePackageSha256,original.evidencePackageSha256);
assert.equal(publicView.evidencePackageSha256.length,64);

const publishedBundle=buildPortableProvenanceBundle(publicView);
const dossier=buildArtworkResearchProjection({
  objectId:'lot-published',
  provenancePassport:publicView,
  scholarlyContributions:[],
  marketHistory:[]
});
for(const data of [publicView,publishedBundle,dossier]){
  const serialized=JSON.stringify(data);
  for(const bad of [
    'SECRET_OWNER_61','PRIVATE_VAULT_ADDR','PRIVATE_PHONE_70',
    'PRIVATE_DOCUMENT_TOKEN_95','SECRET_RESTRICTED_EVENT_DESCRIPTION',
    'SECRET_EMAIL@EXAMPLE.COM','PERSONAL_SCAN','s3://private-storage'
  ])assert.ok(!serialized.includes(bad),'public projection leaked '+bad);
}
const reordered=structuredClone(original);
reordered.provenanceEvents[0].event.ownerName='DIFFERENT_PRIVATE_OWNER';
const publicChanged=projectPublicProvenanceEvidencePassport(reordered);
assert.equal(publicChanged.evidencePackageSha256,publicView.evidencePackageSha256,
  'private-only changes must not modify hash of publicly disclosed fields');
const untrusted=structuredClone(original);
untrusted.provenanceEvents[0].id='private_owner@example.com';
untrusted.provenanceEvents[0].evidenceStatus='PRIVATE_STATUS_OWNER';
untrusted.evidenceSummary.gapIndex.eventGaps=[
  {eventId:'private_owner@example.com',codes:['CONFLICTING_ASSERTION']}
];
const redacted=projectPublicProvenanceEvidencePassport(untrusted);
assert.equal(redacted.provenanceEvents[0].evidenceStatus,'UNSPECIFIED');
assert.equal(redacted.provenanceEvents[0].id,'public-event-1');
assert.equal(redacted.evidenceSummary.gapIndex.eventGaps[0].eventId,'public-event-1');
assert.doesNotMatch(JSON.stringify(redacted),/private_owner@example.com|PRIVATE_STATUS_OWNER/);

const safeChanged=structuredClone(original);
safeChanged.provenanceEvents[0].evidenceStatus='REJECTED';
assert.notEqual(projectPublicProvenanceEvidencePassport(safeChanged).evidencePackageSha256,
  publicView.evidencePackageSha256,'public evidence state change must revise disclosure hash');

// Public API paths must keep requesting publicOnly filtering after refactoring.
const routes=await readFile(new URL('../routes-provenance-passport-v43.mjs',import.meta.url),'utf8');
const dossierSource=await readFile(new URL('../artwork-dossier-v51.mjs',import.meta.url),'utf8');
const source=await readFile(new URL('../provenance-evidence-passport-v43.mjs',import.meta.url),'utf8');
assert.match(routes,/portableProvenanceBundle\(bundleMatch\[1\],\{publicOnly:true\}\)/);
assert.match(routes,/provenanceEvidencePassport\(match\[1\],\{publicOnly:true\}\)/);
assert.match(dossierSource,/provenanceEvidencePassport\(objectId,\{publicOnly:true\}\)/);
assert.match(source,/publicOnly\?projectPublicProvenanceEvidencePassport\(source\):source/);
assert.match(source,/publicOnly\?projectPublicProvenanceEvidencePassport\(sourcePassport\):sourcePassport/);

// Enforce public-only identifiers even when canonical source IDs are
// syntactically harmless but still confidential.
assert.deepEqual(publicView.provenanceEvents.map(x=>x.id),[
  'public-event-1','public-event-2'
]);
assert.equal(publicView.passportRevision.revisionId,'public-revision-4');
assert.equal(publicView.passportRevision.revisionNo,4);
assert.equal(publicView.evidenceSummary.byClass.OWNER_DEALER_STATEMENT,1);
assert.equal(publicView.evidenceSummary.byClass.INSTITUTIONAL_RECORD,1);
assert.equal(publicView.evidenceSummary.gapIndex.totalGaps,
  Object.values(publicView.evidenceSummary.gapIndex.byCode).reduce((a,b)=>a+b,0));
assert.equal(publicView.evidenceSummary.totalEvents,publicView.provenanceEvents.length);

// Public portable bundle must never accidentally serialize a private source
// even if caller forgets to request publicOnly or already has privileged data.
const portableFromPrivate=buildPortableProvenanceBundle(original);
assert.deepEqual(portableFromPrivate.provenanceEvents,publishedBundle.provenanceEvents);
assert.equal(portableFromPrivate.sourcePassportSha256,publicView.evidencePackageSha256);
assert.equal(portableFromPrivate.bundleSha256,publishedBundle.bundleSha256);
for(const confidential of ['evt-1','evt-2','rev-1','SECRET_OWNER_61',
    'PRIVATE_VAULT_ADDR','PRIVATE_PHONE_70','PRIVATE_DOCUMENT_TOKEN_95',
    'SECRET_RESTRICTED_EVENT_DESCRIPTION','SECRET_EMAIL@EXAMPLE.COM']){
  assert.ok(!JSON.stringify(portableFromPrivate).includes(confidential),
    'portable bundle exposed source value '+confidential);
}

// A normal-looking ID and arbitrary revision metadata are still unsafe.
// Restrict them to sequence and revision numbers.
const internalFields=structuredClone(original);
internalFields.provenanceEvents[0].id='SECRET_OWNER_61';
internalFields.passportRevision.revisionId='SECRET_RESEARCH_REVISION';
internalFields.passportRevision.createdAt='SECRET_UNSAFE_DATE';
internalFields.work.attributionStatus='SECRET_PRIVATE_ATTRIBUTION';
internalFields.schemaVersion='SECRET_PRIVATE_SCHEMA';
internalFields.evidenceSummary.completeness='SECRET_PRIVATE_COMPLETENESS';
internalFields.evidenceSummary.byClass={SECRET_PRIVATE_CLASS:12345};
internalFields.evidenceSummary.gapIndex.totalGaps=999;
internalFields.evidenceSummary.gapIndex.byCode={SECRET_PRIVATE_GAP:99};
// The canonical summary must refer to the same event ID. Otherwise the
// event-gap linkage is invalid and cannot be reconstructed from a PII-free ID.
internalFields.evidenceSummary.gapIndex.eventGaps=
  internalFields.evidenceSummary.gapIndex.eventGaps.map(row=>({
    ...row,eventId:row.eventId==='evt-1'?'SECRET_OWNER_61':row.eventId
  }));
const internalRedacted=projectPublicProvenanceEvidencePassport(internalFields);
const internalSerialized=JSON.stringify(internalRedacted);
for(const confidential of ['SECRET_RESEARCH_REVISION','SECRET_UNSAFE_DATE',
  'SECRET_PRIVATE_ATTRIBUTION','SECRET_PRIVATE_SCHEMA','SECRET_PRIVATE_COMPLETENESS',
  'SECRET_PRIVATE_CLASS','SECRET_PRIVATE_GAP','SECRET_OWNER_61']){
  assert.doesNotMatch(internalSerialized,new RegExp(confidential));
}
assert.equal(internalRedacted.passportRevision.revisionId,'public-revision-4');
assert.equal(internalRedacted.passportRevision.createdAt,null);
assert.equal(internalRedacted.work.attributionStatus,'UNSPECIFIED');
assert.equal(internalRedacted.evidenceSummary.totalEvents,2);
assert.equal(internalRedacted.evidenceSummary.gapIndex.byCode.CONFLICTING_ASSERTION,1);
// The public projection remains canonical when called again; it doesn't pick
// up private source hashes or document identifiers on repeated sharing.
const projectedAgain=projectPublicProvenanceEvidencePassport(publicView);
assert.equal(projectedAgain.evidencePackageSha256,publicView.evidencePackageSha256);
assert.deepEqual(projectedAgain.provenanceEvents,publicView.provenanceEvents);

console.log('ANTIQUA P0 public provenance: redaction and no-leak regression PASS');
