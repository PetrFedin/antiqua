import {dealerInterestFor} from './dealer-interest-v32.mjs';
import {dealerLeadCockpit} from './dealer-leads-v24.mjs';

const INTEREST_STAGES=['DISCOVERED','ENGAGED','INQUIRY','VIEWING','NEGOTIATING','TRANSACTING'];
const INTEREST_RANK=Object.fromEntries(INTEREST_STAGES.map((x,i)=>[x,i]));
const LEAD_STAGES=['NEW_LEAD','UNANSWERED','REPLIED','VIEWING','NEGOTIATING','WON','LOST'];

const ratio=(n,d)=>d>0?Number((n/d).toFixed(4)):null;
const addCurrency=(out,src={})=>{for(const [ccy,v] of Object.entries(src||{})){const n=Number(v||0);if(Number.isSafeInteger(n)&&n>=0)out[ccy]=(out[ccy]||0)+n}return out};

export function partnerPilotCapabilities(){return{
 contractVersion:'v33',
 projectionOnly:true,
 snapshotOnly:true,
 personLevelFunnel:false,
 crossSignalUniqueAudience:false,
 sourceAuthorities:['DEALER_INTEREST_V32','DEALER_LEADS_V24'],
 note:'Object progression and lead outcomes are current-state snapshots. Rates are object- or lead-based, never inferred unique-person conversion.'
}}

export function buildPartnerPilotAnalytics({account,interest,dealerLeads}={}){
 if(!account?.sellerId)throw Object.assign(new Error('Seller account required'),{status:403,code:'SELLER_REQUIRED'});
 const objects=interest?.objects||[];
 const leads=dealerLeads?.leads||[];
 const signaled=objects.filter(x=>x.stage&&x.stage!=='NO_SIGNAL');
 const atLeast={};
 for(const stage of INTEREST_STAGES)atLeast[stage]=objects.filter(x=>(INTEREST_RANK[x.stage]??-1)>=INTEREST_RANK[stage]).length;
 const objectRates={
  engagedFromDiscovered:ratio(atLeast.ENGAGED,atLeast.DISCOVERED),
  inquiryFromEngaged:ratio(atLeast.INQUIRY,atLeast.ENGAGED),
  viewingFromInquiry:ratio(atLeast.VIEWING,atLeast.INQUIRY),
  negotiatingFromViewing:ratio(atLeast.NEGOTIATING,atLeast.VIEWING),
  transactingFromNegotiating:ratio(atLeast.TRANSACTING,atLeast.NEGOTIATING)
 };
 const leadStageCounts=Object.fromEntries(LEAD_STAGES.map(x=>[x,leads.filter(l=>l.stage===x).length]));
 const responded=leads.filter(x=>x.firstDealerResponseAt).length;
 const won=leadStageCounts.WON||0,lost=leadStageCounts.LOST||0,closed=won+lost;
 const pipelineByCurrency=addCurrency({},dealerLeads?.summary?.potentialByCurrency);
 const priority=leads.filter(x=>['UNANSWERED','NEW_LEAD','NEGOTIATING','VIEWING'].includes(x.stage)).map(x=>({
  id:x.id,objectId:x.objectId,stage:x.stage,responseStatus:x.responseStatus,nextAction:x.nextAction||null,
  potentialAmountMinor:x.potentialAmountMinor??null,potentialCurrency:x.potentialCurrency||null,updatedAt:x.updatedAt||null
 })).slice(0,25);
 return{
  sellerId:account.sellerId,
  generatedAt:new Date().toISOString(),
  scope:{mode:'CURRENT_SNAPSHOT',signaledObjects:signaled.length,totalObjects:objects.length,totalLeads:leads.length},
  objectProgression:{atLeast,rates:objectRates,denominatorUnit:'OBJECTS'},
  leadOperations:{
   stageCounts:leadStageCounts,
   overdue:Number(dealerLeads?.summary?.overdue||0),
   awaitingDealer:Number(dealerLeads?.summary?.awaitingDealer||0),
   medianResponseMinutes:dealerLeads?.summary?.medianResponseMinutes??null,
   responseCoverage:ratio(responded,leads.length),
   closedOutcomeRate:closed?ratio(won,closed):null,
   pipelineByCurrency
  },
  priorityWork:priority,
  privacy:{personLevelFunnel:false,crossSignalUniqueAudience:false,passiveIdentityExposed:false},
  capabilities:partnerPilotCapabilities()
 }
}

export async function partnerPilotAnalyticsFor(account){
 const [interest,dealerLeads]=await Promise.all([dealerInterestFor(account),dealerLeadCockpit(account)]);
 return buildPartnerPilotAnalytics({account,interest,dealerLeads})
}
