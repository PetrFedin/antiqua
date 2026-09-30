import crypto from 'node:crypto';
import {db,uid} from './runtime-v09.mjs';
import {appSecret,tokenHash} from './security-v09.mjs';
import {dealerPilotDetail} from './dealer-pilot-authority-v37.mjs';
const mem=new Map(),reviews=new Map();
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const digest=v=>crypto.createHash('sha256').update(canonical(v)).digest('hex');
const sign=v=>'v1='+crypto.createHmac('sha256',appSecret()).update(canonical(v)).digest('hex');
const seller=a=>{if(!a?.sellerId)throw Object.assign(new Error('Seller account required'),{status:403,code:'SELLER_REQUIRED'})};
const token=()=>crypto.randomBytes(32).toString('base64url');
export function pilotCounterpartyCapabilities(){return{contractVersion:'v38',scopedAccess:true,sellerSessionReuse:false,tokenStoredAsHash:true,reviewTypes:['CONTRACT_ACCEPTED','CHECKPOINT_ACCEPTED','CHECKPOINT_OBJECTION','FINAL_ACCEPTED','FINAL_OBJECTION'],bilateralFinalAcceptance:true,publicVerification:true}}
export async function invitePilotCounterparty(account,pilotId,input={}){
 seller(account);const detail=await dealerPilotDetail(account,pilotId);if(!detail)throw Object.assign(new Error('Pilot not found'),{status:404,code:'PILOT_NOT_FOUND'});
 const email=String(input.email||'').trim().toLowerCase(),name=String(input.displayName||'').trim();if(!email.includes('@')||!name)throw Object.assign(new Error('Valid email and displayName required'),{status:400,code:'COUNTERPARTY_INVALID'});
 const raw=token(),hash=tokenHash(raw),id=uid('pcp'),expiresAt=new Date(Date.now()+Math.max(1,Math.min(30,Number(input.expiresInDays)||7))*86400000).toISOString(),cp={id,pilotId,email,displayName:name,roleLabel:String(input.roleLabel||'DEALER_REPRESENTATIVE').slice(0,80),tokenHash:hash,status:'INVITED',expiresAt,acceptedAt:null,createdAt:new Date().toISOString()};
 if(db.kind==='POSTGRES')await db.pool.query(`INSERT INTO dealer_pilot_counterparties(id,pilot_id,email,display_name,role_label,token_hash,status,expires_at,created_at) VALUES($1,$2,$3,$4,$5,$6,'INVITED',$7,$8) ON CONFLICT(pilot_id,email) DO UPDATE SET display_name=EXCLUDED.display_name,role_label=EXCLUDED.role_label,token_hash=EXCLUDED.token_hash,status='INVITED',expires_at=EXCLUDED.expires_at,accepted_at=NULL RETURNING id`,[id,pilotId,email,name,cp.roleLabel,hash,expiresAt,cp.createdAt]);else mem.set(hash,cp);
 return{counterparty:{id,pilotId,email,displayName:name,roleLabel:cp.roleLabel,status:'INVITED',expiresAt},accessToken:raw}
}
async function byToken(raw){
 const hash=tokenHash(String(raw||''));let cp;if(db.kind==='POSTGRES'){const r=(await db.pool.query('SELECT * FROM dealer_pilot_counterparties WHERE token_hash=$1',[hash])).rows[0];if(r)cp={id:r.id,pilotId:r.pilot_id,email:r.email,displayName:r.display_name,roleLabel:r.role_label,status:r.status,expiresAt:r.expires_at?.toISOString?.()||r.expires_at,acceptedAt:r.accepted_at?.toISOString?.()||r.accepted_at}}else cp=mem.get(hash);
 if(!cp||cp.status==='REVOKED')throw Object.assign(new Error('Pilot access denied'),{status:403,code:'PILOT_ACCESS_DENIED'});if(Date.parse(cp.expiresAt)<Date.now())throw Object.assign(new Error('Pilot access expired'),{status:403,code:'PILOT_ACCESS_EXPIRED'});return cp
}
async function publicPilot(pilotId){
 if(db.kind==='POSTGRES'){const p=(await db.pool.query('SELECT id,name,status,starts_at,ends_at,baseline,inventory_scope,kpi_contract,contract_frozen_at,contract_digest FROM dealer_pilot_engagements WHERE id=$1',[pilotId])).rows[0];if(!p)return null;const events=(await db.pool.query("SELECT id,event_type,payload,digest,signature,created_at FROM dealer_pilot_events WHERE pilot_id=$1 AND event_type IN('CONTRACT_FROZEN','CHECKPOINT_SIGNED','FINAL_PACK_SIGNED','COMPLETED') ORDER BY created_at,id",[pilotId])).rows;return{pilot:{id:p.id,name:p.name,status:p.status,startsAt:p.starts_at,endsAt:p.ends_at,baseline:p.baseline,inventoryScope:p.inventory_scope,kpiContract:p.kpi_contract,contractFrozenAt:p.contract_frozen_at,contractDigest:p.contract_digest},events}}
 return null
}
export async function counterpartyWorkspace(raw){const cp=await byToken(raw),view=await publicPilot(cp.pilotId);if(!view)throw Object.assign(new Error('Pilot not found'),{status:404,code:'PILOT_NOT_FOUND'});return{counterparty:{id:cp.id,displayName:cp.displayName,roleLabel:cp.roleLabel,status:cp.status},...view}}
export async function counterpartyReview(raw,input={}){
 const cp=await byToken(raw),type=String(input.reviewType||'').toUpperCase();if(!pilotCounterpartyCapabilities().reviewTypes.includes(type))throw Object.assign(new Error('Invalid review type'),{status:400,code:'PILOT_REVIEW_TYPE_INVALID'});
 const view=await publicPilot(cp.pilotId);if(!view?.pilot?.contractFrozenAt)throw Object.assign(new Error('Contract not frozen'),{status:409,code:'PILOT_NOT_FROZEN'});
 const checkpointId=input.checkpointEventId?String(input.checkpointEventId):null;
 if(type.startsWith('CHECKPOINT_')&&!view.events.some(e=>e.id===checkpointId&&e.event_type==='CHECKPOINT_SIGNED'))throw Object.assign(new Error('Checkpoint not found'),{status:404,code:'CHECKPOINT_NOT_FOUND'});
 if(type.startsWith('FINAL_')&&!view.events.some(e=>e.event_type==='FINAL_PACK_SIGNED'))throw Object.assign(new Error('Final pack not signed'),{status:409,code:'FINAL_PACK_NOT_READY'});
 const sourceKey=String(input.clientActionId||uid('review')),body={pilotId:cp.pilotId,counterpartyId:cp.id,reviewType:type,checkpointEventId:checkpointId,comment:String(input.comment||'').slice(0,2000),sourceKey,contractDigest:view.pilot.contractDigest,createdAt:new Date().toISOString()},d=digest(body),sig=sign(body),id=uid('prv');
 if(db.kind==='POSTGRES'){const q=await db.pool.query(`INSERT INTO dealer_pilot_reviews(id,pilot_id,counterparty_id,checkpoint_event_id,review_type,comment,source_key,payload,digest,signature,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(pilot_id,source_key) DO NOTHING RETURNING *`,[id,cp.pilotId,cp.id,checkpointId,type,body.comment,sourceKey,{contractDigest:view.pilot.contractDigest},d,sig,body.createdAt]);if(!q.rows[0])return(await db.pool.query('SELECT * FROM dealer_pilot_reviews WHERE pilot_id=$1 AND source_key=$2',[cp.pilotId,sourceKey])).rows[0];if(cp.status==='INVITED')await db.pool.query("UPDATE dealer_pilot_counterparties SET status='ACCEPTED',accepted_at=now() WHERE id=$1",[cp.id])}else{reviews.set(cp.pilotId+':'+sourceKey,{id,...body,digest:d,signature:sig});cp.status='ACCEPTED'}
 return{id,...body,digest:d,signature:sig}
}
export async function bilateralPilotStatus(account,pilotId){
 seller(account);const detail=await dealerPilotDetail(account,pilotId);if(!detail)return null;
 let rs=[];if(db.kind==='POSTGRES')rs=(await db.pool.query('SELECT review_type,comment,digest,signature,created_at,counterparty_id,checkpoint_event_id FROM dealer_pilot_reviews WHERE pilot_id=$1 ORDER BY created_at,id',[pilotId])).rows;else rs=[...reviews.values()].filter(x=>x.pilotId===pilotId);
 const finalAccepted=rs.some(x=>(x.review_type||x.reviewType)==='FINAL_ACCEPTED'),finalObjected=rs.some(x=>(x.review_type||x.reviewType)==='FINAL_OBJECTION');
 return{pilotId,contractDigest:detail.pilot.contractDigest,reviews:rs,bilateralFinalStatus:finalObjected?'OBJECTED':finalAccepted?'ACCEPTED':'PENDING'}
}
export async function verifyPilotEvidencePublic({digest:expectedDigest,signature:providedSignature,payload}={}){
 if(!expectedDigest||!providedSignature||payload==null)return{valid:false,reason:'MISSING_FIELDS'};const d=digest(payload),sig=sign(payload);const valid=d===expectedDigest&&sig.length===String(providedSignature).length&&crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(String(providedSignature)));return{valid,digestMatches:d===expectedDigest,signatureMatches:valid,algorithm:'HMAC_SHA256',digestAlgorithm:'SHA256'}
}
