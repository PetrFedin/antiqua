import {send,readBody} from './runtime-v09.mjs';
import {commercialEvidenceCapabilities,recordCommercialEvent,sellerCommercialSummary,operatorCommercialSummary,investorCommercialAggregate} from './commercial-evidence-v46.mjs';

export async function routeCommercialEvidencePublicV46(req,res,url){
 if(url.pathname==='/api/commercial-evidence/capabilities'&&req.method==='GET')return send(res,200,{capabilities:commercialEvidenceCapabilities()});
 return false
}

export async function routeCommercialEvidenceV46(req,res,url,ctx){
 if(!ctx)return false;
 const seller=url.pathname.match(/^\/api\/dealer\/pilots\/([^/]+)\/commercial-evidence$/);
 if(seller&&req.method==='GET'){
  const x=await sellerCommercialSummary(ctx.account,decodeURIComponent(seller[1]));
  return x?send(res,200,{commercial:x}):send(res,404,{error:'Pilot not found',code:'PILOT_NOT_FOUND'})
 }
 const operator=url.pathname.match(/^\/api\/operator\/pilots\/([^/]+)\/commercial-evidence(?:\/(events))?$/);
 if(operator){
  const id=decodeURIComponent(operator[1]);
  if(operator[2]==='events'&&req.method==='POST')return send(res,201,{event:await recordCommercialEvent(ctx.account,id,await readBody(req))});
  if(!operator[2]&&req.method==='GET'){
   const x=await operatorCommercialSummary(ctx.account,id);
   return x?send(res,200,{commercial:x}):send(res,404,{error:'Pilot not found',code:'PILOT_NOT_FOUND'})
  }
 }
 if(url.pathname==='/api/operator/investor-commercial-aggregate'&&req.method==='GET')return send(res,200,{commercial:await investorCommercialAggregate(ctx.account)});
 return false
}
