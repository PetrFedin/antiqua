import {db,auctions,offers,orders,clientFor,lot,listing,step} from './runtime-v09.mjs';

const iso=v=>v?.toISOString?.()||v||null;
const fail=(status,code,message)=>{throw Object.assign(new Error(message),{status,code})};
const liveState=x=>{
 const now=Date.now(),start=Date.parse(iso(x.startsAt)||''),end=Date.parse(iso(x.endsAt)||'');
 if(String(x.status||x.state||'').toUpperCase()==='CLOSED'||Number.isFinite(end)&&now>=end)return'CLOSED';
 if(Number.isFinite(start)&&now<start)return'SCHEDULED';
 return'LIVE';
};

export function projectBidIntent(position,accountId){
 const state=liveState(position),currentBid=Number(position.currentBid||0),increment=Number(position.increment||step(currentBid)),leading=String(position.leaderAccountId||'')===String(accountId),maximum=Number(position.maxAmount||0),minimum=currentBid+increment;
 let nextAction;
 if(state==='LIVE'&&!leading)nextAction={type:'RAISE_MAX',auctionId:position.auctionId,minimum};
 else if(state==='LIVE'&&leading)nextAction={type:'WAIT',reason:'LEADING'};
 else if(state==='SCHEDULED')nextAction={type:'WAIT',reason:'NOT_STARTED'};
 else nextAction={type:'VIEW_RESULT',objectId:position.objectId};
 return{kind:'BID',auctionId:position.auctionId,objectId:position.objectId,currency:position.currency||'EUR',state,leading,maxAmount:maximum,currentBid,increment,minimumNextBid:minimum,bidCount:Number(position.bidCount||0),endsAt:iso(position.endsAt),updatedAt:iso(position.updatedAt||position.acceptedAt),needsAttention:nextAction.type==='RAISE_MAX',nextAction};
}

export function projectOfferIntent(offer,order=null){
 const status=String(offer.status||'').toUpperCase(),buyerAmount=Number(offer.buyerAmount||0),sellerAmount=offer.sellerAmount==null?null:Number(offer.sellerAmount),asking=Number(offer.askingPrice||listing(offer.listingId)?.price||0);
 let nextAction;
 if(status==='COUNTERED_BY_SELLER'){const counterMin=buyerAmount+1,counterMax=(sellerAmount||asking)-1,canCounter=counterMax>=counterMin;nextAction={type:'REVIEW_COUNTER',offerId:offer.id,primary:'ACCEPT',allowed:canCounter?['ACCEPT','COUNTER']:['ACCEPT'],counterMin:canCounter?counterMin:null,counterMax:canCounter?counterMax:null}};
 else if(status==='PENDING'||status==='COUNTERED_BY_BUYER')nextAction={type:'WAIT',reason:'SELLER_RESPONSE'};
 else if(status==='ACCEPTED'&&order)nextAction={type:'OPEN_ORDER',orderId:order.id};
 else if(status==='ACCEPTED')nextAction={type:'WAIT',reason:'ORDER_MATERIALIZING'};
 else nextAction={type:'CLOSED',reason:status||'CLOSED'};
 return{kind:'OFFER',offerId:offer.id,listingId:offer.listingId,objectId:offer.lotId||offer.objectId||listing(offer.listingId)?.lotId||null,currency:offer.currency||'EUR',status,buyerAmount,sellerAmount,askingPrice:asking,updatedAt:offer.updatedAt||offer.createdAt||null,needsAttention:nextAction.type==='REVIEW_COUNTER',nextAction};
}

async function pgBidPositions(accountId){
 const rows=(await db.pool.query(`SELECT p.auction_id,p.max_amount,p.accepted_at,p.updated_at,
  a.object_id,a.sale_id,a.status,a.current_bid,a.increment,a.bid_count,a.leader_account_id,a.starts_at,a.ends_at,a.state
  FROM auction_proxy_positions p JOIN auctions a ON a.id=p.auction_id
  WHERE p.account_id=$1 ORDER BY a.ends_at DESC,p.updated_at DESC`,[accountId])).rows;
 return rows.map(r=>({auctionId:r.auction_id,objectId:r.object_id,saleId:r.sale_id,status:r.status,currentBid:Number(r.current_bid||0),increment:Number(r.increment||0),bidCount:Number(r.bid_count||0),leaderAccountId:r.leader_account_id,startsAt:iso(r.starts_at),endsAt:iso(r.ends_at),currency:r.state?.currency||'EUR',maxAmount:Number(r.max_amount||0),acceptedAt:iso(r.accepted_at),updatedAt:iso(r.updated_at)}));
}
function memoryBidPositions(account){
 const c=clientFor(account),by=new Map();
 for(const b of c.bids||[]){const prior=by.get(b.auctionId);if(!prior||Date.parse(b.createdAt||0)>=Date.parse(prior.createdAt||0))by.set(b.auctionId,b)}
 return [...by.values()].map(b=>{const a=auctions.find(x=>x.id===b.auctionId)||{};return{auctionId:b.auctionId,objectId:a.lotId||b.lotId,status:a.state,currentBid:Number(a.currentBid||b.visibleAmount||0),increment:Number(a.increment||step(Number(a.currentBid||b.visibleAmount||0))),bidCount:Number(a.bidCount||0),leaderAccountId:a.leaderClientId||null,startsAt:a.startsAt,endsAt:a.endsAt,currency:a.currency||'EUR',maxAmount:Number((a.proxyBids||[]).find(x=>(x.clientId||x.accountId)===account.id)?.maxAmount||b.maxAmount||0),acceptedAt:b.createdAt,updatedAt:b.createdAt}});
}
async function pgOffers(accountId){return(await db.pool.query(`SELECT o.payload,l.payload AS listing_payload FROM offers o LEFT JOIN listings l ON l.id=o.listing_id WHERE o.buyer_account_id=$1 ORDER BY o.updated_at DESC,o.created_at DESC`,[accountId])).rows.map(x=>({...x.payload,askingPrice:Number(x.listing_payload?.price??x.payload?.askingPrice??0)}))}
async function pgOrders(accountId){return(await db.pool.query('SELECT payload FROM orders WHERE buyer_account_id=$1 ORDER BY updated_at DESC,created_at DESC',[accountId])).rows.map(x=>x.payload)}

export async function getBuyerIntents(account){
 if(!account?.roles?.includes('BUYER'))fail(403,'BUYER_REQUIRED','Buyer account required');
 const bidPositions=db.kind==='POSTGRES'?await pgBidPositions(account.id):memoryBidPositions(account);
 const buyerOffers=db.kind==='POSTGRES'?await pgOffers(account.id):[...offers.values()].filter(x=>x.buyerClientId===account.id);
 const buyerOrders=db.kind==='POSTGRES'?await pgOrders(account.id):[...orders.values()].filter(x=>x.buyerClientId===account.id);
 const orderForOffer=o=>buyerOrders.find(x=>x.listingId===o.listingId&&x.buyerClientId===account.id&&x.status!=='CANCELLED')||null;
 const bids=bidPositions.map(x=>projectBidIntent(x,account.id)),offerIntents=buyerOffers.map(o=>projectOfferIntent(o,orderForOffer(o)));
 const activeBids=bids.filter(x=>['LIVE','SCHEDULED'].includes(x.state)),activeOffers=offerIntents.filter(x=>['PENDING','COUNTERED_BY_SELLER','COUNTERED_BY_BUYER'].includes(x.status)||(x.status==='ACCEPTED'&&x.nextAction?.type==='WAIT'));
 const attention=[...activeBids.filter(x=>x.needsAttention),...activeOffers.filter(x=>x.needsAttention)].sort((a,b)=>Date.parse(b.updatedAt||0)-Date.parse(a.updatedAt||0));
 return{summary:{activeBids:activeBids.length,leadingBids:activeBids.filter(x=>x.leading).length,outbid:activeBids.filter(x=>x.state==='LIVE'&&!x.leading).length,activeOffers:activeOffers.length,needsAttention:attention.length},attention,bids,offers:offerIntents};
}

export function buyerIntentCapabilities(){return{databaseBackedBids:true,privateMaximumOwnerOnly:true,mutationsReuseExistingAuthorities:true,bidActions:['RAISE_MAX','WAIT','VIEW_RESULT'],offerActions:['REVIEW_COUNTER','WAIT','OPEN_ORDER','CLOSED']}}
