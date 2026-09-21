import {db} from './runtime-v09.mjs';
import {getAuthoritativePublicAuction} from './auction-authority-v15.mjs';
import {getSettlement} from './commerce-lifecycle-v16.mjs';

const SYSTEM={id:null,roles:['ADMIN'],sellerId:null};

function publicSettlementStatus(status){
 const s=String(status||'').toUpperCase();
 if(s==='COMPLETED')return{status:'SOLD',final:true,realized:true};
 if(['PAID','FULFILLMENT'].includes(s))return{status:'SALE_IN_PROGRESS',final:false,realized:false};
 if(['PAYMENT_DUE','PAYMENT_PROCESSING'].includes(s))return{status:'HAMMERED',final:false,realized:false};
 if(s==='DISPUTED')return{status:'UNDER_REVIEW',final:false,realized:false};
 if(s==='NONPAYMENT')return{status:'NOT_COMPLETED',final:false,realized:false};
 if(s==='REOFFERED')return{status:'REOFFERED',final:true,realized:false};
 if(s==='VOID')return{status:'VOID',final:true,realized:false};
 return{status:'PENDING',final:false,realized:false};
}

export function projectPublicAuctionResult(auction,settlement=null){
 if(!auction)return null;
 const base={auctionId:auction.id,objectId:auction.lotId,currency:auction.currency||settlement?.currency||'EUR',bidCount:Number(auction.bidCount||0),endedAt:auction.endsAt||null,auctionState:auction.state,final:false,status:auction.state,hammerAmountMinor:null,realizedAmountMinor:null};
 if(auction.state!=='CLOSED')return base;
 const hammerAmountMinor=settlement?Number(settlement.winningAmountMinor||0):auction.reserveMet?Math.round(Number(auction.currentBid||0)*100):null;
 if(!settlement){
  if(!auction.reserveMet)return{...base,status:'UNSOLD',final:true};
  return{...base,status:'PENDING',hammerAmountMinor};
 }
 const publicStatus=publicSettlementStatus(settlement.status);
 return{...base,...publicStatus,hammerAmountMinor,realizedAmountMinor:publicStatus.realized?hammerAmountMinor:null};
}

async function settlementForAuction(auctionId){
 if(db.kind==='POSTGRES'){
  const r=(await db.pool.query('SELECT auction_id,winning_amount_minor,currency,status FROM auction_settlements WHERE auction_id=$1 ORDER BY created_at DESC LIMIT 1',[auctionId])).rows[0];
  return r?{auctionId:r.auction_id,winningAmountMinor:Number(r.winning_amount_minor||0),currency:r.currency,status:r.status}:null;
 }
 try{return await getSettlement(SYSTEM,`set-${auctionId}`)}catch{return null}
}

export async function getPublicAuctionResult(auctionId){
 const auction=await getAuthoritativePublicAuction(String(auctionId||''));if(!auction)return null;
 const settlement=auction.state==='CLOSED'?await settlementForAuction(auction.id):null;
 return projectPublicAuctionResult(auction,settlement);
}

export function auctionResultCapabilities(){return{
 publicResults:true,
 buyerIdentityExposed:false,
 settlementIdentityExposed:false,
 hammerVsRealizedSeparated:true,
 finalSaleRequiresSettlementCompleted:true,
 statuses:['SCHEDULED','LIVE','PENDING','HAMMERED','SALE_IN_PROGRESS','SOLD','UNSOLD','UNDER_REVIEW','NOT_COMPLETED','REOFFERED','VOID']
}}
