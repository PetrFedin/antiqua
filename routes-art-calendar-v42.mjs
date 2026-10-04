import {send,readBody,requireCsrf,audit,authContext} from './runtime-v09.mjs';
import {artCalendarCapabilities,listArtCalendar,getPublicArtEvent,getMyArtCalendar,createArtEvent,updateArtEvent,submitArtEvent,reviewArtEvent,cancelArtEvent,setCalendarParticipation,calendarItemToIcs} from './art-calendar-v42.mjs';

const originFor=req=>`${String(req.headers['x-forwarded-proto']||'https').split(',')[0]}://${req.headers.host||'antiqua-preview.onrender.com'}`;

export async function routeArtCalendarPublicV42(req,res,url){
 if(url.pathname==='/api/calendar/capabilities'&&req.method==='GET')return send(res,200,{capabilities:artCalendarCapabilities()});
 if(url.pathname==='/api/calendar'&&req.method==='GET')return send(res,200,await listArtCalendar());
 let m=url.pathname.match(/^\/api\/calendar\/events\/([^/.]+)$/);
 if(m&&req.method==='GET'){const e=await getPublicArtEvent(decodeURIComponent(m[1]));return e?send(res,200,{event:e}):send(res,404,{error:'Event not found',code:'CALENDAR_EVENT_NOT_FOUND'})}
 m=url.pathname.match(/^\/api\/calendar\/(events|exhibitions)\/([^/]+)\.ics$/);
 if(m&&req.method==='GET'){
  const sourceType=m[1]==='events'?'EVENT':'EXHIBITION',id=decodeURIComponent(m[2]),calendar=await listArtCalendar(),item=calendar.items.find(x=>x.sourceType===sourceType&&x.id===id);
  if(!item)return send(res,404,{error:'Calendar item not found',code:'CALENDAR_ITEM_NOT_FOUND'});
  const ics=calendarItemToIcs(item,originFor(req));res.writeHead(200,{'content-type':'text/calendar; charset=utf-8','content-disposition':`inline; filename="antiqua-${sourceType.toLowerCase()}-${id.replace(/[^a-zA-Z0-9_-]/g,'-')}.ics"`,'cache-control':'public, max-age=300','x-content-type-options':'nosniff'});res.end(ics);return true
 }
 return false
}

export async function routeArtCalendarV42(req,res,url,ctx=null){
 const auth=ctx||await authContext(req);if(!auth)return false;const a=auth.account;
 if(url.pathname==='/api/calendar/me'&&req.method==='GET')return send(res,200,await getMyArtCalendar(a));
 if(url.pathname==='/api/calendar/events'&&req.method==='POST'){requireCsrf(req,auth);const event=await createArtEvent(a,await readBody(req));await audit(req,a,'ART_EVENT_CREATED','ART_EVENT',event.id,null,{eventType:event.eventType,visibility:event.visibility,startsAt:event.startsAt});return send(res,201,{event})}
 let m=url.pathname.match(/^\/api\/calendar\/events\/([^/]+)$/);
 if(m&&req.method==='PATCH'){requireCsrf(req,auth);const id=decodeURIComponent(m[1]),before=await getPublicArtEvent(id),event=await updateArtEvent(a,id,await readBody(req));await audit(req,a,'ART_EVENT_UPDATED','ART_EVENT',id,before,{status:event.status,visibility:event.visibility,startsAt:event.startsAt});return send(res,200,{event})}
 m=url.pathname.match(/^\/api\/calendar\/events\/([^/]+)\/(submit|cancel)$/);
 if(m&&req.method==='POST'){requireCsrf(req,auth);const id=decodeURIComponent(m[1]),action=m[2],event=action==='submit'?await submitArtEvent(a,id):await cancelArtEvent(a,id);await audit(req,a,action==='submit'?'ART_EVENT_SUBMITTED':'ART_EVENT_CANCELLED','ART_EVENT',id,null,{status:event.status});return send(res,200,{event})}
 m=url.pathname.match(/^\/api\/calendar\/(events|exhibitions)\/([^/]+)\/participation$/);
 if(m&&req.method==='POST'){requireCsrf(req,auth);const sourceType=m[1]==='events'?'EVENT':'EXHIBITION',id=decodeURIComponent(m[2]),result=await setCalendarParticipation(a,sourceType,id,await readBody(req));await audit(req,a,'ART_CALENDAR_PARTICIPATION_UPDATED','ART_CALENDAR_ITEM',sourceType+':'+id,null,{state:result.participation.state,sourceType});return send(res,200,result)}
 m=url.pathname.match(/^\/api\/calendar\/review\/events\/([^/]+)$/);
 if(m&&req.method==='POST'){requireCsrf(req,auth);const id=decodeURIComponent(m[1]),body=await readBody(req),event=await reviewArtEvent(a,id,body);await audit(req,a,'ART_EVENT_REVIEWED','ART_EVENT',id,null,{decision:body.decision||'APPROVE',status:event.status});return send(res,200,{event})}
 return false
}
