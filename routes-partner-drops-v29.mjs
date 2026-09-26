import {send,readBody,requireCsrf,audit,authContext} from './runtime-v09.mjs';
import {getPartnerDrop,setExhibitionFollow,transitionPartnerDrop,partnerDropCapabilities} from './partner-drops-v29.mjs';

export async function routePartnerDropsV29(req,res,url,ctx=null){
 if(url.pathname==='/api/partner-drops/capabilities'&&req.method==='GET')return send(res,200,{capabilities:partnerDropCapabilities()});
 const drop=url.pathname.match(/^\/api\/exhibitions\/([^/]+)\/drop$/);
 if(drop&&req.method==='GET'){const auth=ctx||await authContext(req),x=await getPartnerDrop(auth?.account||null,drop[1]);return x?send(res,200,x):send(res,404,{error:'Exhibition not found',code:'EXHIBITION_NOT_FOUND'})}
 const follow=url.pathname.match(/^\/api\/exhibitions\/([^/]+)\/follow$/);
 if(follow&&req.method==='POST'){const auth=ctx||await authContext(req);if(!auth)return send(res,401,{error:'Authentication required',code:'AUTH_REQUIRED'});requireCsrf(req,auth);const body=await readBody(req),x=await setExhibitionFollow(auth.account,follow[1],body.enabled!==false);await audit(req,auth.account,x.enabled?'EXHIBITION_FOLLOWED':'EXHIBITION_UNFOLLOWED','EXHIBITION',follow[1],null,{enabled:x.enabled});return send(res,200,x)}
 const transition=url.pathname.match(/^\/api\/exhibitions\/([^/]+)\/drop\/(release|archive)$/);
 if(transition&&req.method==='POST'){const auth=ctx||await authContext(req);if(!auth)return send(res,401,{error:'Authentication required',code:'AUTH_REQUIRED'});requireCsrf(req,auth);const next=transition[2]==='release'?'LIVE':'ARCHIVED',x=await transitionPartnerDrop(auth.account,transition[1],next);await audit(req,auth.account,next==='LIVE'?'PARTNER_DROP_RELEASED':'PARTNER_DROP_ARCHIVED','EXHIBITION',transition[1],null,{stage:x.drop.stage,changed:x.changed});return send(res,200,x)}
 return false
}
