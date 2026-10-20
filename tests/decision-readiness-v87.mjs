import assert from 'node:assert/strict';
import {buildDecisionReadinessV87,READINESS_SCHEMA_V87} from '../decision-readiness-v87.mjs';

const dossier={
 schemaVersion:'antiqua-decision-dossier-contract-v2',objectId:'painting-v87',
 projectionSha256:'a'.repeat(64),
 source:{authority:'antiqua-artwork-dossier-public-v58',
  publicEvidenceProjectionSha256:'b'.repeat(64),
  evidenceHashScope:'DISCLOSED_FIELDS_ONLY'},
 work:{title:{ru:'Пейзаж',en:'Landscape'},artist:{ru:'Автор',en:'Artist'},attributionStatus:'DISPUTED'},
 provenance:{status:'CONFLICTED',events:[{id:'public-event-1',conflict:true,evidenceStatus:'DISPUTED'}],
  conflictCount:1,unresolvedCount:1},
 scholarship:[],scholarlyDisclosureStatus:'REQUIRES_EXPLICIT_PUBLICATION_GRANT',
 marketHistory:[],condition:{status:'NOT_ASSESSED',assessment:null},
 currentSale:{status:'NOT_ASSESSED',askingPrice:null,offerEnabled:false},
 disclosure:{scope:'PUBLIC_ONLY',authenticityCertified:false,attributionCertified:false,
 privateOwnerIdentityIncluded:false,privateDocumentsIncluded:false,privateEventIdsIncluded:false,
 privateSaleIdentityIncluded:false,investmentReturnProjected:false},
 confidentialOwner:{name:'SECRET_OWNER_V87'},
 evidenceLinks:[{privateUrl:'s3://private/SECRET_DOC_V87'}]
};
const original=structuredClone(dossier);
const report=buildDecisionReadinessV87(dossier);
assert.equal(report.schemaVersion,READINESS_SCHEMA_V87);
assert.equal(report.sourceProjectionSha256,dossier.projectionSha256);
assert.equal(report.decisionState,'HUMAN_REVIEW_REQUIRED');
assert.equal(report.checks.length,8);
assert.deepEqual(report.checks.map(x=>x.code),[
 'ARTWORK_IDENTITY','ATTRIBUTION','PROVENANCE','CONDITION',
 'SCHOLARSHIP','SALE_HISTORY','LEGAL_TITLE','IMAGE_RIGHTS'
]);
const by=Object.fromEntries(report.checks.map(x=>[x.code,x.status]));
assert.equal(by.ARTWORK_IDENTITY,'RECORDED');
assert.equal(by.ATTRIBUTION,'DISPUTED');
assert.equal(by.PROVENANCE,'CONFLICTED');
assert.equal(by.CONDITION,'NOT_ASSESSED');
assert.equal(by.SCHOLARSHIP,'NOT_PUBLICLY_RELEASED');
assert.equal(by.SALE_HISTORY,'NO_PUBLIC_RESULTS');
assert.equal(by.LEGAL_TITLE,'NOT_VERIFIED');
assert.equal(by.IMAGE_RIGHTS,'NOT_INDEPENDENTLY_VERIFIED');
assert.equal(report.boundaries.proofOfAuthenticity,false);
assert.equal(report.boundaries.proofOfLegalTitle,false);
assert.equal(report.boundaries.priceOrReturnRecommendation,false);
assert.equal(report.boundaries.privateRoomCreated,false);
assert.match(report.reportSha256,/^[a-f0-9]{64}$/);
assert.deepEqual(dossier,original,'readiness must be a pure derived projection');
assert.equal(buildDecisionReadinessV87(dossier).reportSha256,report.reportSha256);
for(const secret of ['SECRET_OWNER_V87','SECRET_DOC_V87','s3://private']){
 assert.ok(!JSON.stringify(report).includes(secret),'privacy leak: '+secret);
}
const updated=structuredClone(dossier);
updated.work.attributionStatus='ATTRIBUTED';
updated.provenance.status='EVIDENCE_INDEXED';
updated.marketHistory=[{status:'SOLD',realizedAmountMinor:500000}];
updated.projectionSha256='c'.repeat(64);
const change=buildDecisionReadinessV87(updated);
assert.notEqual(change.reportSha256,report.reportSha256);
const after=Object.fromEntries(change.checks.map(x=>[x.code,x.status]));
assert.equal(after.ATTRIBUTION,'RECORDED_UNCERTIFIED');
assert.equal(after.PROVENANCE,'INDEXED_UNCERTIFIED');
assert.equal(after.SALE_HISTORY,'PUBLIC_RESULT_RECORDED');
assert.equal(change.decisionState,'HUMAN_REVIEW_REQUIRED',
 'recorded data cannot automate authenticity, legal title or suitability');
const forged=structuredClone(updated);
forged.work.attributionStatus='AUTHENTICITY_CERTIFIED';
assert.equal(buildDecisionReadinessV87(forged).checks.find(x=>x.code==='ATTRIBUTION').status,
 'UNRESOLVED','unknown attribution token cannot imply verification');
for(const mutate of [
 d=>{d.schemaVersion='antiqua-artwork-dossier-v51'},
 d=>{d.source.evidenceHashScope='RAW_PRIVATE'},
 d=>{d.disclosure.scope='PRIVATE'},
 d=>{d.disclosure.privateOwnerIdentityIncluded=true},
 d=>{d.disclosure.privateDocumentsIncluded=true},
 d=>{d.disclosure.privateEventIdsIncluded=true},
 d=>{d.disclosure.authenticityCertified=true},
 d=>{d.disclosure.investmentReturnProjected=true},
 d=>{d.projectionSha256='not-a-hash'},
 d=>{d.provenance.status='AUTOMATICALLY_AUTHENTICATED'}
]){
 const candidate=structuredClone(dossier);mutate(candidate);
 assert.throws(()=>buildDecisionReadinessV87(candidate),e=>e.code==='PUBLIC_DECISION_SOURCE_REQUIRED');
}
console.log('ANTIQUA v87 evidence checklist: read-only, human-review and privacy regression PASS');
