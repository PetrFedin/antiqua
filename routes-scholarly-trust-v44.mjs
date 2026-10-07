import {send,readBody,requireCsrf,audit,authContext,db} from './runtime-v09.mjs';
import {scholarlyTrustCapabilities,createScholarlyContribution,reviewScholarlyContribution,publicContributorTrust} from './scholarly-trust-v44.mjs';

export async function routeScholarlyTrustPublicV44(req,res,url){
  if(req.method==='GET'&&url.pathname==='/api/research/contributors/capabilities')return send(res,200,{capabilities:scholarlyTrustCapabilities()});
  const m=url.pathname.match(/^\/api\/research\/contributors\/([^/]+)$/);
  if(m&&req.method==='GET'){if(db.kind!=='POSTGRES')return send(res,503,{error:'PostgreSQL required',code:'POSTGRES_REQUIRED'});const trust=await publicContributorTrust(decodeURIComponent(m[1]));return trust?send(res,200,{trust}):send(res,404,{error:'Contributor not found',code:'SCHOLARLY_CONTRIBUTOR_NOT_FOUND'})}
  return false;
}
export async function routeScholarlyTrustV44(req,res,url,ctx=null){
  const auth=ctx||await authContext(req);if(!auth)return false;const a=auth.account;
  if(url.pathname==='/api/research/contributions'&&req.method==='POST'){requireCsrf(req,auth);if(db.kind!=='POSTGRES')return send(res,503,{error:'PostgreSQL required',code:'POSTGRES_REQUIRED'});const contribution=await createScholarlyContribution(a,await readBody(req));await audit(req,a,'SCHOLARLY_CONTRIBUTION_SUBMITTED','SCHOLARLY_CONTRIBUTION',contribution.id,null,{subjectType:contribution.subject_type,subjectId:contribution.subject_id,contributionType:contribution.contribution_type});return send(res,201,{contribution})}
  const m=url.pathname.match(/^\/api\/research\/contributions\/([^/]+)\/review$/);
  if(m&&req.method==='POST'){requireCsrf(req,auth);if(db.kind!=='POSTGRES')return send(res,503,{error:'PostgreSQL required',code:'POSTGRES_REQUIRED'});const body=await readBody(req),contribution=await reviewScholarlyContribution(a,decodeURIComponent(m[1]),body);await audit(req,a,'SCHOLARLY_CONTRIBUTION_REVIEWED','SCHOLARLY_CONTRIBUTION',contribution.id,null,{status:contribution.status});return send(res,200,{contribution})}
  return false;
}
