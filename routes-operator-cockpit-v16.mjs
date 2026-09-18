import {send,requirePermission} from './runtime-v09.mjs';
import {operatorCockpitSnapshot,operatorCockpitCapabilities} from './operator-cockpit-v16.mjs';

export async function routeOperatorCockpitV16(req,res,url,ctx){
  if(!ctx)return false;
  if(url.pathname==='/api/operator/cockpit/capabilities'&&req.method==='GET'){
    requirePermission(ctx.account,'audit.read');
    return send(res,200,{capabilities:operatorCockpitCapabilities()});
  }
  if(url.pathname==='/api/operator/cockpit'&&req.method==='GET'){
    requirePermission(ctx.account,'audit.read');
    const limit=Number(url.searchParams.get('limit')||100);
    return send(res,200,{cockpit:await operatorCockpitSnapshot({limit})});
  }
  return false;
}
