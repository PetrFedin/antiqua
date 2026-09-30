import {send,readBody} from './runtime-v09.mjs';
import {dealerPilotAuthorityCapabilities,createDealerPilot,listDealerPilots,dealerPilotDetail,freezeDealerPilot,activateDealerPilot,addPilotCheckpoint,addPilotEvidence,acknowledgeDealerPilot,finalDealerPilotPack} from './dealer-pilot-authority-v37.mjs';

export async function routeDealerPilotAuthorityPublicV37(req,res,url){
 if(url.pathname==='/api/dealer/pilots/capabilities'&&req.method==='GET')return send(res,200,{capabilities:dealerPilotAuthorityCapabilities()});
 return false
}
export async function routeDealerPilotAuthorityV37(req,res,url,ctx){
 if(!ctx)return false;
 if(url.pathname==='/api/dealer/pilots'&&req.method==='GET')return send(res,200,{pilots:await listDealerPilots(ctx.account)});
 if(url.pathname==='/api/dealer/pilots'&&req.method==='POST')return send(res,201,{pilot:await createDealerPilot(ctx.account,await readBody(req))});
 const m=url.pathname.match(/^\/api\/dealer\/pilots\/([^/]+)(?:\/(freeze|activate|checkpoint|evidence|acknowledge|final-pack))?$/);if(!m)return false;
 const id=decodeURIComponent(m[1]),action=m[2]||null;
 if(!action&&req.method==='GET'){const detail=await dealerPilotDetail(ctx.account,id);return detail?send(res,200,{detail}):send(res,404,{error:'Pilot not found',code:'PILOT_NOT_FOUND'})}
 if(req.method!=='POST')return false;const body=await readBody(req);
 if(action==='freeze')return send(res,200,{pilot:await freezeDealerPilot(ctx.account,id,body)});
 if(action==='activate')return send(res,200,{pilot:await activateDealerPilot(ctx.account,id,body)});
 if(action==='checkpoint')return send(res,201,{checkpoint:await addPilotCheckpoint(ctx.account,id,body)});
 if(action==='evidence')return send(res,201,{evidence:await addPilotEvidence(ctx.account,id,body)});
 if(action==='acknowledge')return send(res,201,{acknowledgement:await acknowledgeDealerPilot(ctx.account,id,body)});
 if(action==='final-pack')return send(res,200,{pack:await finalDealerPilotPack(ctx.account,id,body)});
 return false
}
