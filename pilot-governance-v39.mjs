import crypto from 'node:crypto';
import {db,uid} from './runtime-v09.mjs';
import {appSecret,tokenHash} from './security-v09.mjs';
import {dealerPilotDetail} from './dealer-pilot-authority-v37.mjs';
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const digest=v=>crypto.createHash('sha256').update(canonical(v)).digest('hex');
const sign=v=>'v1='+crypto.createHmac('sha256',appSecret()).update(canonical(v)).digest('hex');
const seller=a=>{if(!a?.sellerId)throw Object.assign(new Error('Seller account required'),{status:403,code:'SELLER_REQUIRED'})};
const rand=()=>crypto.randomBytes(32).toString('base64url');
export function pilotGovernanceCapabilities(){return{contractVersion:'v39',versionedCounterparties:true,tokenRotation:true,revocation:true,multiRepresentativeQuorum:true,objectionResolution:true,checkpointSupersession:true,historyRewrite:false,privacyPreservingPublicReceipt:true,bilateralCertificate:true,schemaProof:true}}
async function pilot(account,id){seller(account);const d=await dealerPilotDetail(account,id);if(!d)throw Object.assign(new Error('Pilot not found'),{status:404,code:'PILOT_NOT_FOUND'});return d}
export async function schemaProof(){
 if(db.kind!=='POSTGRES')return{dataMode:db.kind,ready:false,required:['024_v38_counterparty_acceptance','025_v39_pilot_governance_verification'],applied:[]};
 const q=await db.pool.query("SELECT version FROM schema_migrations WHERE version IN('024_v38_counterparty_acceptance','025_v39_pilot_governance_verification') ORDER BY version");
 const applied=q.rows.map(x=>x.version),required=['024_v38_counterparty_acceptance','025_v39_pilot_governance_verification'];return{dataMode:'POSTGRES',ready:required.every(x=>applied.includes(x)),required,applied,missing:required.filter(x=>!applied.includes(x))}
}
export async function configureGovernance(account,pilotId,input={}){
 await pilot(account,pilotId);const quorum=Math.max(1,Math.min(20,Number(input.quorumRequired)||1)),finalQuorum=Math.max(1,Math.min(20,Number(input.finalQuorumRequired)||quorum));
 if(db.kind!=='POSTGRES')return{pilotId,quorumRequired:quorum,finalQuorumRequired:finalQuorum,publicReceiptEnabled:input.publicReceiptEnabled!==false,version:1,preview:true};
 const q=await db.pool.query(`INSERT INTO dealer_pilot_governance(pilot_id,quorum_required,final_quorum_required,public_receipt_enabled) VALUES($1,$2,$3,$4) ON CONFLICT(pilot_id) DO UPDATE SET quorum_required=EXCLUDED.quorum_required,final_quorum_required=EXCLUDED.final_quorum_required,public_receipt_enabled=EXCLUDED.public_receipt_enabled,version=dealer_pilot_governance.version+1,updated_at=now() RETURNING *`,[pilotId,quorum,finalQuorum,input.publicReceiptEnabled!==false]);return q.rows[0]
}
async function snapshotCounterparty(id,reason){
 if(db.kind!=='POSTGRES')return;const cp=(await db.pool.query('SELECT * FROM dealer_pilot_counterparties WHERE id=$1',[id])).rows[0];if(!cp)return;
 const v=Number((await db.pool.query('SELECT COALESCE(MAX(version),0)+1 v FROM dealer_pilot_counterparty_versions WHERE counterparty_id=$1',[id])).rows[0].v);
 await db.pool.query('INSERT INTO dealer_pilot_counterparty_versions(id,counterparty_id,pilot_id,version,email,display_name,role_label,status,token_hash,expires_at,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[uid('cpv'),id,cp.pilot_id,v,cp.email,cp.display_name,cp.role_label,cp.status,cp.token_hash,cp.expires_at,reason])
}
export async function revokeCounterparty(account,pilotId,counterpartyId,{reason='Revoked'}={}){
 await pilot(account,pilotId);if(db.kind!=='POSTGRES')return{counterpartyId,status:'REVOKED',preview:true};await snapshotCounterparty(counterpartyId,reason);
 const q=await db.pool.query("UPDATE dealer_pilot_counterparties SET status='REVOKED' WHERE id=$1 AND pilot_id=$2 RETURNING id,email,display_name,role_label,status",[counterpartyId,pilotId]);if(!q.rows[0])throw Object.assign(new Error('Counterparty not found'),{status:404,code:'COUNTERPARTY_NOT_FOUND'});return q.rows[0]
}
export async function rotateCounterpartyAccess(account,pilotId,counterpartyId,{expiresInDays=7,reason='Token rotation'}={}){
 await pilot(account,pilotId);if(db.kind!=='POSTGRES')return{counterpartyId,accessToken:rand(),preview:true};await snapshotCounterparty(counterpartyId,reason);const raw=rand(),hash=tokenHash(raw),expires=new Date(Date.now()+Math.max(1,Math.min(30,Number(expiresInDays)||7))*86400000);
 const q=await db.pool.query("UPDATE dealer_pilot_counterparties SET token_hash=$1,status='INVITED',expires_at=$2,accepted_at=NULL WHERE id=$3 AND pilot_id=$4 RETURNING id,email,display_name,role_label,status,expires_at",[hash,expires,counterpartyId,pilotId]);if(!q.rows[0])throw Object.assign(new Error('Counterparty not found'),{status:404,code:'COUNTERPARTY_NOT_FOUND'});return{counterparty:q.rows[0],accessToken:raw}
}
export async function resolveObjection(account,pilotId,input={}){
 await pilot(account,pilotId);const reviewId=String(input.objectionReviewId||''),type=String(input.resolutionType||'').toUpperCase();if(!['ACCEPTED_AS_IS','SUPERSEDED','WITHDRAWN','REJECTED'].includes(type))throw Object.assign(new Error('Invalid resolution type'),{status:400,code:'RESOLUTION_TYPE_INVALID'});
 if(db.kind!=='POSTGRES')return{pilotId,reviewId,resolutionType:type,preview:true};
 const rv=(await db.pool.query("SELECT * FROM dealer_pilot_reviews WHERE id=$1 AND pilot_id=$2 AND review_type IN('CHECKPOINT_OBJECTION','FINAL_OBJECTION')",[reviewId,pilotId])).rows[0];if(!rv)throw Object.assign(new Error('Objection not found'),{status:404,code:'OBJECTION_NOT_FOUND'});
 const body={pilotId,reviewId,resolutionType:type,comment:String(input.comment||'').slice(0,2000),sourceKey:String(input.clientActionId||uid('resolve')),createdAt:new Date().toISOString()},d=digest(body),sig=sign(body);
 const q=await db.pool.query('INSERT INTO dealer_pilot_resolutions(id,pilot_id,objection_review_id,resolution_type,resolution_comment,source_key,payload,digest,signature,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(pilot_id,source_key) DO NOTHING RETURNING *',[uid('res'),pilotId,reviewId,type,body.comment,body.sourceKey,{},d,sig,body.createdAt]);return q.rows[0]||body
}
export async function supersedeCheckpoint(account,pilotId,input={}){
 await pilot(account,pilotId);if(db.kind!=='POSTGRES')return{pilotId,preview:true};const oldId=String(input.supersededEventId||''),newId=String(input.newEventId||''),reason=String(input.reason||'').trim();if(!reason)throw Object.assign(new Error('reason required'),{status:400,code:'SUPERSESSION_REASON_REQUIRED'});
 const q=await db.pool.query("SELECT id FROM dealer_pilot_events WHERE pilot_id=$1 AND id=ANY($2::text[]) AND event_type='CHECKPOINT_SIGNED'",[pilotId,[oldId,newId]]);if(q.rows.length!==2)throw Object.assign(new Error('Both checkpoints required'),{status:404,code:'CHECKPOINT_NOT_FOUND'});
 const source=String(input.clientActionId||uid('supersede'));await db.pool.query('INSERT INTO dealer_pilot_checkpoint_supersessions(id,pilot_id,superseded_event_id,new_event_id,reason,source_key) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(pilot_id,source_key) DO NOTHING',[uid('sup'),pilotId,oldId,newId,reason,source]);return{pilotId,supersededEventId:oldId,newEventId:newId,reason,historyPreserved:true}
}
async function governance(pilotId){if(db.kind!=='POSTGRES')return{quorum_required:1,final_quorum_required:1,public_receipt_enabled:true};return (await db.pool.query('SELECT * FROM dealer_pilot_governance WHERE pilot_id=$1',[pilotId])).rows[0]||{quorum_required:1,final_quorum_required:1,public_receipt_enabled:true}}
export async function governanceStatus(account,pilotId){
 const d=await pilot(account,pilotId),g=await governance(pilotId);if(db.kind!=='POSTGRES')return{pilotId,quorumRequired:1,finalQuorumRequired:1,preview:true};
 const cp=(await db.pool.query("SELECT id,status,display_name,role_label FROM dealer_pilot_counterparties WHERE pilot_id=$1 AND status<>'REVOKED'",[pilotId])).rows;
 const rs=(await db.pool.query('SELECT * FROM dealer_pilot_reviews WHERE pilot_id=$1 ORDER BY created_at,id',[pilotId])).rows, resolutions=(await db.pool.query('SELECT * FROM dealer_pilot_resolutions WHERE pilot_id=$1',[pilotId])).rows;
 const unresolved=rs.filter(r=>r.review_type.endsWith('OBJECTION')&&!resolutions.some(x=>x.objection_review_id===r.id));
 const finalAcceptors=new Set(rs.filter(r=>r.review_type==='FINAL_ACCEPTED').map(r=>r.counterparty_id));
 return{pilotId,governance:{quorumRequired:g.quorum_required,finalQuorumRequired:g.final_quorum_required,publicReceiptEnabled:g.public_receipt_enabled},representatives:cp,reviews:rs,resolutions,unresolvedObjections:unresolved,finalAcceptedCount:finalAcceptors.size,finalQuorumMet:finalAcceptors.size>=g.final_quorum_required&&!unresolved.some(x=>x.review_type==='FINAL_OBJECTION'),contractDigest:d.pilot.contractDigest}
}
export async function issueBilateralCertificate(account,pilotId){
 const st=await governanceStatus(account,pilotId),d=await pilot(account,pilotId);if(!st.finalQuorumMet)throw Object.assign(new Error('Final quorum not met'),{status:409,code:'FINAL_QUORUM_NOT_MET'});if(!d.events.some(e=>(e.event_type||e.eventType)==='FINAL_PACK_SIGNED'))throw Object.assign(new Error('Final pack not signed'),{status:409,code:'FINAL_PACK_NOT_READY'});
 const payload={version:'v39',pilotId,contractDigest:d.pilot.contractDigest,pilotStatus:d.pilot.status,startsAt:d.pilot.startsAt,endsAt:d.pilot.endsAt,finalAcceptedCount:st.finalAcceptedCount,finalQuorumRequired:st.governance.finalQuorumRequired,unresolvedObjections:st.unresolvedObjections.length,issuedAt:new Date().toISOString()},dg=digest(payload),sig=sign(payload),code=crypto.randomBytes(12).toString('hex');
 if(db.kind==='POSTGRES'&&st.governance.publicReceiptEnabled)await db.pool.query('INSERT INTO dealer_pilot_public_receipts(id,pilot_id,receipt_code,certificate_digest,certificate_signature,public_payload) VALUES($1,$2,$3,$4,$5,$6)',[uid('receipt'),pilotId,code,dg,sig,payload]);
 return{certificate:{...payload,digest:dg,signature:sig},verificationReceipt:st.governance.publicReceiptEnabled?{code,publicPath:'/api/pilot/verify/'+code}:null}
}
export async function publicReceipt(code){
 if(db.kind!=='POSTGRES')return null;const r=(await db.pool.query('SELECT receipt_code,certificate_digest,certificate_signature,public_payload,created_at,revoked_at FROM dealer_pilot_public_receipts WHERE receipt_code=$1',[String(code)])).rows[0];if(!r)return null;
 return{valid:!r.revoked_at,receiptCode:r.receipt_code,certificateDigest:r.certificate_digest,certificateSignature:r.certificate_signature,certificate:r.public_payload,issuedAt:r.created_at,revokedAt:r.revoked_at||null,privacyBoundary:'No buyer identity, evidence attachment content, revenue detail, email or counterparty PII is disclosed.'}
}
