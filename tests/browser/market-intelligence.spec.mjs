import {test,expect} from '@playwright/test';

async function demoLogin(page,persona){
 return page.evaluate(async persona=>{const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona})});return{status:r.status,body:await r.json()}},persona)
}
async function post(page,path,csrf,body={},headers={}){
 return page.evaluate(async({path,csrf,body,headers})=>{const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrf,...headers},body:JSON.stringify(body)});let json={};try{json=await r.json()}catch{}return{status:r.status,body:json}},{path,csrf,body,headers})
}
async function registerSale(page,csrf){
 const r=await post(page,'/api/sales/sale-collector-2026-09/register',csrf,{acceptTerms:true,termsVersion:'v25-market-proof'});expect(r.status).toBe(200)
}
async function makeSold(page,auctionId){
 let result=await page.evaluate(async id=>{const r=await fetch('/api/auctions/'+id+'/result');return{status:r.status,body:await r.json()}},auctionId);
 if(result.body.result?.status==='SOLD')return result.body.result;

 let buyer=await demoLogin(page,'BUYER');expect(buyer.status).toBe(200);await registerSale(page,buyer.body.csrf);
 let history=await page.evaluate(async id=>(await fetch('/api/auctions/'+id+'/history')).json(),auctionId);
 if(!history.auction.reserveMet){
  const first=await post(page,'/api/auctions/'+auctionId+'/bid',buyer.body.csrf,{maxAmount:1000000},{'idempotency-key':'v25-first-'+Date.now()});
  expect([200,201]).toContain(first.status);
  history=await page.evaluate(async id=>(await fetch('/api/auctions/'+id+'/history')).json(),auctionId);
  if(!history.auction.reserveMet){
   const token=Date.now()+'-'+Math.random().toString(16).slice(2);
   const second=await page.evaluate(async token=>{const r=await fetch('/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({accountType:'BUYER',displayName:'V25 second bidder',email:'v25-'+token+'@example.test',password:'SecondBidder!25'})});return{status:r.status,body:await r.json()}},token);
   expect(second.status).toBe(201);await registerSale(page,second.body.csrf);
   const bid=await post(page,'/api/auctions/'+auctionId+'/bid',second.body.csrf,{maxAmount:18000},{'idempotency-key':'v25-second-'+token});
   expect([200,201]).toContain(bid.status);expect(bid.body.auction.reserveMet).toBe(true);
  }
 }
 const operator=await demoLogin(page,'OPERATOR');expect(operator.status).toBe(200);
 const closed=await post(page,'/api/operator/auctions/'+auctionId+'/close-preview',operator.body.csrf,{});
 expect([200,201,409]).toContain(closed.status);

 buyer=await demoLogin(page,'BUYER');expect(buyer.status).toBe(200);
 result=await page.evaluate(async id=>{const r=await fetch('/api/auctions/'+id+'/result');return{status:r.status,body:await r.json()}},auctionId);
 if(!['SALE_IN_PROGRESS','SOLD'].includes(result.body.result.status)){
  const paid=await post(page,'/api/settlements/set-'+auctionId+'/payment-preview',buyer.body.csrf,{});
  expect([200,201]).toContain(paid.status)
 }
 result=await page.evaluate(async id=>{const r=await fetch('/api/auctions/'+id+'/result');return{status:r.status,body:await r.json()}},auctionId);
 if(result.body.result.status!=='SOLD'){
  const shipmentId='shp-set-'+auctionId;
  let current=await page.evaluate(async id=>{const r=await fetch('/api/shipments/'+id);return{status:r.status,body:await r.json()}},shipmentId);expect(current.status).toBe(200);
  if(current.body.shipment.status==='QUOTE_REQUIRED')current=await post(page,'/api/shipments/'+shipmentId+'/quote',operator.body.csrf,{origin:'Amsterdam',destination:'Paris'});
  const next={QUOTED:'BOOKED',BOOKED:'PACKING',PACKING:'IN_TRANSIT',IN_TRANSIT:'DELIVERED'};
  while(next[current.body.shipment.status]){
   current=await post(page,'/api/shipments/'+shipmentId+'/transition',operator.body.csrf,{status:next[current.body.shipment.status]});expect(current.status).toBe(200)
  }
  buyer=await demoLogin(page,'BUYER');expect(buyer.status).toBe(200);
  const received=await post(page,'/api/shipments/'+shipmentId+'/confirm-receipt',buyer.body.csrf,{});expect(received.status).toBe(200)
 }
 result=await page.evaluate(async id=>{const r=await fetch('/api/auctions/'+id+'/result');return{status:r.status,body:await r.json()}},auctionId);
 expect(result.body.result.status).toBe('SOLD');expect(result.body.result.realizedAmountMinor).toBeGreaterThan(0);return result.body.result
}

test('Object Passport shows explainable comparable SOLD result with realized range separated from hammer',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});
 const sold=await makeSold(page,'auc-101');
 expect(sold.hammerAmountMinor).toBe(sold.realizedAmountMinor);

 const api=await page.evaluate(async()=>{const r=await fetch('/api/lots/lot-106/comparables?limit=8');return{status:r.status,body:await r.json()}});
 expect(api.status).toBe(200);
 const comp=api.body.items.find(x=>x.objectId==='lot-101');expect(comp).toBeTruthy();
 expect(comp.status).toBe('SOLD');expect(comp.realizedAmountMinor).toBe(sold.realizedAmountMinor);expect(comp.hammerAmountMinor).toBe(sold.hammerAmountMinor);
 expect(comp.reasons.some(x=>['MATERIAL_OVERLAP','PERIOD_OVERLAP'].includes(x.code))).toBe(true);
 expect(api.body.capabilities.priceUsedForMatching).toBe(false);expect(api.body.capabilities.realizedStatsSoldOnly).toBe(true);
 expect(api.body.summary.realizedByCurrency.EUR.count).toBeGreaterThan(0);

 await page.goto('/?object=lot-106#shop',{waitUntil:'domcontentloaded'});
 const dialog=page.locator('#dialog[open]');await expect(dialog).toBeVisible();
 const market=dialog.locator('#dossierMarketIntelligenceV25');await expect(market).toBeVisible();
 const card=market.locator('[data-market-comparable="lot-101"]');await expect(card).toBeVisible();
 await expect(card).toContainText(/Реализованная цена|Realized/i);await expect(card).toContainText(/Цена молотка|Hammer/i);
 await expect(card).toContainText(/ANTIQUA/i);
 await expect(market).toContainText(/Медиана|Median/i);
 await expect(market).toContainText(/Цена не участвует|Price is not used/i);
});
