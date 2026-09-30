import crypto from 'node:crypto';
import {appSecret} from './security-v09.mjs';
import {dealerLeadCockpit} from './dealer-leads-v24.mjs';
import {dealerPerformanceFor} from './dealer-performance-v34.mjs';

const DAY=86400000;
const WINDOWS=[7,30,90];
const ACTIVE=new Set(['NEW_LEAD','UNANSWERED','REPLIED','VIEWING','NEGOTIATING']);
const COMMERCIAL_STAGES=new Set(['VIEWING','NEGOTIATING','WON']);
const ms=v=>{const n=Date.parse(v||'');return Number.isFinite(n)?n:null};
const ratio=(n,d)=>d?Number((n/d).toFixed(4)):null;
const median=xs=>{const s=xs.filter(Number.isFinite).sort((a,b)=>a-b);if(!s.length)return null;const m=Math.floor(s.length/2);return s.length%2?s[m]:Math.round((s[m-1]+s[m])/2)};
const pctDelta=(a,b)=>a==null||b==null||b===0?null:Number(((a-b)/Math.abs(b)).toFixed(4));
const canonical=v=>{
 if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
 if(v&&typeof v==='object'){return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}'}
 return JSON.stringify(v)
};
const sign=v=>crypto.createHmac('sha256',appSecret()).update(canonical(v)).digest('hex');

function cohort(leads,from,to){
 const xs=leads.filter(l=>{const t=ms(l.firstBuyerActivityAt||l.createdAt);return t!=null&&t>=from&&t<to});
 const responded=xs.filter(l=>l.firstDealerResponseAt),won=xs.filter(l=>l.stage==='WON'),lost=xs.filter(l=>l.stage==='LOST');
 return{
  from:new Date(from).toISOString(),to:new Date(to).toISOString(),leads:xs.length,
  responded:responded.length,responseCoverage:ratio(responded.length,xs.length),
  medianResponseMinutes:median(responded.map(l=>Number(l.responseMinutes))),
  overdue:xs.filter(l=>l.responseStatus==='OVERDUE').length,
  viewingOrHigher:xs.filter(l=>COMMERCIAL_STAGES.has(l.stage)).length,
  negotiatingOrWon:xs.filter(l=>['NEGOTIATING','WON'].includes(l.stage)).length,
  won:won.length,lost:lost.length,closedOutcomeRate:ratio(won.length,won.length+lost.length),
  activeAtSnapshot:xs.filter(l=>ACTIVE.has(l.stage)).length
 }
}

function uplift(pilot,baseline){
 return{
  responseCoverageDelta:pilot.responseCoverage==null||baseline.responseCoverage==null?null:Number((pilot.responseCoverage-baseline.responseCoverage).toFixed(4)),
  medianResponseMinutesDelta:pilot.medianResponseMinutes==null||baseline.medianResponseMinutes==null?null:pilot.medianResponseMinutes-baseline.medianResponseMinutes,
  medianResponseMinutesImprovementPct:pctDelta(baseline.medianResponseMinutes,pilot.medianResponseMinutes),
  overdueDelta:pilot.overdue-baseline.overdue,
  viewingOrHigherDelta:pilot.viewingOrHigher-baseline.viewingOrHigher,
  negotiatingOrWonDelta:pilot.negotiatingOrWon-baseline.negotiatingOrWon,
  wonDelta:pilot.won-baseline.won,
  closedOutcomeRateDelta:pilot.closedOutcomeRate==null||baseline.closedOutcomeRate==null?null:Number((pilot.closedOutcomeRate-baseline.closedOutcomeRate).toFixed(4))
 }
}

function objectPerformance(performance){
 const outcomes=performance?.objectOutcomes||[],attr=performance?.attribution?.rows||[];
 const byObject=new Map();
 for(const o of outcomes)byObject.set(o.objectId,{objectId:o.objectId,stage:o.stage,commercialIntent:Boolean(o.commercialIntent),transacting:Boolean(o.transacting),evidenceRows:0});
 for(const a of attr){const row=byObject.get(a.objectId)||{objectId:a.objectId,stage:null,commercialIntent:false,transacting:false,evidenceRows:0};row.evidenceRows++;byObject.set(a.objectId,row)}
 const rows=[...byObject.values()];
 return{
  inventoryObjects:rows.length,
  withCommercialIntent:rows.filter(x=>x.commercialIntent).length,
  transacting:rows.filter(x=>x.transacting).length,
  withPriorExposureEvidence:rows.filter(x=>x.evidenceRows>0).length,
  rows:rows.sort((a,b)=>Number(b.transacting)-Number(a.transacting)||Number(b.commercialIntent)-Number(a.commercialIntent)||b.evidenceRows-a.evidenceRows||String(a.objectId).localeCompare(String(b.objectId)))
 }
}

function outcomeLedger(leads){
 return leads.map(l=>({
  leadId:l.id,objectId:l.objectId||null,stage:l.stage,
  firstBuyerActivityAt:l.firstBuyerActivityAt||l.createdAt||null,
  firstDealerResponseAt:l.firstDealerResponseAt||null,responseMinutes:l.responseMinutes??null,responseStatus:l.responseStatus||null,
  potentialAmountMinor:l.potentialAmountMinor??null,potentialCurrency:l.potentialCurrency||null,
  nextAction:l.nextAction?.code||null,updatedAt:l.updatedAt||null,
  outcome:l.stage==='WON'?'WON':l.stage==='LOST'?'LOST':'OPEN'
 })).sort((a,b)=>(ms(b.firstBuyerActivityAt)||0)-(ms(a.firstBuyerActivityAt)||0)||String(a.leadId).localeCompare(String(b.leadId)))
}

export function pilotControlCapabilities(){return{
 contractVersion:'v35',projectionOnly:true,baselineComparison:true,windowComparisons:WINDOWS,
 signedSnapshot:{algorithm:'HMAC_SHA256',canonicalization:'SORTED_JSON_KEYS_V1',signaturePrefix:'v1='},
 sourceAuthorities:['DEALER_LEADS_V24','DEALER_PERFORMANCE_V34'],
 causalClaims:false,personLevelAttribution:false,
 note:'Baseline vs pilot compares equal-duration lead cohorts. When pilotStartAt is not explicitly supplied, a technical 30-day comparison window is used and marked as inferred.'
}}

export function buildPilotCommercialProof({account,leads=[],performance,pilotStartAt=null,nowMs=Date.now()}={}){
 if(!account?.sellerId)throw Object.assign(new Error('Seller account required'),{status:403,code:'SELLER_REQUIRED'});
 let start=ms(pilotStartAt),explicit=true;
 if(start==null){start=nowMs-30*DAY;explicit=false}
 if(start>=nowMs)throw Object.assign(new Error('pilotStartAt must be before now'),{status:400,code:'PILOT_START_INVALID'});
 const duration=Math.max(DAY,Math.min(90*DAY,nowMs-start)),baselineFrom=start-duration;
 const baseline=cohort(leads,baselineFrom,start),pilot=cohort(leads,start,nowMs);
 const rolling={};
 for(const d of WINDOWS){
  const current=cohort(leads,nowMs-d*DAY,nowMs),prior=cohort(leads,nowMs-2*d*DAY,nowMs-d*DAY);
  rolling['D'+d]={current,prior,uplift:uplift(current,prior)}
 }
 const inventory=objectPerformance(performance);
 const ledger=outcomeLedger(leads);
 const body={
  contractVersion:'v35',sellerId:account.sellerId,generatedAt:new Date(nowMs).toISOString(),
  comparison:{
   pilotStartAt:new Date(start).toISOString(),pilotStartExplicit:explicit,
   interpretation:explicit?'DECLARED_PILOT_PERIOD':'TECHNICAL_30_DAY_COMPARISON_NOT_DECLARED_PILOT',
   baseline,pilot,uplift:uplift(pilot,baseline)
  },
  rolling,inventory,
  dealerOutcomeLedger:ledger,
  evidenceBoundary:{
   causalClaims:false,personLevelAttribution:false,
   attributionModel:performance?.attribution?.model||'TEMPORAL_OBJECT_LEVEL_EVIDENCE',
   note:'Observed cohort and object outcomes only; changes are not asserted to be caused by Antiqua.'
  }
 };
 const digest=crypto.createHash('sha256').update(canonical(body)).digest('hex');
 const signature='v1='+sign(body);
 return{...body,evidenceSnapshot:{digestAlgorithm:'SHA256',digest,signatureAlgorithm:'HMAC_SHA256',signature,canonicalization:'SORTED_JSON_KEYS_V1'}}
}

export function verifyPilotSnapshot(snapshot){
 if(!snapshot?.evidenceSnapshot?.signature)return false;
 const {evidenceSnapshot,...body}=snapshot;
 const expected='v1='+sign(body),provided=String(evidenceSnapshot.signature);
 if(expected.length!==provided.length)return false;
 return crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(provided))
}

export function pilotCommercialReport(proof){
 const c=proof.comparison,fmt=x=>x==null?'n/a':String(x),u=c.uplift||{};
 return[
  '# Antiqua Pilot Commercial Proof',
  '',
  'Generated: '+proof.generatedAt,
  'Seller: '+proof.sellerId,
  'Pilot period: '+c.pilot.from+' → '+c.pilot.to,
  'Baseline: '+c.baseline.from+' → '+c.baseline.to,
  'Period status: '+c.interpretation,
  '',
  '## Baseline vs pilot',
  '- Leads: '+fmt(c.baseline.leads)+' → '+fmt(c.pilot.leads),
  '- Response coverage: '+fmt(c.baseline.responseCoverage)+' → '+fmt(c.pilot.responseCoverage)+' (Δ '+fmt(u.responseCoverageDelta)+')',
  '- Median response minutes: '+fmt(c.baseline.medianResponseMinutes)+' → '+fmt(c.pilot.medianResponseMinutes)+' (Δ '+fmt(u.medianResponseMinutesDelta)+')',
  '- Viewing or higher: '+fmt(c.baseline.viewingOrHigher)+' → '+fmt(c.pilot.viewingOrHigher),
  '- Negotiating or won: '+fmt(c.baseline.negotiatingOrWon)+' → '+fmt(c.pilot.negotiatingOrWon),
  '- Won: '+fmt(c.baseline.won)+' → '+fmt(c.pilot.won),
  '',
  '## Inventory evidence',
  '- Objects measured: '+fmt(proof.inventory.inventoryObjects),
  '- Commercial intent: '+fmt(proof.inventory.withCommercialIntent),
  '- Transacting: '+fmt(proof.inventory.transacting),
  '- Prior editorial/drop evidence: '+fmt(proof.inventory.withPriorExposureEvidence),
  '',
  '## Evidence integrity',
  '- SHA-256 digest: '+proof.evidenceSnapshot.digest,
  '- HMAC signature: '+proof.evidenceSnapshot.signature,
  '- No causal claim; no passive-viewer → buyer identity join.'
 ].join('\n')
}

export async function pilotCommercialProofFor(account,{pilotStartAt=null,nowMs=Date.now()}={}){
 const [dealerLeads,performance]=await Promise.all([dealerLeadCockpit(account,{nowMs}),dealerPerformanceFor(account,{nowMs})]);
 return buildPilotCommercialProof({account,leads:dealerLeads.leads||[],performance,pilotStartAt,nowMs})
}
