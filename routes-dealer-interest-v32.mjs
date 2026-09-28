import {send,requirePermission} from './runtime-v09.mjs';
import {dealerInterestCapabilities,dealerInterestFor} from './dealer-interest-v32.mjs';

export async function routeDealerInterestV32(req,res,url,ctx){
 if(!ctx)return false;
 if(url.pathname==='/api/dealer/interest/capabilities'&&req.method==='GET'){
  if(!ctx.account?.sellerId)return send(res,403,{error:'Seller account required',code:'SELLER_REQUIRED'});
  requirePermission(ctx.account,'seller.analytics.read');
  return send(res,200,{capabilities:dealerInterestCapabilities()})
 }
 if(url.pathname==='/api/dealer/interest'&&req.method==='GET'){
  if(!ctx.account?.sellerId)return send(res,403,{error:'Seller account required',code:'SELLER_REQUIRED'});
  requirePermission(ctx.account,'seller.analytics.read');
  return send(res,200,{interest:await dealerInterestFor(ctx.account)})
 }
 return false
}
