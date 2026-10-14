import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildProvenanceEvidencePassport} from '../provenance-evidence-passport-v43.mjs';
import {buildArtworkResearchProjection,artworkDossierCapabilities} from '../artwork-dossier-v51.mjs';
import {
  PUBLIC_ARTWORK_DOSSIER_VERSION_V58,projectPublicArtworkResearchDossier
} from '../artwork-dossier-public-v58.mjs';

const privatePassport=buildProvenanceEvidencePassport({
  object:{
    id:'public-art-58',objectCode:'ART-58',
    passport:{
      title:{ru:'Картина',en:'Painting'},
      maker:{ru:'Художник',en:'Artist'},
      owner:{name:'PRIVATE_OWNER_58'},attributionStatus:'DISPUTED'
    }
  },
  latestRevision:{
    id:'PRIVATE_REVISION_58',revisionNo:6,passportHash:'PRIVATE_PASSPORT_HASH_58',
    createdAt:'2026-10-12T00:00:00.000Z'
  },
  entries:[{
    id:'private@example.com',sequenceNo:1,
    event:{kind:'OWNERSHIP',ownerName:'PRIVATE_OWNER_58',conflict:true,
      storage:'PRIVATE_VAULT_58'},
    evidenceClass:'OWNER_DEALER_STATEMENT',evidenceStatus:'DISPUTED',
    evidenceRef:'s3://private/PRIVATE_DOCUMENT_58'
  }]
});
const raw=buildArtworkResearchProjection({
  objectId:'public-art-58',
  provenancePassport:privatePassport,
  scholarlyContributions:[{
    id:'PRIVATE_SCHOLAR_ID_58',summary:{en:'PRIVATE_REVIEW_NOTE_58'},
    credentialsAtReview:[{
      projectRef:'PRIVATE_SCOPE_58',credentialType:'PRIVATE_CREDENTIAL_58'
    }],
    evidenceLinks:[{evidenceId:'PRIVATE_DOC_LINK_58',relationType:'SOURCE'}]
  }],
  marketHistory:[
    {auctionId:'pub-auction-58',objectId:'public-art-58',status:'SOLD',
      final:true,realized:true,hammerAmountMinor:240000,
      realizedAmountMinor:240000,currency:'EUR',
      endedAt:'2026-10-12T13:00:00.000Z',
      buyerName:'PRIVATE_BUYER_58',
      settlementAccountId:'PRIVATE_ACCOUNT_58'},
    {auctionId:'pending-auction-58',objectId:'public-art-58',status:'HAMMERED',
      final:false,realized:false,hammerAmountMinor:100000,
      privateBidder:'PRIVATE_BIDDER_58'},
    {auctionId:'foreign-auction',objectId:'other-art',status:'SOLD',
      final:true,realized:true,realizedAmountMinor:999999,
      buyerName:'PRIVATE_FOREIGN_OWNER_58'}
  ]
});
const out=projectPublicArtworkResearchDossier(raw);
assert.equal(out.schemaVersion,PUBLIC_ARTWORK_DOSSIER_VERSION_V58);
assert.equal(out.objectId,'public-art-58');
assert.equal(out.provenancePassport.work.title.ru,'Картина');
assert.equal(out.provenancePassport.provenanceEvents[0].id,'public-event-1');
assert.equal(out.provenancePassport.evidenceSummary.gapIndex.byCode.CONFLICTING_ASSERTION,1);
assert.equal(out.boundaries.publicationScope,'PUBLIC_REDACTED');
assert.equal(out.boundaries.scholarLyDetailsRequireSeparatePublicationGrant,undefined);
assert.equal(out.boundaries.scholarlyDetailsRequireSeparatePublicationGrant,true);
assert.equal(out.boundaries.sourceAccountAndDocumentIdsIncluded,false);
assert.equal(out.boundaries.authenticityCertified,false);
assert.deepEqual(out.scholarlyContributions,[]);
assert.equal(out.marketHistory.length,1);
assert.equal(out.marketHistory[0].auctionId,'pub-auction-58');
assert.equal(out.marketHistory[0].status,'SOLD');
assert.equal(out.marketHistory[0].realizedAmountMinor,240000);
assert.equal(out.marketHistory[0].buyerName,undefined);
assert.equal(out.publicDossierSha256.length,64);

const text=JSON.stringify(out);
for(const needle of [
  'PRIVATE_OWNER_58','PRIVATE_REVISION_58','PRIVATE_PASSPORT_HASH_58',
  'private@example.com','PRIVATE_VAULT_58','PRIVATE_DOCUMENT_58',
  'PRIVATE_SCHOLAR_ID_58','PRIVATE_REVIEW_NOTE_58','PRIVATE_SCOPE_58',
  'PRIVATE_CREDENTIAL_58','PRIVATE_DOC_LINK_58','PRIVATE_BUYER_58',
  'PRIVATE_ACCOUNT_58','PRIVATE_BIDDER_58','PRIVATE_FOREIGN_OWNER_58'
])assert.ok(!text.includes(needle),'leaked confidential field: '+needle);

const changed=structuredClone(raw);
changed.scholarlyContributions[0].summary.en='CHANGED_PRIVATE_STUDY';
changed.marketHistory[0].buyerName='CHANGED_PRIVATE_BUYER';
changed.provenancePassport.provenanceEvents[0].event.storage='CHANGED_PRIVATE_VAULT';
assert.equal(projectPublicArtworkResearchDossier(changed).publicDossierSha256,
  out.publicDossierSha256,
  'private-only changes must not change the public disclosure hash');

const differentSale=structuredClone(raw);
differentSale.marketHistory[0].realizedAmountMinor=250000;
assert.notEqual(projectPublicArtworkResearchDossier(differentSale).publicDossierSha256,
  out.publicDossierSha256,'public verified result must update disclosure hash');

assert.throws(()=>projectPublicArtworkResearchDossier({}),/SOURCE_REQUIRED/);
assert.throws(()=>projectPublicArtworkResearchDossier({
  ...raw,objectId:'other-object'
}),/ARTWORK_ID_MISMATCH/);

const capabilities=artworkDossierCapabilities();
assert.equal(capabilities.schemaVersion,PUBLIC_ARTWORK_DOSSIER_VERSION_V58);
assert.equal(capabilities.scholarlyContributions,false);
assert.equal(capabilities.credentialsAtReview,false);

const source=await readFile(new URL('../artwork-dossier-v51.mjs',import.meta.url),'utf8');
const publicEntry=source.slice(source.indexOf('export async function artworkResearchDossier('));
assert.match(publicEntry,/return projectPublicArtworkResearchDossier\(source\)/);
assert.doesNotMatch(publicEntry,/scholarlyContributionsForArtwork\(/);
console.log('ANTIQUA v58 public Artwork Dossier redaction and final sale proof PASS');
