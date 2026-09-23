import {send,readBody,requireCsrf,audit} from './runtime-v09.mjs';
import {createOffer,getOffer,listOffers,actOnOffer,offerNegotiationCapabilities} from './offer-negotiation-v22.mjs';

export async function routeOfferNegotiationV22(req,res,url,ctx){
 if(url.pathname==='/api/offers/capabilities'&&req.method==='GET')return send(res,200,{capabilities:offerNegotiationCapabilities()});
 if(!ctx)return false;
 requireCsrf(req,ctx);const account=ctx.account;

 if(url.pathname==='/api/offers'&&req.method==='GET')return send(res,200,{offers:await listOffers(account)});

 const create=url.pathname.match(/^\/api\/listings\/([^/]+)\/offers$/);
 if(create&&req.method==='POST'){
  const result=await createOffer(account,create[1],await readBody(req));
  await audit(req,account,result.idempotent?'OFFER_CREATE_REPLAY':'OFFER_CREATED','OFFER',result.offer.id,null,null,{listingId:result.offer.listingId,objectId:result.offer.objectId,version:result.offer.version});
  return send(res,result.idempotent?200:201,result)
 }

 const detail=url.pathname.match(/^\/api\/offers\/([^/]+)$/);
 if(detail&&req.method==='GET'){
  const offer=await getOffer(account,detail[1]);
  return offer?send(res,200,{offer}):send(res,404,{error:'Offer not found',code:'OFFER_NOT_FOUND'})
 }

 const action=url.pathname.match(/^\/api\/offers\/([^/]+)\/actions$/);
 if(action&&req.method==='POST'){
  const result=await actOnOffer(account,action[1],await readBody(req));
  await audit(req,account,result.idempotent?'OFFER_ACTION_REPLAY':'OFFER_ACTION_APPLIED','OFFER',result.offer.id,null,null,{status:result.offer.status,version:result.offer.version,orderId:result.order?.id||null});
  return send(res,result.idempotent?200:201,result)
 }

 const legacy=url.pathname.match(/^\/api\/offers\/([^/]+)\/respond$/);
 if(legacy&&req.method==='POST')return send(res,409,{error:'This offer uses the v0.22 negotiation authority. Reload the offer before acting.',code:'OFFER_V22_ACTION_REQUIRED'});

 return false
}
