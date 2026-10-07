import assert from 'node:assert/strict';
import {buildResearchInterchangeProfile,ANTIQUA_RESEARCH_INTERCHANGE_PROFILE} from '../research-interchange-profile-v47.mjs';

const passport={
  work:{objectId:'lot-1',objectCode:'A-1',title:{en:'Work'},maker:{en:'Artist'},attributionStatus:'DISPUTED'},
  passportRevision:{revisionId:'rev-2',revisionNo:2,passportHash:'abc',previousHash:'def',changeKind:'ATTRIBUTION_UPDATE',createdAt:'2026-10-06T00:00:00.000Z'},
  provenanceEvents:[
    {id:'pe-1',sequenceNo:1,event:{kind:'OWNERSHIP'},evidenceClass:'PRIMARY_DOCUMENT',evidenceStatus:'VERIFIED',evidenceRef:'archive:1',unresolved:false,conflict:false},
    {id:'pe-2',sequenceNo:2,event:{kind:'ATTRIBUTION',status:'CONFLICT'},evidenceClass:'SCHOLARLY_PUBLICATION',evidenceStatus:'DISPUTED',evidenceRef:'book:2',unresolved:true,conflict:true}
  ],
  evidenceSummary:{completeness:'CONFLICTED',gapIndex:{totalGaps:2},unresolvedEventIds:['pe-2'],conflictEventIds:['pe-2']},
  lineage:{objectAuthority:'objects',provenanceAuthority:'provenance_entries',revisionAuthority:'object_passport_revisions'}
};

const p=buildResearchInterchangeProfile({
  passport,
  institutionalIdentifiers:[{scheme:'MUSEUM_ACCESSION',value:'INV-42',institutionId:'museum-1',status:'REVIEWED'}],
  media:[{id:'img-1',type:'IMAGE',iiifManifest:'https://example.org/iiif/manifest',rights:{license:'CC0'},publicationState:'PUBLIC'}],
  bibliography:[{id:'bib-1',citation:'Example'}]
});
assert.equal(p.profileVersion,ANTIQUA_RESEARCH_INTERCHANGE_PROFILE);
assert.equal(p.attribution.status,'DISPUTED');
assert.equal(p.provenanceEvents[1].uncertainty.conflict,true);
assert.equal(p.evidenceState.completeness,'CONFLICTED');
assert.equal(p.boundaries.uncertaintyFlattened,false);
assert.equal(p.boundaries.conflictingAssertionsPreserved,true);
assert.equal(p.boundaries.privateOwnerIdentityIncluded,false);
assert.equal(p.rights.rightsIndependent,true);
assert.equal(p.interchangeSha256.length,64);
console.log('research interchange profile v47 PASS');
