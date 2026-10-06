import assert from 'node:assert/strict';
import {buildPortableProvenanceBundle,buildProvenanceEvidenceOverview,buildProvenanceEvidencePassport} from '../provenance-evidence-passport-v43.mjs';

const object={id:'lot-1',objectCode:'A-001',passport:{title:{en:'Work'},maker:{en:'Artist'},attributionStatus:'ATTRIBUTED'}};
const revision={id:'rev-2',revisionNo:2,passportHash:'a'.repeat(64),previousHash:'b'.repeat(64),changeKind:'PROVENANCE_UPDATE',createdAt:'2026-10-06T00:00:00.000Z'};
const entries=[
  {id:'p2',sequenceNo:2,event:{kind:'OWNERSHIP'},evidenceClass:'OWNER_DEALER_STATEMENT',evidenceStatus:'UNVERIFIED',evidenceRef:null},
  {id:'p1',sequenceNo:1,event:{kind:'EXHIBITION'},evidenceClass:'INSTITUTIONAL_RECORD',evidenceStatus:'VERIFIED',evidenceRef:'museum:123'}
];

const one=buildProvenanceEvidencePassport({object,latestRevision:revision,entries});
const two=buildProvenanceEvidencePassport({object,latestRevision:revision,entries:[...entries].reverse()});
assert.equal(one.schemaVersion,'antiqua-provenance-evidence-passport-v1');
assert.equal(one.provenanceEvents[0].id,'p1');
assert.equal(one.evidenceSummary.totalEvents,2);
assert.deepEqual(one.evidenceSummary.unresolvedEventIds,['p2']);
assert.equal(one.evidenceSummary.completeness,'INCOMPLETE');
assert.equal(one.assertions.authenticityCertified,false);
assert.equal(one.assertions.provenanceComplete,false);
assert.equal(one.evidencePackageSha256,two.evidencePackageSha256);
assert.equal(one.evidencePackageSha256.length,64);

const conflicted=buildProvenanceEvidencePassport({object,entries:[{id:'c1',sequenceNo:1,event:{conflict:true},evidenceClass:'SCHOLARLY_PUBLICATION',evidenceStatus:'VERIFIED',evidenceRef:'book:1'}]});
assert.equal(conflicted.evidenceSummary.completeness,'CONFLICTED');
assert.deepEqual(conflicted.evidenceSummary.conflictEventIds,['c1']);
console.log('provenance evidence passport v1 PASS');

const overview=buildProvenanceEvidenceOverview({
  objects:[{id:'lot-1'},{id:'lot-2'},{id:'lot-3'}],
  entries:[
    {objectId:'lot-1',id:'e1',sequenceNo:1,event:{kind:'EXHIBITION'},evidenceClass:'INSTITUTIONAL_RECORD',evidenceStatus:'VERIFIED',evidenceRef:'museum:1'},
    {objectId:'lot-2',id:'e2',sequenceNo:1,event:{kind:'OWNERSHIP'},evidenceClass:'OWNER_DEALER_STATEMENT',evidenceStatus:'UNVERIFIED',evidenceRef:null},
    {objectId:'lot-3',id:'e3',sequenceNo:1,event:{conflict:true},evidenceClass:'SCHOLARLY_PUBLICATION',evidenceStatus:'VERIFIED',evidenceRef:'book:1'}
  ]
});
assert.equal(overview.publicWorks,3);
assert.equal(overview.worksWithProvenance,3);
assert.equal(overview.completeWorks,1);
assert.equal(overview.incompleteWorks,1);
assert.equal(overview.conflictedWorks,1);
assert.equal(overview.assertions.authenticityCertified,false);
assert.equal(overview.assertions.universalScoreUsed,false);
assert.equal(overview.evidenceClasses.INSTITUTIONAL_RECORD,1);
assert.equal(overview.evidenceOverviewSha256.length,64);

const portable=buildPortableProvenanceBundle(buildProvenanceEvidencePassport({
  object:{id:'lot-partner',objectCode:'OBJ-PARTNER',passport:{title:{en:'Work'},maker:{en:'Artist'},attributionStatus:'ATTRIBUTED'}},
  latestRevision:{id:'rev-1',revisionNo:2,passportHash:'abc',previousHash:'def',changeKind:'RESEARCH_UPDATE',createdAt:'2026-10-06T00:00:00.000Z'},
  entries:[{id:'pe-1',sequenceNo:1,event:{kind:'EXHIBITION'},evidenceClass:'INSTITUTIONAL_RECORD',evidenceStatus:'VERIFIED',evidenceRef:'museum:archive:1'}]
}));
assert.equal(portable.schemaVersion,'antiqua-provenance-partner-bundle-v1');
assert.equal(portable.disclosureBoundary.ownerIdentityIncluded,false);
assert.equal(portable.disclosureBoundary.authenticityCertified,false);
assert.equal(portable.signature.status,'unsigned');
assert.equal(portable.bundleSha256.length,64);
assert.equal(portable.provenanceEvents.length,1);
