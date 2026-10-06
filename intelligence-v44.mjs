import {lots,lot} from './runtime-v09.mjs';
import {publicArtworkEligible} from './artwork-scope-v43.mjs';
import {canonicalArtworkDepartment,artworkDepartmentLabel} from './art-taxonomy-v43.mjs';
import {buildTasteProfile,tasteRecommendations,tasteGraphCapabilities} from './taste-graph-v28.mjs';
import {dealerInterestFor,dealerInterestCapabilities} from './dealer-interest-v32.mjs';
import {dealerPerformanceFor,dealerPerformanceCapabilities} from './dealer-performance-v34.mjs';
import {creatorsForObject,creatorGraphCapabilities} from './creator-graph-v30.mjs';
import {marketIntelligenceFor,marketIntelligenceCapabilities} from './market-intelligence-v25.mjs';
import {passportRevisionHistory,passportRevisionCapabilities} from './passport-revisions-v16.mjs';
import {listMyCollections} from './collection-graph-v10.mjs';

const STAGES=['NO_SIGNAL','DISCOVERED','ENGAGED','INQUIRY','VIEWING','NEGOTIATING','TRANSACTING'];
const RANK=Object.fromEntries(STAGES.map((x,i)=>[x,i]));
const clone=x=>x==null?x:structuredClone(x);
const bi=v=>v&&typeof v==='object'&&!Array.isArray(v)?{en:String(v.en||v.ru||''),ru:String(v.ru||v.en||'')}:{en:String(v||''),ru:String(v||'')};
const arr=v=>Array.isArray(v)?v:Array.isArray(v?.en)?v.en:Array.isArray(v?.ru)?v.ru:v?[v]:[];
const sum=(xs,fn=x=>Number(x||0))=>xs.reduce((a,x)=>a+fn(x),0);

export function intelligenceCapabilities(){return{
 contractVersion:'v45',
 architecture:'SHARED_FACTS_MULTIPLE_PROJECTIONS',
 projections:['COLLECTOR','COLLECTION_STRATEGY','PROFESSIONAL','PORTFOLIO','SCHOLARLY_MARKET','RESEARCH_GAPS'],
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

function topCounts(items,keyFn,limit=6){
 const m=new Map();
 for(const item of items||[]){const key=keyFn(item);if(!key)continue;const prev=m.get(key)||{key,count:0};prev.count++;m.set(key,prev)}
 return [...m.values()].sort((a,b)=>b.count-a.count||String(a.key).localeCompare(String(b.key))).slice(0,limit)
}
function collectionStrategy(collections=[]){
 const works=[],seen=new Set();
 for(const c of collections||[])for(const i of c.items||[]){const o=i.object;if(!o||seen.has(o.id))continue;seen.add(o.id);works.push(o)}
 const departments=topCounts(works,o=>canonicalArtworkDepartment(o.department));
 const artists=topCounts(works,o=>String(o.maker?.en||o.maker?.ru||'').trim());
 const periods=topCounts(works,o=>String(o.period?.en||o.period?.ru||'').trim());
 const origins=topCounts(works,o=>String(o.origin?.en||o.origin?.ru||'').trim());
 const dominant=artists[0]?.count||0,total=works.length;
 return{
  collections:collections.length,uniqueArtworks:total,
  concentration:{topArtistShare:total?Number((dominant/total).toFixed(3)):null,dominantArtist:artists[0]?.key||null},
  dimensions:{departments,artists,periods,origins},
  interpretation:{
   concentrationIsDescriptiveNotAdvice:true,
   noPortfolioValueCalculated:true,
   noLiquidityAssumption:true,
   noBuyRecommendation:true
  }
 }
}
function readinessState(count,{complete=2,partial=1}={}){
 count=Number(count||0);if(count>=complete)return'PRESENT';if(count>=partial)return'PARTIAL';return'MISSING'
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
 const [built,recs,collections]=await Promise.all([buildTasteProfile(account),tasteRecommendations(account,{limit}),listMyCollections(account)]);
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
  collectionStrategy:collectionStrategy(collections),
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
 const artistWorks=artists.reduce((n,a)=>n+a.works,0),topArtist=artists[0]||null;
 const portfolio={artistCoverage:artists.length,artworkCoverage:objects.length,topArtistShare:artistWorks?Number(((topArtist?.works||0)/artistWorks).toFixed(3)):null,topArtistId:topArtist?.creator?.id||null,responseBottleneck:{overdue:Number(performance.dealerPerformance?.currentOverdue||0),medianResponseMinutes:performance.dealerPerformance?.allTimeMedianResponseMinutes??null},stageDistribution:Object.fromEntries(STAGES.map(stage=>[stage,objects.filter(x=>x.stage===stage).length])),interpretation:{descriptiveNotDemandForecast:true,noOpaqueRanking:true,noAudienceIdentityInference:true}};
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
  artists,topObjects,portfolio,
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
 const evidenceCoverage={
  attribution:{state:readinessState(creators.length,{complete:1,partial:1}),count:creators.length},
  provenance:{state:readinessState(evidence.provenanceEvents,{complete:2,partial:1}),count:evidence.provenanceEvents},
  bibliography:{state:readinessState(literature.length,{complete:2,partial:1}),count:literature.length},
  exhibitionHistory:{state:readinessState(exhibitions.length,{complete:2,partial:1}),count:exhibitions.length},
  revisions:{state:readinessState(revList.length,{complete:2,partial:1}),count:revList.length},
  marketComparables:{state:readinessState(market?.summary?.comparables||0,{complete:2,partial:1}),count:Number(market?.summary?.comparables||0)}
 };
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
  evidenceCoverage,
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
