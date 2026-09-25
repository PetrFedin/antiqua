import {send} from './runtime-v09.mjs';
import {listPublicMarketResults,marketIntelligenceFor,marketIntelligenceCapabilities} from './market-intelligence-v25.mjs';

export async function routeMarketIntelligencePublicV25(req,res,url){
 if(url.pathname==='/api/market-intelligence/capabilities'&&req.method==='GET')return send(res,200,{capabilities:marketIntelligenceCapabilities()});
 if(url.pathname==='/api/market-intelligence/results'&&req.method==='GET'){
  return send(res,200,await listPublicMarketResults({
   limit:url.searchParams.get('limit')||50,status:url.searchParams.get('status')||null,currency:url.searchParams.get('currency')||null
  }))
 }
 const m=url.pathname.match(/^\/api\/lots\/([^/]+)\/comparables$/);
 if(m&&req.method==='GET'){
  const result=await marketIntelligenceFor(m[1],{limit:url.searchParams.get('limit')||8});
  if(!result)return send(res,404,{error:'Object not found',code:'OBJECT_NOT_FOUND'});
  return send(res,200,result)
 }
 return false
}
