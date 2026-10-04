import {send,readBody,requireCsrf,audit,authContext} from './runtime-v09.mjs';
import {culturalCalendarCapabilities,listPublicCalendar,getPublicCulturalEvent,createCulturalEvent,updateCulturalEvent,submitCulturalEvent,reviewCulturalEvent,cancelCulturalEvent,setCalendarParticipation,getMyCulturalCalendar,myCalendarIcs,entriesToIcs,createCalendarExhibition,submitCalendarExhibition,reviewCalendarExhibition} from './cultural-calendar-v42.mjs';

export async function routeCulturalCalendarPublicV42(req,res,url){
 if(url.pathname==='/api/calendar/capabilities'&&req.method==='GET')return send(res,200,{capabilities:culturalCalendarCapabilities()});
 if(url.pathname==='/api/calendar'&&req.method==='GET'){const filters=Object.fromEntries(url.searchParams.entries());return send(res,200,await listPublicCalendar(filters))}
 let m=url.pathname.match(/^\/api\/calendar\/events\/([^/]+)\/ics$/);if(m&&req.method==='GET'){const e=await getPublicCulturalEvent(decodeURIComponent(m[1]));if(!e)return send(res,404,{error:'Event not found',code:'CALENDAR_EVENT_NOT_FOUND'});return send(res,200,entriesToIcs([e],{name:e.title?.en||e.title?.ru||'ANTIQUA Event'}),{'content-type':'text/calendar; charset=utf-8','content-disposition':'attachment; filename="antiqua-event.ics"'})}
 m=url.pathname.match(/^\/api\/calendar\/events\/([^/]+)$/);if(m&&req.method==='GET'){const e=await getPublicCulturalEvent(decodeURIComponent(m[1]));return e?send(res,200,{event:e}):send(res,404,{error:'Event not found',code:'CALENDAR_EVENT_NOT_FOUND'})}
 return false
}

export async function routeCulturalCalendarV42(req,res,url,ctx=null){
 const auth=ctx||await authContext(req);if(!auth)return false;const a=auth.account;
 if(url.pathname==='/api/calendar/mine'&&req.method==='GET')return send(res,200,await getMyCulturalCalendar(a));
 if(url.pathname==='/api/calendar/mine.ics'&&req.method==='GET')return send(res,200,await myCalendarIcs(a),{'content-type':'text/calendar; charset=utf-8','content-disposition':'attachment; filename="antiqua-my-art-plan.ics"'});
 if(url.pathname==='/api/calendar/participation'&&req.method==='POST'){requireCsrf(req,auth);const body=await readBody(req),p=await setCalendarParticipation(a,body);await audit(req,a,'CULTURAL_CALENDAR_PARTICIPATION_UPDATED','CULTURAL_'+p.entityType,p.entityId,null,{state:p.state});return send(res,200,{participation:p})}
 if(url.pathname==='/api/calendar/events'&&req.method==='POST'){requireCsrf(req,auth);const e=await createCulturalEvent(a,await readBody(req));await audit(req,a,'CULTURAL_EVENT_CREATED','CULTURAL_EVENT',e.id,null,{eventType:e.eventType,status:e.status});return send(res,201,{event:e})}
 let m=url.pathname.match(/^\/api\/calendar\/events\/([^/]+)(?:\/(submit|cancel))?$/);
 if(m&&req.method==='PATCH'&&!m[2]){requireCsrf(req,auth);const e=await updateCulturalEvent(a,decodeURIComponent(m[1]),await readBody(req));await audit(req,a,'CULTURAL_EVENT_UPDATED','CULTURAL_EVENT',e.id,null,{status:e.status});return send(res,200,{event:e})}
 if(m&&req.method==='POST'&&m[2]==='submit'){requireCsrf(req,auth);const e=await submitCulturalEvent(a,decodeURIComponent(m[1]));await audit(req,a,'CULTURAL_EVENT_SUBMITTED','CULTURAL_EVENT',e.id,null,{status:e.status});return send(res,200,{event:e})}
 if(m&&req.method==='POST'&&m[2]==='cancel'){requireCsrf(req,auth);const e=await cancelCulturalEvent(a,decodeURIComponent(m[1]),await readBody(req));await audit(req,a,'CULTURAL_EVENT_CANCELLED','CULTURAL_EVENT',e.id,null,{status:e.status});return send(res,200,{event:e})}
 m=url.pathname.match(/^\/api\/calendar\/review\/events\/([^/]+)$/);if(m&&req.method==='POST'){requireCsrf(req,auth);const body=await readBody(req),e=await reviewCulturalEvent(a,decodeURIComponent(m[1]),body);await audit(req,a,'CULTURAL_EVENT_REVIEWED','CULTURAL_EVENT',e.id,null,{decision:body.decision||'APPROVE',status:e.status});return send(res,200,{event:e})}
 if(url.pathname==='/api/calendar/exhibitions'&&req.method==='POST'){requireCsrf(req,auth);const e=await createCalendarExhibition(a,await readBody(req));await audit(req,a,'CALENDAR_EXHIBITION_CREATED','EXHIBITION',e.id,null,{publicationStatus:e.publicationStatus||'DRAFT'});return send(res,201,{exhibition:e})}
 m=url.pathname.match(/^\/api\/calendar\/exhibitions\/([^/]+)\/submit$/);if(m&&req.method==='POST'){requireCsrf(req,auth);const e=await submitCalendarExhibition(a,decodeURIComponent(m[1]));await audit(req,a,'CALENDAR_EXHIBITION_SUBMITTED','EXHIBITION',e.id,null,{publicationStatus:e.publicationStatus});return send(res,200,{exhibition:e})}
 m=url.pathname.match(/^\/api\/calendar\/review\/exhibitions\/([^/]+)$/);if(m&&req.method==='POST'){requireCsrf(req,auth);const body=await readBody(req),e=await reviewCalendarExhibition(a,decodeURIComponent(m[1]),body);await audit(req,a,'CALENDAR_EXHIBITION_REVIEWED','EXHIBITION',e.id,null,{decision:body.decision||'APPROVE',publicationStatus:e.publicationStatus});return send(res,200,{exhibition:e})}
 return false
}
