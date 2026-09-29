import {send,readBody,authContext} from './runtime-v09.mjs';
import {partnerPilotCapabilities,recordPartnerExposure,partnerPilotAnalytics} from './partner-pilot-analytics-v33.mjs';

export async function routePartnerPilotPublicV33(req,res,url){
 if(url.pathname==='/api/partner-pilot/capabilities'&&req.method==='GET')return send(res,200,{capabilities:partnerPilotCapabilities()});
 const m=url.pathname.match(/^\/api\/exhibitions\/([^/]+)\/pilot\/events$/);
 if(m&&req.method==='POST'){
  const auth=await authContext(req),body=await readBody(req),result=await recordPartnerExposure(req,auth?.account||null,m[1],body);
  return send(res,result.deduplicated?200:201,result)
 }
 return false
}

export async function routePartnerPilotV33(req,res,url,ctx){
 if(!ctx)return false;
 const m=url.pathname.match(/^\/api\/exhibitions\/([^/]+)\/pilot\/analytics$/);
 if(m&&req.method==='GET')return send(res,200,{analytics:await partnerPilotAnalytics(ctx.account,m[1])});
 return false
}
