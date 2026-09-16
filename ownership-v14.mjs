import crypto from 'node:crypto';
const uid=()=>`own-${crypto.randomUUID().replaceAll('-','').slice(0,18)}`;
const conflict=message=>Object.assign(new Error(message),{status:409,code:'OWNERSHIP_IDEMPOTENCY_CONFLICT'});
const iso=v=>v?.toISOString?.()||v||null;
const eventFromRow=r=>r?{id:r.id,objectId:r.object_id,previousOwnerAccountId:r.previous_owner_account_id||null,newOwnerAccountId:r.new_owner_account_id,eventType:r.event_type,sourceType:r.source_type,sourceId:r.source_id||null,sequenceNo:Number(r.sequence_no),publicNote:r.public_note||{},occurredAt:iso(r.occurred_at),idempotencyKey:r.idempotency_key||null,persistent:true}:null;
function sameEvent(e,{objectId,newOwnerAccountId,sourceType,sourceId,eventType}){return e.objectId===objectId&&e.newOwnerAccountId===newOwnerAccountId&&e.sourceType===sourceType&&String(e.sourceId||'')===String(sourceId||'')&&e.eventType===eventType}
export async function recordOwnershipTransfer(db,{objectId,newOwnerAccountId,sourceType='OTHER',sourceId=null,eventType='TRANSFERRED',publicNote={},idempotencyKey=null}){
 const occurredAt=new Date().toISOString();sourceType=String(sourceType||'OTHER').toUpperCase();eventType=String(eventType||'TRANSFERRED').toUpperCase();sourceId=sourceId==null?null:String(sourceId);const key=String(idempotencyKey||(sourceId?`ownership:${objectId}:${sourceType}:${sourceId}:${eventType}`:'')||'')||null;
 if(db.kind!=='POSTGRES')return{objectId,newOwnerAccountId,sourceType,sourceId,eventType,occurredAt,idempotencyKey:key,persistent:false};
 const c=await db.pool.connect();try{
  await c.query('BEGIN');
  const object=(await c.query('SELECT id FROM objects WHERE id=$1 FOR UPDATE',[objectId])).rows[0];if(!object)throw Object.assign(new Error('Object not found'),{status:404,code:'OBJECT_NOT_FOUND'});
  let priorEvent=null;if(key)priorEvent=(await c.query('SELECT * FROM ownership_events WHERE idempotency_key=$1',[key])).rows[0];if(!priorEvent&&sourceId)priorEvent=(await c.query('SELECT * FROM ownership_events WHERE object_id=$1 AND source_type=$2 AND source_id=$3 AND event_type=$4',[objectId,sourceType,sourceId,eventType])).rows[0];
  if(priorEvent){const mapped=eventFromRow(priorEvent);if(!sameEvent(mapped,{objectId,newOwnerAccountId,sourceType,sourceId,eventType}))throw conflict('Ownership idempotency key or source already belongs to a different transfer');await c.query('COMMIT');return{...mapped,idempotent:true}}
  const prev=(await c.query('SELECT owner_account_id FROM object_ownership WHERE object_id=$1',[objectId])).rows[0]?.owner_account_id||null;
  if(prev===newOwnerAccountId){await c.query('COMMIT');return{objectId,previousOwnerAccountId:prev,newOwnerAccountId,sourceType,sourceId,eventType,occurredAt,idempotencyKey:key,idempotent:true,persistent:true,noOwnershipChange:true}}
  const sequenceNo=Number((await c.query('SELECT COALESCE(MAX(sequence_no),0)+1 AS n FROM ownership_events WHERE object_id=$1',[objectId])).rows[0].n);
  await c.query(`INSERT INTO object_ownership(object_id,owner_account_id,acquired_at,source_type,source_id,updated_at) VALUES($1,$2,$3,$4,$5,$3)
    ON CONFLICT(object_id) DO UPDATE SET owner_account_id=excluded.owner_account_id,acquired_at=excluded.acquired_at,source_type=excluded.source_type,source_id=excluded.source_id,updated_at=excluded.updated_at`,[objectId,newOwnerAccountId,occurredAt,sourceType,sourceId]);
  const id=uid();await c.query(`INSERT INTO ownership_events(id,object_id,previous_owner_account_id,new_owner_account_id,event_type,source_type,source_id,public_note,occurred_at,created_at,sequence_no,idempotency_key)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,$11)`,[id,objectId,prev,newOwnerAccountId,eventType,sourceType,sourceId,publicNote,occurredAt,sequenceNo,key]);
  await c.query('COMMIT');return{id,objectId,previousOwnerAccountId:prev,newOwnerAccountId,sourceType,sourceId,eventType,publicNote,sequenceNo,occurredAt,idempotencyKey:key,idempotent:false,persistent:true}
 }catch(e){try{await c.query('ROLLBACK')}catch{}throw e}finally{c.release()}
}
export async function currentOwnership(db,objectId,requesterAccountId=null){if(db.kind!=='POSTGRES')return null;const r=(await db.pool.query('SELECT object_id,owner_account_id,acquired_at,source_type,source_id,updated_at FROM object_ownership WHERE object_id=$1',[objectId])).rows[0];if(!r)return null;return{objectId:r.object_id,ownerAccountId:requesterAccountId===r.owner_account_id?r.owner_account_id:null,isRequesterOwner:requesterAccountId===r.owner_account_id,acquiredAt:r.acquired_at.toISOString(),sourceType:r.source_type,sourceId:requesterAccountId===r.owner_account_id?r.source_id:null,updatedAt:r.updated_at.toISOString()}}
export async function publicOwnershipHistory(db,objectId){if(db.kind!=='POSTGRES')return[];return(await db.pool.query('SELECT sequence_no,event_type,source_type,public_note,occurred_at FROM ownership_events WHERE object_id=$1 ORDER BY sequence_no',[objectId])).rows.map(r=>({sequenceNo:Number(r.sequence_no),eventType:r.event_type,sourceType:r.source_type,publicNote:r.public_note||{},occurredAt:r.occurred_at.toISOString()}))}
