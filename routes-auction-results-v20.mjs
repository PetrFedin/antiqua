import {send} from './runtime-v09.mjs';
import {getPublicAuctionResult,auctionResultCapabilities} from './auction-results-v20.mjs';

export async function routeAuctionResultsPublicV20(req,res,url){
 const m=url.pathname.match(/^\/api\/auctions\/([^/]+)\/result$/);
 if(!m||req.method!=='GET')return false;
 const result=await getPublicAuctionResult(m[1]);
 if(!result)return send(res,404,{error:'Auction not found',code:'AUCTION_NOT_FOUND'});
 return send(res,200,{result,capabilities:auctionResultCapabilities()});
}
