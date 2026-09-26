import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {db} from '../runtime-v09.mjs';
import {ensureSellerOrganization} from '../organizations-v15.mjs';
import {createCreator,publishCreator,addRepresentation,linkCreatorObject,creatorSalesAuthority,getCreatorProfile,setCreatorFollow} from '../creator-graph-v30.mjs';

if(!process.env.DATABASE_URL){console.log('ANTIQUA v30 PostgreSQL Creator Graph: skipped (DATABASE_URL not set)');process.exit(0)}
assert.equal(db.kind,'POSTGRES');
const seller=await db.findAccountByEmail('seller@demo.antiqua'),operator=await db.findAccountByEmail('operator@demo.antiqua'),buyer=await db.findAccountByEmail('buyer@demo.antiqua');assert.ok(seller?.sellerId);assert.ok(operator?.roles?.includes('ADMIN'));assert.ok(buyer);
const org=await ensureSellerOrganization(seller);assert.ok(org?.id);const token=crypto.randomUUID().replaceAll('-','').slice(0,10);let creator=null;
try{
 creator=await createCreator(seller,{nameEn:'Postgres Artist '+token,nameRu:'Postgres автор '+token,creatorType:'ARTIST',salesModel:'UNSPECIFIED',slug:'pg-artist-'+token});
 await addRepresentation(seller,creator.id,{organizationId:org.id,relationshipType:'EXCLUSIVE',status:'ACTIVE',primarySalesAuthorized:true,directSalesAllowed:false,evidence:{agreementRef:'test-only'}});
 let authority=await creatorSalesAuthority(creator.id,{sellerId:seller.sellerId,marketContext:'PRIMARY'});assert.equal(authority.allowed,true);assert.equal(authority.reason,'ACTIVE_REPRESENTATION');
 authority=await creatorSalesAuthority(creator.id,{sellerId:'dealer-north',marketContext:'PRIMARY'});assert.equal(authority.allowed,false);
 authority=await creatorSalesAuthority(creator.id,{sellerId:'dealer-north',marketContext:'SECONDARY'});assert.equal(authority.allowed,true);
 await linkCreatorObject(seller,creator.id,{objectId:'lot-109',creatorRole:'ARTIST',marketContext:'PRIMARY',attributionStatus:'DOCUMENTED',evidence:{source:'test'}});
 await publishCreator(operator,creator.id);await setCreatorFollow(buyer,creator.id,true);
 const profile=await getCreatorProfile(buyer,creator.id);assert.equal(profile.creator.profileStatus,'PUBLISHED');assert.equal(profile.creator.evidenceStatus,'PLATFORM_REVIEWED');assert.equal(profile.follow.following,true);assert.ok(profile.representations.some(r=>r.organization.id===org.id&&r.primarySalesAuthorized));assert.ok(profile.works.some(w=>w.object.id==='lot-109'&&w.marketContext==='PRIMARY'&&w.listing?.salesAuthorized===true));
 const row=(await db.pool.query('SELECT sales_model,profile_status,evidence_status FROM creators WHERE id=$1',[creator.id])).rows[0];assert.deepEqual(row,{sales_model:'REPRESENTED',profile_status:'PUBLISHED',evidence_status:'PLATFORM_REVIEWED'});
 console.log('ANTIQUA v30 PostgreSQL Creator Graph: representation authority + primary/secondary boundary + publication + follow passed');
}finally{if(creator)await db.pool.query('DELETE FROM creators WHERE id=$1',[creator.id]).catch(()=>{});await db.pool.end()}
