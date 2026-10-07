import {send,db} from './runtime-v09.mjs';
import {independentPassportVerification} from './independent-passport-verification-v46.mjs';

export async function routeIndependentPassportVerificationPublicV46(req,res,url){
  const m=url.pathname.match(/^\/api\/verify\/provenance-passport\/([^/]+)$/);
  if(!m||req.method!=='GET')return false;
  if(db.kind!=='POSTGRES')return send(res,503,{error:'PostgreSQL required',code:'POSTGRES_REQUIRED'});
  const verification=await independentPassportVerification(decodeURIComponent(m[1]),{
    requestedHash:url.searchParams.get('hash'),
    revisionId:url.searchParams.get('revisionId')
  });
  if(!verification)return send(res,404,{error:'Public provenance passport not found',code:'PROVENANCE_VERIFICATION_NOT_FOUND'});
  return send(res,200,{verification,capabilities:{
    independentHashVerification:true,
    supersessionDetection:true,
    publicEvidenceReferences:true,
    scholarlyContributionContext:true,
    scopedCredentialContext:true,
    privateOwnerDealerData:false,
    authenticityCertification:false
  }});
}
