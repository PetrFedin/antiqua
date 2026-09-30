import crypto from 'node:crypto';
import {db,uid,requirePermission} from './runtime-v09.mjs';
import {appSecret} from './security-v09.mjs';
import {pilotCommercialProofFor} from './pilot-control-v35.mjs';

const mem=new Map();
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const digest=v=>crypto.createHash('sha256').update(canonical(v)).digest('hex');
const signature=v=>'v1='+crypto.createHmac('sha256',appSecret()).update(canonical(v)).digest('hex');
const iso=v=>new Date(v).toISOString();
const row=r=>r?{id:r.id,sellerId:r.seller_id,name:r.name,status:r.status,startsAt:iso(r.starts_at),endsAt:iso(r.ends_at),baseline:r.baseline||null,inventoryScope:r.inventory_scope||[],kpiContract:r.kpi_contract||[],contractFrozenAt:r.contract_frozen_at?iso(r.contract_frozen_at):null,contractDigest:r.contract_digest||null,createdAt:iso(r.created_at),updatedAt:iso(r.updated_at)}:null;
const ensureSeller=a=>{if(!a?.sellerId)throw Object.assign(new Error('Seller account required'),{status:403,code:'SELLER_REQUIRED'});requirePermission(a,'seller.analytics.read')};
const validateContract=(inventoryScope,kpiContract)=>{
 const scope=[...new Set((inventoryScope||[]).map(String).map(x=>x.trim()).filter(Boolean))];
 if(!scope.length)throw Object.assign(new Error('inventoryScope required'),{status:400,code:'PILOT_SCOPE_REQUIRED'});
 const kpis=(kpiContract||[]).map(x=>({code:String(x.code||'').trim(),target:x.target??null,direction:String(x.direction||'TRACK').toUpperCase()})).filter(x=>x.code);
 if(!kpis.length)throw Object.assign(new Error('kpiContract required'),{status:400,code:'PILOT_KPI_REQUIRED'});
 return{scope,kpis}
};
async function event(pilot,account,eventType,sourceKey,payload={}){
 const body={pilotId:pilot.id,eventType,sourceKey,payload,createdAt:new Date().toISOString()},d=digest(body),sig=signature(body),e={id:uid('ple'),...body,digest:d,signature:sig,actorAccountId:account?.id||null};
 if(db.kind==='POSTGRES'){
  const q=await db.pool.query(`INSERT INTO dealer_pilot_events(id,pilot_id,event_type,actor_account_id,source_key,payload,digest,signature,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(pilot_id,source_key) DO NOTHING RETURNING *`,[e.id,pilot.id,eventType,e.actorAccountId,sourceKey,payload,d,sig,e.createdAt]);
  if(!q.rows[0]){const old=(await db.pool.query('SELECT * FROM dealer_pilot_events WHERE pilot_id=$1 AND source_key=$2',[pilot.id,sourceKey])).rows[0];return old}
 }else{pilot.events=pilot.events||[];const old=pilot.events.find(x=>x.sourceKey===sourceKey);if(old)return old;pilot.events.push(e)}
 return e
}
async function getRaw(account,id){
 ensureSeller(account);
 if(db.kind==='POSTGRES'){const r=(await db.pool.query('SELECT * FROM dealer_pilot_engagements WHERE id=$1 AND seller_id=$2',[id,account.sellerId])).rows[0];return row(r)}
 const p=mem.get(id);return p?.sellerId===account.sellerId?structuredClone(p):null
}
export function dealerPilotAuthorityCapabilities(){return{contractVersion:'v37',durableWhenPostgres:true,states:['DRAFT','ACTIVE','COMPLETED','CANCELLED'],immutableAfterFreeze:['baseline','inventoryScope','kpiContract','startsAt','endsAt'],signedEvents:true,weeklyCheckpoints:true,dealerAcknowledgement:true,finalEvidencePack:true}}

export async function createDealerPilot(account,input={}){
 ensureSeller(account);const start=Date.parse(input.startsAt||''),end=Date.parse(input.endsAt||'');if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw Object.assign(new Error('Valid startsAt/endsAt required'),{status:400,code:'PILOT_DATES_INVALID'});
 const {scope,kpis}=validateContract(input.inventoryScope,input.kpiContract),id=uid('pilot'),now=new Date().toISOString(),p={id,sellerId:account.sellerId,name:String(input.name||'Dealer pilot').slice(0,160),status:'DRAFT',startsAt:iso(start),endsAt:iso(end),baseline:null,inventoryScope:scope,kpiContract:kpis,contractFrozenAt:null,contractDigest:null,createdAt:now,updatedAt:now,events:[],evidence:[]};
 if(db.kind==='POSTGRES')await db.pool.query('INSERT INTO dealer_pilot_engagements(id,seller_id,name,status,starts_at,ends_at,inventory_scope,kpi_contract,created_by_account_id,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)',[id,p.sellerId,p.name,p.status,p.startsAt,p.endsAt,scope,kpis,account.id,now]);else mem.set(id,p);
 await event(p,account,'CREATED',String(input.clientActionId||'create:'+id),{name:p.name,startsAt:p.startsAt,endsAt:p.endsAt,inventoryScope:scope,kpiContract:kpis});return getRaw(account,id)
}
export async function listDealerPilots(account){ensureSeller(account);if(db.kind==='POSTGRES'){const q=await db.pool.query('SELECT * FROM dealer_pilot_engagements WHERE seller_id=$1 ORDER BY starts_at DESC,id DESC',[account.sellerId]);return q.rows.map(row)}return[...mem.values()].filter(x=>x.sellerId===account.sellerId).map(structuredClone)}
export async function freezeDealerPilot(account,id,{clientActionId}={}){
 const p=await getRaw(account,id);if(!p)throw Object.assign(new Error('Pilot not found'),{status:404,code:'PILOT_NOT_FOUND'});if(p.status!=='DRAFT'||p.contractFrozenAt)return p;
 const proof=await pilotCommercialProofFor(account,{pilotStartAt:p.startsAt,nowMs:Date.parse(p.startsAt)}),baseline=proof.comparison?.baseline||null,frozenAt=new Date().toISOString(),contract={pilotId:p.id,sellerId:p.sellerId,startsAt:p.startsAt,endsAt:p.endsAt,inventoryScope:p.inventoryScope,kpiContract:p.kpiContract,baseline},d=digest(contract);
 if(db.kind==='POSTGRES')await db.pool.query('UPDATE dealer_pilot_engagements SET baseline=$1,contract_frozen_at=$2,contract_digest=$3,updated_at=$2 WHERE id=$4 AND seller_id=$5 AND contract_frozen_at IS NULL',[baseline,frozenAt,d,p.id,p.sellerId]);else Object.assign(mem.get(id),{baseline,contractFrozenAt:frozenAt,contractDigest:d,updatedAt:frozenAt});
 const fresh=await getRaw(account,id);await event(fresh,account,'CONTRACT_FROZEN',String(clientActionId||'freeze:'+id),{contractDigest:d});return getRaw(account,id)
}
export async function activateDealerPilot(account,id,{clientActionId}={}){
 const p=await getRaw(account,id);if(!p)throw Object.assign(new Error('Pilot not found'),{status:404,code:'PILOT_NOT_FOUND'});if(!p.contractFrozenAt)throw Object.assign(new Error('Freeze contract first'),{status:409,code:'PILOT_NOT_FROZEN'});if(p.status==='ACTIVE')return p;if(p.status!=='DRAFT')throw Object.assign(new Error('Pilot cannot activate'),{status:409,code:'PILOT_STATE_INVALID'});
 const now=new Date().toISOString();if(db.kind==='POSTGRES')await db.pool.query("UPDATE dealer_pilot_engagements SET status='ACTIVE',updated_at=$1 WHERE id=$2 AND seller_id=$3",[now,id,p.sellerId]);else Object.assign(mem.get(id),{status:'ACTIVE',updatedAt:now});
 const fresh=await getRaw(account,id);await event(fresh,account,'ACTIVATED',String(clientActionId||'activate:'+id),{});return getRaw(account,id)
}
export async function addPilotCheckpoint(account,id,{label,clientActionId}={}){
 const p=await getRaw(account,id);if(!p)throw Object.assign(new Error('Pilot not found'),{status:404,code:'PILOT_NOT_FOUND'});if(p.status!=='ACTIVE')throw Object.assign(new Error('Active pilot required'),{status:409,code:'PILOT_NOT_ACTIVE'});
 const proof=await pilotCommercialProofFor(account,{pilotStartAt:p.startsAt}),snapshot={label:String(label||'Weekly checkpoint').slice(0,120),proof};await event(p,account,'CHECKPOINT_SIGNED',String(clientActionId||uid('checkpoint')),snapshot);return snapshot
}
export async function addPilotEvidence(account,id,input={}){
 const p=await getRaw(account,id);if(!p)throw Object.assign(new Error('Pilot not found'),{status:404,code:'PILOT_NOT_FOUND'});if(!['DRAFT','ACTIVE'].includes(p.status))throw Object.assign(new Error('Pilot closed'),{status:409,code:'PILOT_CLOSED'});
 const type=String(input.evidenceType||'NOTE').toUpperCase();if(!['URL','DOCUMENT_REF','NOTE','METRIC_SNAPSHOT'].includes(type))throw Object.assign(new Error('Invalid evidence type'),{status:400,code:'PILOT_EVIDENCE_TYPE_INVALID'});
 const ref=String(input.reference||'').trim();if(!ref)throw Object.assign(new Error('reference required'),{status:400,code:'PILOT_EVIDENCE_REFERENCE_REQUIRED'});const e={id:uid('pev'),pilotId:id,checkpointLabel:String(input.checkpointLabel||'').slice(0,120)||null,evidenceType:type,reference:ref,sha256:input.sha256?String(input.sha256):null,metadata:input.metadata||{},createdAt:new Date().toISOString()};
 if(db.kind==='POSTGRES')await db.pool.query('INSERT INTO dealer_pilot_evidence(id,pilot_id,checkpoint_label,evidence_type,reference,sha256,metadata,added_by_account_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[e.id,id,e.checkpointLabel,type,ref,e.sha256,e.metadata,account.id,e.createdAt]);else mem.get(id).evidence.push(e);
 await event(p,account,'EVIDENCE_ATTACHED',String(input.clientActionId||'evidence:'+e.id),{evidenceId:e.id,evidenceType:type,sha256:e.sha256});return e
}
export async function acknowledgeDealerPilot(account,id,{statement='ACKNOWLEDGED',clientActionId}={}){
 const p=await getRaw(account,id);if(!p)throw Object.assign(new Error('Pilot not found'),{status:404,code:'PILOT_NOT_FOUND'});if(p.status!=='ACTIVE')throw Object.assign(new Error('Active pilot required'),{status:409,code:'PILOT_NOT_ACTIVE'});
 return event(p,account,'DEALER_ACKNOWLEDGED',String(clientActionId||uid('ack')),{statement:String(statement).slice(0,500)})
}
export async function finalDealerPilotPack(account,id,{clientActionId}={}){
 const p=await getRaw(account,id);if(!p)throw Object.assign(new Error('Pilot not found'),{status:404,code:'PILOT_NOT_FOUND'});if(p.status!=='ACTIVE')throw Object.assign(new Error('Active pilot required'),{status:409,code:'PILOT_NOT_ACTIVE'});
 const proof=await pilotCommercialProofFor(account,{pilotStartAt:p.startsAt});
 let events=[],evidence=[];if(db.kind==='POSTGRES'){events=(await db.pool.query('SELECT event_type,payload,digest,signature,created_at FROM dealer_pilot_events WHERE pilot_id=$1 ORDER BY created_at,id',[id])).rows;evidence=(await db.pool.query('SELECT id,checkpoint_label,evidence_type,reference,sha256,metadata,created_at FROM dealer_pilot_evidence WHERE pilot_id=$1 ORDER BY created_at,id',[id])).rows}else{events=mem.get(id).events||[];evidence=mem.get(id).evidence||[]}
 const pack={contractVersion:'v37',pilot:p,proof,events,evidence,generatedAt:new Date().toISOString()},packDigest=digest(pack),packSignature=signature(pack);
 await event(p,account,'FINAL_PACK_SIGNED',String(clientActionId||uid('final')),{packDigest,packSignature});
 const now=new Date().toISOString();if(db.kind==='POSTGRES')await db.pool.query("UPDATE dealer_pilot_engagements SET status='COMPLETED',updated_at=$1 WHERE id=$2 AND seller_id=$3",[now,id,p.sellerId]);else Object.assign(mem.get(id),{status:'COMPLETED',updatedAt:now});
 await event({...p,status:'COMPLETED'},account,'COMPLETED','complete:'+packDigest,{packDigest});
 return{...pack,integrity:{digestAlgorithm:'SHA256',digest:packDigest,signatureAlgorithm:'HMAC_SHA256',signature:packSignature,canonicalization:'SORTED_JSON_KEYS_V1'}}
}
export async function dealerPilotDetail(account,id){const pilot=await getRaw(account,id);if(!pilot)return null;let events=[],evidence=[];if(db.kind==='POSTGRES'){events=(await db.pool.query('SELECT id,event_type,actor_account_id,source_key,payload,digest,signature,created_at FROM dealer_pilot_events WHERE pilot_id=$1 ORDER BY created_at,id',[id])).rows;evidence=(await db.pool.query('SELECT id,checkpoint_label,evidence_type,reference,sha256,metadata,created_at FROM dealer_pilot_evidence WHERE pilot_id=$1 ORDER BY created_at,id',[id])).rows}else{events=mem.get(id).events||[];evidence=mem.get(id).evidence||[]}return{pilot,events,evidence}}
