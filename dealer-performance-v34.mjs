import {dealerLeadCockpit} from './dealer-leads-v24.mjs';
import {dealerInterestFor} from './dealer-interest-v32.mjs';
import {listEditorialObjectEvents} from './editorial-commerce-v31.mjs';
import {listExhibitions,getExhibition} from './collection-graph-v10.mjs';

const WINDOWS=[7,30,90];
const ACTIVE=new Set(['NEW_LEAD','UNANSWERED','REPLIED','VIEWING','NEGOTIATING']);
const COMMERCIAL=new Set(['NEW_LEAD','UNANSWERED','REPLIED','VIEWING','NEGOTIATING','WON','LOST']);
const ms=v=>{const n=Date.parse(v||'');return Number.isFinite(n)?n:null};
const ratio=(n,d)=>d?Number((n/d).toFixed(4)):null;
const median=xs=>{const s=xs.filter(Number.isFinite).sort((a,b)=>a-b);if(!s.length)return null;const m=Math.floor(s.length/2);return s.length%2?s[m]:Math.round((s[m-1]+s[m])/2)};
const money=(xs)=>{const out={};for(const x of xs){const c=String(x.potentialCurrency||'').toUpperCase(),v=Number(x.potentialAmountMinor);if(c&&Number.isSafeInteger(v)&&v>=0)out[c]=(out[c]||0)+v}return out};
const objectIdsFromExhibition=e=>[...new Set((e?.sections||[]).flatMap(s=>s.items||[]).map(i=>i.objectId).filter(Boolean))];

export function dealerPerformanceCapabilities(){return{
 contractVersion:'v34',windowsDays:WINDOWS,projectionOnly:true,
 attributionModel:'TEMPORAL_OBJECT_LEVEL_EVIDENCE',
 causalAttribution:false,personLevelAttribution:false,crossSignalIdentityJoin:false,
 sourceAuthorities:['DEALER_LEADS_V24','DEALER_INTEREST_V32','EDITORIAL_EVENTS_V31','EXHIBITIONS_V10'],
 note:'Editorial/drop evidence is associated to the same object before commercial activity. It does not prove causality or that the content viewer became the buyer.'
}}

export function buildDealerPerformanceEvidence({account,leads=[],interestObjects=[],editorialEvents=[],dropExposures=[],nowMs=Date.now()}={}){
 if(!account?.sellerId)throw Object.assign(new Error('Seller account required'),{status:403,code:'SELLER_REQUIRED'});
 const windows={};
 for(const days of WINDOWS){
  const from=nowMs-days*86400000;
  const cohort=leads.filter(l=>{const t=ms(l.firstBuyerActivityAt||l.createdAt);return t!=null&&t>=from&&t<=nowMs});
  const responded=cohort.filter(l=>l.firstDealerResponseAt),won=cohort.filter(l=>l.stage==='WON'),lost=cohort.filter(l=>l.stage==='LOST');
  windows['D'+days]={
   from:new Date(from).toISOString(),to:new Date(nowMs).toISOString(),leadCohort:cohort.length,
   responded:responded.length,responseCoverage:ratio(responded.length,cohort.length),
   medianResponseMinutes:median(responded.map(l=>Number(l.responseMinutes))),
   overdue:cohort.filter(l=>l.responseStatus==='OVERDUE').length,
   viewing:cohort.filter(l=>['VIEWING','NEGOTIATING','WON'].includes(l.stage)).length,
   negotiating:cohort.filter(l=>['NEGOTIATING','WON'].includes(l.stage)).length,
   won:won.length,lost:lost.length,closedOutcomeRate:ratio(won.length,won.length+lost.length),
   activePipelineByCurrency:money(cohort.filter(l=>ACTIVE.has(l.stage)))
  }
 }
 const editorialByObject=new Map();
 for(const e of editorialEvents){const a=editorialByObject.get(e.objectId)||[];a.push(e);editorialByObject.set(e.objectId,a)}
 const dropsByObject=new Map();
 for(const d of dropExposures)for(const objectId of d.objectIds||[]){const a=dropsByObject.get(objectId)||[];a.push(d);dropsByObject.set(objectId,a)}
 const attribution=[];
 for(const l of leads.filter(x=>COMMERCIAL.has(x.stage)&&x.objectId)){
  const commercialAt=ms(l.firstBuyerActivityAt||l.createdAt);if(commercialAt==null)continue;
  const editorial=(editorialByObject.get(l.objectId)||[]).filter(e=>{const t=ms(e.occurredAt);return t!=null&&t<=commercialAt&&commercialAt-t<=90*86400000});
  const drops=(dropsByObject.get(l.objectId)||[]).filter(d=>{const t=ms(d.startedAt);return t!=null&&t<=commercialAt&&commercialAt-t<=90*86400000});
  if(!editorial.length&&!drops.length)continue;
  attribution.push({
   leadId:l.id,objectId:l.objectId,commercialStage:l.stage,commercialAt:new Date(commercialAt).toISOString(),
   evidence:{
    editorial:editorial.map(e=>({storyId:e.storyId,occurredAt:e.occurredAt,daysBefore:Math.floor((commercialAt-ms(e.occurredAt))/86400000)})),
    partnerDrops:drops.map(d=>({exhibitionId:d.exhibitionId,startedAt:d.startedAt,daysBefore:Math.floor((commercialAt-ms(d.startedAt))/86400000)}))
   },
   interpretation:'PRIOR_EXPOSURE_ON_SAME_OBJECT_NOT_CAUSAL'
  })
 }
 const objectOutcomes=interestObjects.map(o=>({objectId:o.objectId,stage:o.stage,commercialIntent:['INQUIRY','VIEWING','NEGOTIATING','TRANSACTING'].includes(o.stage),transacting:o.stage==='TRANSACTING',hasAttributedLead:attribution.some(a=>a.objectId===o.objectId)}));
 return{
  sellerId:account.sellerId,generatedAt:new Date(nowMs).toISOString(),windows,
  dealerPerformance:{currentActiveLeads:leads.filter(l=>ACTIVE.has(l.stage)).length,currentOverdue:leads.filter(l=>l.responseStatus==='OVERDUE').length,allTimeMedianResponseMinutes:median(leads.map(l=>Number(l.responseMinutes)))},
  attribution:{model:'TEMPORAL_OBJECT_LEVEL_EVIDENCE',lookbackDays:90,rows:attribution,objectsWithEvidence:new Set(attribution.map(x=>x.objectId)).size},
  objectOutcomes,
  limitations:['NO_CAUSAL_CLAIM','NO_PERSON_LEVEL_EDITORIAL_TO_BUYER_JOIN','WINDOWS_COHORTED_BY_FIRST_BUYER_ACTIVITY'],
  capabilities:dealerPerformanceCapabilities()
 }
}

export function dealerPerformanceReport(evidence){
 const w=evidence.windows||{},fmt=x=>x==null?'n/a':String(x);
 return [
  '# Antiqua Dealer Pilot Evidence',
  '',
  'Generated: '+evidence.generatedAt,
  'Seller: '+evidence.sellerId,
  '',
  '## Cohort performance',
  ...WINDOWS.map(d=>{const x=w['D'+d]||{};return '- D'+d+': '+fmt(x.leadCohort)+' leads; response '+fmt(x.responseCoverage)+'; median '+fmt(x.medianResponseMinutes)+' min; viewing '+fmt(x.viewing)+'; negotiating '+fmt(x.negotiating)+'; won '+fmt(x.won)}),
  '',
  '## Attribution evidence',
  '- Objects with prior editorial/drop evidence: '+fmt(evidence.attribution?.objectsWithEvidence),
  '- Model: temporal same-object evidence, 90-day lookback.',
  '- This report does not claim causal attribution or identify passive viewers as buyers.',
  '',
  '## Current dealer operations',
  '- Active leads: '+fmt(evidence.dealerPerformance?.currentActiveLeads),
  '- Overdue responses: '+fmt(evidence.dealerPerformance?.currentOverdue),
  '- All-time median response: '+fmt(evidence.dealerPerformance?.allTimeMedianResponseMinutes)+' min'
 ].join('\n')
}

export async function dealerPerformanceFor(account,{nowMs=Date.now()}={}){
 const [dealerLeads,interest,exhibitions]=await Promise.all([dealerLeadCockpit(account,{nowMs}),dealerInterestFor(account),listExhibitions()]);
 const objectIds=(interest.objects||[]).map(x=>x.objectId);
 const editorialEvents=await listEditorialObjectEvents(objectIds);
 const dropExposures=[];
 for(const x of exhibitions){const e=await getExhibition(x.id);if(!e)continue;const ids=objectIdsFromExhibition(e).filter(id=>objectIds.includes(id));if(ids.length)dropExposures.push({exhibitionId:e.id,startedAt:e.startsAt||e.createdAt||null,objectIds:ids})}
 return buildDealerPerformanceEvidence({account,leads:dealerLeads.leads||[],interestObjects:interest.objects||[],editorialEvents,dropExposures,nowMs})
}
