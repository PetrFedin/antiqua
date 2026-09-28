import {sellerAnalyticsFor} from './seller-analytics-v17.mjs';
import {dealerLeadCockpit} from './dealer-leads-v24.mjs';
import {aggregateEditorialObjectOpens} from './editorial-commerce-v31.mjs';

const STAGES=['NO_SIGNAL','DISCOVERED','ENGAGED','INQUIRY','VIEWING','NEGOTIATING','TRANSACTING'];
const RANK=Object.fromEntries(STAGES.map((x,i)=>[x,i]));
const clone=x=>x==null?x:structuredClone(x);
const maxStage=(a,b)=>RANK[b]>RANK[a]?b:a;
const addCurrency=(out,currency,value)=>{currency=String(currency||'').toUpperCase();value=Number(value);if(!currency||!Number.isSafeInteger(value)||value<=0)return;out[currency]=(out[currency]||0)+value};

export function dealerInterestCapabilities(){return{
 contractVersion:'v32',projectionOnly:true,opaqueScore:false,
 sourceAuthorities:['PASSPORT_VIEW','ACCOUNT_OBJECT_FLAG','EDITORIAL_OBJECT_OPEN','CONVERSATION','CONDITION_REPORT','VIEWING','OFFER','ORDER','AUCTION_BID','SETTLEMENT'],
 stages:STAGES,passiveIdentityExposed:false,crossSignalUniqueAudience:false,
 passiveSignals:['PASSPORT_VIEW','SAVED','WATCH','EDITORIAL_OBJECT_OPEN'],
 explicitCommercialSignals:['CONVERSATION','CONDITION_REPORT','VIEWING','OFFER','ORDER'],
 interpretation:'HIGHEST_OBSERVED_INTENT_STAGE',
 note:'Counts from different signal authorities are not summed into a unique-person audience estimate.'
}}

function leadStage(lead){
 if(!lead||lead.stage==='LOST')return null;
 if(lead.stage==='WON')return'TRANSACTING';
 if(lead.stage==='NEGOTIATING')return'NEGOTIATING';
 if(lead.stage==='VIEWING')return'VIEWING';
 if(['NEW_LEAD','UNANSWERED','REPLIED'].includes(lead.stage))return'INQUIRY';
 return null
}
function signal(type,count,{active=false,detail=null}={}){count=Number(count||0);return count>0?{type,count,active:Boolean(active),detail}:null}

export function buildDealerInterestProjection({account,analytics,dealerLeads,editorialByObject={}}={}){
 if(!account?.sellerId)throw Object.assign(new Error('Seller account required'),{status:403,code:'SELLER_REQUIRED'});
 const leads=dealerLeads?.leads||[],leadByObject=new Map();
 for(const l of leads){if(!l.objectId)continue;const xs=leadByObject.get(l.objectId)||[];xs.push(l);leadByObject.set(l.objectId,xs)}
 const rows=[];
 for(const a of analytics?.objects||[]){
  const objectLeads=leadByObject.get(a.objectId)||[],activeLeads=objectLeads.filter(x=>x.stage!=='LOST'),editorial=editorialByObject[a.objectId]||{opens:0,uniqueViewers:0,lastOccurredAt:null};
  let stage='NO_SIGNAL';
  if(Number(a.views)>0)stage=maxStage(stage,'DISCOVERED');
  if(Number(a.saved)>0||Number(a.watching)>0||Number(editorial.opens)>0||Number(a.views)>=2)stage=maxStage(stage,'ENGAGED');
  const leadStages=activeLeads.map(leadStage).filter(Boolean);for(const x of leadStages)stage=maxStage(stage,x);
  if(!leadStages.length&&Number(a.conversations)>0)stage=maxStage(stage,'INQUIRY');
  if(Number(a.bids)>0||Number(a.offers)>0)stage=maxStage(stage,'NEGOTIATING');
  if(Number(a.acceptedOffers)>0||Number(a.orders)>0||Number(a.settlements)>0)stage=maxStage(stage,'TRANSACTING');
  const hasViewing=activeLeads.some(x=>x.stage==='VIEWING'||x.refs?.viewingRequestId);if(hasViewing)stage=maxStage(stage,'VIEWING');
  const hasCondition=activeLeads.some(x=>x.refs?.conditionRequestId);if(hasCondition)stage=maxStage(stage,'INQUIRY');
  const potentialByCurrency={};for(const l of activeLeads)addCurrency(potentialByCurrency,l.potentialCurrency,l.potentialAmountMinor);
  const signals=[
   signal('PASSPORT_VIEW',a.views,{detail:'DEDUPED_30_MINUTE_SESSIONS'}),signal('SAVED',a.saved),signal('WATCH',a.watching),
   signal('EDITORIAL_OBJECT_OPEN',editorial.opens,{detail:editorial.uniqueViewers?String(editorial.uniqueViewers)+' deduped editorial viewers':null}),
   signal('CONVERSATION',a.conversations,{active:activeLeads.some(x=>['NEW_LEAD','UNANSWERED','REPLIED'].includes(x.stage))}),
   signal('CONDITION_REPORT',activeLeads.filter(x=>x.refs?.conditionRequestId).length,{active:true}),
   signal('VIEWING',activeLeads.filter(x=>x.refs?.viewingRequestId).length,{active:true}),
   signal('OFFER',a.offers,{active:activeLeads.some(x=>x.refs?.offerId)}),signal('AUCTION_BID',a.bids,{active:true}),
   signal('ORDER',a.orders,{active:true}),signal('SETTLEMENT',a.settlements,{active:true})
  ].filter(Boolean);
  const nextActions=[...new Map(activeLeads.map(x=>[x.nextAction?.code,x.nextAction]).filter(([k])=>k)).values()];
  const lastExplicitAt=activeLeads.map(x=>x.updatedAt).filter(Boolean).sort().at(-1)||null;
  rows.push({
   objectId:a.objectId,objectCode:a.objectCode,title:clone(a.title),listingStatus:a.listingStatus,listingPrice:a.listingPrice,currency:a.currency,
   stage,signals,passive:{views:Number(a.views||0),saved:Number(a.saved||0),watching:Number(a.watching||0),editorialOpens:Number(editorial.opens||0),editorialUniqueViewers:Number(editorial.uniqueViewers||0)},
   commercial:{conversations:Number(a.conversations||0),offers:Number(a.offers||0),acceptedOffers:Number(a.acceptedOffers||0),orders:Number(a.orders||0),bids:Number(a.bids||0),settlements:Number(a.settlements||0),openDisputes:Number(a.openDisputes||0),activeLeads:activeLeads.length,potentialByCurrency,nextActions,lastExplicitAt},
   privacy:{passiveViewerIdentityExposed:false,explicitLeadIdentityAvailableOnlyInLeadWorkflow:true,crossSignalUniqueAudience:false}
  })
 }
 rows.sort((a,b)=>RANK[b.stage]-RANK[a.stage]||b.commercial.activeLeads-a.commercial.activeLeads||b.commercial.offers-a.commercial.offers||b.passive.saved-a.passive.saved||b.passive.views-a.passive.views||String(a.objectCode).localeCompare(String(b.objectCode)));
 const stageCounts=Object.fromEntries(STAGES.map(x=>[x,rows.filter(r=>r.stage===x).length])),potentialByCurrency={};for(const r of rows)for(const [ccy,v] of Object.entries(r.commercial.potentialByCurrency))addCurrency(potentialByCurrency,ccy,v);
 return{sellerId:account.sellerId,generatedAt:new Date().toISOString(),summary:{objects:rows.length,objectsWithSignal:rows.filter(x=>x.stage!=='NO_SIGNAL').length,engagedOrHigher:rows.filter(x=>RANK[x.stage]>=RANK.ENGAGED).length,explicitCommercialIntent:rows.filter(x=>RANK[x.stage]>=RANK.INQUIRY).length,viewingOrHigher:rows.filter(x=>RANK[x.stage]>=RANK.VIEWING).length,negotiatingOrHigher:rows.filter(x=>RANK[x.stage]>=RANK.NEGOTIATING).length,transacting:stageCounts.TRANSACTING,potentialByCurrency,stageCounts},objects:rows,capabilities:dealerInterestCapabilities()}
}

export async function dealerInterestFor(account){
 const analytics=await sellerAnalyticsFor(account,{limit:500});
 const dealerLeads=await dealerLeadCockpit(account);
 const objectIds=(analytics.objects||[]).map(x=>x.objectId);
 const editorialByObject=await aggregateEditorialObjectOpens(objectIds);
 return buildDealerInterestProjection({account,analytics,dealerLeads,editorialByObject})
}
