import {send,requirePermission} from './runtime-v09.mjs';
import {dealerPerformanceCapabilities,dealerPerformanceFor,dealerPerformanceReport} from './dealer-performance-v34.mjs';

export async function routeDealerPerformancePublicV34(req,res,url){
 if(url.pathname==='/api/dealer/performance/capabilities'&&req.method==='GET')return send(res,200,{capabilities:dealerPerformanceCapabilities()});
 return false
}
export async function routeDealerPerformanceV34(req,res,url,ctx){
 if(!ctx)return false;
 if(url.pathname==='/api/dealer/performance'&&req.method==='GET'){
  if(!ctx.account?.sellerId)return send(res,403,{error:'Seller account required',code:'SELLER_REQUIRED'});
  requirePermission(ctx.account,'seller.analytics.read');
  return send(res,200,{performance:await dealerPerformanceFor(ctx.account)})
 }
 if(url.pathname==='/api/dealer/performance/report'&&req.method==='GET'){
  if(!ctx.account?.sellerId)return send(res,403,{error:'Seller account required',code:'SELLER_REQUIRED'});
  requirePermission(ctx.account,'seller.analytics.read');
  const evidence=await dealerPerformanceFor(ctx.account);const body=dealerPerformanceReport(evidence);
  res.writeHead(200,{'content-type':'text/markdown; charset=utf-8','content-disposition':'attachment; filename="antiqua-dealer-pilot-evidence.md"','cache-control':'no-store'});res.end(body);return
 }
 return false
}
