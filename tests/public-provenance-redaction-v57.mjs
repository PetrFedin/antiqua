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
console.log('ANTIQUA P0 public provenance: redaction and no-leak regression PASS');
