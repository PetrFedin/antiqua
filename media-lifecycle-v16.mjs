import {db,draftItems} from './runtime-v09.mjs';
import {inferLifecycleAuthority,planLifecycleTransition} from './lifecycle-authority-v16.mjs';
import {findLifecycleEventBySourceTx,recordLifecycleTransitionTx} from './lifecycle-events-v16.mjs';

const iso=v=>v?.toISOString?.()||v||null;
const mapMedia=r=>r?{id:r.id,entityType:r.entity_type??r.entityType,entityId:r.entity_id??r.entityId,storageKey:r.storage_key??r.storageKey,contentType:r.content_type??r.contentType,bytes:Number(r.bytes??0),sha256:r.sha256||null,etag:r.etag||null,role:r.role,visibility:r.visibility,status:r.status,uploadedAt:iso(r.uploaded_at??r.uploadedAt),createdAt:iso(r.created_at??r.createdAt)}:null;
const conflict=message=>Object.assign(new Error(message),{status:409,code:'LIFECYCLE_EVENT_CONFLICT'});

export async function beginMediaVerification(actor,id,{sourceKey=null}={}){
  sourceKey=sourceKey==null?null:String(sourceKey);
  if(db.kind!=='POSTGRES'){
    const current=await db.getMedia(id);if(!current)throw Object.assign(new Error('Media not found'),{status:404});const action=current.status==='UPLOADING'?'BEGIN_VERIFY':current.status==='VERIFYING'?'RETRY_VERIFY':null;if(!action)throw Object.assign(new Error('Media cannot be completed from current state'),{status:409,code:'MEDIA_INVALID_STATE'});const plan=planLifecycleTransition({domain:'MEDIA',from:current.status,to:'VERIFYING',action,authority:inferLifecycleAuthority({account:actor})}),asset=await db.updateMedia(id,{...current,status:plan.to});return{asset,idempotentTransition:false,lifecycle:plan}
  }
  const cx=await db.pool.connect();try{
    await cx.query('BEGIN');const row=(await cx.query('SELECT * FROM media_assets WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row)throw Object.assign(new Error('Media not found'),{status:404});const current=mapMedia(row);
    if(sourceKey){const prior=await findLifecycleEventBySourceTx(cx,{domain:'MEDIA',aggregateId:id,sourceKey});if(prior){if(prior.to!=='VERIFYING')throw conflict('Media verification source key belongs to another transition');await cx.query('COMMIT');return{asset:current,idempotentTransition:true,lifecycle:prior}}}
    const action=current.status==='UPLOADING'?'BEGIN_VERIFY':current.status==='VERIFYING'?'RETRY_VERIFY':null;if(!action)throw Object.assign(new Error('Media cannot be completed from current state'),{status:409,code:'MEDIA_INVALID_STATE'});const plan=planLifecycleTransition({domain:'MEDIA',from:current.status,to:'VERIFYING',action,authority:inferLifecycleAuthority({account:actor})});const changed=(await cx.query("UPDATE media_assets SET status='VERIFYING' WHERE id=$1 RETURNING *",[id])).rows[0];await recordLifecycleTransitionTx(cx,{plan,aggregateId:id,sourceKey,metadata:{entityType:current.entityType,entityId:current.entityId,role:current.role}});await cx.query('COMMIT');return{asset:mapMedia(changed),idempotentTransition:false,lifecycle:plan}
  }catch(e){try{await cx.query('ROLLBACK')}catch{}throw e}finally{cx.release()}
}

export async function markMediaReady(id,verified,{sourceKey=null}={}){
  sourceKey=sourceKey==null?null:String(sourceKey);
  if(db.kind!=='POSTGRES'){
    const current=await db.getMedia(id);if(!current)throw Object.assign(new Error('Media not found'),{status:404});const plan=planLifecycleTransition({domain:'MEDIA',from:current.status,to:'READY',action:'MARK_READY',authority:'SYSTEM',facts:{STORAGE_VERIFIED:true}}),asset=await db.updateMedia(id,{...current,...verified,status:plan.to});if(asset.entityType==='DRAFT'){const d=draftItems.get(asset.entityId);if(d&&!d.media.some(x=>x.id===asset.id)){d.media.push({id:asset.id,storageKey:asset.storageKey,role:asset.role,status:'READY'});await db.putDraft(d)}}return{asset,idempotentTransition:false,lifecycle:plan}
  }
  const cx=await db.pool.connect();let draftPayload=null;try{
    await cx.query('BEGIN');const row=(await cx.query('SELECT * FROM media_assets WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row)throw Object.assign(new Error('Media not found'),{status:404});const current=mapMedia(row);
    if(sourceKey){const prior=await findLifecycleEventBySourceTx(cx,{domain:'MEDIA',aggregateId:id,sourceKey});if(prior){if(prior.to!=='READY')throw conflict('Media ready source key belongs to another transition');await cx.query('COMMIT');return{asset:current,idempotentTransition:true,lifecycle:prior}}}
    const plan=planLifecycleTransition({domain:'MEDIA',from:current.status,to:'READY',action:'MARK_READY',authority:'SYSTEM',facts:{STORAGE_VERIFIED:true}}),bytes=Number(verified?.bytes??current.bytes??0),contentType=String(verified?.contentType||current.contentType),sha256=verified?.sha256||current.sha256||null,etag=verified?.etag||current.etag||null,uploadedAt=verified?.uploadedAt||new Date().toISOString();const changed=(await cx.query("UPDATE media_assets SET status='READY',bytes=$2,content_type=$3,sha256=$4,etag=$5,uploaded_at=$6 WHERE id=$1 RETURNING *",[id,bytes,contentType,sha256,etag,uploadedAt])).rows[0];
    if(current.entityType==='DRAFT'){const dr=(await cx.query('SELECT * FROM seller_drafts WHERE id=$1 FOR UPDATE',[current.entityId])).rows[0];if(dr){draftPayload={...(dr.payload||{}),status:dr.status};const media=Array.isArray(draftPayload.media)?[...draftPayload.media]:[];if(!media.some(x=>x.id===id))media.push({id,storageKey:current.storageKey,role:current.role,status:'READY'});draftPayload.media=media;await cx.query('UPDATE seller_drafts SET payload=$2,updated_at=now() WHERE id=$1',[current.entityId,draftPayload])}}
    await recordLifecycleTransitionTx(cx,{plan,aggregateId:id,sourceKey,metadata:{entityType:current.entityType,entityId:current.entityId,role:current.role,bytes,contentType}});await cx.query('COMMIT');if(draftPayload)draftItems.set(current.entityId,draftPayload);return{asset:mapMedia(changed),idempotentTransition:false,lifecycle:plan}
  }catch(e){try{await cx.query('ROLLBACK')}catch{}throw e}finally{cx.release()}
}

export async function rejectMediaVerification(id,error,{sourceKey=null}={}){
  sourceKey=sourceKey==null?null:String(sourceKey);
  if(db.kind!=='POSTGRES'){
    const current=await db.getMedia(id);if(!current)throw Object.assign(new Error('Media not found'),{status:404});const plan=planLifecycleTransition({domain:'MEDIA',from:current.status,to:'REJECTED',action:'REJECT',authority:'SYSTEM',facts:{STORAGE_VERIFICATION_FAILED:true}}),asset=await db.updateMedia(id,{...current,status:plan.to});return{asset,idempotentTransition:false,lifecycle:plan}
  }
  const cx=await db.pool.connect();try{
    await cx.query('BEGIN');const row=(await cx.query('SELECT * FROM media_assets WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row)throw Object.assign(new Error('Media not found'),{status:404});const current=mapMedia(row);
    if(sourceKey){const prior=await findLifecycleEventBySourceTx(cx,{domain:'MEDIA',aggregateId:id,sourceKey});if(prior){if(prior.to!=='REJECTED')throw conflict('Media reject source key belongs to another transition');await cx.query('COMMIT');return{asset:current,idempotentTransition:true,lifecycle:prior}}}
    const plan=planLifecycleTransition({domain:'MEDIA',from:current.status,to:'REJECTED',action:'REJECT',authority:'SYSTEM',facts:{STORAGE_VERIFICATION_FAILED:true}}),changed=(await cx.query("UPDATE media_assets SET status='REJECTED' WHERE id=$1 RETURNING *",[id])).rows[0];await recordLifecycleTransitionTx(cx,{plan,aggregateId:id,sourceKey,metadata:{entityType:current.entityType,entityId:current.entityId,role:current.role,errorCode:error?.code||'MEDIA_VERIFY_FAILED'}});await cx.query('COMMIT');return{asset:mapMedia(changed),idempotentTransition:false,lifecycle:plan}
  }catch(e){try{await cx.query('ROLLBACK')}catch{}throw e}finally{cx.release()}
}

export function mediaLifecycleCapabilities(){return{postgresAuthority:db.kind==='POSTGRES',rowLock:true,journal:true,outbox:true,retryableVerification:true,draftLinkAtomicWithReady:true}}
