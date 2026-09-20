import {db,listings,auctions,draftItems,offers,orders,lot} from './runtime-v09.mjs';
import {aggregateObjectFlags} from './preferences-v14.mjs';
import {listConversations,listSettlements,listDisputes} from './domain-e2e-v14.mjs';
import {aggregateObjectViews,engagementCapabilities} from './engagement-v17.mjs';

const clone=x=>x==null?x:structuredClone(x);
const localTitle=o=>o?.title||{en:o?.objectId||o?.id||'Object',ru:o?.objectId||o?.id||'Предмет'};
const add=(map,id,key,n=1)=>{if(!id)return;const row=map.get(id)||{};row[key]=(row[key]||0)+Number(n||0);map.set(id,row)};
const statuses=xs=>xs.reduce((a,x)=>(a[String(x.status||'UNKNOWN')]=(a[String(x.status||'UNKNOWN')]||0)+1,a),{});
const sum=(xs,key)=>xs.reduce((n,x)=>n+Number(x[key]||0),0);
const terminalDispute=new Set(['RESOLVED_BUYER','RESOLVED_SELLER','PARTIAL_REFUND','FULL_REFUND','CLOSED']);

function buildResult({account,objects,listingRows,draftRows,flags,views,conversations,offerRows,orderRows,auctionRows,settlements,disputes}){
 const byObject=new Map(objects.map(o=>[o.id,{objectId:o.id,objectCode:o.objectCode||o.objectId||o.id,title:localTitle(o),listingStatus:null,listingPrice:null,currency:o.currency||'EUR',views:Number(views[o.id]?.views||0),saved:Number(flags[o.id]?.SAVED||0),watching:Number(flags[o.id]?.WATCH||0),conversations:0,offers:0,acceptedOffers:0,orders:0,bids:0,bidders:0,settlements:0,settledValueMinor:0,settlementCurrency:null,openDisputes:0}]));
 const ensure=id=>{if(!byObject.has(id)){const o=lot(id)||{id,objectId:id,title:{en:id,ru:id},currency:'EUR'};byObject.set(id,{objectId:id,objectCode:o.objectId||id,title:localTitle(o),listingStatus:null,listingPrice:null,currency:o.currency||'EUR',views:Number(views[id]?.views||0),saved:Number(flags[id]?.SAVED||0),watching:Number(flags[id]?.WATCH||0),conversations:0,offers:0,acceptedOffers:0,orders:0,bids:0,bidders:0,settlements:0,settledValueMinor:0,settlementCurrency:null,openDisputes:0})}return byObject.get(id)};
 for(const x of listingRows){const r=ensure(x.objectId);r.listingStatus=x.status;r.listingPrice=x.price??null;r.currency=x.currency||r.currency}
 for(const x of conversations)ensure(x.objectId).conversations++;
 for(const x of offerRows){const r=ensure(x.objectId);r.offers+=Number(x.total||1);r.acceptedOffers+=Number(x.accepted||0)}
 for(const x of orderRows)ensure(x.objectId).orders+=Number(x.total||1);
 for(const x of auctionRows){const r=ensure(x.objectId);r.bids+=Number(x.bidCount||0);r.bidders+=Number(x.bidderCount||0)}
 for(const x of settlements){const r=ensure(x.objectId);r.settlements++;r.settledValueMinor+=Number(x.winningAmountMinor||0);r.settlementCurrency=x.currency||r.settlementCurrency||'EUR'}
 for(const x of disputes)if(!terminalDispute.has(String(x.status)))ensure(x.objectId).openDisputes++;
 const rows=[...byObject.values()].sort((a,b)=>b.orders-a.orders||b.offers-a.offers||b.conversations-a.conversations||(b.saved+b.watching)-(a.saved+a.watching)||b.bids-a.bids||b.views-a.views||String(a.objectCode).localeCompare(String(b.objectCode)));
 const settledByCurrency=settlements.reduce((a,x)=>{const currency=String(x.currency||'EUR').toUpperCase();a[currency]=(a[currency]||0)+Number(x.winningAmountMinor||0);return a},{});const summary={objects:rows.length,views:sum(rows,'views'),activeListings:listingRows.filter(x=>x.status==='ACTIVE').length,drafts:draftRows.length,saved:sum(rows,'saved'),watching:sum(rows,'watching'),conversations:sum(rows,'conversations'),offers:sum(rows,'offers'),acceptedOffers:sum(rows,'acceptedOffers'),orders:sum(rows,'orders'),bids:sum(rows,'bids'),bidders:sum(rows,'bidders'),settlements:sum(rows,'settlements'),settledByCurrency,openDisputes:sum(rows,'openDisputes')};
 return{sellerId:account.sellerId,measurement:{mode:'EVENTS_ONLY',viewsTracked:true,viewDefinition:'DEDUPED_30_MINUTE_PASSPORT_SESSIONS',windowMinutes:engagementCapabilities().windowMinutes,visitorIdentityExposed:false,generatedAt:new Date().toISOString()},summary,portfolio:{listings:statuses(listingRows),drafts:statuses(draftRows)},objects:rows.slice(0,24)};
}

async function postgresAnalytics(account){
 const sellerId=account.sellerId;
 const [objQ,listQ,draftQ,convQ,offerQ,orderQ,auctionQ,settleQ,disputeQ]=await Promise.all([
  db.pool.query(`SELECT DISTINCT o.id,o.object_code,o.passport FROM objects o LEFT JOIN listings l ON l.object_id=o.id WHERE o.seller_id=$1 OR l.seller_id=$1 ORDER BY o.id`,[sellerId]),
  db.pool.query(`SELECT object_id,status,payload FROM listings WHERE seller_id=$1 ORDER BY updated_at DESC`,[sellerId]),
  db.pool.query(`SELECT id,status,payload FROM seller_drafts WHERE seller_id=$1 ORDER BY updated_at DESC`,[sellerId]),
  db.pool.query(`SELECT object_id,count(*)::int total FROM conversations WHERE seller_id=$1 GROUP BY object_id`,[sellerId]),
  db.pool.query(`SELECT l.object_id,count(*)::int total,count(*) FILTER(WHERE o.status='ACCEPTED')::int accepted FROM offers o JOIN listings l ON l.id=o.listing_id WHERE o.seller_id=$1 GROUP BY l.object_id`,[sellerId]),
  db.pool.query(`SELECT object_id,count(*)::int total FROM orders WHERE seller_id=$1 GROUP BY object_id`,[sellerId]),
  db.pool.query(`SELECT a.object_id,count(b.id)::int bid_count,count(DISTINCT b.account_id)::int bidder_count FROM auctions a JOIN objects o ON o.id=a.object_id LEFT JOIN auction_bids b ON b.auction_id=a.id WHERE o.seller_id=$1 GROUP BY a.object_id`,[sellerId]),
  db.pool.query(`SELECT object_id,winning_amount_minor,currency,status FROM auction_settlements WHERE seller_id=$1`,[sellerId]),
  db.pool.query(`SELECT object_id,status FROM disputes WHERE seller_id=$1`,[sellerId])
 ]);
 const objects=objQ.rows.map(r=>({id:r.id,objectId:r.object_code,title:r.passport?.title,currency:r.passport?.currency||'EUR'}));
 const objectIds=[...new Set([...objects.map(x=>x.id),...listQ.rows.map(x=>x.object_id)])],flags=await aggregateObjectFlags(db,objectIds),views=await aggregateObjectViews(db,objectIds,{excludeAccountId:account.id});
 const listingRows=listQ.rows.map(r=>({objectId:r.object_id,status:r.status,price:Number(r.payload?.price??0)||null,currency:r.payload?.currency||'EUR'}));
 return buildResult({account,objects,listingRows,draftRows:draftQ.rows.map(r=>({status:r.status})),flags,views,
  conversations:convQ.rows.flatMap(r=>Array.from({length:Number(r.total||0)},()=>({objectId:r.object_id}))),
  offerRows:offerQ.rows.map(r=>({objectId:r.object_id,total:r.total,accepted:r.accepted})),
  orderRows:orderQ.rows.map(r=>({objectId:r.object_id,total:r.total})),
  auctionRows:auctionQ.rows.map(r=>({objectId:r.object_id,bidCount:r.bid_count,bidderCount:r.bidder_count})),
  settlements:settleQ.rows.map(r=>({objectId:r.object_id,winningAmountMinor:Number(r.winning_amount_minor||0),currency:r.currency,status:r.status})),
  disputes:disputeQ.rows.map(r=>({objectId:r.object_id,status:r.status}))
 });
}

async function memoryAnalytics(account){
 const sellerId=account.sellerId,sellerListings=[...listings.values()].filter(x=>x.sellerId===sellerId),objectIds=[...new Set(sellerListings.map(x=>x.lotId))],flags=await aggregateObjectFlags(db,objectIds),views=await aggregateObjectViews(db,objectIds,{excludeAccountId:account.id});
 const conversations=(await listConversations(account)).filter(x=>x.sellerId===sellerId);
 const settlements=(await listSettlements(account)).filter(x=>x.sellerId===sellerId);
 const disputes=(await listDisputes(account)).filter(x=>x.sellerId===sellerId);
 const sellerOffers=[...offers.values()].filter(x=>x.sellerId===sellerId),sellerOrders=[...orders.values()].filter(x=>x.sellerId===sellerId);
 const byOffers=new Map(),byOrders=new Map(),auctionRows=[];
 for(const x of sellerOffers){add(byOffers,x.lotId,'total');if(x.status==='ACCEPTED')add(byOffers,x.lotId,'accepted')}
 for(const x of sellerOrders)add(byOrders,x.lotId,'total');
 for(const a of auctions){if(!objectIds.includes(a.lotId)&&lot(a.lotId)?.sellerId!==sellerId)continue;auctionRows.push({objectId:a.lotId,bidCount:Number(a.bidCount||0),bidderCount:new Set((a.proxyBids||[]).map(x=>x.clientId)).size})}
 const objects=objectIds.map(id=>clone(lot(id))).filter(Boolean),listingRows=sellerListings.map(x=>({objectId:x.lotId,status:x.status,price:x.price,currency:x.currency})),draftRows=[...draftItems.values()].filter(x=>x.sellerId===sellerId);
 return buildResult({account,objects,listingRows,draftRows,flags,views,conversations,offerRows:[...byOffers].map(([objectId,x])=>({objectId,...x})),orderRows:[...byOrders].map(([objectId,x])=>({objectId,...x})),auctionRows,settlements,disputes});
}

export async function sellerAnalyticsFor(account){
 if(!account?.sellerId)throw Object.assign(new Error('Seller account required'),{status:403,code:'SELLER_REQUIRED'});
 return db.kind==='POSTGRES'?postgresAnalytics(account):memoryAnalytics(account);
}
