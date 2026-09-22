import {send} from './runtime-v09.mjs';
import {getBuyerIntents,buyerIntentCapabilities} from './buyer-intents-v22.mjs';

export async function routeBuyerIntentsV22(req,res,url,ctx){
 if(url.pathname==='/api/buyer/intents/capabilities'&&req.method==='GET')return send(res,200,{capabilities:buyerIntentCapabilities()});
 if(url.pathname!=='/api/buyer/intents'||req.method!=='GET')return false;
 if(!ctx)return send(res,401,{error:'Authentication required',code:'AUTH_REQUIRED'});
 const intents=await getBuyerIntents(ctx.account);
 return send(res,200,{intents,capabilities:buyerIntentCapabilities()});
}
