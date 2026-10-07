import {send} from './runtime-v09.mjs';
import {buildSyntheticReferenceCatalogue,SYNTHETIC_REFERENCE_CATALOGUE_VERSION} from './synthetic-reference-catalogue-v48.mjs';

export async function routeSyntheticReferenceCataloguePublicV48(req,res,url){
  if(url.pathname==='/api/research/reference-catalogue/capabilities'&&req.method==='GET')return send(res,200,{capabilities:{
    catalogueVersion:SYNTHETIC_REFERENCE_CATALOGUE_VERSION,
    syntheticOnly:true,
    publicDomainData:true,
    intentionalConflict:true,
    intentionalEvidenceGap:true,
    endToEndPassportVerificationInterchange:true
  }});
  if(url.pathname==='/api/research/reference-catalogue'&&req.method==='GET')return send(res,200,{catalogue:buildSyntheticReferenceCatalogue()});
  return false;
}
