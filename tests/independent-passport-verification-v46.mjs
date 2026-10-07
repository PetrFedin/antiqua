import assert from 'node:assert/strict';
import {buildIndependentVerification} from '../independent-passport-verification-v46.mjs';

const passport={
  evidencePackageSha256:'a'.repeat(64),
  provenanceEvents:[{id:'pe-1',sequenceNo:1,event:{kind:'EXHIBITION'},evidenceClass:'INSTITUTIONAL_RECORD',evidenceStatus:'VERIFIED',evidenceRef:'museum:1',unresolved:false,conflict:false}],
  evidenceSummary:{completeness:'EVIDENCED',gapIndex:{totalGaps:0,byCode:{},eventGaps:[]}}
};
const current={id:'rev-2',revisionNo:2,createdAt:'2026-10-06T00:00:00.000Z'};
const old={id:'rev-1',revisionNo:1,createdAt:'2026-10-05T00:00:00.000Z'};

const match=buildIndependentVerification({objectId:'lot-1',requestedHash:'a'.repeat(64),passport,currentRevision:current,requestedRevision:current});
assert.equal(match.status,'MATCH');
assert.equal(match.hashMatches,true);
assert.equal(match.superseded,false);
assert.equal(match.disclosureBoundary.ownerIdentityIncluded,false);

const mismatch=buildIndependentVerification({objectId:'lot-1',requestedHash:'b'.repeat(64),passport,currentRevision:current,requestedRevision:current});
assert.equal(mismatch.status,'MISMATCH');
assert.equal(mismatch.hashMatches,false);

const superseded=buildIndependentVerification({objectId:'lot-1',requestedHash:'a'.repeat(64),passport,currentRevision:current,requestedRevision:old});
assert.equal(superseded.status,'SUPERSEDED');
assert.equal(superseded.superseded,true);
assert.equal(superseded.disclosureBoundary.authenticityCertified,false);
console.log('independent passport verification v46 PASS');
