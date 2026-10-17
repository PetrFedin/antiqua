import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildResearchInterchangeProfile} from '../research-interchange-profile-v47.mjs';
import {
  PUBLIC_INTERCHANGE_VERSION_V58,
  projectPublicResearchInterchangeProfile
} from '../research-interchange-public-v58.mjs';

// The source builder may legitimately contain unpublished scholarly,
// ownership and media metadata. The public API must not return any of them.
const passport={
  work:{
    objectId:'public-work-58',objectCode:'AQ-58',
    title:{ru:'Этюд',en:'Study',privateNote:'PRIVATE_TITLE_NOTE'},
    maker:{ru:'Неизвестный художник',en:'Unknown Artist'},
    attributionStatus:'DISPUTED',
    owner:'PRIVATE_OWNER_58'
  },
  passportRevision:{
    revisionId:'PRIVATE_REVISION_58',revisionNo:3,
    passportHash:'PRIVATE_FULL_EVIDENCE_HASH_58',
    previousHash:'PRIVATE_PREVIOUS_HASH_58',
    changeKind:'PRIVATE_CHANGE_KIND',
    createdAt:'2026-10-12T00:00:00.000Z'
  },
  provenanceEvents:[
    {id:'private_mail@example.com',sequenceNo:1,
      event:{kind:'OWNERSHIP',ownerName:'PRIVATE_OWNER_58',
        note:'PRIVATE_STOREROOM_58',email:'private_mail@example.com'},
      evidenceClass:'OWNER_DEALER_STATEMENT',evidenceStatus:'DISPUTED',
      evidenceRef:'s3://private-art/PRIVATE_DOCUMENT_TOKEN_58',
      unresolved:true,conflict:true},
    {id:'private-guid-58',sequenceNo:2,
      event:{kind:'EXHIBITION',description:'PRIVATE_LOCATION_58'},
      evidenceClass:'INSTITUTIONAL_RECORD',evidenceStatus:'VERIFIED',
      evidenceRef:'https://internal.example/PRIVATE_MEDIA_URL_58',
      unresolved:false,conflict:false}
  ],
  evidenceSummary:{
    completeness:'CONFLICTED',
    gapIndex:{
      totalGaps:2,
      byCode:{
        CONFLICTING_ASSERTION:1,
        MISSING_EVIDENCE_REFERENCE:1,
        PRIVATE_GAP_CODE:999
      },
      eventGaps:[{eventId:'private_mail@example.com',codes:['PRIVATE_GAP_CODE']}]
    },
    unresolvedEventIds:['private_mail@example.com'],
    conflictEventIds:['private_mail@example.com']
  },
  lineage:{
    objectAuthority:'objects',provenanceAuthority:'provenance_entries',
    revisionAuthority:'object_passport_revisions'
  }
};
const raw=buildResearchInterchangeProfile({
  passport,
  exhibitions:[{title:'PRIVATE_EXHIBITION_58',publicationState:'DRAFT'}],
  bibliography:[{id:'PRIVATE_BIBLIOGRAPHY_58',citation:'PRIVATE_RESEARCH_NOTE_58'}],
  institutionalIdentifiers:[{value:'PRIVATE_ACCESSION_58',sourceRef:'PRIVATE_INTERNAL_REFERENCE_58'}],
  media:[{
    id:'PRIVATE_MEDIA_ID_58',type:'IMAGE',
    iiifManifest:'https://internal.example/PRIVATE_MEDIA_URL_58',
    url:'https://internal.example/PRIVATE_MEDIA_URL_58',
    rights:{private_owner:'PRIVATE_OWNER_58'},publicationState:'PRIVATE'
  }],
  scholarlyContributions:[{
    contributorAccountId:'PRIVATE_ACCOUNT_58',
    summary:{en:'PRIVATE_SCHOLAR_NOTE_58'},
    subjectId:'private_mail@example.com'
  }],
  scopedCredentials:[{
    subjectAccountId:'PRIVATE_ACCOUNT_58',roleLabel:'PRIVATE_CREDENTIAL_58'
  }],
  objectMetadata:{
    mediaRights:{privateSource:'PRIVATE_MEDIA_RIGHT_58'},
    metadataRights:{privateSource:'PRIVATE_METADATA_RIGHT_58'}
  }
});
const released=projectPublicResearchInterchangeProfile(raw);
assert.equal(released.profileVersion,PUBLIC_INTERCHANGE_VERSION_V58);
assert.equal(released.work.title.ru,'Этюд');
assert.equal(released.work.maker.en,'Unknown Artist');
assert.equal(released.attribution.status,'DISPUTED');
assert.equal(released.attribution.certified,false);
assert.deepEqual(released.provenanceEvents.map(x=>x.id),['public-event-1','public-event-2']);
assert.equal(released.provenanceEvents[0].event.kind,'OWNERSHIP');
assert.equal(released.provenanceEvents[0].evidence.reference,null);
assert.equal(released.provenanceEvents[0].uncertainty.conflict,true);
assert.equal(released.evidenceState.completeness,'CONFLICTED');
assert.equal(released.evidenceState.gaps.byCode.CONFLICTING_ASSERTION,1);
assert.equal(released.evidenceState.gaps.totalGaps,2);
assert.deepEqual(released.evidenceState.conflictEventIds,['public-event-1']);
assert.equal(released.revision.id,'public-revision-3');
assert.equal(released.revision.number,3);
assert.equal(released.revision.passportHash,undefined);
for(const section of ['exhibitions','bibliography','institutionalIdentifiers','media']){
  assert.deepEqual(released[section],[],section+' must remain closed without grant');
}
assert.deepEqual(released.scholarlyContext,{contributions:[],credentials:[]});
assert.equal(released.boundaries.disclosureScope,'PUBLIC_REDACTED');
assert.equal(released.boundaries.evidenceHashScope,'DISCLOSED_FIELDS_ONLY');
assert.equal(released.boundaries.privateDocumentsIncluded,false);
assert.equal(released.interchangeSha256.length,64);

const serialized=JSON.stringify(released);
for(const restricted of [
  'PRIVATE_OWNER_58','PRIVATE_STOREROOM_58','private_mail@example.com',
  'PRIVATE_DOCUMENT_TOKEN_58','PRIVATE_LOCATION_58','PRIVATE_MEDIA_URL_58',
  'PRIVATE_REVISION_58','PRIVATE_FULL_EVIDENCE_HASH_58',
  'PRIVATE_PREVIOUS_HASH_58','PRIVATE_EXHIBITION_58',
  'PRIVATE_BIBLIOGRAPHY_58','PRIVATE_RESEARCH_NOTE_58',
  'PRIVATE_ACCESSION_58','PRIVATE_INTERNAL_REFERENCE_58',
  'PRIVATE_MEDIA_ID_58','PRIVATE_ACCOUNT_58','PRIVATE_SCHOLAR_NOTE_58',
  'PRIVATE_CREDENTIAL_58','PRIVATE_MEDIA_RIGHT_58','PRIVATE_METADATA_RIGHT_58',
  'PRIVATE_GAP_CODE','PRIVATE_TITLE_NOTE'
]) assert.ok(!serialized.includes(restricted),'public interchange leaked: '+restricted);

// Changes only to private data must not alter the public disclosure checksum.
const mutated=structuredClone(raw);
mutated.exhibitions[0].title='NEW_PRIVATE_EXHIBITION_58';
mutated.media[0].url='https://private.invalid/different';
mutated.scholarlyContext.contributions[0].contributorAccountId='NEW_PRIVATE_OWNER';
mutated.provenanceEvents[0].event.ownerName='CHANGED_PRIVATE_OWNER';
mutated.provenanceEvents[0].id='changed-private-guid';
assert.equal(
  projectPublicResearchInterchangeProfile(mutated).interchangeSha256,
  released.interchangeSha256
);
const changed=structuredClone(raw);
changed.provenanceEvents[0].uncertainty.conflict=false;
assert.notEqual(
  projectPublicResearchInterchangeProfile(changed).interchangeSha256,
  released.interchangeSha256
);
assert.throws(()=>projectPublicResearchInterchangeProfile({}),
  /ANTIQUA_PUBLIC_INTERCHANGE: SOURCE_REQUIRED/);

// Guard against accidentally bypassing the projection in public API code.
const source=await readFile(new URL('../research-interchange-profile-v47.mjs',import.meta.url),'utf8');
const route=await readFile(new URL('../routes-research-interchange-v47.mjs',import.meta.url),'utf8');
assert.match(source,/return projectPublicResearchInterchangeProfile\(source\)/);
assert.match(route,/profileVersion:PUBLIC_INTERCHANGE_VERSION_V58/);
assert.doesNotMatch(route,/return send\(res,200,\{profile:buildResearchInterchangeProfile/);
console.log('ANTIQUA v58 public research interchange source redaction PASS');
