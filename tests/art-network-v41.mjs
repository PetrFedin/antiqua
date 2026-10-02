import assert from 'node:assert/strict';
import {db} from '../runtime-v09.mjs';
import {artNetworkCapabilities,upsertArtProfile,setRoleClaim,setExpertiseClaim,getPublicArtProfile,listPublicArtProfiles,createCulturalOrganization,updateCulturalOrganizationProfile,listPublicGalleries} from '../art-network-v41.mjs';

const buyer=await db.findAccountByEmail('buyer@demo.antiqua');
assert.ok(buyer);

const caps=artNetworkCapabilities();
assert.equal(caps.oneAccountIdentity,true);
assert.equal(caps.publicDescriptorsNotPermissions,true);
assert.equal(caps.expertiseUniversalScore,false);

const token=Math.random().toString(36).slice(2,10);
let x=await upsertArtProfile(buyer,{displayName:'Art Enthusiast '+token,slug:'art-enthusiast-'+token,visibility:'PUBLIC',headline:{en:'Painting and prints',ru:'Живопись и графика'}});
assert.equal(x.profile.accountId,buyer.id);
await setRoleClaim(buyer,{role:'ENTHUSIAST'});
await setRoleClaim(buyer,{role:'EXPERT',evidence:{note:'self supplied evidence'}});
await setExpertiseClaim(buyer,{expertiseCode:'PRINTS_ENGRAVING',label:{en:'Prints and engraving',ru:'Гравюра и печатная графика'},evidence:{note:'self supplied evidence'}});

let pub=await getPublicArtProfile('art-enthusiast-'+token);
assert.ok(pub);
assert.equal('accountId' in pub,false,'public Art Profile must not expose account id');
assert.ok(pub.roles.some(r=>r.role==='ENTHUSIAST'));
assert.ok(!pub.roles.some(r=>r.role==='EXPERT'),'professional role must not become public verified identity without review');
assert.equal(pub.expertise.length,0,'unreviewed expertise must not publish');

let experts=await listPublicArtProfiles({role:'EXPERT'});
assert.ok(!experts.some(p=>p.slug==='art-enthusiast-'+token));

x=await upsertArtProfile(buyer,{visibility:'PRIVATE'});
assert.equal(x.profile.visibility,'PRIVATE');
pub=await getPublicArtProfile('art-enthusiast-'+token);
assert.equal(pub,null,'PRIVATE Art Profile must not be publicly resolvable');

const gallery=await createCulturalOrganization(buyer,{organizationType:'GALLERY',name:'Preview Print Gallery '+token,slug:'preview-print-gallery-'+token,specialties:['Prints','Engraving']});
assert.equal(gallery.organizationType,'GALLERY');
await updateCulturalOrganizationProfile(buyer,gallery.id,{publicationStatus:'PUBLISHED',culturalMetadata:{focus:['PRINTS','ENGRAVING']}});
const galleries=await listPublicGalleries();
assert.ok(galleries.some(g=>g.id===gallery.id&&g.name===gallery.name),'noncommercial preview gallery must publish without seller identity');

console.log('ANTIQUA v41 Art Network: identity/privacy/professional-claim boundaries passed');
