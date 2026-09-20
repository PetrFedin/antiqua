import crypto from 'node:crypto';
import {db,notify} from './runtime-v09.mjs';
import {listObjectFlagAccounts} from './preferences-v14.mjs';
import {enqueueOutboxTx} from './outbox-v15.mjs';

const TYPES=new Set(['WATCH_LISTING_CHANGED','WATCH_AUCTION_ACTIVITY']);
const unique=xs=>[...new Set((xs||[]).map(String).filter(Boolean))];
const eventId=prefix=>prefix+'-'+crypto.randomUUID().replaceAll('-','').slice(0,20);

async function subscribersTx(client,objectId){
 const rows=(await client.query("SELECT account_id FROM account_object_flags WHERE object_id=$1 AND flag_type='WATCH' ORDER BY account_id",[String(objectId)])).rows;
 return rows.map(r=>String(r.account_id));
}
function cleanType(type){type=String(type||'').toUpperCase();if(!TYPES.has(type))throw Object.assign(new Error('Unsupported watch event type'),{status:400,code:'WATCH_EVENT_TYPE_INVALID'});return type}

export function watchCapabilities(){
 return{durableFlags:true,listingChanges:true,auctionActivity:true,postgresOutbox:true,exactlyOnceNotificationDelivery:true,selfEventSuppression:true};
}

export async function enqueueWatchNotificationsTx(client,{objectId,type,data={},excludeAccountIds=[],eventKey}){
 objectId=String(objectId||'');type=cleanType(type);eventKey=String(eventKey||'').trim();
 if(!objectId||!eventKey)throw Object.assign(new Error('Watch event objectId and eventKey required'),{status:400,code:'WATCH_EVENT_INVALID'});
 const excluded=new Set(unique(excludeAccountIds)),accounts=(await subscribersTx(client,objectId)).filter(id=>!excluded.has(id));
 let queued=0,idempotent=0;
 for(const accountId of accounts){
  const out=await enqueueOutboxTx(client,{topic:'NOTIFICATION',aggregateType:'OBJECT',aggregateId:objectId,payload:{accountId,type,data:{objectId,...data}},idempotencyKey:`watch:${eventKey}:${accountId}`});
  queued+=out.idempotent?0:1;idempotent+=out.idempotent?1:0;
 }
 return{subscribers:accounts.length,queued,idempotent,persistent:true};
}

export async function emitWatchNotificationsMemory({objectId,type,data={},excludeAccountIds=[]}){
 objectId=String(objectId||'');type=cleanType(type);if(!objectId)return{subscribers:0,delivered:0,persistent:false};
 const excluded=new Set(unique(excludeAccountIds)),accounts=(await listObjectFlagAccounts(db,objectId,'WATCH')).filter(id=>!excluded.has(id));
 for(const accountId of accounts)await notify(accountId,type,{objectId,...data});
 return{subscribers:accounts.length,delivered:accounts.length,persistent:false};
}

export function listingWatchData(before,after){
 if(!before||!after)return null;
 const priceChanged=Number(before.price)!==Number(after.price),statusChanged=String(before.status)!==String(after.status);
 if(!priceChanged&&!statusChanged)return null;
 return{listingId:String(after.id),previousPrice:Number(before.price),price:Number(after.price),currency:String(after.currency||before.currency||'EUR'),previousStatus:String(before.status),status:String(after.status),priceChanged,statusChanged};
}

export async function persistSellerListingWithWatch(before,after,{actorAccountId=null,eventKey=null}={}){
 const data=listingWatchData(before,after),key=eventKey||eventId('listing');
 if(db.kind!=='POSTGRES'){
  await db.putListing(after);
  const watch=data?await emitWatchNotificationsMemory({objectId:after.lotId,type:'WATCH_LISTING_CHANGED',data,excludeAccountIds:[actorAccountId]}):{subscribers:0,delivered:0,persistent:false};
  return{watch,eventKey:key};
 }
 const cx=await db.pool.connect();try{
  await cx.query('BEGIN');
  await cx.query(`INSERT INTO listings(id,object_id,seller_id,status,payload) VALUES($1,$2,$3,$4,$5)
    ON CONFLICT(id) DO UPDATE SET status=excluded.status,payload=excluded.payload,updated_at=now()`,[after.id,after.lotId,after.sellerId,after.status,after]);
  const watch=data?await enqueueWatchNotificationsTx(cx,{objectId:after.lotId,type:'WATCH_LISTING_CHANGED',data,excludeAccountIds:[actorAccountId],eventKey:key}):{subscribers:0,queued:0,idempotent:0,persistent:true};
  await cx.query('COMMIT');return{watch,eventKey:key};
 }catch(e){try{await cx.query('ROLLBACK')}catch{}Object.assign(after,structuredClone(before));throw e}finally{cx.release()}
}

export async function emitListingStatusMemory(before,after,{excludeAccountIds=[]}={}){
 const data=listingWatchData(before,after);if(!data)return{subscribers:0,delivered:0,persistent:false};
 return emitWatchNotificationsMemory({objectId:after.lotId,type:'WATCH_LISTING_CHANGED',data,excludeAccountIds});
}

export async function enqueueListingStatusTx(client,before,after,{excludeAccountIds=[],eventKey}={}){
 const data=listingWatchData(before,after);if(!data)return{subscribers:0,queued:0,idempotent:0,persistent:true};
 return enqueueWatchNotificationsTx(client,{objectId:after.lotId||after.objectId,type:'WATCH_LISTING_CHANGED',data,excludeAccountIds,eventKey});
}

export async function emitAuctionWatchMemory(auction,{actorAccountId=null}={}){
 return emitWatchNotificationsMemory({objectId:auction.lotId,type:'WATCH_AUCTION_ACTIVITY',excludeAccountIds:[actorAccountId],data:{auctionId:auction.id,currentBid:Number(auction.currentBid),currency:String(auction.currency||'EUR'),bidCount:Number(auction.bidCount||0),endsAt:auction.endsAt,reserveMet:Boolean(auction.reserveMet)}});
}

export async function enqueueAuctionWatchTx(client,auction,{actorAccountId=null,eventKey}={}){
 return enqueueWatchNotificationsTx(client,{objectId:auction.lotId,type:'WATCH_AUCTION_ACTIVITY',excludeAccountIds:[actorAccountId],eventKey,data:{auctionId:auction.id,currentBid:Number(auction.currentBid),currency:String(auction.currency||'EUR'),bidCount:Number(auction.bidCount||0),endsAt:auction.endsAt,reserveMet:Boolean(auction.reserveMet)}});
}
