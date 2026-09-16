import {lots} from './runtime-v09.mjs';
import {routeOperator} from './routes-operator-v09.mjs';
import {notifyDiscoveryForObject} from './discovery-events-v14.mjs';

export async function routeOperatorHooksV14(req,res,url,ctx){
 const publish=url.pathname.match(/^\/api\/operator\/drafts\/([^/]+)\/publish$/);
 if(!publish||req.method!=='POST')return false;
 const before=new Set(lots.map(x=>x.id)),handled=await routeOperator(req,res,url,ctx);
 if(handled!==false){const created=lots.find(x=>!before.has(x.id));if(created)await notifyDiscoveryForObject(created.id).catch(e=>console.error('discovery publication hook',e));return handled}
 return false
}
