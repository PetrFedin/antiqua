import assert from 'node:assert/strict';
import {buildPublicDecisionDossierContract,DECISION_DOSSIER_SCHEMA} from '../decision-dossier-v56.mjs';

const digest='f'.repeat(64);
const base={
  schemaVersion:'antiqua-artwork-dossier-public-v58',
  objectId:'lot-public-1',
  boundaries:{
    readModelOnly:true,
    publicationScope:'PUBLIC_REDACTED',
    evidenceHashScope:'DISCLOSED_FIELDS_ONLY',
    authenticityCertified:false,
    scholarlyDetailsRequireSeparatePublicationGrant:true
  },
  provenancePassport:{
    work:{
      objectId:'lot-public-1',objectCode:'ART-001',
      title:{ru:'Пейзаж',en:'Landscape'},maker:{ru:'Автор',en:'Artist'},
      attributionStatus:'ATTRIBUTED',
      privateOwner:'SECRET_OWNER_543'
    },
    passportRevision:{revisionId:'PRIVATE_REVISION_543',revisionNo:5},
    evidencePackageSha256:digest,
    disclosureBoundary:{
      scope:'PUBLIC_REDACTED',
      evidenceHashScope:'DISCLOSED_FIELDS_ONLY',
      rawEvidenceReferenceIncluded:false,
      ownerIdentityIncluded:false
    },
    assertions:{authenticityCertified:false,attributionCertified:false},
    provenanceEvents:[
      {id:'private-owner@example.com',sequenceNo:2,
        event:{kind:'OWNERSHIP',privateAddress:'PRIVATE_STREET_92',
          ownerName:'SECRET_OWNER_543',phone:'SECRET_PHONE_54'},
        evidenceClass:'OWNER_DEALER_STATEMENT',evidenceStatus:'DISPUTED',
        evidenceRef:'PRIVATE_DOCUMENT_TOKEN_992',
        evidenceReferenceRecorded:true,unresolved:true,conflict:true},
      {id:'PRIVATE_EVENT_10',sequenceNo:1,
        event:{kind:'EXHIBITION',description:'PRIVATE_EXHIBITION_PLACE'},
        evidenceClass:'INSTITUTIONAL_RECORD',evidenceStatus:'VERIFIED',
        evidenceRef:'https://example.com/PRIVATE_PROVENANCE_URL',
        evidenceReferenceRecorded:true,unresolved:false,conflict:false}
    ],
    evidenceSummary:{
      completeness:'CONFLICTED',
      gapIndex:{
        byCode:{CONFLICTING_ASSERTION:1,UNRESOLVED_EVIDENCE_STATUS:1,
          PRIVATE_EVIDENCE_GAP:999}
      }
    }
  },
  scholarlyContributions:[],
  marketHistory:[
    {objectId:'lot-public-1',auctionId:'PRIVATE_AUCTION_ID_9',
      status:'SOLD',final:true,realized:true,
      endedAt:'2026-09-13T12:00:00Z',hammerAmountMinor:150000,
      realizedAmountMinor:175000,currency:'EUR',
      buyerName:'PRIVATE_BIDDER_NAME',
      settlementAccount:'PRIVATE_SETTLEMENT_ACCOUNT'},
    {objectId:'lot-public-1',auctionId:'unconfirmed',status:'OPEN',
      final:false,realized:false,hammerAmountMinor:999999999},
    {objectId:'foreign-art',auctionId:'foreign',status:'SOLD',
      final:true,realized:true,realizedAmountMinor:999999999}
  ],
  confidentialOwner:{name:'SECRET_OWNER_543'},
  askingPriceMinor:1234567
};

assert.throws(()=>buildPublicDecisionDossierContract(base),
  /PUBLIC_ARTWORK_AUTHORITY_REQUIRED/);
const original=structuredClone(base);
const result=buildPublicDecisionDossierContract(base,{publicVisibilityConfirmed:true});
assert.deepEqual(base,original,'contract projection must not mutate canonical input');
assert.equal(result.schemaVersion,DECISION_DOSSIER_SCHEMA);
assert.equal(result.schemaVersion,'antiqua-decision-dossier-contract-v2');
assert.equal(result.objectId,'lot-public-1');
assert.equal(result.work.title.ru,'Пейзаж');
assert.equal(result.work.artist.en,'Artist');
assert.equal(result.source.authority,'antiqua-artwork-dossier-public-v58');
assert.equal(result.source.passportRevisionId,'public-revision-5');
assert.equal(result.source.publicEvidenceProjectionSha256,digest);
assert.equal(result.source.evidenceHashScope,'DISCLOSED_FIELDS_ONLY');
assert.equal(result.source.passportRevisionNo,5);
assert.match(result.projectionSha256,/^[0-9a-f]{64}$/);
assert.equal(result.provenance.status,'CONFLICTED');
assert.equal(result.provenance.conflictCount,1);
assert.equal(result.provenance.unresolvedCount,1);
assert.equal(result.provenance.eventCount,2);
assert.equal(result.provenance.events[0].eventKind,'EXHIBITION');
assert.equal(result.provenance.events[1].eventKind,'OWNERSHIP');
assert.equal(result.provenance.events[1].evidenceReferenceExists,true);
assert.deepEqual(result.provenance.events.map(x=>x.id),[
  'public-event-1','public-event-2'
]);
assert.equal(result.provenance.gapCodes.CONFLICTING_ASSERTION,1);
assert.equal(result.provenance.gapCodes.PRIVATE_EVIDENCE_GAP,undefined);
assert.deepEqual(result.scholarship,[]);
assert.equal(result.scholarlyDisclosureStatus,'REQUIRES_EXPLICIT_PUBLICATION_GRANT');
assert.equal(result.marketHistory.length,1);
assert.equal(result.marketHistory[0].id,'public-sale-1');
assert.equal(result.marketHistory[0].status,'SOLD');
assert.equal(result.marketHistory[0].hammerAmountMinor,150000);
assert.equal(result.marketHistory[0].realizedAmountMinor,175000);
assert.equal(result.currentSale.askingPrice,null);
assert.equal(result.currentSale.offerEnabled,false);
assert.equal(result.condition.status,'NOT_ASSESSED');
assert.equal(result.disclosure.authenticityCertified,false);
assert.equal(result.disclosure.investmentReturnProjected,false);
assert.equal(result.disclosure.privateEventIdsIncluded,false);

const serialized=JSON.stringify(result);
for(const sensitive of [
  'SECRET_OWNER_543','PRIVATE_STREET_92','SECRET_PHONE_54',
  'PRIVATE_DOCUMENT_TOKEN_992','private-owner@example.com',
  'PRIVATE_EVENT_10','PRIVATE_REVISION_543',
  'PRIVATE_EXHIBITION_PLACE','PRIVATE_PROVENANCE_URL',
  'PRIVATE_EVIDENCE_GAP','PRIVATE_AUCTION_ID_9',
  'PRIVATE_BIDDER_NAME','PRIVATE_SETTLEMENT_ACCOUNT',
  '999999999','1234567'
])assert.ok(!serialized.includes(sensitive),'private field leaked: '+sensitive);

// Private-only changes must not alter the hash or leak into a public recipient.
const privateOnly=structuredClone(base);
privateOnly.provenancePassport.provenanceEvents[0].id='changed-secret-credential';
privateOnly.provenancePassport.provenanceEvents[0].event.ownerName='DIFFERENT_PRIVATE_OWNER';
privateOnly.marketHistory[0].buyerName='PRIVATE_BUYER_CHANGED';
privateOnly.confidentialOwner={privateNote:'PRIVATE_ADDITIONAL_INFO'};
assert.equal(buildPublicDecisionDossierContract(privateOnly,
  {publicVisibilityConfirmed:true}).projectionSha256,result.projectionSha256);
const changed=structuredClone(base);
changed.provenancePassport.provenanceEvents[0].conflict=false;
assert.notEqual(buildPublicDecisionDossierContract(changed,
  {publicVisibilityConfirmed:true}).projectionSha256,result.projectionSha256);
const publishedSaleChange=structuredClone(base);
publishedSaleChange.marketHistory[0].realizedAmountMinor=175001;
assert.notEqual(buildPublicDecisionDossierContract(publishedSaleChange,
  {publicVisibilityConfirmed:true}).projectionSha256,result.projectionSha256);

// A v51 source, even one marked published, may contain raw owner and document
// fields. It must never be silently upgraded into this public contract.
const legacy=structuredClone(base);
legacy.schemaVersion='antiqua-artwork-dossier-v51';
assert.throws(()=>buildPublicDecisionDossierContract(legacy,
  {publicVisibilityConfirmed:true}),/REDACTED_V58_RESEARCH_AUTHORITY_REQUIRED/);
const wrong=structuredClone(base);
wrong.objectId='foreign';
assert.throws(()=>buildPublicDecisionDossierContract(wrong,
  {publicVisibilityConfirmed:true}),/ARTWORK_IDENTITY_MISMATCH/);
const missingHash=structuredClone(base);
missingHash.provenancePassport.evidencePackageSha256=null;
assert.throws(()=>buildPublicDecisionDossierContract(missingHash,
  {publicVisibilityConfirmed:true}),/PUBLIC_EVIDENCE_HASH_REQUIRED/);
const forged=structuredClone(base);
forged.provenancePassport.assertions.authenticityCertified=true;
assert.throws(()=>buildPublicDecisionDossierContract(forged,
  {publicVisibilityConfirmed:true}),/UNSUPPORTED_AUTHENTICITY_ASSERTION/);
const unredactedScholar=structuredClone(base);
unredactedScholar.scholarlyContributions=[{
  id:'PRIVATE_PERSON_ID',assertions:{contributionPublished:true}
}];
assert.throws(()=>buildPublicDecisionDossierContract(unredactedScholar,
  {publicVisibilityConfirmed:true}),/UNREDACTED_SCHOLARLY_SOURCE/);
const forgedBoundary=structuredClone(base);
forgedBoundary.provenancePassport.disclosureBoundary.evidenceHashScope='RAW_PRIVATE';
assert.throws(()=>buildPublicDecisionDossierContract(forgedBoundary,
  {publicVisibilityConfirmed:true}),/PUBLIC_PROVENANCE_DISCLOSURE_REQUIRED/);

const evidenced=structuredClone(base);
evidenced.provenancePassport.provenanceEvents=[{
  id:'private-doc-1',sequenceNo:1,event:{kind:'PUBLICATION'},
  evidenceClass:'SCHOLARLY_PUBLICATION',evidenceStatus:'VERIFIED',
  evidenceReferenceRecorded:true,unresolved:false,conflict:false
}];
evidenced.provenancePassport.evidenceSummary={
  completeness:'EVIDENCED',gapIndex:{byCode:{}}
};
const finalResult=buildPublicDecisionDossierContract(evidenced,
  {publicVisibilityConfirmed:true});
assert.equal(finalResult.provenance.status,'EVIDENCE_INDEXED');
assert.equal(finalResult.disclosure.authenticityCertified,false);
console.log('ANTIQUA DD-01 v2 public Decision Dossier redaction contract PASS');
