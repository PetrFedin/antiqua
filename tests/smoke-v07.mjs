import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const port=11991,base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['server-v07.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const call=(persona,path,opts={})=>fetch(`${base}${path}`,{...opts,headers:{'x-preview-client':persona,'content-type':'application/json',...(opts.headers||{})}});
try{
let ready=false;for(let i=0;i<50;i++){try{if((await fetch(`${base}/api/health`)).ok){ready=true;break}}catch{}await sleep(100)}assert.equal(ready,true);
const health=await (await fetch(`${base}/api/health`)).json();assert.equal(health.version,'0.7.0');
const catalog=await (await call('preview-buyer','/api/catalog')).json();assert.ok(catalog.auctions.length>=6);assert.ok(catalog.listings.length>=6);assert.ok(catalog.sellers.length>=3);assert.ok(catalog.lots[0].title.ru&&catalog.lots[0].title.en);
const buyer=await (await call('preview-buyer','/api/client-state')).json();assert.equal(buyer.kind,'BUYER');
const seller=await (await call('preview-seller','/api/client-state')).json();assert.equal(seller.kind,'SELLER');assert.equal(seller.seller.profile.id,'seller-preview');
const a=catalog.auctions[0];let r=await call('preview-buyer',`/api/auctions/${a.id}/bid`,{method:'POST',body:JSON.stringify({maxAmount:a.currentBid+a.increment})});assert.equal(r.status,403);
r=await call('preview-buyer',`/api/sales/${catalog.sale.id}/register`,{method:'POST',body:JSON.stringify({acceptTerms:true,country:'Netherlands'})});assert.equal(r.status,200);
r=await call('preview-buyer',`/api/auctions/${a.id}/bid`,{method:'POST',headers:{'idempotency-key':'test-bid-1'},body:JSON.stringify({maxAmount:a.currentBid+a.increment*2})});assert.equal(r.status,201);
r=await call('preview-seller',`/api/auctions/${a.id}/bid`,{method:'POST',body:JSON.stringify({maxAmount:a.currentBid+a.increment*3})});assert.equal(r.status,403);
const offerListing=catalog.listings.find(x=>x.id==='lst-110');r=await call('preview-buyer',`/api/listings/${offerListing.id}/offers`,{method:'POST',body:JSON.stringify({amount:4800})});assert.equal(r.status,201);const offer=(await r.json()).offer;
let sellerState=await (await call('preview-seller','/api/client-state')).json();assert.ok(sellerState.offers.some(x=>x.id===offer.id));
r=await call('preview-seller',`/api/offers/${offer.id}/respond`,{method:'POST',body:JSON.stringify({action:'COUNTER',amount:5200})});assert.equal(r.status,200);
r=await call('preview-buyer',`/api/offers/${offer.id}/respond`,{method:'POST',body:JSON.stringify({action:'ACCEPT'})});assert.equal(r.status,200);const accepted=await r.json();assert.equal(accepted.order.status,'AWAITING_PAYMENT_CONNECTOR');
const buyListing=catalog.listings.find(x=>x.id==='lst-109');r=await call('preview-buyer',`/api/listings/${buyListing.id}/buy`,{method:'POST',body:'{}'});assert.equal(r.status,201);const order=(await r.json()).order;
r=await call('another-buyer',`/api/listings/${buyListing.id}/buy`,{method:'POST',body:'{}'});assert.equal(r.status,409);
r=await call('preview-buyer',`/api/orders/${order.id}/cancel`,{method:'POST',body:'{}'});assert.equal(r.status,200);
r=await call('preview-seller','/api/seller/listings',{method:'POST',body:JSON.stringify({titleEn:'A test object',titleRu:'Тестовый предмет',categoryEn:'Decorative Arts',categoryRu:'Декоративное искусство',price:5000,saleType:'BUY_NOW'})});assert.equal(r.status,201);const created=(await r.json()).listing;
r=await call('preview-seller',`/api/seller/listings/${created.id}/submit`,{method:'POST',body:'{}'});assert.equal(r.status,200);
const home=await fetch(base);assert.equal(home.status,200);assert.match(await home.text(),/styles-v07\.css/);
for(const f of ['i18n-v07.js','core-v07.js','views-shop-v07.js','views-account-v07.js','dialogs-v07.js','app-v07.js'])assert.equal((await fetch(`${base}/${f}`)).status,200);
console.log('ANTIQUA 0.7 modular smoke: 18/18 passed');
}finally{child.kill('SIGTERM')}
