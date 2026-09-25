import {send,readBody,requireCsrf,audit} from './runtime-v09.mjs';
import {conditionReportCapabilities,createConditionReportRequest,getConditionReportRequest,listConditionReportRequests,publishConditionReportVersion,cancelConditionReportRequest,conditionReportRead} from './condition-report-v23.mjs';
import {viewingCapabilities,createViewingRequest,getViewingRequest,listViewingRequests,proposeViewingSlots,confirmViewingSlot,requestViewingReschedule,cancelViewingRequest,viewingCalendarIcs} from './viewing-v23.mjs';

export async function routeCommercialServicesV23(req,res,url,ctx){
 if(url.pathname==='/api/commercial-services/capabilities'&&req.method==='GET')return send(res,200,{conditionReports:conditionReportCapabilities(),viewings:viewingCapabilities()});
 if(!ctx)return false;const a=ctx.account;

 if(url.pathname==='/api/condition-report-requests'&&req.method==='GET')return send(res,200,{requests:await listConditionReportRequests(a)});
 let m=url.pathname.match(/^\/api\/listings\/([^/]+)\/condition-report-requests$/);
 if(m&&req.method==='POST'){
  requireCsrf(req,ctx);const result=await createConditionReportRequest(a,m[1],await readBody(req));
  await audit(req,a,result.idempotent?'CONDITION_REPORT_REQUEST_REPLAY':'CONDITION_REPORT_REQUESTED','CONDITION_REPORT_REQUEST',result.request.id,null,null,{listingId:result.request.listingId,objectId:result.request.objectId,version:result.request.version,reusedOpen:Boolean(result.reusedOpen)});
  return send(res,result.idempotent?200:201,result)
 }
 m=url.pathname.match(/^\/api\/condition-report-requests\/([^/]+)$/);
 if(m&&req.method==='GET'){const request=await getConditionReportRequest(a,m[1]);return request?send(res,200,{request}):send(res,404,{error:'Condition report request not found',code:'CONDITION_REQUEST_NOT_FOUND'})}
 m=url.pathname.match(/^\/api\/condition-report-requests\/([^/]+)\/versions$/);
 if(m&&req.method==='POST'){
  requireCsrf(req,ctx);const result=await publishConditionReportVersion(a,m[1],await readBody(req));
  await audit(req,a,result.idempotent?'CONDITION_REPORT_PUBLISH_REPLAY':'CONDITION_REPORT_PUBLISHED','CONDITION_REPORT_REQUEST',result.request.id,null,null,{objectId:result.request.objectId,requestVersion:result.request.version,reportVersion:result.version?.versionNo||result.request.currentReportVersion,mediaId:result.version?.mediaId||null});
  return send(res,result.idempotent?200:201,result)
 }
 m=url.pathname.match(/^\/api\/condition-report-requests\/([^/]+)\/cancel$/);
 if(m&&req.method==='POST'){
  requireCsrf(req,ctx);const result=await cancelConditionReportRequest(a,m[1],await readBody(req));
  await audit(req,a,result.idempotent?'CONDITION_REPORT_CANCEL_REPLAY':'CONDITION_REPORT_REQUEST_CANCELLED','CONDITION_REPORT_REQUEST',result.request.id,null,null,{objectId:result.request.objectId,version:result.request.version});
  return send(res,result.idempotent?200:201,result)
 }
 m=url.pathname.match(/^\/api\/condition-report-requests\/([^/]+)\/versions\/(\d+)\/read$/);
 if(m&&req.method==='GET')return send(res,200,await conditionReportRead(a,m[1],Number(m[2])));

 if(url.pathname==='/api/viewing-requests'&&req.method==='GET')return send(res,200,{requests:await listViewingRequests(a)});
 m=url.pathname.match(/^\/api\/listings\/([^/]+)\/viewing-requests$/);
 if(m&&req.method==='POST'){
  requireCsrf(req,ctx);const result=await createViewingRequest(a,m[1],await readBody(req));
  await audit(req,a,result.idempotent?'VIEWING_REQUEST_REPLAY':'VIEWING_REQUESTED','VIEWING_REQUEST',result.request.id,null,null,{listingId:result.request.listingId,objectId:result.request.objectId,version:result.request.version,reusedOpen:Boolean(result.reusedOpen)});
  return send(res,result.idempotent?200:201,result)
 }
 m=url.pathname.match(/^\/api\/viewing-requests\/([^/]+)$/);
 if(m&&req.method==='GET'){const request=await getViewingRequest(a,m[1]);return request?send(res,200,{request}):send(res,404,{error:'Viewing request not found',code:'VIEWING_REQUEST_NOT_FOUND'})}
 m=url.pathname.match(/^\/api\/viewing-requests\/([^/]+)\/slots$/);
 if(m&&req.method==='POST'){
  requireCsrf(req,ctx);const result=await proposeViewingSlots(a,m[1],await readBody(req));
  await audit(req,a,result.idempotent?'VIEWING_SLOTS_REPLAY':'VIEWING_SLOTS_PROPOSED','VIEWING_REQUEST',result.request.id,null,null,{objectId:result.request.objectId,version:result.request.version,proposalVersion:result.request.proposalVersion});
  return send(res,result.idempotent?200:201,result)
 }
 m=url.pathname.match(/^\/api\/viewing-requests\/([^/]+)\/confirm$/);
 if(m&&req.method==='POST'){
  requireCsrf(req,ctx);const result=await confirmViewingSlot(a,m[1],await readBody(req));
  await audit(req,a,result.idempotent?'VIEWING_CONFIRM_REPLAY':'VIEWING_CONFIRMED','VIEWING_REQUEST',result.request.id,null,null,{objectId:result.request.objectId,version:result.request.version,slotId:result.request.selectedSlotId,calendarSequence:result.request.calendarEvent?.sequence??null});
  return send(res,result.idempotent?200:201,result)
 }
 m=url.pathname.match(/^\/api\/viewing-requests\/([^/]+)\/reschedule$/);
 if(m&&req.method==='POST'){
  requireCsrf(req,ctx);const result=await requestViewingReschedule(a,m[1],await readBody(req));
  await audit(req,a,result.idempotent?'VIEWING_RESCHEDULE_REPLAY':'VIEWING_RESCHEDULE_REQUESTED','VIEWING_REQUEST',result.request.id,null,null,{objectId:result.request.objectId,version:result.request.version});
  return send(res,result.idempotent?200:201,result)
 }
 m=url.pathname.match(/^\/api\/viewing-requests\/([^/]+)\/cancel$/);
 if(m&&req.method==='POST'){
  requireCsrf(req,ctx);const result=await cancelViewingRequest(a,m[1],await readBody(req));
  await audit(req,a,result.idempotent?'VIEWING_CANCEL_REPLAY':'VIEWING_CANCELLED','VIEWING_REQUEST',result.request.id,null,null,{objectId:result.request.objectId,version:result.request.version,calendarSequence:result.request.calendarEvent?.sequence??null});
  return send(res,result.idempotent?200:201,result)
 }
 m=url.pathname.match(/^\/api\/viewing-requests\/([^/]+)\/calendar\.ics$/);
 if(m&&req.method==='GET'){
  const result=await viewingCalendarIcs(a,m[1]);
  res.writeHead(200,{'content-type':'text/calendar; charset=utf-8','cache-control':'no-store','content-disposition':`attachment; filename="antiqua-viewing-${m[1]}.ics"`,'x-content-type-options':'nosniff'});
  res.end(result.ics);return true
 }
 return false
}
