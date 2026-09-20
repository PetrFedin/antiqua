import {db,send,lot} from './runtime-v09.mjs';
import {listRecentlyViewed,engagementCapabilities} from './engagement-v17.mjs';

export async function routeEngagementV17(req,res,url,ctx){
 if(url.pathname!=='/api/engagement/recent'||req.method!=='GET')return false;
 if(!ctx)return send(res,401,{error:'Authentication required',code:'AUTH_REQUIRED'});
 const rows=await listRecentlyViewed(db,ctx.account.id,{limit:12});
 const items=rows.map(x=>{const o=lot(x.objectId);return o?{...x,object:{id:o.id,objectId:o.objectId,title:o.title,image:o.image,department:o.department,period:o.period}}:null}).filter(Boolean);
 return send(res,200,{items,capabilities:engagementCapabilities()});
}
