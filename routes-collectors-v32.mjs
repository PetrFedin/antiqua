import {send,readBody,requireCsrf,audit,authContext} from './runtime-v09.mjs';
import {listCollectors,getCollectorProfile,getMyCollectorProfile,upsertCollectorProfile,setCollectorFollow,collectorProfileCapabilities} from './collector-profile-v32.mjs';

export async function routeCollectorsPublicV32(req,res,url){
 if(url.pathname==='/api/collectors/capabilities'&&req.method==='GET')return send(res,200,{capabilities:collectorProfileCapabilities()});
 if(url.pathname==='/api/collectors'&&req.method==='GET'){const ctx=await authContext(req);return send(res,200,await listCollectors(ctx?.account||null))}
 const m=url.pathname.match(/^\/api\/collectors\/([^/]+)$/);
 if(m&&req.method==='GET'){const ctx=await authContext(req),data=await getCollectorProfile(ctx?.account||null,decodeURIComponent(m[1]));return data?send(res,200,data):send(res,404,{error:'Collector profile not found',code:'COLLECTOR_NOT_FOUND'})}
 return false
}

export async function routeCollectorsV32(req,res,url,ctx){
 if(!ctx)return false;
 if(url.pathname==='/api/collector-profile/me'&&req.method==='GET')return send(res,200,await getMyCollectorProfile(ctx.account));
 if(url.pathname==='/api/collector-profile/me'&&['PUT','PATCH'].includes(req.method)){requireCsrf(req,ctx);const before=await getMyCollectorProfile(ctx.account),data=await upsertCollectorProfile(ctx.account,await readBody(req));await audit(req,ctx.account,'COLLECTOR_PROFILE_UPDATED','ACCOUNT',ctx.account.id,before.profile,data.profile,{visibility:data.profile.visibility});return send(res,200,data)}
 const follow=url.pathname.match(/^\/api\/collectors\/([^/]+)\/follow$/);
 if(follow&&req.method==='POST'){requireCsrf(req,ctx);const body=await readBody(req),result=await setCollectorFollow(ctx.account,decodeURIComponent(follow[1]),body.enabled!==false);await audit(req,ctx.account,result.enabled?'COLLECTOR_FOLLOWED':'COLLECTOR_UNFOLLOWED','COLLECTOR_PROFILE',result.slug,null,{enabled:result.enabled});return send(res,200,result)}
 return false
}
