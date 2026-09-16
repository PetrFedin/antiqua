import {db,send,readBody,requireCsrf,requirePermission,audit,draftItems,listings,lot,uid,now,createUploadIntent,verifyUpload,createReadUrl} from './runtime-v09.mjs';

const ROLES=new Set(['HERO','DETAIL','MARK','SIGNATURE','CONDITION','PROVENANCE_DOC','INVOICE','CERTIFICATE','SHIPPING_BEFORE','SHIPPING_AFTER','DISPUTE','DOCUMENT']);
const canOperate=a=>Boolean(a?.roles?.includes('ADMIN')||a?.roles?.includes('TRUST_REVIEWER')||a?.roles?.includes('CATALOGUER'));
function sellerForObject(id){return lot(id)?.sellerId||[...listings.values()].find(x=>x.lotId===id)?.sellerId||null}
function mayAccess(a,type,id){if(canOperate(a))return true;if(type==='DRAFT')return Boolean(a.sellerId&&draftItems.get(id)?.sellerId===a.sellerId);return Boolean(a.sellerId&&sellerForObject(id)===a.sellerId)}
function publicAsset(asset){return asset?{id:asset.id,entityType:asset.entityType,entityId:asset.entityId,contentType:asset.contentType,bytes:asset.bytes,sha256:asset.sha256,etag:asset.etag,role:asset.role,visibility:asset.visibility,status:asset.status,uploadedAt:asset.uploadedAt,createdAt:asset.createdAt}:null}
async function rejectVerification(req,a,asset,error){const rejected=await db.updateMedia(asset.id,{...asset,status:'REJECTED'});await audit(req,a,'MEDIA_UPLOAD_REJECTED','MEDIA',asset.id,null,{entityType:asset.entityType,entityId:asset.entityId,code:error?.code||'MEDIA_VERIFY_FAILED'});return rejected}

export async function routeMediaV14(req,res,url,ctx){
 if(!ctx)return false;const a=ctx.account;
 if(url.pathname==='/api/media/upload-intent'&&req.method==='POST'){
  requireCsrf(req,ctx);if(!canOperate(a))requirePermission(a,'seller.draft.manage');const b=await readBody(req),entityId=String(b.draftId||b.objectId||''),entityType=b.draftId?'DRAFT':'OBJECT';if(!entityId)return send(res,400,{error:'Entity required'});if(!mayAccess(a,entityType,entityId))return send(res,403,{error:'Media permission denied',code:'MEDIA_OWNERSHIP_REQUIRED'});const role=String(b.role||'DETAIL').toUpperCase();if(!ROLES.has(role))return send(res,400,{error:'Unsupported media role',code:'INVALID_MEDIA_ROLE'});const intent=await createUploadIntent({ownerUserId:a.id,entityId,contentType:String(b.contentType||''),bytes:Number(b.bytes),sha256:b.sha256}),asset={id:uid('media'),entityType,entityId,storageKey:intent.key,contentType:intent.contentType,bytes:intent.bytes,sha256:intent.sha256,role,visibility:'PRIVATE',status:'UPLOADING',createdAt:now()};await db.createMedia(asset);await audit(req,a,'MEDIA_UPLOAD_INTENT_CREATED','MEDIA',asset.id,null,{entityType,entityId,role});return send(res,201,{asset:publicAsset(asset),uploadUrl:intent.uploadUrl,expiresIn:intent.expiresIn})
 }
 const read=url.pathname.match(/^\/api\/media\/([^/]+)(?:\/(read|complete))?$/);if(!read)return false;
 const asset=await db.getMedia(read[1]);if(!asset)return send(res,404,{error:'Media not found'});if(!mayAccess(a,asset.entityType,asset.entityId))return send(res,403,{error:'Media permission denied',code:'MEDIA_OWNERSHIP_REQUIRED'});
 if(req.method==='GET'&&!read[2])return send(res,200,{asset:publicAsset(asset)});
 if(req.method==='GET'&&read[2]==='read'){
  if(asset.status!=='READY')return send(res,409,{error:'Media is not ready',code:'MEDIA_NOT_READY',status:asset.status});const signed=await createReadUrl(asset.storageKey);await audit(req,a,'MEDIA_READ_URL_CREATED','MEDIA',asset.id,null,{entityType:asset.entityType,entityId:asset.entityId,expiresIn:signed.expiresIn});return send(res,200,{asset:publicAsset(asset),read:signed})
 }
 if(req.method==='POST'&&read[2]==='complete'){
  requireCsrf(req,ctx);if(!['UPLOADING','VERIFYING'].includes(asset.status))return send(res,409,{error:'Media cannot be completed from current state',code:'MEDIA_INVALID_STATE',status:asset.status});await db.updateMedia(asset.id,{...asset,status:'VERIFYING'});let verified;try{verified=await verifyUpload({key:asset.storageKey,contentType:asset.contentType,bytes:asset.bytes,sha256:asset.sha256})}catch(e){await rejectVerification(req,a,asset,e);throw e}const ready=await db.updateMedia(asset.id,{...asset,...verified,status:'READY'});if(asset.entityType==='DRAFT'){const d=draftItems.get(asset.entityId);if(d&&!d.media.some(x=>x.id===asset.id)){d.media.push({id:asset.id,storageKey:asset.storageKey,role:asset.role,status:'READY'});await db.putDraft(d)}}await audit(req,a,'MEDIA_UPLOAD_COMPLETED','MEDIA',asset.id,null,{entityType:asset.entityType,entityId:asset.entityId,bytes:ready.bytes,contentType:ready.contentType});return send(res,200,{asset:publicAsset(ready),read:await createReadUrl(asset.storageKey)})
 }
 return false
}
