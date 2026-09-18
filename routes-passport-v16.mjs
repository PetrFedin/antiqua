import {db,send,readBody,requireCsrf,requirePermission,audit,lot} from './runtime-v09.mjs';
import {passportRevisionHistory,reviseObjectPassport,passportRevisionCapabilities} from './passport-revisions-v16.mjs';

const canRead=a=>Boolean(a?.roles?.some(r=>['ADMIN','CATALOGUER','TRUST_REVIEWER'].includes(r)));

export async function routePassportPublicV16(req,res,url){
  const m=url.pathname.match(/^\/api\/lots\/([^/]+)\/passport\/revisions$/);
  if(!m||req.method!=='GET')return false;
  const raw=lot(m[1]);if(!raw||raw.publicationStatus==='PRIVATE')return send(res,404,{error:'Object not found'});
  const history=await passportRevisionHistory(m[1],{includePrivate:false,limit:Number(url.searchParams.get('limit')||50)});
  if(!history)return send(res,404,{error:'Object not found'});
  return send(res,200,{history,capabilities:{hashChain:'SHA256',appendOnly:true,publicEvidenceSanitized:true}});
}

export async function routePassportV16(req,res,url,ctx){
  if(!ctx)return false;const a=ctx.account;
  if(url.pathname==='/api/operator/passport-revision-capabilities'&&req.method==='GET'){
    if(!canRead(a))return send(res,403,{error:'Operator permission required',code:'FORBIDDEN'});
    return send(res,200,{capabilities:passportRevisionCapabilities()});
  }
  const m=url.pathname.match(/^\/api\/operator\/lots\/([^/]+)\/passport\/revisions$/);if(!m)return false;
  if(!canRead(a))return send(res,403,{error:'Operator permission required',code:'FORBIDDEN'});
  if(req.method==='GET'){
    const history=await passportRevisionHistory(m[1],{includePrivate:true,limit:Number(url.searchParams.get('limit')||100)});
    return history?send(res,200,{history}):send(res,404,{error:'Object not found'});
  }
  if(req.method==='POST'){
    requireCsrf(req,ctx);requirePermission(a,'catalogue.review');
    const sourceKey=String(req.headers['idempotency-key']||'').trim();if(!sourceKey)return send(res,400,{error:'Idempotency-Key required',code:'IDEMPOTENCY_KEY_REQUIRED'});
    const body=await readBody(req),before=db.kind==='POSTGRES'?(await db.pool.query('SELECT passport FROM objects WHERE id=$1',[m[1]])).rows[0]?.passport:lot(m[1]);
    if(!before)return send(res,404,{error:'Object not found'});
    const result=await reviseObjectPassport(a,m[1],{patch:body.patch||{},changeKind:body.changeKind||null,reason:body.reason||'',publicSummary:body.publicSummary||{},evidence:body.evidence||[],sourceKey});
    await audit(req,a,'PASSPORT_REVISION_CREATED','OBJECT',m[1],{passportHash:before.passportHash||null},{passportHash:result.passport.passportHash,revisionNo:result.revision.revisionNo},{revisionId:result.revision.id,changeKind:result.revision.changeKind,idempotent:result.idempotent,evidenceCount:result.revision.evidence?.length||0});
    return send(res,result.idempotent?200:201,result);
  }
  return false;
}
