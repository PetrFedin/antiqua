import {send,listing} from './runtime-v09.mjs';
import {getAuthoritativePublicAuction} from './auction-authority-v15.mjs';
import {listingTotalCost,auctionTotalCost,totalCostCapabilities} from './total-cost-v17.mjs';

const parseAmount=url=>{
 const raw=url.searchParams.get('amount');if(raw==null||raw==='')return null;
 const n=Math.round(Number(raw));if(!Number.isSafeInteger(n)||n<=0)throw Object.assign(new Error('Positive integer amount required'),{status:400,code:'INVALID_COST_BASIS'});
 return n;
};

export async function routeTotalCostPublicV17(req,res,url){
 if(req.method!=='GET')return false;
 const lm=url.pathname.match(/^\/api\/commerce\/cost\/listing\/([^/]+)$/);
 if(lm){
  const li=listing(lm[1]);if(!li||li.status!=='ACTIVE')return send(res,404,{error:'Listing not found',code:'LISTING_NOT_FOUND'});
  const mode=String(url.searchParams.get('mode')||'BUY').toUpperCase(),amount=parseAmount(url);
  if(!['BUY','OFFER'].includes(mode))return send(res,400,{error:'Invalid cost mode',code:'INVALID_COST_MODE'});
  return send(res,200,{cost:listingTotalCost(li,{amount,mode}),capabilities:totalCostCapabilities()});
 }
 const am=url.pathname.match(/^\/api\/commerce\/cost\/auction\/([^/]+)$/);
 if(am){
  const au=await getAuthoritativePublicAuction(am[1]);if(!au)return send(res,404,{error:'Auction not found',code:'AUCTION_NOT_FOUND'});
  if(au.state==='CLOSED')return send(res,409,{error:'Auction closed',code:'AUCTION_CLOSED'});
  return send(res,200,{cost:auctionTotalCost(au,{amount:parseAmount(url)}),capabilities:totalCostCapabilities()});
 }
 return false;
}
