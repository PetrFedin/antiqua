import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {db} from '../runtime-v09.mjs';
import {listPublicSellerProfiles} from '../organizations-v15.mjs';
import {upsertArtProfile,submitArtProfile,reviewArtProfile,submitExpertiseClaim,reviewExpertiseClaim,createCulturalOrganization,submitCulturalOrganization,reviewCulturalOrganization,artNetworkDirectory,getPublicArtProfile} from '../art-network-v41.mjs';

if(!process.env.DATABASE_URL){console.log('ANTIQUA v41 PostgreSQL Art Network: skipped (DATABASE_URL not set)');process.exit(0)}
assert.equal(db.kind,'POSTGRES');
const buyer=await db.findAccountByEmail('buyer@demo.antiqua'),seller=await db.findAccountByEmail('seller@demo.antiqua'),operator=await db.findAccountByEmail('operator@demo.antiqua');
assert.ok(buyer);assert.ok(seller);assert.ok(operator?.roles?.includes('ADMIN'));
const token=crypto.randomUUID().replaceAll('-','').slice(0,10),slug='pg-network-'+token,orgSlug='pg-gallery-'+token;
let orgId=null;
try{
 let profile=await upsertArtProfile(buyer,{slug,displayName:{en:'Postgres Collector '+token,ru:'Postgres коллекционер '+token},participantRoles:['COLLECTOR'],interests:['etching'],visibility:'PSEUDONYMOUS'});
 assert.equal(profile.profileStatus,'DRAFT');
 await submitArtProfile(buyer);
 assert.equal((await artNetworkDirectory()).profiles.some(x=>x.slug===slug),false);
 profile=await reviewArtProfile(operator,buyer.id,{decision:'APPROVE',note:'postgres proof'});
 assert.equal(profile.profileStatus,'PUBLISHED');

 const expertise=await submitExpertiseClaim(buyer,{expertiseType:'PRINTMAKING',scope:{label:{en:'European printmaking',ru:'Европейская печатная графика'}},evidence:{source:'postgres-test'}});
 await reviewExpertiseClaim(operator,expertise.id,{decision:'VERIFY',note:'postgres proof'});
 const publicProfile=await getPublicArtProfile(slug);
 assert.equal(publicProfile.expertise.length,1);
 assert.equal('accountId' in publicProfile.profile,false);

 const org=await createCulturalOrganization(seller,{organizationType:'GALLERY',name:'Postgres Gallery '+token,slug:orgSlug,city:{en:'Berlin',ru:'Берлин'},country:{en:'Germany',ru:'Германия'},culturalFocus:['painting','works on paper'],programmingTypes:['EXHIBITION','ARTIST_TALK']});
 orgId=org.id;assert.equal(org.profileStatus,'DRAFT');
 let raw=(await db.pool.query('SELECT seller_id FROM organizations WHERE id=$1',[orgId])).rows[0];assert.equal(raw.seller_id,null,'cultural organization must not require a seller identity');
 await submitCulturalOrganization(seller,orgId);await reviewCulturalOrganization(operator,orgId,{decision:'APPROVE',note:'postgres proof'});
 const directory=await artNetworkDirectory(),publicOrg=directory.organizations.find(x=>x.id===orgId);assert.ok(publicOrg);assert.equal(publicOrg.commercialVerification,false);
 const sellerDirectory=await listPublicSellerProfiles();assert.equal(sellerDirectory.some(x=>x.organizationId===orgId),false,'cultural-only organization must not leak into seller directory');
 const row=(await db.pool.query('SELECT profile_status,visibility FROM art_profiles WHERE account_id=$1',[buyer.id])).rows[0];assert.deepEqual(row,{profile_status:'PUBLISHED',visibility:'PSEUDONYMOUS'});
 console.log('ANTIQUA v41 PostgreSQL Art Network: durable reviewed identity + scoped expertise + non-selling cultural organization passed');
}finally{
 if(orgId)await db.pool.query('DELETE FROM organizations WHERE id=$1',[orgId]).catch(()=>{});
 await db.pool.query('DELETE FROM expertise_claims WHERE account_id=$1',[buyer.id]).catch(()=>{});
 await db.pool.query('DELETE FROM art_profile_creator_claims WHERE account_id=$1',[buyer.id]).catch(()=>{});
 await db.pool.query('DELETE FROM art_profile_organization_selections WHERE account_id=$1',[buyer.id]).catch(()=>{});
 await db.pool.query('DELETE FROM art_profiles WHERE account_id=$1',[buyer.id]).catch(()=>{});
 await db.pool.end();
}
