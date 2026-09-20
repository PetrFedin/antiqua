const VALID_STATUS=new Set(['KNOWN','ESTIMATE','UNKNOWN','NOT_APPLICABLE']);
const integer=n=>Number.isSafeInteger(Number(n))?Number(n):null;
const component=(code,{status='UNKNOWN',amount=null,currency='EUR',reason=null,source=null}={})=>{
 status=String(status||'UNKNOWN').toUpperCase();
 if(!VALID_STATUS.has(status))throw new Error('Invalid total-cost component status');
 const value=amount==null?null:integer(amount);
 if(['KNOWN','ESTIMATE'].includes(status)&&value==null)throw new Error(code+' requires an integer amount');
 if(['UNKNOWN','NOT_APPLICABLE'].includes(status)&&amount!=null)throw new Error(code+' must not carry an amount');
 return{code,status,amount:value,currency:String(currency||'EUR').toUpperCase(),reason:reason||null,source:source||null};
};
const explicitMoney=(resource,key,currency)=>{
 const raw=resource?.[key];
 if(Number.isSafeInteger(Number(raw))&&Number(raw)>=0)return component(key.toUpperCase(),{status:'KNOWN',amount:Number(raw),currency,source:'RESOURCE_EXPLICIT'});
 return null;
};
const premium=(resource,currency)=>explicitMoney(resource,'buyerPremium',currency)||component('BUYER_PREMIUM',{status:'UNKNOWN',currency,reason:'NOT_CONFIGURED'});
const tax=(resource,currency)=>{
 if(String(resource?.taxStatus||'').toUpperCase()==='NOT_APPLICABLE')return component('TAX',{status:'NOT_APPLICABLE',currency,reason:'EXPLICIT_NOT_APPLICABLE'});
 return explicitMoney(resource,'taxAmount',currency)||component('TAX',{status:'UNKNOWN',currency,reason:String(resource?.taxStatus||'NOT_CALCULATED').toUpperCase()});
};
const duties=(resource,currency)=>{
 if(String(resource?.dutiesStatus||'').toUpperCase()==='NOT_APPLICABLE')return component('DUTIES',{status:'NOT_APPLICABLE',currency,reason:'EXPLICIT_NOT_APPLICABLE'});
 return explicitMoney(resource,'dutiesAmount',currency)||component('DUTIES',{status:'UNKNOWN',currency,reason:String(resource?.dutiesStatus||'DESTINATION_REQUIRED').toUpperCase()});
};
const shipping=(resource,currency)=>{
 const q=resource?.shippingQuote;
 if(q&&Number.isSafeInteger(Number(q.amount))&&Number(q.amount)>=0)return component('SHIPPING',{status:q.nonBinding||String(q.kind||'').toUpperCase().includes('ESTIMATE')?'ESTIMATE':'KNOWN',amount:Number(q.amount),currency:q.currency||currency,reason:q.nonBinding?'NON_BINDING_QUOTE':null,source:q.provider||q.source||'SHIPPING_QUOTE'});
 if(String(resource?.shippingStatus||'').toUpperCase()==='NOT_APPLICABLE')return component('SHIPPING',{status:'NOT_APPLICABLE',currency,reason:'EXPLICIT_NOT_APPLICABLE'});
 return component('SHIPPING',{status:'UNKNOWN',currency,reason:String(resource?.shippingStatus||'QUOTE_REQUIRED').toUpperCase()});
};
function finalize({context,basisType,principal,currency,resource={},metadata={}}){
 principal=integer(principal);if(principal==null||principal<=0)throw Object.assign(new Error('Positive principal amount required'),{status:400,code:'INVALID_COST_BASIS'});
 currency=String(currency||'EUR').toUpperCase();
 const components=[
  component('PRINCIPAL',{status:'KNOWN',amount:principal,currency,source:basisType}),
  premium(resource,currency),
  tax(resource,currency),
  duties(resource,currency),
  shipping(resource,currency)
 ];
 const crossCurrency=components.filter(x=>['KNOWN','ESTIMATE'].includes(x.status)&&x.currency!==currency);
 const unknown=components.filter(x=>x.status==='UNKNOWN').map(x=>x.code);
 const estimates=components.filter(x=>x.status==='ESTIMATE').map(x=>x.code);
 const confirmedSubtotal=components.filter(x=>x.status==='KNOWN'&&x.currency===currency).reduce((n,x)=>n+x.amount,0);
 const estimatedSubtotal=components.filter(x=>['KNOWN','ESTIMATE'].includes(x.status)&&x.currency===currency).reduce((n,x)=>n+x.amount,0);
 const complete=!unknown.length&&!estimates.length&&!crossCurrency.length;
 return{
  authority:'TOTAL_COST_V17',
  context,
  basis:{type:basisType,amount:principal,currency},
  components,
  confirmedSubtotal,
  estimatedSubtotal:estimates.length?estimatedSubtotal:null,
  allInTotal:complete?confirmedSubtotal:null,
  currency,
  completeness:complete?'COMPLETE':'INCOMPLETE',
  unknownComponents:unknown,
  estimatedComponents:estimates,
  crossCurrencyComponents:crossCurrency.map(x=>x.code),
  metadata,
  disclosure:{
   bindingTotalAvailable:complete,
   textKey:complete?'TOTAL_CONFIRMED':'TOTAL_NOT_YET_CALCULABLE'
  }
 };
}
export function listingTotalCost(listing,{amount=null,mode=null}={}){
 if(!listing)throw Object.assign(new Error('Listing not found'),{status:404,code:'LISTING_NOT_FOUND'});
 const asking=integer(listing.price),requested=amount==null?asking:integer(amount);
 if(requested==null||requested<=0)throw Object.assign(new Error('Invalid listing amount'),{status:400,code:'INVALID_COST_BASIS'});
 if(mode==='OFFER'&&asking!=null&&requested>=asking)throw Object.assign(new Error('Offer basis must be below asking price'),{status:400,code:'INVALID_OFFER_BASIS'});
 return finalize({context:'LISTING',basisType:mode==='OFFER'?'OFFER_AMOUNT':'ASKING_PRICE',principal:requested,currency:listing.currency,resource:listing,metadata:{listingId:listing.id,objectId:listing.lotId,saleType:listing.saleType,shippingFrom:listing.shippingFrom||null}});
}
export function auctionTotalCost(auction,{amount=null}={}){
 if(!auction)throw Object.assign(new Error('Auction not found'),{status:404,code:'AUCTION_NOT_FOUND'});
 const principal=amount==null?integer(auction.currentBid)+integer(auction.increment):integer(amount);
 if(principal==null||principal<=0)throw Object.assign(new Error('Invalid auction amount'),{status:400,code:'INVALID_COST_BASIS'});
 return finalize({context:'AUCTION',basisType:'MAXIMUM_BID_CEILING',principal,currency:auction.currency,resource:auction,metadata:{auctionId:auction.id,objectId:auction.lotId,notFinalHammer:true}});
}
export function orderTotalCost(order){
 if(!order)throw Object.assign(new Error('Order not found'),{status:404,code:'ORDER_NOT_FOUND'});
 return finalize({context:'ORDER',basisType:'ORDER_PRICE',principal:order.price,currency:order.currency,resource:order,metadata:{orderId:order.id,objectId:order.lotId,shippingStatus:order.shippingStatus||null,taxStatus:order.taxStatus||null}});
}
export function totalCostCapabilities(){return{statusModel:['KNOWN','ESTIMATE','UNKNOWN','NOT_APPLICABLE'],neverInventRates:true,allInRequiresComplete:true,crossCurrencySummation:false};}
