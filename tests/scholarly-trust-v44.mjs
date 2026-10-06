import assert from 'node:assert/strict';
import {buildContributorTrustProjection,scholarlyTrustCapabilities} from '../scholarly-trust-v44.mjs';

const p=buildContributorTrustProjection({
  profile:{slug:'anna-ivanova',displayName:{ru:'Анна Иванова',en:'Anna Ivanova'}},
  expertise:[
    {id:'x1',expertiseType:'PROVENANCE',scope:{label:{ru:'Русская графика 1890–1920'}},status:'VERIFIED'},
    {id:'x2',expertiseType:'OTHER',scope:{label:'Unreviewed'},status:'EVIDENCE_SUBMITTED'}
  ],
  affiliations:[{organizationId:'museum-1',roleLabel:'Research fellow',status:'VERIFIED'}],
  contributions:[
    {id:'c1',contributionType:'PROVENANCE_REVIEW',subjectType:'OBJECT',subjectId:'lot-1',summary:{ru:'Проверка архивного источника'},disclosure:{conflict:false},status:'PUBLISHED',evidenceLinks:[{evidenceType:'PROVENANCE_ENTRY',evidenceId:'pe-1',relationType:'REVIEWS'}]},
    {id:'c2',contributionType:'SOURCE_REVIEW',subjectType:'SOURCE',subjectId:'s-1',summary:{ru:'Черновик'},status:'SUBMITTED'}
  ]
});
assert.equal(p.verifiedExpertise.length,1);
assert.equal(p.verifiedAffiliations.length,1);
assert.equal(p.contributions.length,1);
assert.equal(p.contributions[0].subjectId,'lot-1');
assert.equal(p.assertions.universalScoreUsed,false);
assert.equal(p.assertions.popularityRankingUsed,false);
assert.equal(p.assertions.contributionCountIsQualityScore,false);
assert.equal(scholarlyTrustCapabilities().expertiseAuthority,'EXPERTISE_CLAIMS_V41');
console.log('scholarly contributor trust v44 PASS');
