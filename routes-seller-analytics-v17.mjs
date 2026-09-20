import {send,requirePermission} from './runtime-v09.mjs';
import {sellerAnalyticsFor} from './seller-analytics-v17.mjs';

export async function routeSellerAnalyticsV17(req,res,url,ctx){
 if(url.pathname!=='/api/seller/analytics'||req.method!=='GET')return false;
 if(!ctx)return send(res,401,{error:'Authentication required',code:'AUTH_REQUIRED'});
 requirePermission(ctx.account,'seller.analytics.read');
 return send(res,200,{analytics:await sellerAnalyticsFor(ctx.account)});
}
