import crypto from 'node:crypto';
import {BUYER_ID,SELLER_ID,sellers,lots,auctions,listings,draftItems,offers,orders,messages,clients,step} from './data-v08.mjs';
lots.forEach((x,i)=>{x.restoration.ru=i%3===0?'Отмечена историческая реставрация; детали ожидаются':'В preview реставрация не заявлена';});
export const uid=p=>`${p}-${crypto.randomUUID().replaceAll('-','').slice(0,14)}`;
export const nowIso=()=>new Date().toISOString();
export const getLot=id=>lots.find(l=>l.id===id);
export const getSeller=id=>sellers.get(id)||null;
export const getListing=id=>listings.get(id)||null;
export function normalAuction(a){const t=Date.now();a.state=t<Date.parse(a.startsAt)?'SCHEDULED':t>=Date.parse(a.endsAt)?'CLOSED':'LIVE';a.reserveMet=a.currentBid>=a.reservePrice;return a;}
export function publicAuction(a){normalAuction(a);return{id:a.id,saleId:a.saleId,lotId:a.lotId,currency:a.currency,currentBid:a.currentBid,increment:a.increment,bidCount:a.bidCount,reserveMet:a.reserveMet,startsAt:a.startsAt,endsAt:a.endsAt,state:a.state,history:a.history.slice(-12)};}
export function recomputeAuction(a){const r=[...a.proxyBids].sort((x,y)=>y.maxAmount-x.maxAmount||x.placedAt.localeCompare(y.placedAt));if(!r.length)return;const f=r[0],s=r[1],floor=a.baselineBid+step(a.baselineBid);a.currentBid=Math.max(a.baselineBid,s?Math.max(floor,Math.min(f.maxAmount,s.maxAmount+step(s.maxAmount))):Math.min(f.maxAmount,floor));a.increment=step(a.currentBid);a.leaderClientId=f.clientId;}
export function publicListing(x){return{...x,seller:getSeller(x.sellerId),lot:getLot(x.lotId)};}
export function checklist(d){
 const checks=[
  ['IDENTITY',Boolean(d.title?.en&&d.title?.ru&&d.category?.en&&d.category?.ru&&d.period?.en&&d.period?.ru)],
  ['ATTRIBUTION',Boolean(d.maker?.en&&d.maker?.ru&&d.origin?.en&&d.origin?.ru)],
  ['PHYSICAL',Boolean(d.materials?.en&&d.materials?.ru&&d.dimensions?.en&&d.dimensions?.ru)],
  ['DESCRIPTION',Boolean(d.description?.en&&d.description?.ru)],
  ['PROVENANCE',Boolean(d.provenance?.en&&d.provenance?.ru)],
  ['CONDITION',Boolean(d.condition?.en&&d.condition?.ru)],
  ['MEDIA',Array.isArray(d.media)&&d.media.length>=3],
  ['COMMERCIAL',Boolean(d.shippingFrom)&&((d.saleRoute==='SHOP'&&d.price>0)||(d.saleRoute==='AUCTION'&&d.estimateLow>0&&d.estimateHigh>d.estimateLow))]
 ];
 const complete=checks.filter(([,ok])=>ok).length;return{checks:checks.map(([key,complete])=>({key,complete})),complete,total:checks.length,percent:Math.round(complete/checks.length*100),ready:complete===checks.length};
}
function baseClient(id){const seller=id===SELLER_ID;return{id,name:seller?'Preview Dealer':'Preview Collector',email:seller?'dealer@preview.antiqua':'collector@preview.antiqua',kind:seller?'SELLER':'BUYER',sellerId:seller?'seller-preview':null,registeredSales:new Set(),acceptedTermsAt:null,country:null,bids:[],watchAlerts:new Set(),savedLots:new Set(),collection:new Set(),notifications:[],createdAt:nowIso()};}
export function ensureClient(id){id=id||BUYER_ID;if(!clients.has(id))clients.set(id,baseClient(id));return clients.get(id);}
export function notify(clientId,type,payload){const c=clients.get(clientId);if(c)c.notifications.unshift({id:uid('ntf'),type,payload,createdAt:nowIso(),read:false});}
export function sellerInventory(sellerId){return[...listings.values()].filter(l=>l.sellerId===sellerId).map(publicListing);}
export function clientState(c){
 const myOffers=[...offers.values()].filter(o=>o.buyerClientId===c.id||(c.sellerId&&o.sellerId===c.sellerId)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
 const myOrders=[...orders.values()].filter(o=>o.buyerClientId===c.id||(c.sellerId&&o.sellerId===c.sellerId)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 return{id:c.id,name:c.name,email:c.email,kind:c.kind,sellerId:c.sellerId,registeredSales:[...c.registeredSales],acceptedTermsAt:c.acceptedTermsAt,country:c.country,leadingLots:auctions.filter(a=>a.leaderClientId===c.id&&a.state==='LIVE').map(a=>a.lotId),bids:c.bids.slice(-30),watchAlerts:[...c.watchAlerts],savedLots:[...c.savedLots],collection:[...c.collection],offers:myOffers,orders:myOrders,notifications:c.notifications.slice(0,50),unreadNotifications:c.notifications.filter(n=>!n.read).length,seller:c.sellerId?{profile:getSeller(c.sellerId),listings:sellerInventory(c.sellerId),drafts:[...draftItems.values()].filter(d=>d.sellerId===c.sellerId).map(d=>({...d,checklist:checklist(d)})),pendingOffers:myOffers.filter(o=>['PENDING','COUNTERED_BY_BUYER'].includes(o.status)),inquiries:[...messages.values()].filter(m=>m.sellerId===c.sellerId)}:null};
}
export function createOrder({listing,buyerClientId,price,source,offerId=null}){if(listing.status!=='ACTIVE')throw Object.assign(new Error('Item is no longer available'),{status:409});listing.status='RESERVED';const order={id:uid('ord'),listingId:listing.id,lotId:listing.lotId,sellerId:listing.sellerId,buyerClientId,price,currency:listing.currency,source,offerId,status:'AWAITING_PAYMENT_CONNECTOR',paymentStatus:'NOT_CONFIGURED',invoiceStatus:'DRAFT_NOT_ISSUED',shippingStatus:'QUOTE_REQUIRED',shippingQuote:null,taxStatus:'NOT_CALCULATED',timeline:[{status:'ORDER_CREATED',at:nowIso()},{status:'PAYMENT_CONNECTOR_REQUIRED',at:nowIso()}],createdAt:nowIso()};orders.set(order.id,order);notify(buyerClientId,'ORDER_CREATED',{orderId:order.id,lotId:order.lotId});return order;}
export function orderDetail(order){if(!order)return null;return{...order,lot:getLot(order.lotId),listing:getListing(order.listingId),seller:getSeller(order.sellerId)};}
export function seedNotifications(){const b=ensureClient(BUYER_ID),s=ensureClient(SELLER_ID);if(!b.notifications.length){b.notifications.push({id:uid('ntf'),type:'WATCHED_LOT_ENDING',payload:{lotId:'lot-103',hours:9},createdAt:new Date(Date.now()-2400000).toISOString(),read:false},{id:uid('ntf'),type:'CATALOGUE_STORY',payload:{topic:'provenance'},createdAt:new Date(Date.now()-86400000).toISOString(),read:true});}if(!s.notifications.length){s.notifications.push({id:uid('ntf'),type:'CHANGES_REQUESTED',payload:{draftId:'draft-1'},createdAt:new Date(Date.now()-1800000).toISOString(),read:false});}}
seedNotifications();
