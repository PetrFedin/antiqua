import {send,readBody,requireCsrf,audit} from './runtime-v09.mjs';
import {
 artNetworkCapabilities,upsertArtProfile,getMyArtProfile,listPublicArtProfiles,getPublicArtProfile,
 setRoleClaim,setExpertiseClaim,linkProfileCreator,linkProfileOrganization,
 updateCulturalOrganizationProfile,listPublicGalleries,reviewArtNetworkClaim
} from './art-network-v41.mjs';

export async function routeArtNetworkPublicV41(req,res,url){
 if(url.pathname==='/api/art-network/capabilities'&&req.method==='GET')return send(res,200,{capabilities:artNetworkCapabilities()});
 if(url.pathname==='/api/art-profiles'&&req.method==='GET')return send(res,200,{profiles:await listPublicArtProfiles({role:url.searchParams.get('role'),q:url.searchParams.get('q'),limit:url.searchParams.get('limit')}),capabilities:artNetworkCapabilities()});
 const p=url.pathname.match(/^\/api\/art-profiles\/([^/]+)$/);if(p&&req.method==='GET'){const profile=await getPublicArtProfile(decodeURIComponent(p[1]));return profile?send(res,200,{profile}):send(res,404,{error:'Art profile not found',code:'ART_PROFILE_NOT_FOUND'})}
 if(url.pathname==='/api/galleries'&&req.method==='GET')return send(res,200,{galleries:await listPublicGalleries()});
 return false
}

export async function routeArtNetworkV41(req,res,url,ctx){
 if(!ctx)return false;const a=ctx.account;
 if(url.pathname==='/api/art-profile/me'&&req.method==='GET'){const x=await getMyArtProfile(a);return send(res,200,x||{profile:null,claims:null})}
 if(url.pathname==='/api/art-profile/me'&&req.method==='PATCH'){requireCsrf(req,ctx);const before=await getMyArtProfile(a),x=await upsertArtProfile(a,await readBody(req));await audit(req,a,'ART_PROFILE_UPSERTED','ART_PROFILE',x.profile.id,before?.profile||null,x.profile,{visibility:x.profile.visibility});return send(res,before?200:201,x)}
 if(url.pathname==='/api/art-profile/me/roles'&&req.method==='POST'){requireCsrf(req,ctx);const claim=await setRoleClaim(a,await readBody(req));await audit(req,a,'ART_PROFILE_ROLE_CLAIMED','ART_PROFILE_ROLE',claim.id,null,{role:claim.role,status:claim.status});return send(res,200,{claim})}
 if(url.pathname==='/api/art-profile/me/expertise'&&req.method==='POST'){requireCsrf(req,ctx);const claim=await setExpertiseClaim(a,await readBody(req));await audit(req,a,'ART_EXPERTISE_CLAIMED','ART_EXPERTISE',claim.id,null,{expertiseCode:claim.expertiseCode,status:claim.status});return send(res,200,{claim})}
 if(url.pathname==='/api/art-profile/me/creator-links'&&req.method==='POST'){requireCsrf(req,ctx);const link=await linkProfileCreator(a,await readBody(req));await audit(req,a,'ART_PROFILE_CREATOR_LINK_CLAIMED','ART_PROFILE_CREATOR_LINK',link.id,null,{creatorId:link.creatorId,relationshipType:link.relationshipType,status:link.status});return send(res,200,{link})}
 if(url.pathname==='/api/art-profile/me/organization-links'&&req.method==='POST'){requireCsrf(req,ctx);const link=await linkProfileOrganization(a,await readBody(req));await audit(req,a,'ART_PROFILE_ORGANIZATION_LINKED','ART_PROFILE_ORGANIZATION_LINK',link.id,null,{organizationId:link.organizationId,relationshipType:link.relationshipType,public:link.public});return send(res,200,{link})}
 const m=url.pathname.match(/^\/api\/organizations\/([^/]+)\/cultural-profile$/);if(m&&req.method==='PATCH'){requireCsrf(req,ctx);const profile=await updateCulturalOrganizationProfile(a,decodeURIComponent(m[1]),await readBody(req));await audit(req,a,'ORGANIZATION_CULTURAL_PROFILE_UPDATED','ORGANIZATION',decodeURIComponent(m[1]),null,profile,{publicationStatus:profile.publicationStatus,reviewStatus:profile.reviewStatus});return send(res,200,{profile})}
 if(url.pathname==='/api/art-network/review'&&req.method==='POST'){requireCsrf(req,ctx);const result=await reviewArtNetworkClaim(a,await readBody(req));await audit(req,a,'ART_NETWORK_CLAIM_REVIEWED',result.entityType,result.id,null,result,{status:result.status});return send(res,200,{review:result})}
 return false
}
