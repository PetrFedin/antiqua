import {send} from './runtime-v09.mjs';
import {provenanceEvidenceOverview,provenanceEvidencePassport,PROVENANCE_PASSPORT_VERSION} from './provenance-evidence-passport-v43.mjs';

export async function routeProvenancePassportPublicV43(req,res,url){
  if(req.method==='GET'&&url.pathname==='/api/provenance-evidence-overview'){
    const overview=await provenanceEvidenceOverview();
    return send(res,200,{overview,capabilities:{authenticityCertification:false,universalScore:false,evidenceClasses:true}});
  }
  const match=url.pathname.match(/^\/api\/lots\/([^/]+)\/provenance-passport$/);
  if(!match||req.method!=='GET')return false;
  const passport=await provenanceEvidencePassport(match[1],{publicOnly:true});
  if(!passport)return send(res,404,{error:'Object not found'});
  return send(res,200,{
    passport,
    capabilities:{
      schemaVersion:PROVENANCE_PASSPORT_VERSION,
      evidenceClasses:true,
      unresolvedEvidencePreserved:true,
      conflictsPreserved:true,
      authenticityCertification:false
    }
  });
}
