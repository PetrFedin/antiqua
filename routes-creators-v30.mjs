import {send,readBody,requireCsrf,audit,authContext} from './runtime-v09.mjs';
import {creatorGraphCapabilities,listCreators,getCreatorProfile,createCreator,publishCreator,addRepresentation,linkCreatorObject,setCreatorFollow,creatorSalesAuthority} from './creator-graph-v30.mjs';

export async function routeCreatorsV30(req,res,url,ctx=null){
 if(url.pathname==='/api/creators/capabilities'&&req.method==='GET')return send(res,200,{capabilities:creatorGraphCapabilities()});
 if(url.pathname==='/api/creators'&&req.method==='GET'){const auth=ctx||await authContext(req);return send(res,200,{creators:await listCreators(auth?.account||null),capabilities:creatorGraphCapabilities()})}
 if(url.pathname==='/api/creators'&&req.method==='POST'){const auth=ctx||await authContext(req);if(!auth)return send(res,401,{error:'Authentication required',code:'AUTH_REQUIRED'});requireCsrf(req,auth);const creator=await createCreator(auth.account,await readBody(req));await audit(req,auth.account,'CREATOR_DRAFT_CREATED','CREATOR',creator.id,null,{creatorType:creator.creatorType,salesModel:creator.salesModel});return send(res,201,{creator})}
 const m=url.pathname.match(/^\/api\/creators\/([^/]+)(?:\/(publish|follow|representations|objects|sales-authority))?$/);if(!m)return false;const id=decodeURIComponent(m[1]),sub=m[2]||null;
 if(!sub&&req.method==='GET'){const auth=ctx||await authContext(req),profile=await getCreatorProfile(auth?.account||null,id);return profile?send(res,200,profile):send(res,404,{error:'Creator not found',code:'CREATOR_NOT_FOUND'})}
 if(sub==='sales-authority'&&req.method==='GET'){const marketContext=url.searchParams.get('marketContext')||'PRIMARY',sellerId=url.searchParams.get('sellerId')||null,x=await creatorSalesAuthority(id,{marketContext,sellerId});return x?send(res,200,{authority:x}):send(res,404,{error:'Creator not found',code:'CREATOR_NOT_FOUND'})}
 const auth=ctx||await authContext(req);if(!auth)return send(res,401,{error:'Authentication required',code:'AUTH_REQUIRED'});requireCsrf(req,auth);
 if(sub==='publish'&&req.method==='POST'){const creator=await publishCreator(auth.account,id);await audit(req,auth.account,'CREATOR_PUBLISHED','CREATOR',creator.id,null,{evidenceStatus:creator.evidenceStatus});return send(res,200,{creator})}
 if(sub==='follow'&&req.method==='POST'){const body=await readBody(req),x=await setCreatorFollow(auth.account,id,body.enabled!==false);await audit(req,auth.account,x.enabled?'CREATOR_FOLLOWED':'CREATOR_UNFOLLOWED','CREATOR',x.creatorId,null,{enabled:x.enabled});return send(res,200,x)}
 if(sub==='representations'&&req.method==='POST'){const representation=await addRepresentation(auth.account,id,await readBody(req));await audit(req,auth.account,'CREATOR_REPRESENTATION_ADDED','CREATOR',representation.creatorId,null,{representationId:representation.id,organizationId:representation.organizationId,status:representation.status});return send(res,201,{representation})}
 if(sub==='objects'&&req.method==='POST'){const link=await linkCreatorObject(auth.account,id,await readBody(req));await audit(req,auth.account,'CREATOR_OBJECT_LINKED','CREATOR',link.creatorId,null,{objectId:link.objectId,marketContext:link.marketContext,creatorRole:link.creatorRole});return send(res,200,{link})}
 return false
}
