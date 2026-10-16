// Collection publication is a separate authority from the owner PRIVATE/PUBLIC choice.
import {send,readBody,requireCsrf,audit} from './runtime-v09.mjs';
import {collectionPublicationStatus,transitionCollectionPublication,collectionReviewQueue} from './collection-publication-v73.mjs';

const actions=Object.freeze({
 submit:'SUBMIT',approve:'APPROVE',publish:'PUBLISH',
 'request-changes':'REQUEST_CHANGES',revoke:'REVOKE'
});
export async function routeCollectionPublicationV73(req,res,url,ctx){
 if(url.pathname==='/api/collection-publication/queue'&&req.method==='GET'){
  if(!ctx)return send(res,401,{error:'Authentication required',code:'AUTH_REQUIRED'});
  return send(res,200,await collectionReviewQueue(ctx.account,{limit:url.searchParams.get('limit')||30}));
 }
 const match=url.pathname.match(/^\/api\/collections\/([^/]+)\/publication(?:\/(submit|approve|publish|request-changes|revoke))?$/);
 if(!match)return false;
 if(req.method==='GET'&&!match[2]){
  if(!ctx)return send(res,401,{error:'Authentication required',code:'AUTH_REQUIRED'});
  return send(res,200,await collectionPublicationStatus(ctx.account,match[1]));
 }
 if(req.method!=='POST'||!match[2])return false;
 if(!ctx)return send(res,401,{error:'Authentication required',code:'AUTH_REQUIRED'});
 requireCsrf(req,ctx);
 const body=await readBody(req),action=actions[match[2]],key=req.headers['idempotency-key']||body.idempotencyKey||null;
 const outcome=await transitionCollectionPublication(ctx.account,match[1],action,{...body,idempotencyKey:key});
 if(!outcome.idempotent)await audit(req,ctx.account,'COLLECTION_PUBLICATION_'+action,'COLLECTION',match[1],null,{
  publicationState:outcome.publicationState,sequenceNo:outcome.event?.sequenceNo||null,
  snapshotHash:outcome.snapshotHash,eventHash:outcome.event?.eventHash||null
 });
 return send(res,200,outcome);
}
