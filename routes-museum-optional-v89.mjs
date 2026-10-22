// ANTIQUA v89 — safe read-only same-origin museum metadata endpoint.
// No query-driven proxying. Returns ONLY the curated, source-field-filtered
// Art Institute of Chicago OPTIONAL paintings (never sale inventory).
import {send} from './runtime-v09.mjs';
import {fetchMuseumOptionalV89} from './museum-optional-v89.mjs';

const blocked=Object.freeze({
 status:'UNAVAILABLE',data:[],source:'ART_INSTITUTE_OF_CHICAGO',
 sourceFieldsValidated:false
});
let cache=null,expiresAt=0,inflight=null;
const allowedToFetch=env=>!((env.PREVIEW_MODE==='true'||env.NODE_ENV==='test')&&
 env.ANTIQUA_MUSEUM_OPTIONAL_NETWORK!=='true');

export async function museumMetadataSnapshotV89({
 env=process.env,loader=fetchMuseumOptionalV89,clock=()=>Date.now()
}={}){
 // Integration preview CI cannot be held hostage by a third-party API.
 if(!allowedToFetch(env))return blocked;
 const now=clock();
 if(cache&&expiresAt>now)return cache;
 if(inflight)return inflight;
 inflight=(async()=>{
  let snapshot;
  try{snapshot=await loader()}catch{snapshot=blocked}
  // Never treat an error, missing data or spoofed response as validated.
  if(snapshot?.status!=='SOURCE_FIELDS_FILTERED'||
     snapshot?.sourceFieldsValidated!==true||
     snapshot?.source!=='ART_INSTITUTE_OF_CHICAGO'||
     !Array.isArray(snapshot?.data)){
   snapshot=blocked;
  }
  cache=snapshot;
  expiresAt=clock()+(snapshot===blocked?30_000:600_000);
  return snapshot;
 })().finally(()=>{inflight=null});
 return inflight;
}

export async function routeMuseumOptionalPublicV89(req,res,url,options){
 if(url.pathname!=='/api/museum/optional')return false;
 if(req.method!=='GET')
  return send(res,405,{error:'Method not allowed',code:'METHOD_NOT_ALLOWED'},{allow:'GET'});
 // Reject parameters instead of accidentally turning this into an SSRF proxy
 // or a query-driven artwork identity oracle.
 if(url.search!=='')return send(res,400,{error:'Unsupported museum parameters',code:'UNSUPPORTED_PARAMETERS'});
 const source=await museumMetadataSnapshotV89(options);
 return send(res,200,source,{'x-robots-tag':'noindex'});
}
