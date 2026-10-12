import assert from 'node:assert/strict';
import {buildPublicDecisionDossierContract} from '../decision-dossier-v56.mjs';

const digest='f'.repeat(64);
const base={
  schemaVersion:'antiqua-artwork-dossier-v51',
  objectId:'lot-public-1',
  boundaries:{readModelOnly:true,marketHistoryExcludesCurrentAskingPrice:true},
  provenancePassport:{
    work:{
      objectId:'lot-public-1',objectCode:'ART-001',
      title:{ru:'Пейзаж',en:'Landscape'},maker:{ru:'Автор',en:'Artist'},
      attributionStatus:'ATTRIBUTED',
      ownerIdentity:'SECRET_OWNER_543'
    },
    passportRevision:{revisionId:'rev-5',revisionNo:5},
    evidencePackageSha256:digest,
    assertions:{authenticityCertified:false,attributionCertified:false},
    provenanceEvents:[
      {id:'evt-2',sequenceNo:2,
        event:{kind:'OWNERSHIP',privateAddress:'PRIVATE_STREET_92',
          ownerName:'SECRET_OWNER_543',phone:'SECRET_PHONE_54'},
        evidenceClass:'OWNER_DEALER_STATEMENT',evidenceStatus:'DISPUTED',
        evidenceRef:'PRIVATE_DOCUMENT_TOKEN_992',unresolved:true,conflict:true},
      {id:'evt-1',sequenceNo:1,
        event:{kind:'EXHIBITION',description:'Museum exhibition'},
        evidenceClass:'INSTITUTIONAL_RECORD',evidenceStatus:'VERIFIED',
        evidenceRef:'https://example.com/public',unresolved:false,conflict:false}
    ],
    evidenceSummary:{
      completeness:'CONFLICTED',
      gapIndex:{byCode:{CONFLICTING_ASSERTION:1,UNRESOLVED_EVIDENCE_STATUS:1}}
    }
  },
  scholarlyContributions:[
    {id:'sch-1',contributionType:'PROVENANCE_REVIEW',
      publishedAt:'2026-10-10T00:00:00Z',
      assertions:{contributionPublished:true},
      summary:{ru:'PRIVATE_SCHOLAR_EMAIL@EXAMPLE.COM'},
      contributor:{displayName:'PRIVATE_CONTRIBUTOR_ADDRESS'},
      credentialsAtReview:[{id:'credential-private-5'}],
      evidenceLinks:[{evidenceId:'RESTRICTED_SCAN_1'}]},
    {id:'sch-private',assertions:{contributionPublished:false},
      summary:{ru:'NOT_PUBLISHED_PII'}}
  ],
  marketHistory:[
    {auctionId:'auction-1',status:'SOLD',endedAt:'2026-09-13T12:00:00Z',
      hammerAmountMinor:150000,currency:'EUR',realizedAmountMinor:175000,
      privateBidder:'PRIVATE_BIDDER_NAME'},
    {auctionId:'unconfirmed',status:'OPEN',hammerAmountMinor:999999999,
      currency:'EUR'}
  ],
  confidentialOwner:{name:'SECRET_OWNER_543'},
  askingPriceMinor:1234567
};

assert.throws(()=>buildPublicDecisionDossierContract(base),/PUBLIC_ARTWORK_AUTHORITY_REQUIRED/);
const result=buildPublicDecisionDossierContract(base,{publicVisibilityConfirmed:true});
assert.equal(result.schemaVersion,'antiqua-decision-dossier-contract-v1');
assert.equal(result.objectId,'lot-public-1');
assert.equal(result.work.title.ru,'Пейзаж');
assert.equal(result.source.passportRevisionId,'rev-5');
assert.equal(result.source.evidencePackageSha256,digest);
assert.equal(result.projectionSha256.length,64);
assert.equal(result.provenance.status,'CONFLICTED');
assert.equal(result.provenance.conflictCount,1);
assert.equal(result.provenance.unresolvedCount,1);
assert.equal(result.provenance.eventCount,2);
assert.equal(result.provenance.events[0].eventKind,'EXHIBITION');
assert.equal(result.provenance.events[1].eventKind,'OWNERSHIP');
assert.equal(result.provenance.events[1].evidenceReferenceExists,true);
assert.equal(result.scholarship.length,1);
assert.equal(result.scholarship[0].reviewerCredentialRecorded,true);
assert.equal(result.marketHistory.length,1);
assert.equal(result.marketHistory[0].hammerAmountMinor,150000);
assert.equal(result.currentSale.askingPrice,null);
assert.equal(result.currentSale.offerEnabled,false);
assert.equal(result.condition.status,'NOT_ASSESSED');
assert.equal(result.disclosure.authenticityCertified,false);
assert.equal(result.disclosure.investmentReturnProjected,false);

const serialized=JSON.stringify(result);
for(const sensitive of [
  'SECRET_OWNER_543','PRIVATE_STREET_92','SECRET_PHONE_54',
  'PRIVATE_DOCUMENT_TOKEN_992','PRIVATE_SCHOLAR_EMAIL@EXAMPLE.COM',
  'PRIVATE_CONTRIBUTOR_ADDRESS','RESTRICTED_SCAN_1','NOT_PUBLISHED_PII',
  'PRIVATE_BIDDER_NAME','999999999','1234567',
  'https://example.com/public'
])assert.ok(!serialized.includes(sensitive),'private field leaked: '+sensitive);

// Stable versioning should depend only on explicitly exposed source facts.
assert.equal(
  buildPublicDecisionDossierContract(structuredClone(base),{publicVisibilityConfirmed:true}).projectionSha256,
  result.projectionSha256
);
const changed=structuredClone(base);
changed.provenancePassport.provenanceEvents[0].conflict=false;
assert.notEqual(
  buildPublicDecisionDossierContract(changed,{publicVisibilityConfirmed:true}).projectionSha256,
  result.projectionSha256
);

const clean=structuredClone(base);
clean.provenancePassport.provenanceEvents=[{
  id:'ev-1',sequenceNo:1,event:{kind:'PUBLICATION'},
  evidenceClass:'SCHOLARLY_PUBLICATION',evidenceStatus:'VERIFIED',
  evidenceRef:'published:1',unresolved:false,conflict:false
}];
clean.provenancePassport.evidenceSummary={completeness:'EVIDENCED',gapIndex:{byCode:{}}};
const evidenced=buildPublicDecisionDossierContract(clean,{publicVisibilityConfirmed:true});
assert.equal(evidenced.provenance.status,'EVIDENCE_INDEXED');
assert.equal(evidenced.disclosure.authenticityCertified,false);

const wrong=structuredClone(base);
wrong.objectId='other-artwork';
assert.throws(()=>buildPublicDecisionDossierContract(wrong,{publicVisibilityConfirmed:true}),/ARTWORK_IDENTITY_MISMATCH/);
const missingHash=structuredClone(base);
missingHash.provenancePassport.evidencePackageSha256=null;
assert.throws(()=>buildPublicDecisionDossierContract(missingHash,{publicVisibilityConfirmed:true}),/EVIDENCE_PACKAGE_HASH_REQUIRED/);
const forged=structuredClone(base);
forged.provenancePassport.assertions.authenticityCertified=true;
assert.throws(()=>buildPublicDecisionDossierContract(forged,{publicVisibilityConfirmed:true}),/UNSUPPORTED_AUTHENTICITY_ASSERTION/);
const privateResearch=structuredClone(base);
privateResearch.boundaries.readModelOnly=false;
assert.throws(()=>buildPublicDecisionDossierContract(privateResearch,{publicVisibilityConfirmed:true}),/V51_RESEARCH_AUTHORITY_REQUIRED/);

console.log('ANTIQUA DD-01 public Decision Dossier contract tests passed');
