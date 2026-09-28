import {send,readBody,authContext,requireCsrf,audit} from './runtime-v09.mjs';
import {listEditorial,getEditorialStory,recordEditorialEvent,createEditorialStory,publishEditorialStory,linkEditorialTarget,editorialAnalytics,editorialCapabilities} from './editorial-commerce-v31.mjs';

export async function routeEditorialPublicV31(req,res,url){
 if(url.pathname==='/api/editorial/capabilities'&&req.method==='GET')return send(res,200,{capabilities:editorialCapabilities()});
 if(url.pathname==='/api/editorial'&&req.method==='GET'){const data=await listEditorial({limit:url.searchParams.get('limit')||12,type:url.searchParams.get('type')||null});return send(res,200,data)}
 const m=url.pathname.match(/^\/api\/editorial\/([^/]+)$/);
 if(m&&req.method==='GET'){const ctx=await authContext(req),data=await getEditorialStory(ctx?.account||null,decodeURIComponent(m[1]));return data?send(res,200,data):send(res,404,{error:'Story not found',code:'EDITORIAL_NOT_FOUND'})}
 const ev=url.pathname.match(/^\/api\/editorial\/([^/]+)\/events$/);
 if(ev&&req.method==='POST'){const ctx=await authContext(req),result=await recordEditorialEvent(req,ctx?.account||null,decodeURIComponent(ev[1]),await readBody(req));return send(res,200,result)}
 return false
}

export async function routeEditorialV31(req,res,url,ctx){
 if(!ctx)return false;
 if(url.pathname==='/api/editorial'&&req.method==='POST'){requireCsrf(req,ctx);const story=await createEditorialStory(ctx.account,await readBody(req));await audit(req,ctx.account,'EDITORIAL_DRAFT_CREATED','EDITORIAL_STORY',story.id,null,{storyType:story.storyType,slug:story.slug});return send(res,201,{story})}
 const publish=url.pathname.match(/^\/api\/editorial\/([^/]+)\/publish$/);
 if(publish&&req.method==='POST'){requireCsrf(req,ctx);const story=await publishEditorialStory(ctx.account,decodeURIComponent(publish[1]));await audit(req,ctx.account,'EDITORIAL_STORY_PUBLISHED','EDITORIAL_STORY',story.id,null,{slug:story.slug});return send(res,200,{story})}
 const link=url.pathname.match(/^\/api\/editorial\/([^/]+)\/links$/);
 if(link&&req.method==='POST'){requireCsrf(req,ctx);const result=await linkEditorialTarget(ctx.account,decodeURIComponent(link[1]),await readBody(req));await audit(req,ctx.account,result.idempotent?'EDITORIAL_LINK_REPLAY':'EDITORIAL_LINK_ADDED','EDITORIAL_STORY',decodeURIComponent(link[1]),null,{linkType:result.link.linkType,targetId:result.link.targetId});return send(res,result.idempotent?200:201,result)}
 const analytics=url.pathname.match(/^\/api\/editorial\/([^/]+)\/analytics$/);
 if(analytics&&req.method==='GET')return send(res,200,await editorialAnalytics(ctx.account,decodeURIComponent(analytics[1])));
 return false
}
