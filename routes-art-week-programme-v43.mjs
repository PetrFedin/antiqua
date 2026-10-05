import {send,readBody,requireCsrf,audit,authContext} from './runtime-v09.mjs';
import {programmeCapabilities,listPublicProgrammes,getPublicProgramme,createProgramme,updateProgramme,upsertProgrammeEntry,removeProgrammeEntry,submitProgramme,reviewProgramme,cancelProgramme,getMyProgramme,upsertProgrammeDayPlanItem,removeProgrammeDayPlanItem,publicProgrammeIcs,myProgrammeIcs} from './art-week-programme-v43.mjs';

const sendIcs=(res,body,filename)=>{res.writeHead(200,{'content-type':'text/calendar; charset=utf-8','content-disposition':`attachment; filename="${filename}"`,'cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'strict-origin-when-cross-origin'});res.end(body);return true};

export async function routeArtWeekProgrammePublicV43(req,res,url){
 if(url.pathname==='/api/programmes/capabilities'&&req.method==='GET')return send(res,200,{capabilities:programmeCapabilities()});
 if(url.pathname==='/api/programmes'&&req.method==='GET')return send(res,200,{programmes:await listPublicProgrammes(Object.fromEntries(url.searchParams.entries())),capabilities:programmeCapabilities()});
 let m=url.pathname.match(/^\/api\/programmes\/([^/]+)\/ics$/);if(m&&req.method==='GET'){const p=await getPublicProgramme(decodeURIComponent(m[1]));if(!p)return send(res,404,{error:'Programme not found',code:'PROGRAMME_NOT_FOUND'});return sendIcs(res,await publicProgrammeIcs(p.id),'antiqua-programme.ics')}
 m=url.pathname.match(/^\/api\/programmes\/([^/]+)$/);if(m&&req.method==='GET'){const p=await getPublicProgramme(decodeURIComponent(m[1]));return p?send(res,200,{programme:p}):send(res,404,{error:'Programme not found',code:'PROGRAMME_NOT_FOUND'})}
 return false
}

export async function routeArtWeekProgrammeV43(req,res,url,ctx=null){
 const auth=ctx||await authContext(req);if(!auth)return false;const a=auth.account;
 let m=url.pathname.match(/^\/api\/programmes\/([^/]+)\/mine\.ics$/);if(m&&req.method==='GET'){const body=await myProgrammeIcs(a,decodeURIComponent(m[1]));return body?sendIcs(res,body,'antiqua-my-day.ics'):send(res,404,{error:'Programme not found',code:'PROGRAMME_NOT_FOUND'})}
 m=url.pathname.match(/^\/api\/programmes\/([^/]+)\/mine$/);if(m&&req.method==='GET'){const mine=await getMyProgramme(a,decodeURIComponent(m[1]));return mine?send(res,200,mine):send(res,404,{error:'Programme not found',code:'PROGRAMME_NOT_FOUND'})}
 if(url.pathname==='/api/programmes'&&req.method==='POST'){requireCsrf(req,auth);const p=await createProgramme(a,await readBody(req));await audit(req,a,'CULTURAL_PROGRAMME_CREATED','CULTURAL_PROGRAMME',p.id,null,{programmeType:p.programmeType,status:p.status});return send(res,201,{programme:p})}
 m=url.pathname.match(/^\/api\/programmes\/([^/]+)$/);if(m&&req.method==='PATCH'){requireCsrf(req,auth);const p=await updateProgramme(a,decodeURIComponent(m[1]),await readBody(req));await audit(req,a,'CULTURAL_PROGRAMME_UPDATED','CULTURAL_PROGRAMME',p.id,null,{status:p.status});return send(res,200,{programme:p})}
 m=url.pathname.match(/^\/api\/programmes\/([^/]+)\/(submit|cancel)$/);if(m&&req.method==='POST'){requireCsrf(req,auth);const body=await readBody(req),p=m[2]==='submit'?await submitProgramme(a,decodeURIComponent(m[1])):await cancelProgramme(a,decodeURIComponent(m[1]),body);await audit(req,a,m[2]==='submit'?'CULTURAL_PROGRAMME_SUBMITTED':'CULTURAL_PROGRAMME_CANCELLED','CULTURAL_PROGRAMME',p.id,null,{status:p.status});return send(res,200,{programme:p})}
 m=url.pathname.match(/^\/api\/programmes\/review\/([^/]+)$/);if(m&&req.method==='POST'){requireCsrf(req,auth);const body=await readBody(req),p=await reviewProgramme(a,decodeURIComponent(m[1]),body);await audit(req,a,'CULTURAL_PROGRAMME_REVIEWED','CULTURAL_PROGRAMME',p.id,null,{decision:body.decision||'APPROVE',status:p.status});return send(res,200,{programme:p})}
 m=url.pathname.match(/^\/api\/programmes\/([^/]+)\/entries$/);if(m&&req.method==='PUT'){requireCsrf(req,auth);const p=await upsertProgrammeEntry(a,decodeURIComponent(m[1]),await readBody(req));await audit(req,a,'CULTURAL_PROGRAMME_ENTRY_UPSERTED','CULTURAL_PROGRAMME',p.id,null,{status:p.status});return send(res,200,{programme:p})}
 m=url.pathname.match(/^\/api\/programmes\/([^/]+)\/entries\/(EVENT|EXHIBITION)\/([^/]+)$/);if(m&&req.method==='DELETE'){requireCsrf(req,auth);const p=await removeProgrammeEntry(a,decodeURIComponent(m[1]),m[2],decodeURIComponent(m[3]));await audit(req,a,'CULTURAL_PROGRAMME_ENTRY_REMOVED','CULTURAL_PROGRAMME',p.id,null,{entityType:m[2],entityId:decodeURIComponent(m[3]),status:p.status});return send(res,200,{programme:p})}
 m=url.pathname.match(/^\/api\/programmes\/([^/]+)\/day-plan$/);if(m&&req.method==='PUT'){requireCsrf(req,auth);const mine=await upsertProgrammeDayPlanItem(a,decodeURIComponent(m[1]),await readBody(req));await audit(req,a,'CULTURAL_PROGRAMME_DAY_PLAN_UPDATED','CULTURAL_PROGRAMME',mine.programme.id,null,{privatePlan:true});return send(res,200,mine)}
 m=url.pathname.match(/^\/api\/programmes\/([^/]+)\/day-plan\/(EVENT|EXHIBITION)\/([^/]+)$/);if(m&&req.method==='DELETE'){requireCsrf(req,auth);const mine=await removeProgrammeDayPlanItem(a,decodeURIComponent(m[1]),m[2],decodeURIComponent(m[3]));await audit(req,a,'CULTURAL_PROGRAMME_DAY_PLAN_REMOVED','CULTURAL_PROGRAMME',mine.programme.id,null,{privatePlan:true});return send(res,200,mine)}
 return false
}
