import assert from 'node:assert/strict';
import {createCreator,publishCreator} from '../creator-graph-v30.mjs';
import {upsertArtProfile,submitArtProfile,reviewArtProfile,submitCreatorProfileClaim,reviewCreatorProfileClaim,submitExpertiseClaim,reviewExpertiseClaim,listPublicArtProfiles,getPublicArtProfile,artNetworkCapabilities} from '../art-network-v41.mjs';

const collector={id:'network-collector-memory',displayName:'Private Collector',roles:['BUYER']};
const artistManager={id:'network-artist-manager-memory',displayName:'Artist Manager',sellerId:'seller-preview',roles:['SELLER']};
const reviewer={id:'network-reviewer-memory',displayName:'Reviewer',roles:['ADMIN','CATALOGUER']};

let p=await upsertArtProfile(collector,{slug:'collector-study-room',displayName:{en:'Collector Study Room',ru:'Кабинет коллекционера'},biography:{en:'Works on paper and printmaking.',ru:'Графика и печатные техники.'},participantRoles:['COLLECTOR','ENTHUSIAST'],interests:['etching','lithography'],visibility:'PSEUDONYMOUS'});
assert.equal(p.profileStatus,'DRAFT');
await submitArtProfile(collector);
assert.equal((await listPublicArtProfiles()).some(x=>x.slug===p.slug),false,'review-pending profile must not leak');
p=await reviewArtProfile(reviewer,collector.id,{decision:'APPROVE',note:'Identity projection reviewed'});
assert.equal(p.profileStatus,'PUBLISHED');
let directory=await listPublicArtProfiles(),publicP=directory.find(x=>x.slug===p.slug);assert.ok(publicP);assert.equal('accountId' in publicP,false,'internal account id must not be public');
assert.deepEqual(publicP.participantRoles,['COLLECTOR','ENTHUSIAST']);

const creator=await createCreator(artistManager,{slug:'network-proof-artist',nameEn:'Network Proof Artist',nameRu:'Тестовый художник сети',creatorType:'ARTIST',salesModel:'INDEPENDENT'});
await publishCreator(reviewer,creator.id);
const creatorClaim=await submitCreatorProfileClaim(collector,{creatorId:creator.id,relationshipType:'AUTHORIZED_REPRESENTATIVE',evidence:{documentRef:'memory-test'}});
assert.equal(creatorClaim.status,'EVIDENCE_SUBMITTED');
await reviewCreatorProfileClaim(reviewer,creatorClaim.id,{decision:'VERIFY',note:'Relationship evidence reviewed'});

const expertise=await submitExpertiseClaim(collector,{expertiseType:'PRINTMAKING',scope:{label:{en:'European etching',ru:'Европейская офортная графика'}},evidence:{bibliography:['memory-test']}});
assert.equal(expertise.status,'EVIDENCE_SUBMITTED');
await reviewExpertiseClaim(reviewer,expertise.id,{decision:'VERIFY',note:'Scoped evidence reviewed'});
let detail=await getPublicArtProfile(p.slug);assert.equal(detail.expertise.length,1);assert.equal(detail.expertise[0].expertiseType,'PRINTMAKING');assert.equal(detail.linkedCreators.length,1);assert.equal(detail.linkedCreators[0].creator.id,creator.id);assert.equal('score' in detail.expertise[0],false,'expertise must not become a global score');

p=await upsertArtProfile(collector,{...p,biography:{en:'Updated biography requires review.',ru:'Обновлённая биография требует повторной проверки.'}});
assert.equal(p.profileStatus,'DRAFT','substantive profile edit must invalidate previous publication review');
assert.equal((await listPublicArtProfiles()).some(x=>x.slug===p.slug),false);
await submitArtProfile(collector);await reviewArtProfile(reviewer,collector.id,{decision:'APPROVE'});
detail=await getPublicArtProfile(p.slug);assert.ok(detail);

assert.equal(artNetworkCapabilities().identityAuthority,'ACCOUNT');
assert.equal(artNetworkCapabilities().expertiseModel,'SCOPED_REVIEWED_CLAIMS_NO_GLOBAL_SCORE');
assert.equal(artNetworkCapabilities().genericSocialFeed,false);
await assert.rejects(()=>upsertArtProfile({id:'bad-role',displayName:'Bad',roles:['BUYER']},{displayName:'Bad',participantRoles:['CELEBRITY'],visibility:'PUBLIC'}),e=>e.code==='ART_PROFILE_ROLE_INVALID');
console.log('ANTIQUA v41 Art Network: reviewed identity + pseudonymity + creator claims + scoped expertise passed');
