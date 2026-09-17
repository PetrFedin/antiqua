import {db,send,readBody,requireCsrf,requirePermission,audit,draftChecklist} from './runtime-v09.mjs';
import {editDraftPublication,submitDraftPublication,requestPublicationChanges,approvePublication,publishPublication,publicationLifecycleCapabilities} from './publication-lifecycle-v16.mjs';

const sourceKey=(req,body={})=>String(req.headers['idempotency-key']||body.sourceKey||'')||null;

export async function routePublicationV16(req,res,url,ctx){
 if(!ctx)return false;const a=ctx.account;
 if(url.pathname==='/api/e2e/publication-lifecycle-capabilities'&&req.method==='GET')return send(res,200,{capabilities:publicationLifecycleCapabilities()});
 const seller=url.pathname.match(/^\/api\/seller\/drafts\/([^/]+)(?:\/(submit))?$/);if(seller){
  if(req.method==='PATCH'&&!seller[2]){requireCsrf(req,ctx);requirePermission(a,'seller.draft.manage');const body=await readBody(req),x=await editDraftPublication(a,seller[1],body,{sourceKey:sourceKey(req,body)});if(x.lifecycle)await audit(req,a,x.lifecycle.auditAction,'DRAFT',seller[1],null,{status:x.draft.status},{lifecycle:x.lifecycle,idempotentTransition:x.idempotentTransition});return send(res,200,{draft:{...x.draft,checklist:draftChecklist(x.draft)},idempotent:x.idempotentTransition})}
  if(req.method==='POST'&&seller[2]==='submit'){requireCsrf(req,ctx);requirePermission(a,'seller.draft.manage');const body=await readBody(req),x=await submitDraftPublication(a,seller[1],{sourceKey:sourceKey(req,body)});await audit(req,a,x.lifecycle.auditAction,'DRAFT',seller[1],null,{status:x.draft.status},{lifecycle:x.lifecycle,idempotentTransition:x.idempotentTransition});return send(res,200,{draft:{...x.draft,checklist:x.checklist},idempotent:x.idempotentTransition})}
 }
 const op=url.pathname.match(/^\/api\/operator\/drafts\/([^/]+)\/(request-changes|approve|publish)$/);if(op&&req.method==='POST'){
  requireCsrf(req,ctx);const body=await readBody(req),action=op[2],key=sourceKey(req,body);if(action==='request-changes'){requirePermission(a,'catalogue.review');const x=await requestPublicationChanges(a,op[1],{note:String(body.note||'Changes requested'),sourceKey:key});await audit(req,a,x.lifecycle.auditAction,'DRAFT',op[1],null,{status:x.draft.status},{lifecycle:x.lifecycle,idempotentTransition:x.idempotentTransition});return send(res,200,{draft:{...x.draft,checklist:x.checklist},review:x.review,idempotent:x.idempotentTransition})}
  if(action==='approve'){requirePermission(a,'catalogue.review');const x=await approvePublication(a,op[1],{sourceKey:key});await audit(req,a,x.lifecycle.auditAction,'DRAFT',op[1],null,{status:x.draft.status},{lifecycle:x.lifecycle,idempotentTransition:x.idempotentTransition});return send(res,200,{draft:{...x.draft,checklist:x.checklist},review:x.review,idempotent:x.idempotentTransition})}
  if(action==='publish'){
   if(db.kind!=='POSTGRES')return false;requirePermission(a,'catalogue.review');requirePermission(a,'trust.review');const x=await publishPublication(a,op[1],{sourceKey:key});await audit(req,a,x.lifecycle.auditAction,'DRAFT',op[1],null,{status:x.draft.status,objectId:x.object?.id||null,listingId:x.listing?.id||null,auctionId:x.auction?.id||null},{lifecycle:x.lifecycle,idempotentTransition:x.idempotentTransition});return send(res,200,{draft:{...x.draft,checklist:draftChecklist(x.draft)},review:x.review,object:x.object,listing:x.listing,auction:x.auction,idempotent:x.idempotentTransition})
  }
 }
 return false
}
