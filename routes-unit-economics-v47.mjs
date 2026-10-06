import {send} from './runtime-v09.mjs';
import {unitEconomicsCapabilities,operatorUnitEconomics} from './unit-economics-v47.mjs';

export async function routeUnitEconomicsPublicV47(req,res,url){
 if(url.pathname==='/api/unit-economics/capabilities'&&req.method==='GET')return send(res,200,{capabilities:unitEconomicsCapabilities()});
 return false
}

export async function routeUnitEconomicsV47(req,res,url,ctx){
 if(!ctx)return false;
 if(url.pathname==='/api/operator/unit-economics'&&req.method==='GET')return send(res,200,{unitEconomics:await operatorUnitEconomics(ctx.account)});
 return false
}
