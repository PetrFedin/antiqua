import {send} from './runtime-v09.mjs';
import {artworkResearchDossier,artworkDossierCapabilities} from './artwork-dossier-v51.mjs';

export async function routeArtworkDossierPublicV51(req,res,url){
  const m=url.pathname.match(/^\/api\/lots\/([^/]+)\/dossier$/);
  if(!m||req.method!=='GET')return false;
  const dossier=await artworkResearchDossier(decodeURIComponent(m[1]));
  if(!dossier)return send(res,404,{error:'Artwork not found',code:'ARTWORK_NOT_FOUND'});
  return send(res,200,{dossier,capabilities:artworkDossierCapabilities()});
}
