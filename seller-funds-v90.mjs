// ANTIQUA v90: currency-safe gross payment evidence for auction settlements.
// The amount is NOT seller payout, profit, GMV on offer, or net proceeds.
const PAID=new Set(['PAID','FULFILLMENT','COMPLETED']);
const CONTESTED=new Set(['DISPUTED']);
const AWAITING=new Set(['PAYMENT_DUE','PAYMENT_PROCESSING']);
const ALLOWED=new Set(['PAYMENT_DUE','PAYMENT_PROCESSING','PAID','FULFILLMENT',
 'COMPLETED','DISPUTED','NONPAYMENT','REOFFERED','VOID']);
const CURRENCY=/^[A-Z]{3}$/;
const validAmount=x=>{
 const n=Number(x);
 return x!==null&&x!==undefined&&x!==''&&
  Number.isSafeInteger(n)&&n>=0?n:null;
};
const sortedObject=map=>Object.fromEntries([...map].sort(([a],[b])=>a.localeCompare(b)));
const add=(map,c,n)=>map.set(c,(map.get(c)||0)+n);
export function summarizeSettlementFundsV90(records=[]){
 if(!Array.isArray(records))throw new TypeError('Settlement records must be an array');
 const gross=new Map(),contested=new Map();
 let paidCount=0,contestedCount=0,awaitingCount=0,unpaidFinalCount=0,invalidCount=0;
 const seen=new Set();
 for(const record of records){
  const id=record?.id;
  // Never double-count a duplicated event or duplicate DB payload. Records
  // without a stable identity cannot be assumed financially authoritative.
  if(typeof id!=='string'||!id||seen.has(id)){invalidCount++;continue}
  seen.add(id);
  const status=String(record.status||'');
  const currency=String(record.currency||'').toUpperCase();
  const amount=validAmount(record.winningAmountMinor);
  if(!ALLOWED.has(status)||!CURRENCY.test(currency)||amount===null){
   invalidCount++;continue;
  }
  if(PAID.has(status)){
   add(gross,currency,amount);paidCount++;
  }else if(CONTESTED.has(status)){
   add(contested,currency,amount);contestedCount++;
  }else if(AWAITING.has(status))awaitingCount++;
  else unpaidFinalCount++;
 }
 for(const map of [gross,contested]){
  for(const [currency,n] of map){
   if(!Number.isSafeInteger(n))throw new RangeError(
    'Unsafe monetary sum for '+currency);
  }
 }
 return {
  schemaVersion:'antiqua-gross-auction-payments-v1',
  denominator:'DISTINCT_VALID_SETTLEMENT_RECORDS',
  grossPaidByCurrency:sortedObject(gross),
  contestedByCurrency:sortedObject(contested),
  paidCount,contestedCount,awaitingCount,unpaidFinalCount,invalidCount,
  boundaries:{
   grossNotNet:true,notPayoutConfirmation:true,notBankReconciled:true,
   pendingExcluded:true,disputesExcludedFromPaid:true,
   crossCurrencySummation:false
  }
 };
}
export function conversationIntensityV90({threads,viewSessions}){
 if(!Number.isSafeInteger(threads)||threads<0||
    !Number.isSafeInteger(viewSessions)||viewSessions<0)return null;
 // Threads and de-duplicated view sessions have distinct grains: this ratio
 // is signal intensity, NEVER a purchaser conversion probability.
 return viewSessions===0?null:
  Math.round((threads/viewSessions)*1000)/10;
}
