import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
const port=11992,base=`http://127.0.0.1:${port}`;const child=spawn(process.execPath,['server-v08.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});const sleep=ms=>new Promise(r=>setTimeout(r,ms));const call=(p,path,opts={})=>fetch(base+path,{...opts,headers:{'content-type':'application/json','x-preview-client':p,...(opts.headers||{})}});
try{
 let ready=false;for(let i=0;i<50;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break}}catch{}await sleep(100)}assert.equal(ready,true);
 const h=await(await fetch(base+'/api/health')).json();assert.equal(h.version,'0.8.0');
 const cat=await(await call('preview-buyer','/api/catalog')).json();assert.ok(cat.lots.length>=12);assert.ok(cat.listings.length>=6);assert.ok(cat.sellers.length>=3);assert.ok(cat.categories.length>=6);
 const pass=await(await call('preview-buyer','/api/lots/lot-107/passport')).json();assert.equal(pass.lot.objectId,'AQ-107-2026');assert.ok(pass.lot.materials.en);assert.ok(Array.isArray(pass.lot.provenanceTimeline));assert.equal(pass.commercial.listing.id,'lst-107');
 const sp=await(await call('preview-buyer','/api/sellers/dealer-vermeer')).json();assert.equal(sp.seller.verified,true);assert.ok(sp.inventory.length>=2);assert.ok(sp.stats.totalViews>0);
 const b0=await(await call('preview-buyer','/api/client-state')).json();assert.equal(b0.kind,'BUYER');assert.ok(b0.unreadNotifications>=1);
 let r=await call('preview-buyer','/api/notifications/read-all',{method:'POST',body:'{}'});assert.equal(r.status,200);assert.equal((await r.json()).unread,0);
 r=await call('preview-buyer','/api/listings/lst-109/buy',{method:'POST',body:'{}'});assert.equal(r.status,201);const ord=(await r.json()).order;assert.equal(ord.status,'AWAITING_PAYMENT_CONNECTOR');assert.ok(ord.lot.title.en);
 r=await call('preview-buyer',`/api/orders/${ord.id}`,{method:'GET'});assert.equal(r.status,200);assert.equal((await r.json()).order.seller.id,'seller-preview');
 r=await call('preview-buyer',`/api/orders/${ord.id}/shipping-quote`,{method:'POST',body:JSON.stringify({country:'Netherlands'})});assert.equal(r.status,200);const quoted=(await r.json()).order;assert.equal(quoted.shippingStatus,'QUOTE_READY');assert.equal(quoted.shippingQuote.insuranceIncluded,true);
 r=await call('preview-buyer',`/api/orders/${ord.id}/cancel`,{method:'POST',body:'{}'});assert.equal(r.status,200);
 const seller=await(await call('preview-seller','/api/client-state')).json();assert.equal(seller.kind,'SELLER');assert.ok(seller.seller.drafts.length>=2);assert.ok(seller.seller.drafts.some(d=>d.checklist.percent<100));
 const d=seller.seller.drafts.find(x=>x.id==='draft-1');r=await call('preview-seller',`/api/seller/drafts/${d.id}/submit`,{method:'POST',body:'{}'});assert.equal(r.status,409);const incomplete=await r.json();assert.ok(incomplete.checklist.percent<100);
 const img='https://images.metmuseum.org/CRDImages/es/web-large/DP247929.jpg';r=await call('preview-seller',`/api/seller/drafts/${d.id}`,{method:'PATCH',body:JSON.stringify({media:[{url:img},{url:img+'?detail=1'},{url:img+'?condition=1'}]})});assert.equal(r.status,200);const updated=(await r.json()).draft;assert.equal(updated.checklist.ready,true);
 r=await call('preview-seller',`/api/seller/drafts/${d.id}/submit`,{method:'POST',body:'{}'});assert.equal(r.status,200);assert.equal((await r.json()).draft.status,'CATALOGUE_REVIEW');
 const auc=cat.auctions[0];r=await call('preview-buyer',`/api/sales/${cat.sale.id}/register`,{method:'POST',body:JSON.stringify({acceptTerms:true,country:'Netherlands'})});assert.equal(r.status,200);r=await call('preview-buyer',`/api/auctions/${auc.id}/bid`,{method:'POST',headers:{'idempotency-key':'v08-bid'},body:JSON.stringify({maxAmount:auc.currentBid+auc.increment*2})});assert.equal(r.status,201);
 const home=await fetch(base);assert.equal(home.status,200);assert.match(await home.text(),/app-v08\.js/);for(const f of ['styles-v07.css','styles-addon-v08.css','app-v08.js','core-v08.js','views-v08.js','dialogs-v08.js','i18n-v08.js'])assert.equal((await fetch(`${base}/${f}`)).status,200);
 console.log('ANTIQUA 0.8 smoke: 19/19 passed');
}finally{child.kill('SIGTERM')}
