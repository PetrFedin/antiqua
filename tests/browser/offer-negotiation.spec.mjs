import {test,expect} from '@playwright/test';

async function demoLogin(page,persona){
 return page.evaluate(async persona=>{const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona})});return{status:r.status,body:await r.json()}},persona)
}
async function apiPost(page,path,body,csrf){
 return page.evaluate(async args=>{const r=await fetch(args.path,{method:'POST',headers:{'content-type':'application/json','x-csrf-token':args.csrf},body:JSON.stringify(args.body)});let json={};try{json=await r.json()}catch{}return{status:r.status,body:json}}, {path,body,csrf})
}
async function openPassport(page,objectId){
 await page.goto('/#shop',{waitUntil:'domcontentloaded'});
 const card=page.locator('[data-open-passport="'+objectId+'"]:visible').first();await expect(card).toBeVisible();await card.locator('h3').click();
 const dialog=page.locator('#dialog[open]');await expect(dialog).toBeVisible();return dialog
}
async function openNegotiation(page,offerId){
 await page.goto('/#account',{waitUntil:'domcontentloaded'});
 const ops=page.locator('#v14Operations');await expect(ops).toBeVisible();
 await ops.locator('[data-v14-tab="offers"]').click();
 const card=ops.locator('[data-v22-offer-card="'+offerId+'"]');await expect(card).toBeVisible();await card.locator('[data-v22-offer-open]').click();
 const sheet=page.locator('#actionSheet[open]');await expect(sheet).toBeVisible();return sheet
}

test('offer -> counteroffer -> optimistic-lock proof -> accept -> exactly-once order uses the existing payment order flow',async({page},testInfo)=>{
 const mobile=testInfo.project.name.includes('mobile');
 const cfg=mobile?{listingId:'lst-110',objectId:'lot-110',offer:5000,counter:5300}:{listingId:'lst-109',objectId:'lot-109',offer:7000,counter:7400};
 let orderId=null,buyerCsrf=null;
 try{
  await page.goto('/',{waitUntil:'domcontentloaded'});
  let login=await demoLogin(page,'BUYER');expect(login.status).toBe(200);buyerCsrf=login.body.csrf;
  await page.reload({waitUntil:'domcontentloaded'});
  const dialog=await openPassport(page,cfg.objectId);
  const offerButton=dialog.locator('[data-offer="'+cfg.listingId+'"]');await expect(offerButton).toBeVisible();await offerButton.click();
  let sheet=page.locator('#actionSheet[open] .v22-create-offer');await expect(sheet).toBeVisible();
  await sheet.locator('#offerAmount').fill(String(cfg.offer));await sheet.locator('#offerComment').fill('Browser '+testInfo.project.name+' opening offer');
  await sheet.locator('#offerTtl').selectOption('72');
  const createWait=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/listings/'+cfg.listingId+'/offers'&&r.request().method()==='POST');
  await sheet.locator('#confirmOffer').click();
  const createResponse=await createWait;expect([200,201]).toContain(createResponse.status());const created=await createResponse.json();
  const offerId=created.offer?.id;expect(offerId).toBeTruthy();expect(created.offer.version).toBe(1);expect(created.offer.status).toBe('OPEN');

  login=await demoLogin(page,'SELLER');expect(login.status).toBe(200);
  sheet=await openNegotiation(page,offerId);await expect(sheet).toContainText(/Ваш ход|Your action/i);
  await sheet.locator('[data-v22-counter="'+offerId+'"]').click();
  const counterForm=page.locator('#v22CounterForm');await expect(counterForm).toBeVisible();await counterForm.locator('[name="amount"]').fill(String(cfg.counter));
  await counterForm.locator('[name="comment"]').fill('Dealer browser counter');
  const counterWait=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/offers/'+offerId+'/actions'&&r.request().method()==='POST');
  await counterForm.locator('button[type="submit"]').click();
  const counterResponse=await counterWait;expect(counterResponse.status()).toBe(201);const countered=await counterResponse.json();
  expect(countered.offer.version).toBe(2);expect(countered.offer.currentAmountMinor).toBe(cfg.counter*100);expect(countered.offer.awaitingRole).toBe('BUYER');

  login=await demoLogin(page,'BUYER');expect(login.status).toBe(200);buyerCsrf=login.body.csrf;
  const stale=await apiPost(page,'/api/offers/'+offerId+'/actions',{action:'ACCEPT',expectedVersion:1,clientActionId:'stale-'+Date.now()+'-'+Math.random()},buyerCsrf);
  expect(stale.status).toBe(409);expect(stale.body.code).toBe('OFFER_VERSION_CONFLICT');expect(stale.body.currentVersion).toBeUndefined();

  sheet=await openNegotiation(page,offerId);await expect(sheet).toContainText(/Ваш ход|Your action/i);
  const accept=sheet.locator('[data-v22-offer-action="ACCEPT"]');await expect(accept).toBeVisible();
  const acceptWait=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/offers/'+offerId+'/actions'&&r.request().method()==='POST');
  await accept.click();
  const acceptResponse=await acceptWait;expect(acceptResponse.status()).toBe(201);
  const accepted=await acceptResponse.json(),acceptBody=acceptResponse.request().postDataJSON();
  orderId=accepted.order?.id;expect(orderId).toBeTruthy();expect(accepted.offer.status).toBe('ACCEPTED');expect(accepted.offer.version).toBe(3);
  expect(accepted.order.sourceType).toBe('OFFER');expect(accepted.order.offerId).toBe(offerId);expect(accepted.order.status).toBe('AWAITING_PAYMENT_CONNECTOR');

  const replay=await apiPost(page,'/api/offers/'+offerId+'/actions',acceptBody,buyerCsrf);
  expect(replay.status).toBe(200);expect(replay.body.idempotent).toBe(true);expect(replay.body.order.id).toBe(orderId);

  const order=await page.evaluate(async id=>{const r=await fetch('/api/orders/'+id);return{status:r.status,body:await r.json()}},orderId);
  expect(order.status).toBe(200);expect(order.body.order.id).toBe(orderId);expect(order.body.order.offerId).toBe(offerId);
  expect(order.body.order.status).toBe('AWAITING_PAYMENT_CONNECTOR');
 }finally{
  if(orderId){
   try{
    const login=await demoLogin(page,'BUYER');
    if(login.status===200)await apiPost(page,'/api/orders/'+orderId+'/cancel',{},login.body.csrf)
   }catch{}
  }
 }
});
