import {send,readBody,requireCsrf,audit} from './runtime-v09.mjs';
import {listOrganizationsForAccount,getOrganizationForMember,updateOrganization,listOrganizationMembers,addOrganizationMember,organizationCapabilities} from './organizations-v15.mjs';

export async function routeOrganizationsV15(req,res,url,ctx){
  if(!ctx)return false;const a=ctx.account;
  if(url.pathname==='/api/organizations/capabilities'&&req.method==='GET')return send(res,200,{capabilities:organizationCapabilities()});
  if(url.pathname==='/api/organizations/me'&&req.method==='GET')return send(res,200,{memberships:await listOrganizationsForAccount(a)});
  const m=url.pathname.match(/^\/api\/organizations\/([^/]+)(?:\/(members))?$/);if(!m)return false;
  const organizationId=m[1],sub=m[2]||null;
  if(!sub&&req.method==='GET'){const x=await getOrganizationForMember(a.id,organizationId);return send(res,200,x)}
  if(!sub&&req.method==='PATCH'){requireCsrf(req,ctx);const before=await getOrganizationForMember(a.id,organizationId),updated=await updateOrganization(a.id,organizationId,await readBody(req));await audit(req,a,'ORGANIZATION_UPDATED','ORGANIZATION',organizationId,before.organization,updated.organization);return send(res,200,updated)}
  if(sub==='members'&&req.method==='GET')return send(res,200,{members:await listOrganizationMembers(a.id,organizationId)});
  if(sub==='members'&&req.method==='POST'){requireCsrf(req,ctx);const member=await addOrganizationMember(a.id,organizationId,await readBody(req));await audit(req,a,'ORGANIZATION_MEMBER_UPSERTED','ORGANIZATION',organizationId,null,{memberAccountId:member.accountId,role:member.role});return send(res,200,{member})}
  return false;
}
