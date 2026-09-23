import {db,offers,orders,listing,uid,now,notify,requirePermission} from './runtime-v09.mjs';
import {majorToMinor,assertMinorAmount,normalizeCurrency,currencyExponent} from './money-v15.mjs';

const clone=x=>x==null?x:structuredClone(x);
const TERMINAL=new Set(['ACCEPTED','REJECTED','WITHDRAWN','EXPIRED']);
const ACTIONS=new Set(['COUNTER','ACCEPT','REJECT','WITHDRAW']);
const DEFAULT_EXPIRY_MS=72*60*60*1000;
const MAX_EXPIRY_MS=30*24*60*60*1000;
const fail=(status,code,message,extra={})=>{throw Object.assign(new Error(message),{status,code,...extra})};
const iso=v=>v?.toISOString?.()||v||null;
const minorToMajor=(amount,currency)=>assertMinorAmount(amount,{allowZero:false})/(10**currencyExponent(currency));

function roleFor(account,offer){
 if(!account)return null;
 if(account.id===offer.buyerAccountId)return 'BUYER';
 if(account.sellerId&&account.sellerId===offer.sellerId)return 'SELLER';
 if(account.roles?.some(r=>['ADMIN','TRUST_REVIEWER'].includes(r)))return 'OPERATOR';
 return null
}
function expiryFrom(value,{required=false}={}){
 if(value==null||value===''){
  if(required)return new Date(Date.now()+DEFAULT_EXPIRY_MS).toISOString();
  return null
 }
 const at=new Date(value),ms=at.getTime();
 if(!Number.isFinite(ms)||ms<=Date.now()+60_000)fail(400,'OFFER_EXPIRY_INVALID','Offer expiry must be at least one minute in the future');
 if(ms>Date.now()+MAX_EXPIRY_MS)fail(400,'OFFER_EXPIRY_TOO_LONG','Offer expiry may not exceed 30 days');
 return at.toISOString()
}
function commentFrom(v){
 const x=String(v||'').trim();
 if(x.length>2000)fail(400,'OFFER_COMMENT_TOO_LONG','Offer comment is too long');
 return x
}
function actionId(body){
 const x=String(body?.clientActionId||'').trim();
 if(x.length<8||x.length>160)fail(400,'CLIENT_ACTION_ID_INVALID','clientActionId is required');
 return x
}
function amountFrom(body,currency){
 if(body?.amountMinor!=null)return assertMinorAmount(body.amountMinor,{allowZero:false,name:'amountMinor'});
 if(body?.amount!=null)return majorToMinor(body.amount,currency);
 fail(400,'OFFER_AMOUNT_REQUIRED','Offer amount is required')
}
function mapRow(r){
 if(!r)return null;
 const p=r.payload||{};
 return{
  id:r.id,
  listingId:r.listing_id??r.listingId??p.listingId,
  objectId:p.objectId??p.lotId??r.objectId??null,
  lotId:p.objectId??p.lotId??r.objectId??null,
  buyerAccountId:r.buyer_account_id??r.buyerAccountId??p.buyerAccountId??p.buyerClientId,
  buyerClientId:r.buyer_account_id??r.buyerAccountId??p.buyerAccountId??p.buyerClientId,
  sellerId:r.seller_id??r.sellerId??p.sellerId,
  status:String(r.status??p.status??'OPEN').toUpperCase(),
  currentAmountMinor:Number(r.current_amount_minor??r.currentAmountMinor??p.currentAmountMinor??0),
  currency:String(r.currency??p.currency??'EUR').toUpperCase(),
  currentProposerRole:r.current_proposer_role??r.currentProposerRole??p.currentProposerRole??'BUYER',
  awaitingRole:r.awaiting_role??r.awaitingRole??p.awaitingRole??null,
  version:Number(r.version??p.version??1),
  expiresAt:iso(r.expires_at??r.expiresAt??p.expiresAt),
  acceptedOrderId:r.accepted_order_id??r.acceptedOrderId??p.acceptedOrderId??null,
  createIdempotencyKey:r.create_idempotency_key??r.createIdempotencyKey??p.createIdempotencyKey??null,
  comment:p.comment||'',
  createdAt:iso(r.created_at??r.createdAt??p.createdAt),
  updatedAt:iso(r.updated_at??r.updatedAt??p.updatedAt)
 }
}
function legacyPayload(o,{comment=o.comment||''}={}){
 const amount=minorToMajor(o.currentAmountMinor,o.currency);
 return{
  id:o.id,listingId:o.listingId,lotId:o.objectId,objectId:o.objectId,sellerId:o.sellerId,
  buyerClientId:o.buyerAccountId,buyerAccountId:o.buyerAccountId,status:o.status,
  buyerAmount:o.currentProposerRole==='BUYER'?amount:null,
  sellerAmount:o.currentProposerRole==='SELLER'?amount:null,
  currentAmountMinor:o.currentAmountMinor,currency:o.currency,currentProposerRole:o.currentProposerRole,
  awaitingRole:o.awaitingRole,version:o.version,expiresAt:o.expiresAt,acceptedOrderId:o.acceptedOrderId||null,
  createIdempotencyKey:o.createIdempotencyKey||null,comment,createdAt:o.createdAt,updatedAt:o.updatedAt
 }
}
function hydrateMemoryOffer(raw){
 const o=mapRow(raw);
 if(!o.currentAmountMinor){
  const currency=normalizeCurrency(raw.currency||'EUR'),major=raw.sellerAmount??raw.buyerAmount;
  o.currentAmountMinor=majorToMinor(major,currency);o.currency=currency
 }
 o.buyerAccountId=o.buyerAccountId||raw.buyerClientId;
 o.objectId=o.objectId||raw.lotId;
 o.lotId=o.objectId;
 o.expiresAt=o.expiresAt||new Date(Date.now()+DEFAULT_EXPIRY_MS).toISOString();
 o.version=Number(o.version||1);
 return o
}
function active(o){return !TERMINAL.has(o.status)}
function allowedActions(account,o){
 const r=roleFor(account,o);if(!r||TERMINAL.has(o.status))return[];
 if(r===o.awaitingRole)return ['COUNTER','ACCEPT','REJECT'];
 if(r===o.currentProposerRole)return ['WITHDRAW'];
 return []
}
function publicOffer(account,o,events=[]){
 return{...clone(o),participantRole:roleFor(account,o),allowedActions:allowedActions(account,o),history:events.map(clone)}
}
async function pgEvents(offerId,cx=db.pool){
 const rows=(await cx.query('SELECT * FROM offer_events WHERE offer_id=$1 ORDER BY version,created_at,id',[offerId])).rows;
 return rows.map(r=>({id:r.id,version:r.version,eventType:r.event_type,actorAccountId:r.actor_account_id||null,actorRole:r.actor_role,fromStatus:r.from_status,toStatus:r.to_status,amountMinor:Number(r.amount_minor),currency:r.currency,comment:r.comment||'',clientActionId:r.client_action_id||null,metadata:r.metadata||{},createdAt:iso(r.created_at)}))
}
function memoryEvents(raw){raw._events??=[];return raw._events}
async function loadPg(id,{forUpdate=false,cx=db.pool}={}){
 const row=(await cx.query('SELECT * FROM offers WHERE id=$1'+(forUpdate?' FOR UPDATE':''),[id])).rows[0];
 return mapRow(row)
}
async function loadListingPg(id,cx=db.pool,{forUpdate=false}={}){
 const row=(await cx.query('SELECT * FROM listings WHERE id=$1'+(forUpdate?' FOR UPDATE':''),[id])).rows[0];
 if(!row)return null;
 return{...(row.payload||{}),id:row.id,lotId:row.object_id,sellerId:row.seller_id,status:row.status}
}
async function expirePgIfDue(o){
 if(!o||!active(o)||Date.parse(o.expiresAt)>Date.now())return o;
 const cx=await db.pool.connect();let out=o;
 try{
  await cx.query('BEGIN');
  const locked=await loadPg(o.id,{forUpdate:true,cx});
  if(!locked||!active(locked)||Date.parse(locked.expiresAt)>Date.now()){await cx.query('COMMIT');return locked||o}
  const version=locked.version+1,ts=now(),next={...locked,status:'EXPIRED',awaitingRole:null,version,updatedAt:ts};
  const payload=legacyPayload(next);
  const row=(await cx.query('UPDATE offers SET status=$2,awaiting_role=NULL,version=$3,payload=$4,updated_at=$5 WHERE id=$1 RETURNING *',[locked.id,'EXPIRED',version,payload,ts])).rows[0];
  await cx.query('INSERT INTO offer_events(id,offer_id,version,event_type,actor_account_id,actor_role,from_status,to_status,amount_minor,currency,comment,metadata,created_at) VALUES($1,$2,$3,$4,NULL,$5,$6,$7,$8,$9,$10,$11,$12)',[uid('oev'),locked.id,version,'EXPIRED','SYSTEM',locked.status,'EXPIRED',locked.currentAmountMinor,locked.currency,'Offer expired',{expiresAt:locked.expiresAt},ts]);
  await cx.query('COMMIT');out=mapRow(row);offers.set(out.id,legacyPayload(out))
 }catch(e){try{await cx.query('ROLLBACK')}catch{}throw e}finally{cx.release()}
 return out
}
function expireMemoryIfDue(raw){
 const o=hydrateMemoryOffer(raw);if(!active(o)||Date.parse(o.expiresAt)>Date.now())return o;
 const before=o.status;o.status='EXPIRED';o.awaitingRole=null;o.version++;o.updatedAt=now();
 memoryEvents(raw).push({id:uid('oev'),version:o.version,eventType:'EXPIRED',actorAccountId:null,actorRole:'SYSTEM',fromStatus:before,toStatus:'EXPIRED',amountMinor:o.currentAmountMinor,currency:o.currency,comment:'Offer expired',clientActionId:null,metadata:{expiresAt:o.expiresAt},createdAt:o.updatedAt});
 Object.assign(raw,legacyPayload(o));return o
}
async function notifyCounterparty(o,actor,type,payload={}){
 let accountId=null;
 if(actor?.id===o.buyerAccountId){const sa=await db.findAccountBySellerId(o.sellerId);accountId=sa?.id||null}
 else accountId=o.buyerAccountId;
 if(accountId)await notify(accountId,type,{offerId:o.id,listingId:o.listingId,objectId:o.objectId,version:o.version,...payload})
}
function createOrderPayload(o,acceptedVersion){
 const ts=now(),price=minorToMajor(o.currentAmountMinor,o.currency);
 return{id:uid('ord'),listingId:o.listingId,lotId:o.objectId,objectId:o.objectId,sellerId:o.sellerId,buyerClientId:o.buyerAccountId,buyerAccountId:o.buyerAccountId,price,priceMinor:o.currentAmountMinor,currency:o.currency,status:'AWAITING_PAYMENT_CONNECTOR',paymentStatus:'NOT_CONFIGURED',invoiceStatus:'DRAFT_NOT_ISSUED',shippingStatus:'QUOTE_REQUIRED',taxStatus:'NOT_CALCULATED',sourceType:'OFFER',offerId:o.id,offerVersion:acceptedVersion,timeline:[{status:'OFFER_ACCEPTED',at:ts}],createdAt:ts,updatedAt:ts}
}
function validateCreate(account,li,body){
 requirePermission(account,'offer.create');
 if(!account?.roles?.includes('BUYER'))fail(403,'BUYER_REQUIRED','Buyer account required');
 if(!li||li.status!=='ACTIVE'||!li.negotiable)fail(409,'OFFERS_UNAVAILABLE','Offers are unavailable for this listing');
 if(account.sellerId&&account.sellerId===li.sellerId)fail(409,'OWN_LISTING_OFFER','Seller cannot make an offer on own listing');
 const currency=normalizeCurrency(body.currency||li.currency);
 if(currency!==normalizeCurrency(li.currency))fail(400,'OFFER_CURRENCY_MISMATCH','Offer currency must match the listing currency');
 const amountMinor=amountFrom(body,currency),askingMinor=majorToMinor(li.price,currency);
 if(amountMinor>=askingMinor)fail(400,'OFFER_NOT_BELOW_ASKING','Offer must be below the asking price');
 return{currency,amountMinor,expiresAt:expiryFrom(body.expiresAt,{required:true}),comment:commentFrom(body.comment),clientActionId:actionId(body)}
}
function assertVersion(body,o){
 const expected=Number(body?.expectedVersion);
 if(!Number.isSafeInteger(expected)||expected<1)fail(400,'EXPECTED_VERSION_REQUIRED','expectedVersion is required');
 if(expected!==o.version)fail(409,'OFFER_VERSION_CONFLICT','Offer changed; reload before acting',{currentVersion:o.version})
}
function validateAction(actor,o,body,events,li){
 const action=String(body.action||'').toUpperCase();if(!ACTIONS.has(action))fail(400,'OFFER_ACTION_INVALID','Invalid offer action');
 const actorRole=roleFor(actor,o);if(!actorRole)fail(404,'OFFER_NOT_FOUND','Offer not found');
 if(actorRole==='BUYER')requirePermission(actor,'offer.create');
 if(actorRole==='SELLER')requirePermission(actor,'seller.offer.respond');
 if(TERMINAL.has(o.status))fail(409,'OFFER_TERMINAL','Offer is already closed');
 assertVersion(body,o);
 if(action==='WITHDRAW'){
  if(actorRole!==o.currentProposerRole)fail(403,'OFFER_ACTION_DENIED','Only the current proposer can withdraw');
  return{action,actorRole,amountMinor:o.currentAmountMinor,comment:commentFrom(body.comment),expiresAt:o.expiresAt}
 }
 if(actorRole!==o.awaitingRole)fail(403,'OFFER_ACTION_DENIED','Action is not available to this participant');
 if(['ACCEPT','REJECT'].includes(action))return{action,actorRole,amountMinor:o.currentAmountMinor,comment:commentFrom(body.comment),expiresAt:o.expiresAt};
 const amountMinor=amountFrom(body,o.currency),askingMinor=majorToMinor(li.price,o.currency);
 if(actorRole==='SELLER'){
  if(amountMinor<=o.currentAmountMinor||amountMinor>askingMinor)fail(400,'SELLER_COUNTER_INVALID','Seller counteroffer must be above the buyer amount and no higher than asking price')
 }else{
  if(amountMinor>=o.currentAmountMinor)fail(400,'BUYER_COUNTER_INVALID','Buyer counteroffer must be below the seller counteroffer');
  const previousBuyer=[...events].reverse().find(e=>e.actorRole==='BUYER'&&['CREATED','COUNTERED'].includes(e.eventType));
  if(previousBuyer&&amountMinor<=previousBuyer.amountMinor)fail(400,'BUYER_COUNTER_NOT_IMPROVED','Buyer counteroffer must improve the previous buyer amount')
 }
 return{action,actorRole,amountMinor,comment:commentFrom(body.comment),expiresAt:expiryFrom(body.expiresAt,{required:true})}
}

export function offerNegotiationCapabilities(){
 return{contractVersion:'v22',states:['OPEN','COUNTERED','ACCEPTED','REJECTED','WITHDRAWN','EXPIRED'],actions:['COUNTER','ACCEPT','REJECT','WITHDRAW'],optimisticLocking:true,idempotency:true,immutableHistory:true,atomicAcceptToOrder:true,defaultExpiryHours:72,maxExpiryDays:30}
}

export async function createOffer(account,listingId,body={}){
 const clientActionId=actionId(body);
 if(db.kind!=='POSTGRES'){
  const replay=[...offers.values()].find(raw=>hydrateMemoryOffer(raw).buyerAccountId===account.id&&hydrateMemoryOffer(raw).createIdempotencyKey===clientActionId);
  if(replay){const o=expireMemoryIfDue(replay);return{offer:publicOffer(account,o,memoryEvents(replay)),idempotent:true}}
  const li=listing(String(listingId||'')),v=validateCreate(account,li,body),ts=now();
  const o={id:uid('off'),listingId:li.id,objectId:li.lotId,buyerAccountId:account.id,sellerId:li.sellerId,status:'OPEN',currentAmountMinor:v.amountMinor,currency:v.currency,currentProposerRole:'BUYER',awaitingRole:'SELLER',version:1,expiresAt:v.expiresAt,acceptedOrderId:null,createIdempotencyKey:v.clientActionId,comment:v.comment,createdAt:ts,updatedAt:ts};
  const raw=legacyPayload(o);
  raw._events=[{id:uid('oev'),version:1,eventType:'CREATED',actorAccountId:account.id,actorRole:'BUYER',fromStatus:null,toStatus:'OPEN',amountMinor:o.currentAmountMinor,currency:o.currency,comment:v.comment,clientActionId:v.clientActionId,metadata:{expiresAt:o.expiresAt},createdAt:ts}];
  offers.set(o.id,raw);await db.putOffer(raw);
  const sa=await db.findAccountBySellerId(o.sellerId);if(sa)await notify(sa.id,'NEW_OFFER',{offerId:o.id,listingId:o.listingId,objectId:o.objectId,version:o.version});
  return{offer:publicOffer(account,o,raw._events),idempotent:false}
 }
 const existing=(await db.pool.query('SELECT * FROM offers WHERE buyer_account_id=$1 AND create_idempotency_key=$2',[account.id,clientActionId])).rows[0];
 if(existing){const o=await expirePgIfDue(mapRow(existing));return{offer:publicOffer(account,o,await pgEvents(o.id)),idempotent:true}}
 const cx=await db.pool.connect();let out;
 try{
  await cx.query('BEGIN');
  const li=await loadListingPg(String(listingId||''),cx,{forUpdate:true}),v=validateCreate(account,li,body);
  const replay=(await cx.query('SELECT * FROM offers WHERE buyer_account_id=$1 AND create_idempotency_key=$2',[account.id,v.clientActionId])).rows[0];
  if(replay){await cx.query('COMMIT');const o=mapRow(replay);return{offer:publicOffer(account,o,await pgEvents(o.id)),idempotent:true}}
  const ts=now(),o={id:uid('off'),listingId:li.id,objectId:li.lotId,buyerAccountId:account.id,sellerId:li.sellerId,status:'OPEN',currentAmountMinor:v.amountMinor,currency:v.currency,currentProposerRole:'BUYER',awaitingRole:'SELLER',version:1,expiresAt:v.expiresAt,acceptedOrderId:null,createIdempotencyKey:v.clientActionId,comment:v.comment,createdAt:ts,updatedAt:ts},payload=legacyPayload(o);
  const row=(await cx.query('INSERT INTO offers(id,listing_id,buyer_account_id,seller_id,status,payload,version,expires_at,current_amount_minor,currency,current_proposer_role,awaiting_role,create_idempotency_key,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14) RETURNING *',[o.id,o.listingId,o.buyerAccountId,o.sellerId,o.status,payload,o.version,o.expiresAt,o.currentAmountMinor,o.currency,o.currentProposerRole,o.awaitingRole,o.createIdempotencyKey,ts])).rows[0];
  await cx.query('INSERT INTO offer_events(id,offer_id,version,event_type,actor_account_id,actor_role,from_status,to_status,amount_minor,currency,comment,client_action_id,metadata,created_at) VALUES($1,$2,1,$3,$4,$5,NULL,$6,$7,$8,$9,$10,$11,$12)',[uid('oev'),o.id,'CREATED',account.id,'BUYER','OPEN',o.currentAmountMinor,o.currency,v.comment,v.clientActionId,{expiresAt:o.expiresAt},ts]);
  await cx.query('COMMIT');out=mapRow(row);offers.set(out.id,legacyPayload(out))
 }catch(e){try{await cx.query('ROLLBACK')}catch{}if(e?.code==='23505'){const replay=(await db.pool.query('SELECT * FROM offers WHERE buyer_account_id=$1 AND create_idempotency_key=$2',[account.id,clientActionId])).rows[0];if(replay){const o=mapRow(replay);return{offer:publicOffer(account,o,await pgEvents(o.id)),idempotent:true}}}throw e}finally{cx.release()}
 const sa=await db.findAccountBySellerId(out.sellerId);if(sa)await notify(sa.id,'NEW_OFFER',{offerId:out.id,listingId:out.listingId,objectId:out.objectId,version:out.version});
 return{offer:publicOffer(account,out,await pgEvents(out.id)),idempotent:false}
}

export async function getOffer(account,id){
 if(db.kind==='POSTGRES'){
  let o=await loadPg(id);if(!o||!roleFor(account,o))return null;o=await expirePgIfDue(o);return publicOffer(account,o,await pgEvents(o.id))
 }
 const raw=offers.get(id);if(!raw)return null;const o=expireMemoryIfDue(raw);if(!roleFor(account,o))return null;return publicOffer(account,o,memoryEvents(raw))
}

export async function listOffers(account){
 if(db.kind==='POSTGRES'){
  const rows=account?.sellerId?(await db.pool.query('SELECT * FROM offers WHERE buyer_account_id=$1 OR seller_id=$2 ORDER BY updated_at DESC',[account.id,account.sellerId])).rows:(await db.pool.query('SELECT * FROM offers WHERE buyer_account_id=$1 ORDER BY updated_at DESC',[account.id])).rows;
  const out=[];for(const row of rows){const o=await expirePgIfDue(mapRow(row));out.push(publicOffer(account,o,await pgEvents(o.id)))}return out
 }
 const out=[];for(const raw of offers.values()){const o=expireMemoryIfDue(raw);if(roleFor(account,o))out.push(publicOffer(account,o,memoryEvents(raw)))}return out.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)))
}

export async function actOnOffer(account,id,body={}){
 const clientActionId=actionId(body);
 if(db.kind!=='POSTGRES'){
  const raw=offers.get(id);if(!raw)fail(404,'OFFER_NOT_FOUND','Offer not found');
  const o=expireMemoryIfDue(raw);if(!roleFor(account,o))fail(404,'OFFER_NOT_FOUND','Offer not found');
  const prior=memoryEvents(raw).find(e=>e.clientActionId===clientActionId&&e.actorAccountId===account.id);
  if(prior)return{offer:publicOffer(account,o,memoryEvents(raw)),order:o.acceptedOrderId?clone(orders.get(o.acceptedOrderId)||null):null,idempotent:true};
  const li=listing(o.listingId),v=validateAction(account,o,body,memoryEvents(raw),li),from=o.status,next=v.action==='COUNTER'?'COUNTERED':v.action==='ACCEPT'?'ACCEPTED':v.action==='REJECT'?'REJECTED':'WITHDRAWN',ts=now();
  o.status=next;o.currentAmountMinor=v.amountMinor;o.currentProposerRole=v.action==='COUNTER'?v.actorRole:o.currentProposerRole;o.awaitingRole=v.action==='COUNTER'?(v.actorRole==='BUYER'?'SELLER':'BUYER'):null;o.version++;o.expiresAt=v.expiresAt;o.updatedAt=ts;
  let order=null;
  if(next==='ACCEPTED'){
   if(!li||li.status!=='ACTIVE')fail(409,'LISTING_NOT_AVAILABLE','Listing is no longer available');
   order=createOrderPayload(o,o.version);o.acceptedOrderId=order.id;li.status='RESERVED';
   orders.set(order.id,order);await db.putOrder(order);await db.putListing(li);
   for(const other of offers.values()){const c=hydrateMemoryOffer(other);if(c.id!==o.id&&c.listingId===o.listingId&&active(c)){const before=c.status;c.status='REJECTED';c.awaitingRole=null;c.version++;c.updatedAt=ts;Object.assign(other,legacyPayload(c));memoryEvents(other).push({id:uid('oev'),version:c.version,eventType:'REJECTED',actorAccountId:null,actorRole:'SYSTEM',fromStatus:before,toStatus:'REJECTED',amountMinor:c.currentAmountMinor,currency:c.currency,comment:'Listing accepted another offer',clientActionId:null,metadata:{acceptedOfferId:o.id},createdAt:ts})}}
  }
  Object.assign(raw,legacyPayload(o,{comment:v.comment||o.comment}));
  memoryEvents(raw).push({id:uid('oev'),version:o.version,eventType:v.action==='COUNTER'?'COUNTERED':next,actorAccountId:account.id,actorRole:v.actorRole,fromStatus:from,toStatus:next,amountMinor:o.currentAmountMinor,currency:o.currency,comment:v.comment,clientActionId,metadata:{expiresAt:o.expiresAt,...(order?{orderId:order.id}:{})},createdAt:ts});
  await db.putOffer(raw);await notifyCounterparty(o,account,'OFFER_'+(v.action==='COUNTER'?'COUNTERED':next),order?{orderId:order.id}:{});
  if(order)await notify(o.buyerAccountId,'ORDER_CREATED',{orderId:order.id,lotId:o.objectId,offerId:o.id});
  return{offer:publicOffer(account,o,memoryEvents(raw)),order:clone(order),idempotent:false}
 }

 const early=(await db.pool.query('SELECT offer_id FROM offer_events WHERE actor_account_id=$1 AND client_action_id=$2',[account.id,clientActionId])).rows[0];
 if(early){
  if(early.offer_id!==id)fail(409,'CLIENT_ACTION_ID_CONFLICT','clientActionId already belongs to another offer');
  const o=await getOffer(account,id);if(!o)fail(404,'OFFER_NOT_FOUND','Offer not found');
  const order=o.acceptedOrderId?(await db.pool.query('SELECT payload FROM orders WHERE id=$1',[o.acceptedOrderId])).rows[0]?.payload||null:null;
  return{offer:o,order,idempotent:true}
 }

 const cx=await db.pool.connect();let changed,order=null,action,actorRole;
 try{
  await cx.query('BEGIN');
  const candidate=await loadPg(id,{cx});if(!candidate||!roleFor(account,candidate))fail(404,'OFFER_NOT_FOUND','Offer not found');
  const li=await loadListingPg(candidate.listingId,cx,{forUpdate:true});
  let o=await loadPg(id,{forUpdate:true,cx});if(!o||!roleFor(account,o))fail(404,'OFFER_NOT_FOUND','Offer not found');
  const replay=(await cx.query('SELECT offer_id FROM offer_events WHERE actor_account_id=$1 AND client_action_id=$2',[account.id,clientActionId])).rows[0];
  if(replay){
   if(replay.offer_id!==id)fail(409,'CLIENT_ACTION_ID_CONFLICT','clientActionId already belongs to another offer');
   await cx.query('COMMIT');const current=await getOffer(account,id);const priorOrder=current?.acceptedOrderId?(await db.pool.query('SELECT payload FROM orders WHERE id=$1',[current.acceptedOrderId])).rows[0]?.payload||null:null;
   return{offer:current,order:priorOrder,idempotent:true}
  }
  if(active(o)&&Date.parse(o.expiresAt)<=Date.now()){
   const version=o.version+1,ts=now(),next={...o,status:'EXPIRED',awaitingRole:null,version,updatedAt:ts},payload=legacyPayload(next);
   await cx.query('UPDATE offers SET status=$2,awaiting_role=NULL,version=$3,payload=$4,updated_at=$5 WHERE id=$1',[o.id,'EXPIRED',version,payload,ts]);
   await cx.query('INSERT INTO offer_events(id,offer_id,version,event_type,actor_account_id,actor_role,from_status,to_status,amount_minor,currency,comment,metadata,created_at) VALUES($1,$2,$3,$4,NULL,$5,$6,$7,$8,$9,$10,$11,$12)',[uid('oev'),o.id,version,'EXPIRED','SYSTEM',o.status,'EXPIRED',o.currentAmountMinor,o.currency,'Offer expired',{expiresAt:o.expiresAt},ts]);
   await cx.query('COMMIT');fail(409,'OFFER_EXPIRED','Offer has expired')
  }
  const events=await pgEvents(o.id,cx),v=validateAction(account,o,body,events,li);action=v.action;actorRole=v.actorRole;
  const from=o.status,next=action==='COUNTER'?'COUNTERED':action==='ACCEPT'?'ACCEPTED':action==='REJECT'?'REJECTED':'WITHDRAWN',version=o.version+1,ts=now();
  o={...o,status:next,currentAmountMinor:v.amountMinor,currentProposerRole:action==='COUNTER'?actorRole:o.currentProposerRole,awaitingRole:action==='COUNTER'?(actorRole==='BUYER'?'SELLER':'BUYER'):null,version,expiresAt:v.expiresAt,updatedAt:ts};
  if(next==='ACCEPTED'){
   if(!li||li.status!=='ACTIVE')fail(409,'LISTING_NOT_AVAILABLE','Listing is no longer available');
   order=createOrderPayload(o,version);o.acceptedOrderId=order.id;
   await cx.query('INSERT INTO orders(id,listing_id,object_id,buyer_account_id,seller_id,status,payload,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8)',[order.id,order.listingId,order.objectId,order.buyerAccountId,order.sellerId,order.status,order,order.createdAt]);
   const liPayload={...li,status:'RESERVED'};await cx.query('UPDATE listings SET status=$2,payload=$3,updated_at=$4 WHERE id=$1',[li.id,'RESERVED',liPayload,ts]);
   const competitors=(await cx.query("SELECT * FROM offers WHERE listing_id=$1 AND id<>$2 AND status IN ('OPEN','COUNTERED') FOR UPDATE",[o.listingId,o.id])).rows;
   for(const row of competitors){
    const c=mapRow(row),cv=c.version+1,cp=legacyPayload({...c,status:'REJECTED',awaitingRole:null,version:cv,updatedAt:ts});
    await cx.query('UPDATE offers SET status=$2,awaiting_role=NULL,version=$3,payload=$4,updated_at=$5 WHERE id=$1',[c.id,'REJECTED',cv,cp,ts]);
    await cx.query('INSERT INTO offer_events(id,offer_id,version,event_type,actor_account_id,actor_role,from_status,to_status,amount_minor,currency,comment,metadata,created_at) VALUES($1,$2,$3,$4,NULL,$5,$6,$7,$8,$9,$10,$11,$12)',[uid('oev'),c.id,cv,'REJECTED','SYSTEM',c.status,'REJECTED',c.currentAmountMinor,c.currency,'Listing accepted another offer',{acceptedOfferId:o.id},ts])
   }
  }
  const payload=legacyPayload(o,{comment:v.comment||o.comment});
  const row=(await cx.query('UPDATE offers SET status=$2,current_amount_minor=$3,current_proposer_role=$4,awaiting_role=$5,version=$6,expires_at=$7,accepted_order_id=$8,payload=$9,updated_at=$10 WHERE id=$1 RETURNING *',[o.id,o.status,o.currentAmountMinor,o.currentProposerRole,o.awaitingRole,o.version,o.expiresAt,o.acceptedOrderId,payload,ts])).rows[0];
  await cx.query('INSERT INTO offer_events(id,offer_id,version,event_type,actor_account_id,actor_role,from_status,to_status,amount_minor,currency,comment,client_action_id,metadata,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[uid('oev'),o.id,version,action==='COUNTER'?'COUNTERED':next,account.id,actorRole,from,next,o.currentAmountMinor,o.currency,v.comment,clientActionId,{expiresAt:o.expiresAt,...(order?{orderId:order.id}:{})},ts]);
  await cx.query('COMMIT');changed=mapRow(row);
  offers.set(changed.id,legacyPayload(changed));if(order){orders.set(order.id,order);const liMem=listing(changed.listingId);if(liMem)liMem.status='RESERVED'}
 }catch(e){try{await cx.query('ROLLBACK')}catch{}throw e}finally{cx.release()}
 await notifyCounterparty(changed,account,'OFFER_'+(action==='COUNTER'?'COUNTERED':changed.status),order?{orderId:order.id}:{});
 if(order)await notify(changed.buyerAccountId,'ORDER_CREATED',{orderId:order.id,lotId:changed.objectId,offerId:changed.id});
 return{offer:publicOffer(account,changed,await pgEvents(changed.id)),order:clone(order),idempotent:false}
}
