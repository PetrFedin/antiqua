import {send,readBody} from './runtime-v09.mjs';
import {pilotCounterpartyCapabilities,invitePilotCounterparty,counterpartyWorkspace,counterpartyReview,bilateralPilotStatus,verifyPilotEvidencePublic} from './pilot-counterparty-v38.mjs';
const bearer=req=>String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
export async function routePilotCounterpartyPublicV38(req,res,url){
 if(url.pathname==='/api/pilot/counterparty/capabilities'&&req.method==='GET')return send(res,200,{capabilities:pilotCounterpartyCapabilities()});
 if(url.pathname==='/api/pilot/counterparty/workspace'&&req.method==='GET')return send(res,200,{workspace:await counterpartyWorkspace(bearer(req)||url.searchParams.get('token'))});
 if(url.pathname==='/api/pilot/counterparty/review'&&req.method==='POST')return send(res,201,{review:await counterpartyReview(bearer(req),await readBody(req))});
 if(url.pathname==='/api/pilot/evidence/verify'&&req.method==='POST')return send(res,200,await verifyPilotEvidencePublic(await readBody(req)));
 return false
}
export async function routePilotCounterpartyV38(req,res,url,ctx){
 if(!ctx)return false;const invite=url.pathname.match(/^\/api\/dealer\/pilots\/([^/]+)\/counterparties$/),status=url.pathname.match(/^\/api\/dealer\/pilots\/([^/]+)\/bilateral-status$/);
 if(invite&&req.method==='POST')return send(res,201,await invitePilotCounterparty(ctx.account,decodeURIComponent(invite[1]),await readBody(req)));
 if(status&&req.method==='GET'){const x=await bilateralPilotStatus(ctx.account,decodeURIComponent(status[1]));return x?send(res,200,{status:x}):send(res,404,{error:'Pilot not found',code:'PILOT_NOT_FOUND'})}
 return false
}
