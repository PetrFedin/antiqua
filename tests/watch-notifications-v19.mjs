import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';

const port=12030,base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['server-v14.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),PREVIEW_MODE:'true',APP_SECRET:crypto.randomBytes(32).toString('hex'),NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
class Client{
 constructor(){this.cookies=new Map()}
 header(){return[...this.cookies].map(([k,v])=>`${k}=${v}`).join('; ')}
 async call(path,o={}){const h={'content-type':'application/json',...(o.headers||{})};if(this.cookies.size)h.cookie=this.header();if(!['GET','HEAD'].includes((o.method||'GET').toUpperCase())&&this.cookies.get('antiqua_csrf'))h['x-csrf-token']=decodeURIComponent(this.cookies.get('antiqua_csrf'));const r=await fetch(base+path,{...o,headers:h});for(const s of r.headers.getSetCookie?.()||[]){const [kv]=s.split(';'),i=kv.indexOf('=');if(i>0)this.cookies.set(kv.slice(0,i),kv.slice(i+1))}let body={};try{body=await r.json()}catch{}return{r,body}}
}
const login=async persona=>{const c=new Client(),x=await c.call('/api/auth/demo-login',{method:'POST',body:JSON.stringify({persona})});assert.equal(x.r.status,200);return c};
const watchNotifications=async c=>(await c.call('/api/client-state')).body.notifications.filter(n=>String(n.type).startsWith('WATCH_'));

try{
 let ready=false;for(let i=0;i<120;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break}}catch{}await sleep(100)}assert.equal(ready,true);
 const buyer=await login('BUYER'),seller=await login('SELLER');
 const buyer2=new Client(),password='Aa1!'+crypto.randomBytes(12).toString('hex');
 let x=await buyer2.call('/api/auth/register',{method:'POST',body:JSON.stringify({email:`watch-${crypto.randomUUID()}@example.test`,displayName:'Watch proof buyer',password,accountType:'BUYER'})});assert.equal(x.r.status,201);

 let cat=await(await fetch(base+'/api/catalog')).json(),listing109=cat.listings.find(x=>x.id==='lst-109'),assert.ok(listing109);
 const original109=listing109.price,next109=original109-100;

 x=await buyer.call('/api/lots/lot-109/alert',{method:'POST',body:JSON.stringify({enabled:true})});assert.equal(x.r.status,200);assert.equal(x.body.flag,'WATCH');assert.equal(x.body.enabled,true);
 let state=(await buyer.call('/api/client-state')).body;assert.ok(state.watchAlerts.includes('lot-109'));
 x=await seller.call('/api/seller/listings/lst-109',{method:'PATCH',body:JSON.stringify({price:next109})});assert.equal(x.r.status,200);assert.equal(x.body.watch.subscribers,1);
 let ns=await watchNotifications(buyer),listingEvents=ns.filter(n=>n.type==='WATCH_LISTING_CHANGED'&&n.payload.objectId==='lot-109');assert.equal(listingEvents.length,1);assert.equal(listingEvents[0].payload.previousPrice,original109);assert.equal(listingEvents[0].payload.price,next109);assert.equal(listingEvents[0].payload.priceChanged,true);

 x=await seller.call('/api/seller/listings/lst-109',{method:'PATCH',body:JSON.stringify({price:next109})});assert.equal(x.r.status,200);ns=await watchNotifications(buyer);assert.equal(ns.filter(n=>n.type==='WATCH_LISTING_CHANGED'&&n.payload.objectId==='lot-109').length,1,'same listing state must not create duplicate WATCH event');

 x=await buyer.call('/api/lots/lot-109/alert',{method:'POST',body:JSON.stringify({enabled:false})});assert.equal(x.body.enabled,false);
 x=await seller.call('/api/seller/listings/lst-109',{method:'PATCH',body:JSON.stringify({price:original109})});assert.equal(x.r.status,200);ns=await watchNotifications(buyer);assert.equal(ns.filter(n=>n.type==='WATCH_LISTING_CHANGED'&&n.payload.objectId==='lot-109').length,1,'unwatched object must stop notifications');

 x=await buyer2.call('/api/lots/lot-109/alert',{method:'POST',body:JSON.stringify({enabled:true})});assert.equal(x.r.status,200);
 x=await buyer.call('/api/listings/lst-109/buy',{method:'POST',body:'{}'});assert.equal(x.r.status,201);const orderId=x.body.order.id;
 let n2=await watchNotifications(buyer2),availability=n2.filter(n=>n.type==='WATCH_LISTING_CHANGED'&&n.payload.objectId==='lot-109');assert.equal(availability.length,1);assert.equal(availability[0].payload.previousStatus,'ACTIVE');assert.equal(availability[0].payload.status,'RESERVED');
 x=await buyer.call(`/api/orders/${orderId}/cancel`,{method:'POST',body:'{}'});assert.equal(x.r.status,200);
 n2=await watchNotifications(buyer2);availability=n2.filter(n=>n.type==='WATCH_LISTING_CHANGED'&&n.payload.objectId==='lot-109');assert.equal(availability.length,2);assert.ok(availability.some(n=>n.payload.previousStatus==='RESERVED'&&n.payload.status==='ACTIVE'));

 x=await buyer2.call('/api/lots/lot-101/alert',{method:'POST',body:JSON.stringify({enabled:true})});assert.equal(x.r.status,200);
 cat=await(await fetch(base+'/api/catalog')).json();const auction=cat.auctions.find(a=>a.lotId==='lot-101');assert.ok(auction);
 x=await buyer.call(`/api/sales/${cat.sale.id}/register`,{method:'POST',body:JSON.stringify({acceptTerms:true,termsVersion:'watch-v19'})});assert.equal(x.r.status,200);
 const key='watch-'+crypto.randomUUID(),body=JSON.stringify({maxAmount:auction.currentBid+auction.increment*3});
 x=await buyer.call(`/api/auctions/${auction.id}/bid`,{method:'POST',headers:{'idempotency-key':key},body});assert.equal(x.r.status,201);
 n2=await watchNotifications(buyer2);let auctionEvents=n2.filter(n=>n.type==='WATCH_AUCTION_ACTIVITY'&&n.payload.objectId==='lot-101');assert.equal(auctionEvents.length,1);assert.equal(auctionEvents[0].payload.auctionId,auction.id);assert.ok(auctionEvents[0].payload.currentBid>=auction.currentBid);
 x=await buyer.call(`/api/auctions/${auction.id}/bid`,{method:'POST',headers:{'idempotency-key':key},body});assert.equal(x.r.status,200);assert.equal(x.body.idempotent,true);
 n2=await watchNotifications(buyer2);auctionEvents=n2.filter(n=>n.type==='WATCH_AUCTION_ACTIVITY'&&n.payload.objectId==='lot-101');assert.equal(auctionEvents.length,1,'idempotent bid replay must not duplicate WATCH notification');

 console.log('ANTIQUA v19 WATCH: preference -> listing price/status -> order availability -> auction activity -> replay suppression passed');
}finally{child.kill('SIGTERM')}
