import {send,readBody} from './runtime-v09.mjs';
import {pilotGovernanceCapabilities,schemaProof,configureGovernance,revokeCounterparty,rotateCounterpartyAccess,resolveObjection,supersedeCheckpoint,governanceStatus,issueBilateralCertificate,publicReceipt} from './pilot-governance-v39.mjs';
export async function routePilotGovernancePublicV39(req,res,url){
 if(url.pathname==='/api/pilot/governance/capabilities'&&req.method==='GET')return send(res,200,{capabilities:pilotGovernanceCapabilities(),schema:await schemaProof()});
 const m=url.pathname.match(/^\/api\/pilot\/verify\/([a-f0-9]+)$/);if(m&&req.method==='GET'){const receipt=await publicReceipt(m[1]);return receipt?send(res,200,{receipt}):send(res,404,{error:'Verification receipt not found',code:'RECEIPT_NOT_FOUND'})}
 return false
}
export async function routePilotGovernanceV39(req,res,url,ctx){
 if(!ctx)return false;const m=url.pathname.match(/^\/api\/dealer\/pilots\/([^/]+)\/(governance|counterparties\/([^/]+)\/(revoke|rotate)|objections\/resolve|checkpoints\/supersede|certificate)$/);if(!m)return false;
 const id=decodeURIComponent(m[1]),action=m[2];if(action==='governance'&&req.method==='GET')return send(res,200,{status:await governanceStatus(ctx.account,id)});
 if(action==='governance'&&req.method==='POST')return send(res,200,{governance:await configureGovernance(ctx.account,id,await readBody(req))});
 if(m[3]&&m[4]==='revoke'&&req.method==='POST')return send(res,200,{counterparty:await revokeCounterparty(ctx.account,id,decodeURIComponent(m[3]),await readBody(req))});
 if(m[3]&&m[4]==='rotate'&&req.method==='POST')return send(res,200,await rotateCounterpartyAccess(ctx.account,id,decodeURIComponent(m[3]),await readBody(req)));
 if(action==='objections/resolve'&&req.method==='POST')return send(res,201,{resolution:await resolveObjection(ctx.account,id,await readBody(req))});
 if(action==='checkpoints/supersede'&&req.method==='POST')return send(res,201,{supersession:await supersedeCheckpoint(ctx.account,id,await readBody(req))});
 if(action==='certificate'&&req.method==='POST')return send(res,201,await issueBilateralCertificate(ctx.account,id));
 return false
}
