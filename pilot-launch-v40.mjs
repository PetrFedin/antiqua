import crypto from 'node:crypto';
import {db} from './runtime-v09.mjs';
import {dealerPilotDetail} from './dealer-pilot-authority-v37.mjs';
import {governanceStatus,schemaProof} from './pilot-governance-v39.mjs';
const seller=a=>{if(!a?.sellerId)throw Object.assign(new Error('Seller account required'),{status:403,code:'SELLER_REQUIRED'})};
export function pilotLaunchCapabilities(){return{contractVersion:'v40',createsNewEvidenceAuthority:false,usesAuthorities:['v37','v38','v39'],readinessGate:true,invitationDeliveryTracking:true,weeklyCadence:true,launchIsExplicit:true}}
async function context(account,pilotId){seller(account);const d=await dealerPilotDetail(account,pilotId);if(!d)throw Object.assign(new Error('Pilot not found'),{status:404,code:'PILOT_NOT_FOUND'});const g=await governanceStatus(account,pilotId);return{d,g}}
export async function launchReadiness(account,pilotId){
 const {d,g}=await context(account,pilotId),schema=await schemaProof();let representatives=[];
 if(db.kind==='POSTGRES')representatives=(await db.pool.query("SELECT id,email,display_name,role_label,status,expires_at,accepted_at FROM dealer_pilot_counterparties WHERE pilot_id=$1 AND status<>'REVOKED' ORDER BY created_at,id",[pilotId])).rows;
 const checks=[
  {code:'SCHEMA',ok:schema.ready,detail:schema.missing||[]},
  {code:'CONTRACT_FROZEN',ok:!!d.pilot.contractFrozenAt,detail:d.pilot.contractDigest||null},
  {code:'INVENTORY_SCOPE',ok:(d.pilot.inventoryScope||[]).length>0,detail:(d.pilot.inventoryScope||[]).length},
  {code:'KPI_CONTRACT',ok:(d.pilot.kpiContract||[]).length>0,detail:(d.pilot.kpiContract||[]).length},
  {code:'REPRESENTATIVES',ok:representatives.length>=Number(g.governance?.quorumRequired||1),detail:{count:representatives.length,required:Number(g.governance?.quorumRequired||1)}},
  {code:'INVITATIONS_VALID',ok:representatives.length>0&&representatives.every(x=>x.status==='ACCEPTED'||Date.parse(x.expires_at)>Date.now()),detail:representatives.map(x=>({id:x.id,status:x.status,expiresAt:x.expires_at}))},
  {code:'CONTRACT_ACCEPTANCE',ok:new Set((g.reviews||[]).filter(x=>x.review_type==='CONTRACT_ACCEPTED').map(x=>x.counterparty_id)).size>=Number(g.governance?.quorumRequired||1),detail:{accepted:new Set((g.reviews||[]).filter(x=>x.review_type==='CONTRACT_ACCEPTED').map(x=>x.counterparty_id)).size,required:Number(g.governance?.quorumRequired||1)}}
 ];return{pilotId,ready:checks.every(x=>x.ok),checks,representatives,governance:g.governance}
}
export async function recordInvitationDelivery(account,pilotId,input={}){
 await context(account,pilotId);const counterpartyId=String(input.counterpartyId||''),channel=String(input.channel||'EMAIL').toUpperCase(),status=String(input.status||'SENT').toUpperCase();if(!counterpartyId)throw Object.assign(new Error('counterpartyId required'),{status:400,code:'COUNTERPARTY_REQUIRED'});
 if(db.kind!=='POSTGRES')return{pilotId,counterpartyId,channel,status,preview:true};
 const cp=(await db.pool.query('SELECT id FROM dealer_pilot_counterparties WHERE id=$1 AND pilot_id=$2',[counterpartyId,pilotId])).rows[0];if(!cp)throw Object.assign(new Error('Counterparty not found'),{status:404,code:'COUNTERPARTY_NOT_FOUND'});
 const key=counterpartyId,entry={channel,status,providerMessageId:input.providerMessageId?String(input.providerMessageId):null,recordedAt:new Date().toISOString()};
 const q=await db.pool.query(`INSERT INTO dealer_pilot_operations(pilot_id,invitation_delivery) VALUES($1,jsonb_build_object($2,$3::jsonb)) ON CONFLICT(pilot_id) DO UPDATE SET invitation_delivery=dealer_pilot_operations.invitation_delivery||jsonb_build_object($2,$3::jsonb),updated_at=now() RETURNING invitation_delivery`,[pilotId,key,JSON.stringify(entry)]);return{pilotId,counterpartyId,...entry,delivery:q.rows[0].invitation_delivery}
}
export async function configureWeeklyCadence(account,pilotId,input={}){
 const {d}=await context(account,pilotId),weekday=Math.max(0,Math.min(6,Number(input.weekday)??1)),hourUtc=Math.max(0,Math.min(23,Number(input.hourUtc)??12)),weeks=Math.max(1,Math.min(26,Number(input.weeks)||Math.ceil((Date.parse(d.pilot.endsAt)-Date.parse(d.pilot.startsAt))/604800000)));
 const cadence={weekday,hourUtc,weeks,timeZone:String(input.timeZone||'UTC'),configuredAt:new Date().toISOString()};
 if(db.kind!=='POSTGRES')return{pilotId,cadence,preview:true};
 await db.pool.query(`INSERT INTO dealer_pilot_operations(pilot_id,weekly_cadence) VALUES($1,$2) ON CONFLICT(pilot_id) DO UPDATE SET weekly_cadence=EXCLUDED.weekly_cadence,updated_at=now()`,[pilotId,cadence]);
 const start=new Date(d.pilot.startsAt);for(let i=1;i<=weeks;i++){const x=new Date(start.getTime()+(i-1)*604800000),delta=(weekday-x.getUTCDay()+7)%7;x.setUTCDate(x.getUTCDate()+delta);x.setUTCHours(hourUtc,0,0,0);await db.pool.query(`INSERT INTO dealer_pilot_operating_reviews(id,pilot_id,week_number,scheduled_at) VALUES($1,$2,$3,$4) ON CONFLICT(pilot_id,week_number) DO UPDATE SET scheduled_at=EXCLUDED.scheduled_at,updated_at=now()`,['por_'+crypto.randomUUID(),pilotId,i,x.toISOString()])}
 return{pilotId,cadence}
}
export async function launchPilot(account,pilotId){
 const r=await launchReadiness(account,pilotId);if(!r.ready)throw Object.assign(new Error('Pilot is not ready to launch'),{status:409,code:'PILOT_NOT_READY',readiness:r});
 if(db.kind!=='POSTGRES')return{pilotId,status:'LAUNCHED',preview:true};const now=new Date().toISOString();
 const q=await db.pool.query(`INSERT INTO dealer_pilot_operations(pilot_id,launch_status,launched_at,launched_by_account_id) VALUES($1,'LAUNCHED',$2,$3) ON CONFLICT(pilot_id) DO UPDATE SET launch_status='LAUNCHED',launched_at=COALESCE(dealer_pilot_operations.launched_at,EXCLUDED.launched_at),launched_by_account_id=COALESCE(dealer_pilot_operations.launched_by_account_id,EXCLUDED.launched_by_account_id),updated_at=now() RETURNING *`,[pilotId,now,account.id]);return q.rows[0]
}
export async function pilotOperatingBoard(account,pilotId){
 const readiness=await launchReadiness(account,pilotId);if(db.kind!=='POSTGRES')return{readiness,operation:null,reviews:[]};const operation=(await db.pool.query('SELECT * FROM dealer_pilot_operations WHERE pilot_id=$1',[pilotId])).rows[0]||null,reviews=(await db.pool.query('SELECT * FROM dealer_pilot_operating_reviews WHERE pilot_id=$1 ORDER BY week_number',[pilotId])).rows;return{readiness,operation,reviews}
}
