import {send} from './runtime-v09.mjs';
import {dealerLeadCapabilities,dealerLeadCockpit} from './dealer-leads-v24.mjs';

export async function routeDealerLeadsV24(req,res,url,ctx){
 if(!ctx)return false;
 if(url.pathname==='/api/dealer/leads/capabilities'&&req.method==='GET'){
  if(!ctx.account?.sellerId)return send(res,403,{error:'Seller account required',code:'SELLER_REQUIRED'});
  return send(res,200,{capabilities:dealerLeadCapabilities()})
 }
 if(url.pathname==='/api/dealer/leads'&&req.method==='GET'){
  if(!ctx.account?.sellerId)return send(res,403,{error:'Seller account required',code:'SELLER_REQUIRED'});
  return send(res,200,{cockpit:await dealerLeadCockpit(ctx.account)})
 }
 return false
}
