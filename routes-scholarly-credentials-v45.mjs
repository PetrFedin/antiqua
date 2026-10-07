import {send,readBody,requireCsrf,audit,authContext,db} from './runtime-v09.mjs';
import {scholarlyCredentialCapabilities,issueScholarlyCredential,revokeScholarlyCredential,publicCredentialsForSubject} from './scholarly-credentials-v45.mjs';

export async function routeScholarlyCredentialsPublicV45(req,res,url){
  if(req.method==='GET'&&url.pathname==='/api/research/credentials/capabilities')return send(res,200,{capabilities:scholarlyCredentialCapabilities()});
  if(req.method==='GET'&&url.pathname==='/api/research/credentials'){
    if(db.kind!=='POSTGRES')return send(res,503,{error:'PostgreSQL required',code:'POSTGRES_REQUIRED'});
    return send(res,200,{credentials:await publicCredentialsForSubject({accountId:url.searchParams.get('accountId'),organizationId:url.searchParams.get('organizationId')})});
  }
  return false;
}
export async function routeScholarlyCredentialsV45(req,res,url,ctx=null){
  const auth=ctx||await authContext(req);if(!auth)return false;const a=auth.account;
  if(url.pathname==='/api/research/credentials'&&req.method==='POST'){
    requireCsrf(req,auth);if(db.kind!=='POSTGRES')return send(res,503,{error:'PostgreSQL required',code:'POSTGRES_REQUIRED'});
    const credential=await issueScholarlyCredential(a,await readBody(req));
    await audit(req,a,'SCHOLARLY_CREDENTIAL_ISSUED','SCHOLARLY_CREDENTIAL',credential.id,null,{credentialType:credential.credentialType,projectRef:credential.projectRef});
    return send(res,201,{credential});
  }
  const m=url.pathname.match(/^\/api\/research\/credentials\/([^/]+)\/revoke$/);
  if(m&&req.method==='POST'){
    requireCsrf(req,auth);const credential=await revokeScholarlyCredential(a,decodeURIComponent(m[1]),await readBody(req));
    await audit(req,a,'SCHOLARLY_CREDENTIAL_REVOKED','SCHOLARLY_CREDENTIAL',credential.id,null,{status:credential.status});
    return send(res,200,{credential});
  }
  return false;
}
