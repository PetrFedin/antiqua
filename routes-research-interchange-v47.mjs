import {send,db} from './runtime-v09.mjs';
import {researchInterchangeProfile,ANTIQUA_RESEARCH_INTERCHANGE_PROFILE} from './research-interchange-profile-v47.mjs';

export async function routeResearchInterchangePublicV47(req,res,url){
  if(url.pathname==='/api/research/interchange/capabilities'&&req.method==='GET')return send(res,200,{capabilities:{
    profileVersion:ANTIQUA_RESEARCH_INTERCHANGE_PROFILE,
    uncertaintyPreserved:true,
    conflictsPreserved:true,
    rightsSeparated:true,
    privateOwnerDealerData:false
  }});
  const m=url.pathname.match(/^\/api\/research\/interchange\/objects\/([^/]+)$/);
  if(!m||req.method!=='GET')return false;
  if(db.kind!=='POSTGRES')return send(res,503,{error:'PostgreSQL required',code:'POSTGRES_REQUIRED'});
  const profile=await researchInterchangeProfile(decodeURIComponent(m[1]));
  if(!profile)return send(res,404,{error:'Public research object not found',code:'INTERCHANGE_OBJECT_NOT_FOUND'});
  return send(res,200,{profile});
}
