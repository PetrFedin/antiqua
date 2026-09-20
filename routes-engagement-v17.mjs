import {db,send,lot,requireCsrf,audit} from './runtime-v09.mjs';
import {listRecentlyViewed,clearRecentlyViewed,engagementCapabilities} from './engagement-v17.mjs';

export async function routeEngagementV17(req,res,url,ctx){
 if(url.pathname!=='/api/engagement/recent'||!['GET','DELETE'].includes(req.method))return false;
 if(!ctx)return send(res,401,{error:'Authentication required',code:'AUTH_REQUIRED'});
 if(req.method==='DELETE'){requireCsrf(req,ctx);const cleared=await clearRecentlyViewed(db,ctx.account.id);await audit(req,ctx.account,'RECENT_HISTORY_CLEARED','ACCOUNT',ctx.account.id,null,null,{cleared});return send(res,200,{cleared})}
 const rows=await listRecentlyViewed(db,ctx.account.id,{limit:12});
 const items=rows.map(x=>{const o=lot(x.objectId);return o?{...x,object:{id:o.id,objectId:o.objectId,title:o.title,image:o.image,department:o.department,period:o.period}}:null}).filter(Boolean);
 return send(res,200,{items,capabilities:engagementCapabilities()});
}
