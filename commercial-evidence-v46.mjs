import crypto from 'node:crypto';
import {db,uid,requirePermission} from './runtime-v09.mjs';
import {appSecret} from './security-v09.mjs';

const TYPES=new Set([
 'QUOTE_ISSUED','PRICE_VERBAL_ACCEPTED','PRICE_WRITTEN_ACCEPTED','INVOICE_ISSUED',
 'PAYMENT_RECEIVED','REFUND_RECORDED','DIRECT_COST_RECORDED',
 'RENEWAL_PROPOSED','RENEWAL_ACCEPTED','RENEWAL_REJECTED','EXPANSION_ACCEPTED',
 'COMMERCIAL_EVENT_VOIDED'
]);
const STREAMS=new Set(['PROFESSIONAL_SAAS','PARTNER_EDITION','CULTURAL_PARTNERSHIP','INSTITUTIONAL_RESEARCH','TRANSACTION_REVENUE','ESTATE_ARCHIVE']);
const MONEY_TYPES=new Set(['QUOTE_ISSUED','PRICE_VERBAL_ACCEPTED','PRICE_WRITTEN_ACCEPTED','INVOICE_ISSUED','PAYMENT_RECEIVED','REFUND_RECORDED','DIRECT_COST_RECORDED','RENEWAL_PROPOSED','RENEWAL_ACCEPTED','EXPANSION_ACCEPTED']);
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const digest=v=>crypto.createHash('sha256').update(canonical(v)).digest('hex');
const sign=v=>'v1='+crypto.createHmac('sha256',appSecret()).update(canonical(v)).digest('hex');
const iso=v=>new Date(v).toISOString();
const moneyKey=e=>e.currency||'UNSPECIFIED';

export function commercialEvidenceCapabilities(){return{
 contractVersion:'v46',
 durableWritesOnly:true,
 appendOnly:true,
 operatorControlledWrites:true,
 sellerReadOwnPilot:true,
 idempotentByPilotSourceKey:true,
 signedEvents:true,
 eventTypes:[...TYPES],
 revenueStreams:[...STREAMS],
 evidenceLevels:['INTERNAL_HYPOTHESIS','VERBAL_ACCEPTANCE','WRITTEN_ACCEPTANCE','INVOICED','VERIFIED_CASH','RENEWAL','REPEATABLE'],
 accountingBoundary:{
  quoteIsRevenue:false,
  writtenAcceptanceIsRevenue:false,
  invoiceIsCash:false,
  paymentReceivedIsCash:true,
  refundReducesCash:true,
  directCostReducesGrossContribution:true
 }
}}

async function pilotRow(id){
 if(db.kind!=='POSTGRES')return null;
 return (await db.pool.query('SELECT id,seller_id,name,status,starts_at,ends_at FROM dealer_pilot_engagements WHERE id=$1',[String(id)])).rows[0]||null
}
const ensureOperator=a=>requirePermission(a,'audit.read');
const ensureSeller=a=>{if(!a?.sellerId)throw Object.assign(new Error('Seller account required'),{status:403,code:'SELLER_REQUIRED'});requirePermission(a,'seller.analytics.read')};

function validateEvent(input={}){
 const eventType=String(input.eventType||'').toUpperCase();
 if(!TYPES.has(eventType))throw Object.assign(new Error('Invalid commercial event type'),{status:400,code:'COMMERCIAL_EVENT_TYPE_INVALID'});
 const revenueStream=input.revenueStream==null?null:String(input.revenueStream).toUpperCase();
 if(revenueStream&&!STREAMS.has(revenueStream))throw Object.assign(new Error('Invalid revenue stream'),{status:400,code:'REVENUE_STREAM_INVALID'});
 let amountMinor=input.amountMinor==null?null:Number(input.amountMinor);
 if(amountMinor!=null&&(!Number.isSafeInteger(amountMinor)||amountMinor<0))throw Object.assign(new Error('amountMinor must be a non-negative integer'),{status:400,code:'AMOUNT_MINOR_INVALID'});
 let currency=input.currency==null?null:String(input.currency).toUpperCase();
 if(currency&&!/^[A-Z]{3}$/.test(currency))throw Object.assign(new Error('currency must be ISO-4217 style'),{status:400,code:'CURRENCY_INVALID'});
 if(MONEY_TYPES.has(eventType)&&(amountMinor==null||!currency))throw Object.assign(new Error('amountMinor and currency required'),{status:400,code:'COMMERCIAL_MONEY_REQUIRED'});
 const evidenceRef=String(input.evidenceRef||'').trim()||null;
 if(['PRICE_WRITTEN_ACCEPTED','INVOICE_ISSUED','PAYMENT_RECEIVED','REFUND_RECORDED','RENEWAL_ACCEPTED','EXPANSION_ACCEPTED'].includes(eventType)&&!evidenceRef)
  throw Object.assign(new Error('evidenceRef required for this event type'),{status:400,code:'COMMERCIAL_EVIDENCE_REQUIRED'});
 const occurredAt=iso(input.occurredAt||new Date());
 const sourceKey=String(input.clientActionId||input.sourceKey||'').trim();
 if(!sourceKey)throw Object.assign(new Error('clientActionId required'),{status:400,code:'IDEMPOTENCY_KEY_REQUIRED'});
 return{eventType,revenueStream,amountMinor,currency,evidenceRef,occurredAt,sourceKey,payload:input.payload&&typeof input.payload==='object'?input.payload:{}}
}

export async function recordCommercialEvent(account,pilotId,input={}){
 ensureOperator(account);
 if(db.kind!=='POSTGRES')throw Object.assign(new Error('Durable PostgreSQL required for commercial evidence'),{status:503,code:'COMMERCIAL_EVIDENCE_DURABILITY_REQUIRED'});
 const pilot=await pilotRow(pilotId);if(!pilot)throw Object.assign(new Error('Pilot not found'),{status:404,code:'PILOT_NOT_FOUND'});
 const x=validateEvent(input),body={pilotId:pilot.id,sellerId:pilot.seller_id,eventType:x.eventType,revenueStream:x.revenueStream,amountMinor:x.amountMinor,currency:x.currency,evidenceRef:x.evidenceRef,sourceKey:x.sourceKey,payload:x.payload,occurredAt:x.occurredAt},dg=digest(body),sig=sign(body),id=uid('pce');
 const q=await db.pool.query(`INSERT INTO dealer_pilot_commercial_events(id,pilot_id,seller_id,event_type,revenue_stream,amount_minor,currency,evidence_ref,source_key,payload,digest,signature,occurred_at,created_by_account_id)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
 ON CONFLICT(pilot_id,source_key) DO NOTHING RETURNING *`,
 [id,pilot.id,pilot.seller_id,x.eventType,x.revenueStream,x.amountMinor,x.currency,x.evidenceRef,x.sourceKey,x.payload,dg,sig,x.occurredAt,account.id]);
 if(q.rows[0])return mapEvent(q.rows[0]);
 const existing=(await db.pool.query('SELECT * FROM dealer_pilot_commercial_events WHERE pilot_id=$1 AND source_key=$2',[pilot.id,x.sourceKey])).rows[0];
 return mapEvent(existing)
}

function mapEvent(r){return r?{
 id:r.id,pilotId:r.pilot_id,sellerId:r.seller_id,eventType:r.event_type,revenueStream:r.revenue_stream||null,
 amountMinor:r.amount_minor==null?null:Number(r.amount_minor),currency:r.currency||null,evidenceRef:r.evidence_ref||null,
 sourceKey:r.source_key,payload:r.payload||{},digest:r.digest,signature:r.signature,occurredAt:iso(r.occurred_at),createdAt:iso(r.created_at)
}:null}

async function eventsFor(pilotId){
 if(db.kind!=='POSTGRES')return[];
 return (await db.pool.query('SELECT * FROM dealer_pilot_commercial_events WHERE pilot_id=$1 ORDER BY occurred_at,id',[String(pilotId)])).rows.map(mapEvent)
}
function notVoided(events){
 const voided=new Set(events.filter(e=>e.eventType==='COMMERCIAL_EVENT_VOIDED').map(e=>String(e.payload?.voidsEventId||'')).filter(Boolean));
 return events.filter(e=>e.eventType!=='COMMERCIAL_EVENT_VOIDED'&&!voided.has(e.id))
}
function addMoney(map,e,signum=1){if(e.amountMinor==null)return;const k=moneyKey(e);map[k]=(map[k]||0)+signum*e.amountMinor}
function countsBy(events,field){const out={};for(const e of events){const k=e[field]||'UNSPECIFIED';out[k]=(out[k]||0)+1}return out}

function pricingEvidence(events){
 const active=notVoided(events),quotes=active.filter(e=>e.eventType==='QUOTE_ISSUED'&&e.amountMinor!=null),accepted=active.filter(e=>['PRICE_WRITTEN_ACCEPTED','RENEWAL_ACCEPTED','EXPANSION_ACCEPTED'].includes(e.eventType)&&e.amountMinor!=null),paid=active.filter(e=>e.eventType==='PAYMENT_RECEIVED'&&e.amountMinor!=null),renewed=active.filter(e=>['RENEWAL_ACCEPTED','EXPANSION_ACCEPTED'].includes(e.eventType));
 const latestQuote=quotes.at(-1)||null,latestAccepted=accepted.at(-1)||null;
 const realizedPriceRatio=latestQuote&&latestAccepted&&latestQuote.currency===latestAccepted.currency&&latestQuote.amountMinor>0?Number((latestAccepted.amountMinor/latestQuote.amountMinor).toFixed(4)):null;
 const discountRate=realizedPriceRatio==null?null:Number((1-realizedPriceRatio).toFixed(4));
 const confidence=renewed.length?'HIGH':paid.length?'MEDIUM':accepted.length?'LOW':'UNPROVEN';
 return{confidence,latestQuotedMinor:latestQuote?.amountMinor??null,latestAcceptedMinor:latestAccepted?.amountMinor??null,currency:latestAccepted?.currency||latestQuote?.currency||null,realizedPriceRatio,discountRate,boundary:'Price confidence is evidence maturity, not a forecast of future pricing.'}
}

function evidenceLevel(events){
 const types=new Set(events.map(e=>e.eventType));
 if(types.has('RENEWAL_ACCEPTED')||types.has('EXPANSION_ACCEPTED'))return'RENEWAL';
 if(types.has('PAYMENT_RECEIVED'))return'VERIFIED_CASH';
 if(types.has('INVOICE_ISSUED'))return'INVOICED';
 if(types.has('PRICE_WRITTEN_ACCEPTED'))return'WRITTEN_ACCEPTANCE';
 if(types.has('PRICE_VERBAL_ACCEPTED'))return'VERBAL_ACCEPTANCE';
 return'INTERNAL_HYPOTHESIS'
}
export function summarizeCommercialEvents(events=[]){
 const active=notVoided(events),quoted={},accepted={},invoiced={},cash={},refunds={},costs={},grossContribution={};
 for(const e of active){
  if(e.eventType==='QUOTE_ISSUED')addMoney(quoted,e);
  if(['PRICE_WRITTEN_ACCEPTED','RENEWAL_ACCEPTED','EXPANSION_ACCEPTED'].includes(e.eventType))addMoney(accepted,e);
  if(e.eventType==='INVOICE_ISSUED')addMoney(invoiced,e);
  if(e.eventType==='PAYMENT_RECEIVED')addMoney(cash,e);
  if(e.eventType==='REFUND_RECORDED')addMoney(refunds,e);
  if(e.eventType==='DIRECT_COST_RECORDED')addMoney(costs,e)
 }
 for(const c of new Set([...Object.keys(cash),...Object.keys(refunds),...Object.keys(costs)]))grossContribution[c]=(cash[c]||0)-(refunds[c]||0)-(costs[c]||0);
 const renewals=active.filter(e=>['RENEWAL_ACCEPTED','EXPANSION_ACCEPTED'].includes(e.eventType));
 return{
  evidenceLevel:evidenceLevel(active),
  pricingEvidence:pricingEvidence(active),
  eventCount:active.length,
  quotedMinorByCurrency:quoted,
  acceptedMinorByCurrency:accepted,
  invoicedMinorByCurrency:invoiced,
  cashReceivedMinorByCurrency:cash,
  refundsMinorByCurrency:refunds,
  directCostMinorByCurrency:costs,
  grossContributionMinorByCurrency:grossContribution,
  renewalAccepted:renewals.some(e=>e.eventType==='RENEWAL_ACCEPTED'),
  expansionAccepted:renewals.some(e=>e.eventType==='EXPANSION_ACCEPTED'),
  eventCounts:countsBy(active,'eventType'),
  streamCounts:countsBy(active,'revenueStream'),
  boundaries:commercialEvidenceCapabilities().accountingBoundary
 }
}

async function summaryForPilotInternal(pilotId){
 const pilot=await pilotRow(pilotId);if(!pilot)return null;const events=await eventsFor(pilotId);
 return{pilot:{id:pilot.id,sellerId:pilot.seller_id,name:pilot.name,status:pilot.status,startsAt:iso(pilot.starts_at),endsAt:iso(pilot.ends_at)},summary:summarizeCommercialEvents(events),events}
}
export async function sellerCommercialSummary(account,pilotId){
 ensureSeller(account);const x=await summaryForPilotInternal(pilotId);if(!x||x.pilot.sellerId!==account.sellerId)return null;return x
}
export async function operatorCommercialSummary(account,pilotId){
 ensureOperator(account);return summaryForPilotInternal(pilotId)
}
export async function investorCommercialAggregate(account){
 ensureOperator(account);
 if(db.kind!=='POSTGRES')return{persistence:'MEMORY_FALLBACK',pilots:0,paidPilots:0,cashReceivedMinorByCurrency:{},grossContributionMinorByCurrency:{},renewedPilots:0,evidenceState:'MISSING'};
 const pilots=(await db.pool.query('SELECT id,status FROM dealer_pilot_engagements ORDER BY starts_at,id')).rows,aggregate={pilots:pilots.length,activePilots:pilots.filter(p=>p.status==='ACTIVE').length,completedPilots:pilots.filter(p=>p.status==='COMPLETED').length,paidPilots:0,cashReceivedMinorByCurrency:{},grossContributionMinorByCurrency:{},renewedPilots:0,pricingConfidence:{HIGH:0,MEDIUM:0,LOW:0,UNPROVEN:0}};
 for(const p of pilots){const s=summarizeCommercialEvents(await eventsFor(p.id));aggregate.pricingConfidence[s.pricingEvidence.confidence]=(aggregate.pricingConfidence[s.pricingEvidence.confidence]||0)+1;if(Object.values(s.cashReceivedMinorByCurrency).some(v=>v>0))aggregate.paidPilots++;if(s.renewalAccepted||s.expansionAccepted)aggregate.renewedPilots++;for(const [c,v] of Object.entries(s.cashReceivedMinorByCurrency))aggregate.cashReceivedMinorByCurrency[c]=(aggregate.cashReceivedMinorByCurrency[c]||0)+v;for(const [c,v] of Object.entries(s.grossContributionMinorByCurrency))aggregate.grossContributionMinorByCurrency[c]=(aggregate.grossContributionMinorByCurrency[c]||0)+v}
 return{persistence:'POSTGRES',...aggregate,evidenceState:aggregate.paidPilots>0?'VERIFIED_CASH':'MISSING',accountingBoundary:commercialEvidenceCapabilities().accountingBoundary}
}
