import {send,requirePermission} from './runtime-v09.mjs';
import {partnerPilotAnalyticsFor,partnerPilotCapabilities} from './partner-pilot-analytics-v33.mjs';

export async function routePartnerPilotPublicV33(req,res,url){
 if(url.pathname==='/api/partner/pilot-analytics/capabilities'&&req.method==='GET')return send(res,200,{capabilities:partnerPilotCapabilities()});
 return false
}

export async function routePartnerPilotV33(req,res,url,ctx){
 if(!ctx)return false;
 if(url.pathname==='/api/partner/pilot-analytics'&&req.method==='GET'){
  if(!ctx.account?.sellerId)return send(res,403,{error:'Seller account required',code:'SELLER_REQUIRED'});
  requirePermission(ctx.account,'seller.analytics.read');
  return send(res,200,{analytics:await partnerPilotAnalyticsFor(ctx.account)})
 }
 return false
}
