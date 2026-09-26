import assert from 'node:assert/strict';
import {createCreator,publishCreator,addRepresentation,linkCreatorObject,creatorSalesAuthority,getCreatorProfile,setCreatorFollow,creatorGraphCapabilities} from '../creator-graph-v30.mjs';

const seller={id:'creator-seller-memory',sellerId:'seller-preview',roles:['SELLER','DEALER']},operator={id:'creator-operator-memory',roles:['ADMIN','CATALOGUER']},buyer={id:'creator-buyer-memory',roles:['BUYER']};
const independent=await createCreator(seller,{nameEn:'Independent Studio Proof',nameRu:'Тест независимой мастерской',creatorType:'CRAFTSPERSON',salesModel:'INDEPENDENT',disciplines:[{en:'Objects',ru:'Предметы'}]});
let authority=await creatorSalesAuthority(independent.id,{sellerId:'seller-preview',marketContext:'PRIMARY'});assert.equal(authority.allowed,true);assert.equal(authority.reason,'EXPLICIT_INDEPENDENT_CREATOR');
const linked=await linkCreatorObject(seller,independent.id,{objectId:'lot-109',creatorRole:'MAKER',marketContext:'PRIMARY',attributionStatus:'SELF_DECLARED'});assert.equal(linked.marketContext,'PRIMARY');
await publishCreator(operator,independent.id);let profile=await getCreatorProfile(buyer,independent.id);assert.equal(profile.creator.profileStatus,'PUBLISHED');assert.ok(profile.works.some(w=>w.object.id==='lot-109'&&w.listing?.salesAuthorized));
let followed=await setCreatorFollow(buyer,independent.id,true);assert.equal(followed.follow.following,true);

const represented=await createCreator(seller,{nameEn:'Represented Artist Proof',nameRu:'Тест представленного автора',creatorType:'ARTIST'});
await addRepresentation(seller,represented.id,{organizationId:'preview-gallery',organizationName:'Preview Gallery',relationshipType:'EXCLUSIVE',status:'ACTIVE',primarySalesAuthorized:true});
authority=await creatorSalesAuthority(represented.id,{sellerId:'seller-preview',marketContext:'PRIMARY'});assert.equal(authority.allowed,true);assert.equal(authority.reason,'ACTIVE_REPRESENTATION');
authority=await creatorSalesAuthority(represented.id,{sellerId:'dealer-north',marketContext:'PRIMARY'});assert.equal(authority.allowed,false);assert.equal(authority.reason,'PRIMARY_SELLER_NOT_AUTHORIZED');
authority=await creatorSalesAuthority(represented.id,{sellerId:'dealer-north',marketContext:'SECONDARY'});assert.equal(authority.allowed,true);assert.equal(authority.reason,'SECONDARY_MARKET_INDEPENDENT');
assert.equal(creatorGraphCapabilities().representedCreatorDirectSaleDefault,false);
console.log('ANTIQUA v30 Creator Graph: publication gate + independent/represented primary authority + secondary market + follow passed');
