// ANTIQUA v90: one authorized read-only progress view for two existing
// commerce services. Never exposes private messages, names or media URLs.
import {send,db,listing} from './runtime-v09.mjs';
import {listConversations,getConversation} from './domain-e2e-v14.mjs';
import {listConditionReportRequests} from './condition-report-v23.mjs';
import {buildBuyerDiligenceV90} from './buyer-diligence-v90.mjs';

const ID=/^[A-Za-z0-9._:-]{1,120}$/;
export async function routeBuyerDiligenceV90(req,res,url,ctx){
 const match=url.pathname.match(/^\/api\/listings\/([^/]+)\/diligence-progress$/);
 if(!match)return false;
 if(req.method!=='GET')return send(res,405,{
  code:'METHOD_NOT_ALLOWED',error:'Read-only diligence route'
 },{allow:'GET'});
 if(url.search)return send(res,400,{
  code:'UNSUPPORTED_PARAMETERS',error:'Parameters not supported'
 });
 if(!ctx)return send(res,401,{code:'AUTH_REQUIRED',error:'Buyer authentication required'});
 const a=ctx.account;
 if(!a?.roles?.includes('BUYER'))return send(res,403,{
  code:'BUYER_REQUIRED',error:'Buyer role required'
 });
 const id=match[1];
 if(!ID.test(id))return send(res,400,{code:'LISTING_ID_INVALID',error:'Invalid listing reference'});
 // Resolve source scope from the authoritative listing: a URL parameter
 // cannot supply an objectId or claim someone else's conversation.
 let source;
 if(db.kind==='POSTGRES'){
  const row=(await db.pool.query(
   'SELECT object_id,seller_id,status FROM listings WHERE id=$1 LIMIT 1',[id]
  )).rows[0];
  source=row&&{objectId:row.object_id,sellerId:row.seller_id,status:row.status};
 }else{
  const li=listing(id);
  source=li&&{objectId:li.lotId,sellerId:li.sellerId,status:li.status};
 }
 if(!source||source.status!=='ACTIVE'||!ID.test(source.objectId)||!ID.test(source.sellerId)||
   (a.sellerId&&a.sellerId===source.sellerId)){
  return send(res,404,{code:'LISTING_NOT_AVAILABLE',error:'Active listing not available'});
 }
 // Existing service read models enforce participant authorization in both
 // memory and PostgreSQL paths. Nothing sent to buildBuyerDiligence is trusted
 // from a request payload or from a public research projection.
 const [conversations,requests]=await Promise.all([
  listConversations(a),listConditionReportRequests(a)
 ]);
 const matching=conversations.filter(c=>c?.buyerAccountId===a.id&&
  c.objectId===source.objectId&&c.listingId===id);
 const full=[];
 for(const c of matching){
  const detail=await getConversation(a,c.id);
  if(detail?.buyerAccountId===a.id&&detail.objectId===source.objectId&&detail.listingId===id)
   full.push(detail);
 }
 const state=buildBuyerDiligenceV90({
  buyerAccountId:a.id,objectId:source.objectId,listingId:id,
  conversations:full,conditionRequests:requests
 });
 return send(res,200,{progress:state},{'x-robots-tag':'noindex'});
}
