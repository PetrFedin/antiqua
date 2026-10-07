import {send} from './runtime-v09.mjs';
import {productionAdmissionSnapshot} from './production-admission-v49.mjs';

export async function routeProductionAdmissionPublicV49(req,res,url){
  if(url.pathname!=='/api/ready'||req.method!=='GET')return false;
  const admission=await productionAdmissionSnapshot();
  return send(res,admission.productionReady?200:503,{admission});
}
