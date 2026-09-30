import {send,readBody} from './runtime-v09.mjs';import {pilotLaunchCapabilities,launchReadiness,recordInvitationDelivery,configureWeeklyCadence,launchPilot,pilotOperatingBoard} from './pilot-launch-v40.mjs';
export async function routePilotLaunchPublicV40(req,res,url){if(url.pathname==='/api/pilot/launch/capabilities'&&req.method==='GET')return send(res,200,{capabilities:pilotLaunchCapabilities()});return false}
export async function routePilotLaunchV40(req,res,url,ctx){if(!ctx)return false;const m=url.pathname.match(/^\/api\/dealer\/pilots\/([^/]+)\/(launch-readiness|invitation-delivery|weekly-cadence|launch|operating-board)$/);if(!m)return false;const id=decodeURIComponent(m[1]),a=m[2];
 if(a==='launch-readiness'&&req.method==='GET')return send(res,200,{readiness:await launchReadiness(ctx.account,id)});
 if(a==='operating-board'&&req.method==='GET')return send(res,200,{board:await pilotOperatingBoard(ctx.account,id)});
 if(a==='invitation-delivery'&&req.method==='POST')return send(res,201,{delivery:await recordInvitationDelivery(ctx.account,id,await readBody(req))});
 if(a==='weekly-cadence'&&req.method==='POST')return send(res,200,{cadence:await configureWeeklyCadence(ctx.account,id,await readBody(req))});
 if(a==='launch'&&req.method==='POST')return send(res,200,{operation:await launchPilot(ctx.account,id)});return false}