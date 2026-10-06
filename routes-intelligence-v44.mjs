import {send,requirePermission} from './runtime-v09.mjs';
import {intelligenceCapabilities,collectorIntelligenceFor,professionalIntelligenceFor,scholarlyMarketIntelligenceFor} from './intelligence-v44.mjs';

export async function routeIntelligencePublicV44(req,res,url){
 if(url.pathname==='/api/intelligence/capabilities'&&req.method==='GET')return send(res,200,{capabilities:intelligenceCapabilities()});
 const scholarly=url.pathname.match(/^\/api\/lots\/([^/]+)\/intelligence$/);
 if(scholarly&&req.method==='GET'){
  const result=await scholarlyMarketIntelligenceFor(scholarly[1],{marketLimit:url.searchParams.get('limit')||8});
  return result?send(res,200,{intelligence:result}):send(res,404,{error:'Artwork not found',code:'ARTWORK_NOT_FOUND'})
 }
 return false
}

export async function routeIntelligenceV44(req,res,url,ctx){
 if(!ctx)return false;
 if(url.pathname==='/api/intelligence/collector'&&req.method==='GET'){
  requirePermission(ctx.account,'collection.manage');
  return send(res,200,{intelligence:await collectorIntelligenceFor(ctx.account,{limit:url.searchParams.get('limit')||12})})
 }
 if(url.pathname==='/api/intelligence/professional'&&req.method==='GET'){
  if(!ctx.account?.sellerId)return send(res,403,{error:'Seller account required',code:'SELLER_REQUIRED'});
  requirePermission(ctx.account,'seller.analytics.read');
  return send(res,200,{intelligence:await professionalIntelligenceFor(ctx.account,{limit:url.searchParams.get('limit')||20})})
 }
 return false
}
