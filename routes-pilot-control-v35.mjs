import {send,requirePermission} from './runtime-v09.mjs';
import {pilotControlCapabilities,pilotCommercialProofFor,pilotCommercialReport} from './pilot-control-v35.mjs';

export async function routePilotControlPublicV35(req,res,url){
 if(url.pathname==='/api/pilot/commercial-proof/capabilities'&&req.method==='GET')return send(res,200,{capabilities:pilotControlCapabilities()});
 return false
}
export async function routePilotControlV35(req,res,url,ctx){
 if(!ctx)return false;
 if(!['/api/pilot/commercial-proof','/api/pilot/commercial-proof/report'].includes(url.pathname)||req.method!=='GET')return false;
 if(!ctx.account?.sellerId)return send(res,403,{error:'Seller account required',code:'SELLER_REQUIRED'});
 requirePermission(ctx.account,'seller.analytics.read');
 const proof=await pilotCommercialProofFor(ctx.account,{pilotStartAt:url.searchParams.get('pilotStartAt')||null});
 if(url.pathname.endsWith('/report')){
  const body=pilotCommercialReport(proof);
  res.writeHead(200,{'content-type':'text/markdown; charset=utf-8','content-disposition':'attachment; filename="antiqua-pilot-commercial-proof.md"','cache-control':'no-store'});res.end(body);return
 }
 return send(res,200,{proof})
}
