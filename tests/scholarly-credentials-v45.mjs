import assert from 'node:assert/strict';
import {publicCredentialProjection,scholarlyCredentialCapabilities} from '../scholarly-credentials-v45.mjs';

const c=publicCredentialProjection({
  id:'cred-1',issuerOrganizationId:'museum-1',subjectAccountId:'acct-1',
  credentialType:'CATALOGUE_COMMITTEE_MEMBER',projectRef:'artist-x',roleLabel:'Committee member',
  scope:{artistId:'artist-x'},status:'ACTIVE',issuedAt:'2026-10-06T00:00:00.000Z'
});
assert.equal(c.credentialType,'CATALOGUE_COMMITTEE_MEMBER');
assert.equal(c.assertions.roleScopeAttested,true);
assert.equal(c.assertions.scholarlyConclusionCertified,false);
assert.equal(c.assertions.authenticityCertified,false);
const caps=scholarlyCredentialCapabilities();
assert.equal(caps.provesScholarlyCorrectness,false);
assert.equal(caps.supportsRevocation,true);
assert.equal(caps.supportsSupersession,true);
console.log('scoped scholarly credentials v45 PASS');
