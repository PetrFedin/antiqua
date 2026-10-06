import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
  PROVENANCE_ATTESTATION_VERSION,
  registerProvenanceIssuer,
  verifyProvenanceAttestationEnvelope,
  ingestProvenanceAttestation,
  revokeProvenanceAttestation,
  provenanceAttestationGraph
} from '../provenance-attestations-v44.mjs';

const admin={id:'acct-trust-test',roles:['ADMIN']};
const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519');
const publicKeyPem=publicKey.export({format:'pem',type:'spki'}).toString();

await registerProvenanceIssuer(admin,{
  id:'museum-test',
  displayName:'Museum Test Authority',
  keyId:'museum-key-1',
  algorithm:'Ed25519',
  publicKeyPem
});

function stable(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
}
function envelope(assertionType,statement){
  const payload={
    attestationVersion:PROVENANCE_ATTESTATION_VERSION,
    issuerId:'museum-test',
    keyId:'museum-key-1',
    alg:'Ed25519',
    objectId:'lot-attestation-test',
    passportRevisionId:'revision-test-1',
    passportHash:'a'.repeat(64),
    assertionType,
    assertionScope:'ATTRIBUTION',
    statement,
    evidenceRef:'archive:test:1',
    issuedAt:'2026-10-06T12:00:00.000Z'
  };
  const signature=crypto.sign(null,Buffer.from(stable(payload),'utf8'),privateKey).toString('base64url');
  const credentialSha256=crypto.createHash('sha256').update(stable({payload,signature})).digest('hex');
  return {payload,signature,credentialSha256};
}

const support=envelope('SUPPORT','Archive record supports the stated attribution.');
const contradict=envelope('CONTRADICT','Catalogue note records a competing attribution.');

const verified=await verifyProvenanceAttestationEnvelope(support);
assert.equal(verified.status,'VALID');
assert.equal(verified.signatureValid,true);

const tampered={...support,payload:{...support.payload,statement:'Tampered statement'}};
const invalid=await verifyProvenanceAttestationEnvelope(tampered);
assert.equal(invalid.status,'INVALID_ENVELOPE_HASH');

const supportRow=await ingestProvenanceAttestation(admin,support);
const contradictRow=await ingestProvenanceAttestation(admin,contradict);
assert.equal(supportRow.assertionType,'SUPPORT');
assert.equal(contradictRow.assertionType,'CONTRADICT');

let graph=await provenanceAttestationGraph('lot-attestation-test');
assert.equal(graph.attestations.length,2);
assert.equal(graph.truthBoundary.platformDeterminesTruth,false);
assert.equal(graph.truthBoundary.competingAssertionsPreserved,true);
assert.equal(graph.truthBoundary.authenticityCertified,false);

await revokeProvenanceAttestation(admin,supportRow.id,'Issuer withdrew this attestation.');
graph=await provenanceAttestationGraph('lot-attestation-test');
assert.equal(graph.summary.revoked,1);
assert.equal(graph.attestations.find(x=>x.id===supportRow.id).status,'REVOKED');
assert.ok(graph.attestations.some(x=>x.assertionType==='CONTRADICT'));

console.log('provenance attestation trust v44 PASS');
