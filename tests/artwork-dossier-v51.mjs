import assert from 'node:assert/strict';
import {buildArtworkResearchProjection,artworkDossierCapabilities} from '../artwork-dossier-v51.mjs';

const dossier=buildArtworkResearchProjection({
  objectId:'lot-101',
  provenancePassport:{
    evidenceSummary:{completeness:'CONFLICTED',gapIndex:{totalGaps:2}},
    assertions:{authenticityCertified:false}
  },
  scholarlyContributions:[{
    id:'sc-1',
    contributionType:'PROVENANCE_REVIEW',
    credentialsAtReview:[{
      credentialType:'PROVENANCE_REVIEW_PARTICIPANT',
      statusAtReview:'VALID_AT_REVIEW',
      assertions:{roleScopeAttested:true,scholarlyConclusionCertified:false,authenticityCertified:false}
    }],
    assertions:{contributionPublished:true,conclusionCertified:false,authenticityCertified:false}
  }],
  marketHistory:[{
    auctionId:'auc-1',objectId:'lot-101',status:'SOLD',
    hammerAmountMinor:1000000,realizedAmountMinor:1000000,currency:'EUR'
  }]
});

assert.equal(dossier.schemaVersion,'antiqua-artwork-dossier-v51');
assert.equal(dossier.objectId,'lot-101');
assert.equal(dossier.provenancePassport.evidenceSummary.completeness,'CONFLICTED');
assert.equal(dossier.provenancePassport.evidenceSummary.gapIndex.totalGaps,2);
assert.equal(dossier.scholarlyContributions[0].credentialsAtReview[0].statusAtReview,'VALID_AT_REVIEW');
assert.equal(dossier.scholarlyContributions[0].credentialsAtReview[0].assertions.scholarlyConclusionCertified,false);
assert.equal(dossier.marketHistory[0].status,'SOLD');
assert.equal(dossier.boundaries.credentialProvesRoleNotTruth,true);
assert.equal(dossier.boundaries.marketHistoryExcludesCurrentAskingPrice,true);
assert.equal(dossier.boundaries.conflictsAndGapsPreserved,true);
assert.equal(artworkDossierCapabilities().expertScore,false);
assert.equal(artworkDossierCapabilities().authenticityCertified,false);

console.log('ANTIQUA v51 Artwork Dossier: derived research + credentials-at-review + market-history boundaries passed');
