import {test,expect} from '@playwright/test';

async function demoLogin(page,persona){
 return page.evaluate(async persona=>{const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona})});return{status:r.status,body:await r.json()}},persona);
}
async function post(page,path,csrf,body={},headers={}){
 return page.evaluate(async({path,csrf,body,headers})=>{const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrf,...headers},body:JSON.stringify(body)});let json={};try{json=await r.json()}catch{}return{status:r.status,body:json}},{path,csrf,body,headers});
}
async function publicResult(page,auctionId){
 return page.evaluate(async auctionId=>{const r=await fetch('/api/auctions/'+encodeURIComponent(auctionId)+'/result');return{status:r.status,body:await r.json()}},auctionId);
}
async function registerSale(page,csrf){
 const r=await post(page,'/api/sales/sale-collector-2026-09/register',csrf,{acceptTerms:true,termsVersion:'v20-browser-proof'});expect(r.status).toBe(200);return r;
}
async function ensureReserveMetAndClose(page,{auctionId,secondMax}){
 let history=await page.evaluate(async auctionId=>{const r=await fetch('/api/auctions/'+auctionId+'/history');return r.json()},auctionId);
 if(!history.auction.reserveMet){
  const buyer=await demoLogin(page,'BUYER');expect(buyer.status).toBe(200);await registerSale(page,buyer.body.csrf);
  const hugeMax=1_000_000+Math.floor(Date.now()/1000);
  const first=await post(page,'/api/auctions/'+auctionId+'/bid',buyer.body.csrf,{maxAmount:hugeMax},{'idempotency-key':'v20-first-'+Date.now()});
  expect(first.status).toBe(200);
  history=await page.evaluate(async auctionId=>{const r=await fetch('/api/auctions/'+auctionId+'/history');return r.json()},auctionId);
  if(!history.auction.reserveMet){
   const token=Date.now()+'-'+Math.random().toString(16).slice(2);
   const second=await page.evaluate(async token=>{const r=await fetch('/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({accountType:'BUYER',displayName:'V20 second bidder',email:'v20-'+token+'@example.test',password:'SecondBidder!20'})});return{status:r.status,body:await r.json()}},token);
   expect(second.status).toBe(201);await registerSale(page,second.body.csrf);
   const secondBid=await post(page,'/api/auctions/'+auctionId+'/bid',second.body.csrf,{maxAmount:secondMax},{'idempotency-key':'v20-second-'+token});
   expect(secondBid.status).toBe(200);expect(secondBid.body.auction?.reserveMet).toBe(true);
  }
 }
 const operator=await demoLogin(page,'OPERATOR');expect(operator.status).toBe(200);
 const closed=await post(page,'/api/operator/auctions/'+auctionId+'/close-preview',operator.body.csrf,{});
 expect([200,201,409]).toContain(closed.status);
 return{operator,settlementId:'set-'+auctionId};
}
async function advanceShipmentToDelivered(page,operator,shipmentId){
 let current=await page.evaluate(async id=>{const r=await fetch('/api/shipments/'+id);return{status:r.status,body:await r.json()}},shipmentId);
 expect(current.status).toBe(200);
 if(current.body.shipment.status==='QUOTE_REQUIRED'){
  const q=await post(page,'/api/shipments/'+shipmentId+'/quote',operator.body.csrf,{origin:'Amsterdam',destination:'Paris'});expect(q.status).toBe(200);current=q;
 }
 const next={QUOTED:'BOOKED',BOOKED:'PACKING',PACKING:'IN_TRANSIT',IN_TRANSIT:'DELIVERED'};
 while(next[current.body.shipment.status]){
  const target=next[current.body.shipment.status];
  current=await post(page,'/api/shipments/'+shipmentId+'/transition',operator.body.csrf,{status:target});
  expect(current.status).toBe(200);
 }
 expect(current.body.shipment.status).toBe('DELIVERED');
}

test('public auction result moves from hammer to completed sale without leaking identities',async({page},testInfo)=>{
 const cfg=testInfo.project.name.includes('mobile')?{auctionId:'auc-104',lotId:'lot-104',secondMax:8500}:{auctionId:'auc-105',lotId:'lot-105',secondMax:7600};
 await page.goto('/',{waitUntil:'domcontentloaded'});
 let result=await publicResult(page,cfg.auctionId);expect(result.status).toBe(200);

 if(result.body.result.auctionState!=='CLOSED'){
  await ensureReserveMetAndClose(page,cfg);
  result=await publicResult(page,cfg.auctionId);
 }
 if(result.body.result.status==='PENDING'){
  const operator=await demoLogin(page,'OPERATOR');expect(operator.status).toBe(200);
  const closed=await post(page,'/api/operator/auctions/'+cfg.auctionId+'/close-preview',operator.body.csrf,{});
  expect([200,201,409]).toContain(closed.status);
  result=await publicResult(page,cfg.auctionId);
 }
 const buyer=await demoLogin(page,'BUYER');expect(buyer.status).toBe(200);
 const publicJson=JSON.stringify(result.body);
 expect(publicJson).not.toContain(buyer.body.account.id);
 expect(publicJson).not.toContain('set-'+cfg.auctionId);
 expect(publicJson).not.toContain('buyerAccountId');

 if(result.body.result.status==='HAMMERED'){
  expect(result.body.result.hammerAmountMinor).toBeGreaterThan(0);
  expect(result.body.result.realizedAmountMinor).toBeNull();
  expect(result.body.result.final).toBe(false);
  await page.goto('/#auctions',{waitUntil:'domcontentloaded'});
  const card=page.locator('[data-auction-id="'+cfg.auctionId+'"]');await expect(card).toBeVisible();
  await expect(card.locator('.auction-result-card-v20')).toBeVisible();await expect(card).toContainText(/Цена молотка|Hammered|Hammer amount/i);
  await card.locator('h3').click();
  const dossier=page.locator('#dialog[open]');await expect(dossier).toBeVisible();
  const resultPanel=dossier.locator('#dossierAuctionResultV20');await expect(resultPanel).toBeVisible();await expect(resultPanel).toContainText(/не подтверждение завершённой продажи|not confirmation of a completed sale/i);
  await dossier.locator('[data-close-dialog]').click();
 }
 let afterPayment=await publicResult(page,cfg.auctionId);
 if(!['SALE_IN_PROGRESS','SOLD'].includes(afterPayment.body.result.status)){
  const paid=await post(page,'/api/settlements/set-'+cfg.auctionId+'/payment-preview',buyer.body.csrf,{});
  expect([200,201]).toContain(paid.status);
  afterPayment=await publicResult(page,cfg.auctionId);
 }
 expect(['SALE_IN_PROGRESS','SOLD']).toContain(afterPayment.body.result.status);
 if(afterPayment.body.result.status!=='SOLD'){
  const operator=await demoLogin(page,'OPERATOR');expect(operator.status).toBe(200);
  const shipmentId='shp-set-'+cfg.auctionId;
  await advanceShipmentToDelivered(page,operator,shipmentId);
  const buyerAgain=await demoLogin(page,'BUYER');expect(buyerAgain.status).toBe(200);
  const confirmed=await post(page,'/api/shipments/'+shipmentId+'/confirm-receipt',buyerAgain.body.csrf,{});
  expect(confirmed.status).toBe(200);
 }
 const sold=await publicResult(page,cfg.auctionId);
 expect(sold.body.result.status).toBe('SOLD');expect(sold.body.result.final).toBe(true);
 expect(sold.body.result.realizedAmountMinor).toBe(sold.body.result.hammerAmountMinor);
 expect(JSON.stringify(sold.body)).not.toContain(buyer.body.account.id);

 await page.goto('/?object='+cfg.lotId+'#shop',{waitUntil:'domcontentloaded'});
 const soldPanel=page.locator('#dossierAuctionResultV20');await expect(soldPanel).toBeVisible();await expect(soldPanel).toContainText(/Продано|Sold/i);await expect(soldPanel).toContainText(/Реализованная цена|Realized price/i);
});
