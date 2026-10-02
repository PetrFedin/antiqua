import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {db} from '../runtime-v09.mjs';
import {
 upsertArtProfile,setRoleClaim,setExpertiseClaim,getPublicArtProfile,
 linkProfileOrganization,updateCulturalOrganizationProfile,listPublicGalleries,reviewArtNetworkClaim
} from '../art-network-v41.mjs';

if(!process.env.DATABASE_URL){console.log('ANTIQUA v41 PostgreSQL Art Network: skipped (DATABASE_URL not set)');process.exit(0)}

const token=crypto.randomUUID().replaceAll('-',''),id=p=>p+'-'+token;
const ownerId=id('acct'),reviewerId=id('reviewer'),orgId=id('org'),sellerId=id('seller');
const owner={id:ownerId,displayName:'Art Network Owner',roles:['BUYER']};
const reviewer={id:reviewerId,displayName:'Trust Reviewer',roles:['TRUST_REVIEWER']};

try{
 await db.pool.query("INSERT INTO accounts(id,email,display_name,password_hash,account_type,status,created_at,updated_at) VALUES($1,$2,$3,'test-hash','BUYER','ACTIVE',now(),now()),($4,$5,$6,'test-hash','STAFF','ACTIVE',now(),now())",[ownerId,'art-'+token+'@example.test',owner.displayName,reviewerId,'review-'+token+'@example.test',reviewer.displayName]);

 let x=await upsertArtProfile(owner,{displayName:'Print Collector '+token.slice(0,6),slug:'print-collector-'+token.slice(0,12),visibility:'PUBLIC',headline:{en:'Prints and engraving',ru:'Гравюра и печатная графика'}});
 const profileId=x.profile.id;
 const role=await setRoleClaim(owner,{role:'EXPERT',evidence:{reference:'test-evidence'}});
 const expertise=await setExpertiseClaim(owner,{expertiseCode:'PRINTS_ENGRAVING',label:{en:'Prints and engraving',ru:'Гравюра и печатная графика'},scope:{description:{en:'European prints',ru:'Европейская печатная графика'}},evidence:{reference:'test-evidence'},conflictDisclosure:{declared:true}});

 let pub=await getPublicArtProfile(x.profile.slug);
 assert.ok(pub);
 assert.equal('accountId' in pub,false);
 assert.equal(pub.roles.some(r=>r.role==='EXPERT'),false);
 assert.equal(pub.expertise.length,0);

 await reviewArtNetworkClaim(reviewer,{entityType:'ROLE',id:role.id,status:'VERIFIED',reviewNote:'Scoped role reviewed'});
 await reviewArtNetworkClaim(reviewer,{entityType:'EXPERTISE',id:expertise.id,status:'VERIFIED',reviewNote:'Evidence reviewed'});
 pub=await getPublicArtProfile(x.profile.slug);
 assert.ok(pub.roles.some(r=>r.role==='EXPERT'&&r.status==='VERIFIED'));
 assert.ok(pub.expertise.some(e=>e.expertiseCode==='PRINTS_ENGRAVING'&&e.status==='VERIFIED'));

 await db.pool.query(`INSERT INTO organizations(id,seller_id,organization_type,name,slug,status,verified,city,country,specialties,about,public_policies,created_at,updated_at)
 VALUES($1,$2,'GALLERY',$3,$4,'ACTIVE',false,$5,$6,$7,$8,$9,now(),now())`,[orgId,sellerId,'Print Gallery '+token.slice(0,6),'print-gallery-'+token.slice(0,12),{en:'London',ru:'Лондон'},{en:'United Kingdom',ru:'Великобритания'},JSON.stringify(['Prints','Engraving']),{en:'Works on paper',ru:'Работы на бумаге'},{en:'By appointment',ru:'По записи'}]);
 await db.pool.query("INSERT INTO organization_members(organization_id,account_id,role,status,joined_at,updated_at) VALUES($1,$2,'OWNER','ACTIVE',now(),now())",[orgId,ownerId]);

 const orgLink=await linkProfileOrganization(owner,{organizationId:orgId,relationshipType:'DIRECTOR',public:true});
 assert.equal(orgLink.status,'ORGANIZATION_CONFIRMED');
 let cultural=await updateCulturalOrganizationProfile(owner,orgId,{publicationStatus:'PUBLISHED',culturalMetadata:{focus:['PRINTS','ENGRAVING']},reviewEvidence:{reference:'gallery-review-pack'}});
 assert.equal(cultural.publicationStatus,'PUBLISHED');
 assert.equal(cultural.reviewStatus,'EVIDENCE_SUBMITTED');

 let galleries=await listPublicGalleries();
 let gallery=galleries.find(g=>g.id===orgId);assert.ok(gallery);assert.equal(gallery.culturalReviewStatus,'EVIDENCE_SUBMITTED');

 await reviewArtNetworkClaim(reviewer,{entityType:'GALLERY_PROFILE',id:orgId,status:'VERIFIED',reviewNote:'Cultural profile reviewed'});
 galleries=await listPublicGalleries();gallery=galleries.find(g=>g.id===orgId);assert.equal(gallery.culturalReviewStatus,'VERIFIED');

 pub=await getPublicArtProfile(x.profile.slug);
 assert.ok(pub.organizationLinks.some(l=>l.organizationId===orgId&&l.status==='ORGANIZATION_CONFIRMED'));

 await upsertArtProfile(owner,{visibility:'PRIVATE'});
 assert.equal(await getPublicArtProfile(x.profile.slug),null);

 const counts=await db.pool.query("SELECT (SELECT count(*) FROM art_profiles WHERE id=$1)::int profiles,(SELECT count(*) FROM art_expertise_claims WHERE profile_id=$1)::int expertise,(SELECT count(*) FROM organization_cultural_profiles WHERE organization_id=$2)::int galleries",[profileId,orgId]);
 assert.deepEqual(counts.rows[0],{profiles:1,expertise:1,galleries:1});

 console.log('ANTIQUA v41 PostgreSQL Art Network: durable profile + verified expertise + gallery cultural review + privacy passed');
}finally{
 await db.pool.query('DELETE FROM organizations WHERE id=$1',[orgId]).catch(()=>{});
 await db.pool.query('DELETE FROM accounts WHERE id=$1',[ownerId]).catch(()=>{});
 await db.pool.query('DELETE FROM accounts WHERE id=$1',[reviewerId]).catch(()=>{});
 await db.pool.end();
}
