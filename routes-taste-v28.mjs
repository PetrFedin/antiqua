import {send,readBody,requireCsrf,audit} from './runtime-v09.mjs';
import {recordTasteSignal,buildTasteProfile,tasteRecommendations,tasteGraphCapabilities} from './taste-graph-v28.mjs';

export async function routeTasteV28(req,res,url,ctx){
 if(!ctx)return false;const a=ctx.account;
 if(url.pathname==='/api/taste/capabilities'&&req.method==='GET')return send(res,200,{capabilities:tasteGraphCapabilities()});
 if(url.pathname==='/api/taste/profile'&&req.method==='GET'){const x=await buildTasteProfile(a);return send(res,200,{profile:x.profile,capabilities:x.capabilities})}
 if(url.pathname==='/api/taste/recommendations'&&req.method==='GET'){const x=await tasteRecommendations(a,{limit:url.searchParams.get('limit')||8});return send(res,200,x)}
 if(url.pathname==='/api/taste/signals'&&req.method==='POST'){requireCsrf(req,ctx);const x=await recordTasteSignal(a,await readBody(req));await audit(req,a,x.idempotent?'TASTE_SIGNAL_REPLAY':'TASTE_SIGNAL_RECORDED','OBJECT',x.signal.objectId,null,{signalType:x.signal.signalType});return send(res,x.idempotent?200:201,x)}
 return false
}
