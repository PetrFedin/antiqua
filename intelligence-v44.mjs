import {lots,lot} from './runtime-v09.mjs';
import {publicArtworkEligible} from './artwork-scope-v43.mjs';
import {canonicalArtworkDepartment,artworkDepartmentLabel} from './art-taxonomy-v43.mjs';
import {buildTasteProfile,tasteRecommendations,tasteGraphCapabilities} from './taste-graph-v28.mjs';
import {dealerInterestFor,dealerInterestCapabilities} from './dealer-interest-v32.mjs';
import {dealerPerformanceFor,dealerPerformanceCapabilities} from './dealer-performance-v34.mjs';
import {creatorsForObject,creatorGraphCapabilities} from './creator-graph-v30.mjs';
import {marketIntelligenceFor,marketIntelligenceCapabilities} from './market-intelligence-v25.mjs';
import {passportRevisionHistory,passportRevisionCapabilities} from './passport-revisions-v16.mjs';

const STAGES=['NO_SIGNAL','DISCOVERED','ENGAGED','INQUIRY','VIEWING','NEGOTIATING','TRANSACTING'];
const RANK=Object.fromEntries(STAGES.map((x,i)=>[x,i]));
const clone=x=>x==null?x:structuredClone(x);
const bi=v=>v&&typeof v==='object'&&!Array.isArray(v)?{en:String(v.en||v.ru||''),ru:String(v.ru||v.en||'')}:{en:String(v||''),ru:String(v||'')};
const arr=v=>Array.isArray(v)?v:Array.isArray(v?.en)?v.en:Array.isArray(v?.ru)?v.ru:v?[v]:[];
const sum=(xs,fn=x=>Number(x||0))=>xs.reduce((a,x)=>a+fn(x),0);

export function intelligenceCapabilities(){return{
 contractVersion:'v44',
 architecture:'SHARED_FACTS_MULTIPLE_PROJECTIONS',
 projections:['COLLECTOR','PROFESSIONAL','SCHOLARLY_MARKET'],
 projectionOnly:true,
 writesNewAuthority:false,
 aiRequired:false,
 opaqueScores:false,
 authenticityScore:false,
 appraisalScore:false,
 crossSignalIdentityJoin:false,
 passiveViewerIdentityExposed:false,
 sourceAuthorities:{
  collector:['TASTE_GRAPH_V28'],
  professional:['DEALER_INTEREST_V32','DEALER_PERFORMANCE_V34','CREATOR_GRAPH_V30'],
  scholarlyMarket:['ARTWORK_PASSPORT','CREATOR_GRAPH_V30','PASSPORT_REVISIONS_V16','MARKET_INTELLIGENCE_V25']
 },
 note:'v44 derives explainable projections from existing authorities. It does not create a second source of truth, an authenticity verdict, an appraisal, or a hidden user score.'
}}

function maturity(signalCount){
 const n=Number(signalCount||0);
 if(n>=20)return{state:'ESTABLISHED',signalCount:n};
 if(n>=8)return{state:'DEVELOPING',signalCount:n};
 if(n>0)return{state:'EXPLORATORY',signalCount:n};
 return{state:'COLD_START',signalCount:0}
}
function affinityDirections(profile={}){
 const out=[];
 for(const [dimension,items] of Object.entries(profile.dimensions||{})){
  for(const x of (items||[]).filter(v=>Number(v.points)>0).slice(0,3)){
   out.push({
    dimension,
    key:x.key,
    label:clone(x.value),
    affinityPoints:Number(x.points||0),
    evidence:(x.signals||[]).map(s=>({type:s.type,count:Number(s.count||0),points:Number(s.points||0)}))
   })
  }
 }
 return out.sort((a,b)=>b.affinityPoints-a.affinityPoints||a.dimension.localeCompare(b.dimension)||a.key.localeCompare(b.key)).slice(0,8)
}

export async function collectorIntelligenceFor(account,{limit=12}={}){
 const [built,recs]=await Promise.all([buildTasteProfile(account),tasteRecommendations(account,{limit})]);
 const profile=built.profile||{},directions=affinityDirections(profile),seenDepartments=new Set((profile.dimensions?.department||[]).filter(x=>Number(x.points)>0).map(x=>canonicalArtworkDepartment(x.value)));
 const exploration=(recs.recommendations||[]).filter(x=>!seenDepartments.has(canonicalArtworkDepartment(x.object?.department))).slice(0,4).map(x=>({
  object:clone(x.object),affinityPoints:Number(x.affinityPoints||0),coldStart:Boolean(x.coldStart),
  reason:x.coldStart?'DIVERSIFY_COLD_START':'ADJACENT_DISCOVERY',
  reasons:clone(x.reasons||[])
 }));
 return{
  generatedAt:new Date().toISOString(),
  collector:{accountId:account.id,maturity:maturity(profile.signalCount),signalCounts:clone(profile.signalCounts||{})},
  directions,
  exploration,
  recommendations:(recs.recommendations||[]).slice(0,limit),
  interpretation:{
   affinityPointsNotProbability:true,
   purchaseIntentNotInferredFromPassiveSignals:true,
   priceNotUsedForMatching:true,
   explanationAvailable:true
  },
  privacy:{sellerCannotSeePersonalTasteProfile:true,crossSignalIdentityJoin:false},
  capabilities:{...intelligenceCapabilities(),tasteGraph:tasteGraphCapabilities()}
 }
}

function artistRollupRow(creator){
 return{creator:clone(creator),works:0,highestStage:'NO_SIGNAL',commercialIntentWorks:0,viewingOrHigherWorks:0,transactingWorks:0,passiveViews:0,saves:0,offers:0,activeLeads:0,priorExposureEvidenceWorks:0}
}
export async function professionalIntelligenceFor(account,{limit=20}={}){
 const [interest,performance]=await Promise.all([dealerInterestFor(account),dealerPerformanceFor(account)]);
 const evidenceObjects=new Set((performance.attribution?.rows||[]).map(x=>x.objectId)),artistMap=new Map();
 const objects=(interest.objects||[]).filter(x=>x.stage!=='NO_SIGNAL').slice(0,Math.max(1,Math.min(200,Number(limit)||20)));
 for(const row of objects){
  const links=await creatorsForObject(null,row.objectId);
  for(const link of links){
   const c=link.creator;if(!c)continue;const a=artistMap.get(c.id)||artistRollupRow(c);
   a.works++;if(RANK[row.stage]>RANK[a.highestStage])a.highestStage=row.stage;
   if(RANK[row.stage]>=RANK.INQUIRY)a.commercialIntentWorks++;
   if(RANK[row.stage]>=RANK.VIEWING)a.viewingOrHigherWorks++;
   if(row.stage==='TRANSACTING')a.transactingWorks++;
   a.passiveViews+=Number(row.passive?.views||0);
   a.saves+=Number(row.passive?.saved||0);
   a.offers+=Number(row.commercial?.offers||0);
   a.activeLeads+=Number(row.commercial?.activeLeads||0);
   if(evidenceObjects.has(row.objectId))a.priorExposureEvidenceWorks++;
   artistMap.set(c.id,a)
  }
 }
 const artists=[...artistMap.values()].sort((a,b)=>RANK[b.highestStage]-RANK[a.highestStage]||b.activeLeads-a.activeLeads||b.offers-a.offers||b.saves-a.saves||b.passiveViews-a.passiveViews||String(a.creator.id).localeCompare(String(b.creator.id)));
 const topObjects=objects.map(x=>({
  objectId:x.objectId,objectCode:x.objectCode,title:clone(x.title),stage:x.stage,
  passive:{views:Number(x.passive?.views||0),saved:Number(x.passive?.saved||0),watching:Number(x.passive?.watching||0),editorialOpens:Number(x.passive?.editorialOpens||0)},
  commercial:{activeLeads:Number(x.commercial?.activeLeads||0),offers:Number(x.commercial?.offers||0),orders:Number(x.commercial?.orders||0),settlements:Number(x.commercial?.settlements||0),potentialByCurrency:clone(x.commercial?.potentialByCurrency||{})},
  priorExposureEvidence:evidenceObjects.has(x.objectId)
 })).slice(0,limit);
 return{
  generatedAt:new Date().toISOString(),sellerId:account.sellerId,
  summary:{
   artworksMeasured:Number(interest.summary?.objects||0),
   artworksWithSignal:Number(interest.summary?.objectsWithSignal||0),
   explicitCommercialIntent:Number(interest.summary?.explicitCommercialIntent||0),
   viewingOrHigher:Number(interest.summary?.viewingOrHigher||0),
   negotiatingOrHigher:Number(interest.summary?.negotiatingOrHigher||0),
   transacting:Number(interest.summary?.transacting||0),
   activeLeads:Number(performance.dealerPerformance?.currentActiveLeads||0),
   overdueResponses:Number(performance.dealerPerformance?.currentOverdue||0),
   medianResponseMinutes:performance.dealerPerformance?.allTimeMedianResponseMinutes??null
  },
  artists,topObjects,
  contentEvidence:{
   model:performance.attribution?.model||'TEMPORAL_OBJECT_LEVEL_EVIDENCE',
   objectsWithPriorEvidence:Number(performance.attribution?.objectsWithEvidence||0),
   causalClaim:false
  },
  interpretation:{
   artistRowsOrderedLexicographicallyNotByOpaqueScore:true,
   passiveSignalsAreNotUniquePeople:true,
   editorialExposureIsNotCausalAttribution:true,
   identityOnlyAvailableInsideExplicitLeadWorkflow:true
  },
  capabilities:{...intelligenceCapabilities(),dealerInterest:dealerInterestCapabilities(),dealerPerformance:dealerPerformanceCapabilities(),creatorGraph:creatorGraphCapabilities()}
 }
}

function evidenceSummary(o){
 const events=arr(o?.provenanceTimeline),docs=arr(o?.documents),statusCounts={};
 for(const e of events){const k=String(e?.evidenceStatus||'UNSPECIFIED').toUpperCase();statusCounts[k]=(statusCounts[k]||0)+1}
 return{provenanceEvents:events.length,documentRefs:docs.length,provenanceEvidenceStatusCounts:statusCounts}
}
function researchQuestions(o,creators,market){
 const q=[];
 if(!creators.length)q.push('CREATOR_PROFILE_NOT_LINKED');
 if(!arr(o?.provenanceTimeline).length)q.push('PROVENANCE_TIMELINE_NOT_RECORDED');
 if(!arr(o?.literature).length)q.push('BIBLIOGRAPHY_NOT_LINKED');
 if(!arr(o?.exhibitions).length)q.push('EXHIBITION_HISTORY_NOT_LINKED');
 if(!(market?.summary?.comparables>0))q.push('NO_PLATFORM_MARKET_COMPARABLES');
 const unreviewed=arr(o?.provenanceTimeline).filter(x=>!['REVIEWED','PLATFORM_RECORD'].includes(String(x?.evidenceStatus||'').toUpperCase())).length;
 if(unreviewed)q.push('PROVENANCE_EVIDENCE_REVIEW_OPEN');
 return q
}

export async function scholarlyMarketIntelligenceFor(objectId,{marketLimit=8}={}){
 const o=lot(String(objectId||''));if(!o||!publicArtworkEligible(o))return null;
 const [creators,market,revisions]=await Promise.all([
  creatorsForObject(null,o.id),
  marketIntelligenceFor(o.id,{limit:marketLimit}),
  passportRevisionHistory(o.id,{includePrivate:false,limit:50})
 ]);
 const evidence=evidenceSummary(o),revList=revisions?.revisions||[],revisionEvidenceCount=sum(revList,x=>Number(x.evidence?.count||0));
 const literature=arr(o.literature),exhibitions=arr(o.exhibitions),questions=researchQuestions(o,creators,market);
 return{
  generatedAt:new Date().toISOString(),
  artwork:{
   id:o.id,artworkCode:o.objectId,title:clone(o.title),artistAttribution:clone(o.maker),artworkType:o.artworkType||null,
   department:clone(o.department),period:clone(o.period),technique:clone(o.technique),support:clone(o.support),dimensions:clone(o.dimensions)
  },
  attribution:{
   linkedCreators:creators.map(x=>({creator:{id:x.creator.id,slug:x.creator.slug,displayName:clone(x.creator.displayName),creatorType:x.creator.creatorType,evidenceStatus:x.creator.evidenceStatus},creatorRole:x.creatorRole,attributionStatus:x.attributionStatus,marketContext:x.marketContext})),
   linkedCreatorCount:creators.length,
   verdict:'NO_AUTHENTICITY_VERDICT'
  },
  researchCoverage:{
   provenance:evidence,
   bibliography:{count:literature.length,items:literature.slice(0,25)},
   exhibitionHistory:{count:exhibitions.length,items:exhibitions.slice(0,25)},
   passportRevisions:{count:revList.length,currentRevisionNo:revisions?.currentRevisionNo??null,currentHash:revisions?.currentHash??null,publicEvidenceRefs:revisionEvidenceCount}
  },
  market:{
   comparables:Number(market?.summary?.comparables||0),
   realizedByCurrency:clone(market?.summary?.realizedByCurrency||{}),
   items:clone(market?.items||[]),
   interpretation:'CATALOGUE_COMPARABLES_NOT_APPRAISAL'
  },
  openResearchQuestions:questions,
  boundaries:{
   authenticityScore:false,
   appraisal:false,
   externalAuctionDatabase:false,
   publicSourcesOnly:true,
   privateOwnerLocationExcluded:true,
   marketPriceNotUsedToInferAttribution:true
  },
  capabilities:{...intelligenceCapabilities(),marketIntelligence:marketIntelligenceCapabilities(),passportRevisions:passportRevisionCapabilities(),creatorGraph:creatorGraphCapabilities()}
 }
}
