import {db,listing,lot,requirePermission} from './runtime-v09.mjs';
import {majorToMinor} from './money-v15.mjs';
import {listConversations,getConversation} from './domain-e2e-v14.mjs';
import {listOffers} from './offer-negotiation-v22.mjs';
import {listConditionReportRequests} from './condition-report-v23.mjs';
import {listViewingRequests} from './viewing-v23.mjs';

const clone=x=>x==null?x:structuredClone(x);
const OFFER_ACTIVE=new Set(['OPEN','COUNTERED']);
const OFFER_LOST=new Set(['REJECTED','WITHDRAWN','EXPIRED']);
const VIEWING_ACTIVE=new Set(['REQUESTED','SLOTS_PROPOSED','CONFIRMED','RESCHEDULE_REQUESTED']);
const DEALER_ACTIONS=new Set(['REPLY_TO_BUYER','RESPOND_TO_OFFER','PROPOSE_VIEWING_SLOTS','PUBLISH_CONDITION_REPORT','PREPARE_VIEWING']);

const ms=v=>{const n=Date.parse(v||'');return Number.isFinite(n)?n:null};
const iso=n=>Number.isFinite(n)?new Date(n).toISOString():null;
const byTime=(a,b)=>(ms(b.updatedAt)||ms(b.createdAt)||0)-(ms(a.updatedAt)||ms(a.createdAt)||0);
const latest=xs=>[...(xs||[])].sort(byTime)[0]||null;
const minTime=xs=>{const ns=xs.map(x=>ms(x)).filter(Number.isFinite);return ns.length?Math.min(...ns):null};
const maxTime=xs=>{const ns=xs.map(x=>ms(x)).filter(Number.isFinite);return ns.length?Math.max(...ns):null};

function leadKey(x){
 const buyer=String(x?.buyerAccountId||x?.buyerClientId||'');
 const listingId=String(x?.listingId||'');
 const objectId=String(x?.objectId||x?.lotId||'');
 return buyer+'|'+(listingId?'listing:'+listingId:'object:'+objectId)
}
function titleOf(o,id){return o?.title||{en:o?.objectCode||id||'Object',ru:o?.objectCode||id||'Предмет'}}
function listingPotential(li){
 if(!li||li.price==null||!li.currency)return null;
 try{return{amountMinor:majorToMinor(li.price,li.currency),currency:String(li.currency).toUpperCase(),source:'LISTING'}}catch{return null}
}
function eventActivity(kind,ref,e){
 return{kind,refId:ref,actorRole:e.actorRole||null,at:e.createdAt||null,eventType:e.eventType||kind}
}
function conversationActivities(thread){
 return(thread?.messages||[]).map(m=>({kind:'MESSAGE',refId:thread.id,detailId:m.id,actorRole:m.senderRole||null,at:m.createdAt||null,eventType:'MESSAGE'}))
}
function labelForActivity(a){
 const map={
  MESSAGE:'MESSAGE',
  OFFER_CREATED:'OFFER_CREATED',OFFER_COUNTERED:'OFFER_COUNTERED',OFFER_ACCEPTED:'OFFER_ACCEPTED',OFFER_REJECTED:'OFFER_REJECTED',OFFER_WITHDRAWN:'OFFER_WITHDRAWN',OFFER_EXPIRED:'OFFER_EXPIRED',
  CONDITION_REQUESTED:'CONDITION_REQUESTED',CONDITION_PUBLISHED:'CONDITION_PUBLISHED',CONDITION_CANCELLED:'CONDITION_CANCELLED',
  VIEWING_REQUESTED:'VIEWING_REQUESTED',VIEWING_SLOTS_PROPOSED:'VIEWING_SLOTS_PROPOSED',VIEWING_CONFIRMED:'VIEWING_CONFIRMED',VIEWING_RESCHEDULE_REQUESTED:'VIEWING_RESCHEDULE_REQUESTED',VIEWING_CANCELLED:'VIEWING_CANCELLED'
 };
 return map[a.kind]||a.kind
}
function nextActionFor({stage,activeOffer,viewing,condition,conversation,unreadCount}){
 if(stage==='WON')return{code:'PROCEED_TRANSACTION',target:'TRANSACTIONS'};
 if(activeOffer){
  if(activeOffer.awaitingRole==='SELLER')return{code:'RESPOND_TO_OFFER',target:'OFFER',id:activeOffer.id,version:activeOffer.version};
  return{code:'WAIT_FOR_BUYER',target:'OFFER',id:activeOffer.id,version:activeOffer.version}
 }
 if(viewing&&VIEWING_ACTIVE.has(viewing.status)){
  if(['REQUESTED','RESCHEDULE_REQUESTED'].includes(viewing.status))return{code:'PROPOSE_VIEWING_SLOTS',target:'VIEWING',id:viewing.id,version:viewing.version};
  if(viewing.status==='SLOTS_PROPOSED')return{code:'WAIT_FOR_BUYER',target:'VIEWING',id:viewing.id,version:viewing.version};
  if(viewing.status==='CONFIRMED')return{code:'PREPARE_VIEWING',target:'VIEWING',id:viewing.id,version:viewing.version}
 }
 if(condition?.status==='REQUESTED')return{code:'PUBLISH_CONDITION_REPORT',target:'CONDITION',id:condition.id,version:condition.version};
 if(stage==='LOST')return{code:'NONE',target:null};
 if(conversation?.lastMessage?.senderRole==='BUYER'||unreadCount>0)return{code:'REPLY_TO_BUYER',target:'CONVERSATION',id:conversation?.id||null};
 return{code:'WAIT_FOR_BUYER',target:conversation?.id?'CONVERSATION':null,id:conversation?.id||null}
}
function stageFor({offers,viewing,condition,firstDealerResponseAt,responseStatus,activities}){
 const accepted=offers.find(x=>x.status==='ACCEPTED');
 if(accepted)return'WON';
 const activeOffer=offers.find(x=>OFFER_ACTIVE.has(x.status));
 if(activeOffer)return'NEGOTIATING';
 if(viewing&&VIEWING_ACTIVE.has(viewing.status))return'VIEWING';
 const terminal=offers.find(x=>OFFER_LOST.has(x.status));
 if(terminal){
  const terminalAt=ms(terminal.updatedAt)||0;
  const laterBuyer=activities.some(a=>a.actorRole==='BUYER'&&(ms(a.at)||0)>terminalAt);
  if(!laterBuyer&&condition?.status!=='REQUESTED')return'LOST'
 }
 if(firstDealerResponseAt)return'REPLIED';
 return responseStatus==='OVERDUE'?'UNANSWERED':'NEW_LEAD'
}
function median(xs){if(!xs.length)return null;const s=[...xs].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]:Math.round((s[m-1]+s[m])/2)}

export function dealerLeadCapabilities(){
 return{
  contractVersion:'v24',projectionOnly:true,sourceAuthorities:['CONVERSATION','CONDITION_REPORT','VIEWING','OFFER','ORDER'],
  stages:['NEW_LEAD','UNANSWERED','REPLIED','VIEWING','NEGOTIATING','WON','LOST'],
  responseSlaMinutes:Number(process.env.DEALER_RESPONSE_SLA_MINUTES||1440),
  crossCurrencyTotals:false
 }
}

export function buildDealerLeadProjection({
 account,conversations=[],threads=[],offers=[],conditionRequests=[],viewingRequests=[],listings=[],objects=[],
 nowMs=Date.now(),slaMinutes=Number(process.env.DEALER_RESPONSE_SLA_MINUTES||1440)
}={}){
 if(!account?.sellerId)throw Object.assign(new Error('Seller account required'),{status:403,code:'SELLER_REQUIRED'});
 const groups=new Map(),threadById=new Map((threads||[]).map(x=>[x.id,x])),listingById=new Map((listings||[]).map(x=>[x.id,x])),objectById=new Map((objects||[]).map(x=>[x.id,x]));
 const add=(kind,x)=>{
  if(!x?.buyerAccountId||(!x.listingId&&!x.objectId&&!x.lotId))return;
  const key=leadKey(x);let g=groups.get(key);
  if(!g){g={key,buyerAccountId:x.buyerAccountId,listingId:x.listingId||null,objectId:x.objectId||x.lotId||null,conversations:[],offers:[],conditions:[],viewings:[]};groups.set(key,g)}
  if(!g.listingId&&x.listingId)g.listingId=x.listingId;if(!g.objectId&&(x.objectId||x.lotId))g.objectId=x.objectId||x.lotId;
  g[kind].push(x)
 };
 for(const x of conversations)add('conversations',x);
 for(const x of offers)add('offers',x);
 for(const x of conditionRequests)add('conditions',x);
 for(const x of viewingRequests)add('viewings',x);

 const leads=[];
 for(const g of groups.values()){
  g.conversations.sort(byTime);g.offers.sort(byTime);g.conditions.sort(byTime);g.viewings.sort(byTime);
  const conversation=g.conversations[0]||null,condition=g.conditions[0]||null,viewing=g.viewings[0]||null,activeOffer=g.offers.find(x=>OFFER_ACTIVE.has(x.status))||null;
  const activities=[];
  for(const c of g.conversations){const t=threadById.get(c.id);activities.push(...conversationActivities(t||c))}
  for(const o of g.offers)for(const e of o.history||[])activities.push(eventActivity('OFFER_'+e.eventType,o.id,e));
  for(const r of g.conditions)for(const e of r.history||[])activities.push(eventActivity('CONDITION_'+e.eventType,r.id,e));
  for(const r of g.viewings)for(const e of r.history||[])activities.push(eventActivity('VIEWING_'+e.eventType,r.id,e));
  activities.sort((a,b)=>(ms(a.at)||0)-(ms(b.at)||0));
  const buyerActs=activities.filter(x=>x.actorRole==='BUYER'),sellerActs=activities.filter(x=>x.actorRole==='SELLER');
  const firstBuyerAt=buyerActs[0]?.at||minTime([...g.conversations,...g.offers,...g.conditions,...g.viewings].map(x=>x.createdAt));
  const firstBuyerMs=ms(firstBuyerAt),firstDealer=sellerActs.find(x=>!firstBuyerMs||(ms(x.at)||0)>=firstBuyerMs)||null,firstDealerResponseAt=firstDealer?.at||null;
  const responseDueMs=Number.isFinite(firstBuyerMs)?firstBuyerMs+Math.max(1,Number(slaMinutes)||1440)*60000:null;
  const responseStatus=firstDealerResponseAt?'MET':(responseDueMs!=null&&nowMs>responseDueMs?'OVERDUE':'OPEN');
  const responseMinutes=firstDealerResponseAt&&firstBuyerMs?Math.max(0,Math.round(((ms(firstDealerResponseAt)||firstBuyerMs)-firstBuyerMs)/60000)):null;
  const stage=stageFor({offers:g.offers,viewing,condition,firstDealerResponseAt,responseStatus,activities});
  const unreadCount=g.conversations.reduce((n,x)=>n+Number(x.unreadCount||0),0);
  const last=activities.at(-1)||null,lastAction=last?{type:labelForActivity(last),actorRole:last.actorRole,at:last.at,refId:last.refId}:null;
  const li=listingById.get(g.listingId),obj=objectById.get(g.objectId);
  const valueOffer=activeOffer||g.offers.find(x=>x.status==='ACCEPTED')||g.offers[0]||null;
  const potential=valueOffer?{amountMinor:Number(valueOffer.currentAmountMinor||0),currency:valueOffer.currency,source:'OFFER'}:listingPotential(li);
  const nextAction=nextActionFor({stage,activeOffer,viewing,condition,conversation,unreadCount});
  const createdMs=minTime([...g.conversations,...g.offers,...g.conditions,...g.viewings].map(x=>x.createdAt));
  const updatedMs=maxTime([
   ...g.conversations.flatMap(x=>[x.updatedAt,x.lastMessage?.createdAt]),
   ...g.offers.flatMap(x=>[x.updatedAt,...(x.history||[]).map(e=>e.createdAt)]),
   ...g.conditions.flatMap(x=>[x.updatedAt,...(x.history||[]).map(e=>e.createdAt)]),
   ...g.viewings.flatMap(x=>[x.updatedAt,...(x.history||[]).map(e=>e.createdAt)])
  ]);
  leads.push({
   id:g.key,sellerId:account.sellerId,buyerAccountId:g.buyerAccountId,listingId:g.listingId,objectId:g.objectId,
   object:{id:g.objectId,objectCode:obj?.objectCode||obj?.objectId||g.objectId,title:titleOf(obj,g.objectId)},
   listing:li?{id:li.id,status:li.status,price:li.price??null,currency:li.currency||null}:null,
   stage,potentialAmountMinor:potential?.amountMinor??null,potentialCurrency:potential?.currency||null,potentialSource:potential?.source||null,
   createdAt:iso(createdMs),updatedAt:iso(updatedMs),firstBuyerActivityAt:firstBuyerAt||null,firstDealerResponseAt,responseDueAt:iso(responseDueMs),responseStatus,responseMinutes,
   unreadCount,lastAction,nextAction,
   refs:{
    conversationId:conversation?.id||null,
    offerId:activeOffer?.id||g.offers[0]?.id||null,offerVersion:activeOffer?.version||g.offers[0]?.version||null,
    conditionRequestId:condition?.id||null,conditionVersion:condition?.version||null,
    viewingRequestId:viewing?.id||null,viewingVersion:viewing?.version||null
   }
  })
 }
 leads.sort((a,b)=>{
  const priority={UNANSWERED:0,NEW_LEAD:1,NEGOTIATING:2,VIEWING:3,REPLIED:4,WON:5,LOST:6};
  return(priority[a.stage]??99)-(priority[b.stage]??99)||(ms(b.updatedAt)||0)-(ms(a.updatedAt)||0)
 });
 const stageCounts=Object.fromEntries(dealerLeadCapabilities().stages.map(x=>[x,leads.filter(l=>l.stage===x).length]));
 const potentialByCurrency={};for(const l of leads)if(l.stage!=='LOST'&&l.potentialCurrency&&Number.isSafeInteger(l.potentialAmountMinor)){potentialByCurrency[l.potentialCurrency]=(potentialByCurrency[l.potentialCurrency]||0)+l.potentialAmountMinor}
 const responseValues=leads.map(x=>x.responseMinutes).filter(Number.isFinite);
 return{
  sellerId:account.sellerId,generatedAt:new Date(nowMs).toISOString(),responseSlaMinutes:slaMinutes,
  summary:{total:leads.length,stageCounts,overdue:leads.filter(x=>x.responseStatus==='OVERDUE').length,awaitingDealer:leads.filter(x=>DEALER_ACTIONS.has(x.nextAction?.code)).length,medianResponseMinutes:median(responseValues),potentialByCurrency},
  leads
 }
}

async function listingSnapshots(ids){
 const unique=[...new Set(ids.filter(Boolean))];if(!unique.length)return[];
 if(db.kind==='POSTGRES'){
  const rows=(await db.pool.query('SELECT id,object_id,seller_id,status,payload FROM listings WHERE id=ANY($1::text[])',[unique])).rows;
  return rows.map(r=>({...(r.payload||{}),id:r.id,objectId:r.object_id,lotId:r.object_id,sellerId:r.seller_id,status:r.status}))
 }
 return unique.map(id=>clone(listing(id))).filter(Boolean).map(x=>({...x,objectId:x.lotId}))
}
async function objectSnapshots(ids){
 const unique=[...new Set(ids.filter(Boolean))];if(!unique.length)return[];
 if(db.kind==='POSTGRES'){
  const rows=(await db.pool.query('SELECT id,object_code,passport FROM objects WHERE id=ANY($1::text[])',[unique])).rows;
  return rows.map(r=>({id:r.id,objectId:r.object_code,objectCode:r.object_code,title:r.passport?.title||{en:r.object_code,ru:r.object_code}}))
 }
 return unique.map(id=>clone(lot(id))).filter(Boolean).map(x=>({id:x.id,objectId:x.objectId||x.id,objectCode:x.objectId||x.id,title:x.title}))
}

export async function dealerLeadCockpit(account,{nowMs=Date.now(),slaMinutes=dealerLeadCapabilities().responseSlaMinutes}={}){
 if(!account?.sellerId)throw Object.assign(new Error('Seller account required'),{status:403,code:'SELLER_REQUIRED'});
 requirePermission(account,'seller.analytics.read');
 const [allConversations,allOffers,allConditions,allViewings]=await Promise.all([
  listConversations(account),listOffers(account),listConditionReportRequests(account),listViewingRequests(account)
 ]);
 const conversations=allConversations.filter(x=>x.sellerId===account.sellerId);
 const offers=allOffers.filter(x=>x.sellerId===account.sellerId&&x.participantRole==='SELLER');
 const conditionRequests=allConditions.filter(x=>x.sellerId===account.sellerId&&x.participantRole==='SELLER');
 const viewingRequests=allViewings.filter(x=>x.sellerId===account.sellerId&&x.participantRole==='SELLER');
 const threads=(await Promise.all(conversations.map(x=>getConversation(account,x.id)))).filter(Boolean);
 const listingIds=[...conversations,...offers,...conditionRequests,...viewingRequests].map(x=>x.listingId);
 const objectIds=[...conversations,...offers,...conditionRequests,...viewingRequests].map(x=>x.objectId||x.lotId);
 const [listings,objects]=await Promise.all([listingSnapshots(listingIds),objectSnapshots(objectIds)]);
 return buildDealerLeadProjection({account,conversations,threads,offers,conditionRequests,viewingRequests,listings,objects,nowMs,slaMinutes})
}
