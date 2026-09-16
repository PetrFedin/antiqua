import {db,send,readBody,requireCsrf,requirePermission,audit,draftItems,listings,lot,uid,now,createUploadIntent,verifyUpload,createReadUrl} from './runtime-v09.mjs';

const canOperate=a=>Boolean(a?.roles?.includes('ADMIN')||a?.roles?.includes('TRUST_REVIEWER')||a?.roles?.includes('CATALOGUER'));
function sellerForObject(id){return lot(id)?.sellerId||[...listings.values()].find(x=>x.lotId===id)?.sellerId||null}
function mayWrite(a,type,id){if(canOperate(a))return true;if(type==='DRAFT')return Boolean(a.sellerId&&draftItems.get(id)?.sellerId===a.sellerId);return Boolean(a.sellerId&&sellerForObject(id)===a.sellerId)}
export async function routeMediaV14(req,res,url,ctx){
 if(!ctx)return false;const a=ctx.account;
 if(url.pathname==='/api/media/upload-intent'&&req.method==='POST'){
  requireCsrf(req,ctx);if(!canOperate(a))requirePermission(a,'seller.draft.manage');const b=await readBody(req),entityId=String(b.draftId||b.objectId||''),entityType=b.draftId?'DRAFT':'OBJECT';if(!entityId)return send(res,400,{error:'Entity required'});if(!mayWrite(a,entityType,entityId))return send(res,403,{error:'Media permission denied',code:'MEDIA_OWNERSHIP_REQUIRED'});const intent=await createUploadIntent({ownerUserId:a.id,entityId,contentType:String(b.contentType||''),bytes:Number(b.bytes),sha256:b.sha256}),asset={id:uid('media'),entityType,entityId,storageKey:intent.key,contentType:intent.contentType,bytes:intent.bytes,sha256:intent.sha256,role:String(b.role||'DETAIL').toUpperCase(),visibility:'PRIVATE',status:'UPLOADING',createdAt:now()};await db.createMedia(asset);await audit(req,a,'MEDIA_UPLOAD_INTENT_CREATED','MEDIA',asset.id,null,{entityType,entityId});return send(res,201,{asset,uploadUrl:intent.uploadUrl,expiresIn:intent.expiresIn})
 }
 const m=url.pathname.match(/^\/api\/media\/([^/]+)\/complete$/);if(m&&req.method==='POST'){
  requireCsrf(req,ctx);const asset=await db.getMedia(m[1]);if(!asset)return send(res,404,{error:'Media not found'});if(!mayWrite(a,asset.entityType,asset.entityId))return send(res,403,{error:'Media permission denied',code:'MEDIA_OWNERSHIP_REQUIRED'});const verified=await verifyUpload(asset),ready=await db.updateMedia(asset.id,{...verified,status:'READY'});if(asset.entityType==='DRAFT'){const d=draftItems.get(asset.entityId);if(d&&!d.media.some(x=>x.id===asset.id)){d.media.push({id:asset.id,storageKey:asset.storageKey,role:asset.role,status:'READY'});await db.putDraft(d)}}await audit(req,a,'MEDIA_UPLOAD_COMPLETED','MEDIA',asset.id,null,{entityType:asset.entityType,entityId:asset.entityId});return send(res,200,{asset:ready,read:await createReadUrl(asset.storageKey)})
 }
 return false
}
