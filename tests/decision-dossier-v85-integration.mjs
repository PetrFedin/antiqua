import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildProvenanceEvidencePassport} from '../provenance-evidence-passport-v43.mjs';
import {buildArtworkResearchProjection} from '../artwork-dossier-v51.mjs';
import {projectPublicArtworkResearchDossier} from '../artwork-dossier-public-v58.mjs';
import {buildPublicDecisionDossierContract} from '../decision-dossier-v56.mjs';
const objectId='painting-v85-1';
const privatePassport=buildProvenanceEvidencePassport({
 object:{id:objectId,objectCode:'AQ-85',passport:{
 title:{ru:'Картина',en:'Painting'},maker:{ru:'Автор',en:'Artist'},
 attributionStatus:'DISPUTED',owner:{name:'SECRET_OWNER_V85'}}},
 latestRevision:{id:'SECRET_REVISION_V85',revisionNo:7,passportHash:'SECRET_HASH_V85',
 createdAt:'2026-10-19T00:00:00.000Z'},
 entries:[
 {id:'SECRET_EVENT_V85',sequenceNo:1,event:{kind:'OWNERSHIP',conflict:true,
 ownerName:'SECRET_OWNER_V85',exactStorageLocation:'SECRET_VAULT_V85'},
 evidenceClass:'OWNER_DEALER_STATEMENT',evidenceStatus:'DISPUTED',
 evidenceRef:'s3://private/SECRET_DOCUMENT_V85'},
 {id:'SECRET_EVENT_B_V85',sequenceNo:2,event:{kind:'EXHIBITION',description:'SECRET_PLACE_V85'},
 evidenceClass:'INSTITUTIONAL_RECORD',evidenceStatus:'VERIFIED',
 evidenceRef:'s3://private/SECRET_SCAN_V85'}]
});
const raw=buildArtworkResearchProjection({objectId,provenancePassport:privatePassport,
 scholarlyContributions:[{id:'SECRET_SCHOLAR_V85',summary:{en:'SECRET_NOTE_V85'},
 credentialsAtReview:[{credentialType:'SECRET_CREDENTIAL_V85'}]}],
 marketHistory:[
 {auctionId:'approved-auction-v85',objectId,status:'SOLD',auctionState:'CLOSED',
 final:true,realized:true,publicDisclosureApproved:true,realizedAmountMinor:245000,
 hammerAmountMinor:220000,currency:'EUR',endedAt:'2026-10-19T12:00:00.000Z',
 buyerName:'SECRET_BUYER_V85',settlementAccount:'SECRET_SETTLEMENT_V85'},
 {auctionId:'private-auction-v85',objectId,status:'SOLD',auctionState:'CLOSED',
 final:true,realized:true,publicDisclosureApproved:false,realizedAmountMinor:99999999,
 currency:'EUR',endedAt:'2026-10-18T12:00:00.000Z'}]});
const publicArtwork=projectPublicArtworkResearchDossier(raw);
assert.equal(publicArtwork.marketHistory.length,1);
assert.throws(()=>buildPublicDecisionDossierContract(publicArtwork),
 /PUBLIC_ARTWORK_AUTHORITY_REQUIRED/);
assert.throws(()=>buildPublicDecisionDossierContract(raw,{publicVisibilityConfirmed:true}),
 /REDACTED_V58_RESEARCH_AUTHORITY_REQUIRED/);
const original=structuredClone(publicArtwork);
const decision=buildPublicDecisionDossierContract(publicArtwork,{publicVisibilityConfirmed:true});
assert.deepEqual(publicArtwork,original);
assert.equal(decision.objectId,objectId);
assert.equal(decision.work.title.ru,'Картина');
assert.equal(decision.provenance.status,'CONFLICTED');
assert.equal(decision.provenance.conflictCount,1);
assert.equal(decision.provenance.eventCount,2);
assert.equal(decision.source.publicEvidenceProjectionSha256,
 publicArtwork.provenancePassport.evidencePackageSha256);
assert.equal(decision.source.passportRevisionId,'public-revision-7');
assert.equal(decision.marketHistory.length,1);
assert.equal(decision.marketHistory[0].realizedAmountMinor,245000);
assert.equal(decision.condition.status,'NOT_ASSESSED');
assert.equal(decision.currentSale.offerEnabled,false);
for(const secret of ['SECRET_OWNER_V85','SECRET_REVISION_V85','SECRET_HASH_V85',
 'SECRET_EVENT_V85','SECRET_VAULT_V85','SECRET_DOCUMENT_V85','SECRET_PLACE_V85',
 'SECRET_SCAN_V85','SECRET_SCHOLAR_V85','SECRET_NOTE_V85','SECRET_CREDENTIAL_V85',
 'SECRET_BUYER_V85','SECRET_SETTLEMENT_V85','99999999']){
 assert.ok(!JSON.stringify(decision).includes(secret),'Leaked '+secret);
}
const edited=structuredClone(raw);
edited.provenancePassport.provenanceEvents[0].event.ownerName='DIFFERENT_PRIVATE_OWNER';
edited.scholarlyContributions[0].summary.en='CHANGED_PRIVATE_NOTE';
edited.marketHistory[0].buyerName='DIFFERENT_PRIVATE_BUYER';
const safelyEdited=projectPublicArtworkResearchDossier(edited);
assert.equal(safelyEdited.publicDossierSha256,publicArtwork.publicDossierSha256);
assert.equal(buildPublicDecisionDossierContract(safelyEdited,
 {publicVisibilityConfirmed:true}).projectionSha256,decision.projectionSha256);
const changedSale=structuredClone(raw);
changedSale.marketHistory[0].realizedAmountMinor=245001;
assert.notEqual(buildPublicDecisionDossierContract(
 projectPublicArtworkResearchDossier(changedSale),
 {publicVisibilityConfirmed:true}).projectionSha256,decision.projectionSha256);
for(const mutate of [
 x=>{x.boundaries.sourceAccountAndDocumentIdsIncluded=true},
 x=>{x.boundaries.currentAskingPriceIncluded=true},
 x=>{x.provenancePassport.disclosureBoundary.privateDocumentIncluded=true},
 x=>{x.provenancePassport.disclosureBoundary.sourceRevisionIdIncluded=true}
]){
 const altered=structuredClone(publicArtwork);mutate(altered);
 assert.throws(()=>buildPublicDecisionDossierContract(altered,{publicVisibilityConfirmed:true}),
 /REDACTED_V58_RESEARCH_AUTHORITY_REQUIRED|PUBLIC_PROVENANCE_DISCLOSURE_REQUIRED/);
}
const access=await readFile(new URL('../artwork-dossier-v51.mjs',import.meta.url),'utf8');
const provenance=await readFile(new URL('../provenance-evidence-passport-v43.mjs',import.meta.url),'utf8');
assert.match(access,/provenanceEvidencePassport\(objectId,\{publicOnly:true\}\)/);
assert.match(provenance,/publication_status='PUBLIC'/);
console.log('ANTIQUA v85 public source integration and privacy regression PASS');
