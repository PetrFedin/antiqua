import {test,expect} from '@playwright/test';

async function demoLogin(page,persona){
 return page.evaluate(async persona=>{const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona})});return{status:r.status,body:await r.json()}},persona)
}
async function apiPost(page,path,body,csrf){
 return page.evaluate(async args=>{const r=await fetch(args.path,{method:'POST',headers:{'content-type':'application/json','x-csrf-token':args.csrf},body:JSON.stringify(args.body)});let json={};try{json=await r.json()}catch{}return{status:r.status,body:json}}, {path,body,csrf})
}
async function openAccount(page){
 await page.goto('/#account',{waitUntil:'domcontentloaded'});
 const ops=page.locator('#v14Operations');await expect(ops).toBeVisible();return ops
}

test('Dealer Inbox projects an offer into a negotiating lead and routes back to offer authority',async({page},testInfo)=>{
 const mobile=testInfo.project.name.includes('mobile');
 const cfg=mobile?{listingId:'lst-110',objectId:'lot-110',offer:'5000'}:{listingId:'lst-109',objectId:'lot-109',offer:'7000'};
 let offerId=null;
 await page.goto('/',{waitUntil:'domcontentloaded'});
 let login=await demoLogin(page,'BUYER');expect(login.status).toBe(200);
 try{
  const offer=await apiPost(page,'/api/listings/'+cfg.listingId+'/offers',{
   amount:cfg.offer,currency:'EUR',expiresAt:new Date(Date.now()+72*3600000).toISOString(),
   comment:'Dealer Inbox browser offer',clientActionId:'v24-offer-'+Date.now()+'-'+Math.random()
  },login.body.csrf);
  expect([200,201]).toContain(offer.status);offerId=offer.body.offer?.id;expect(offerId).toBeTruthy();

  let ops=await openAccount(page);
  await expect(ops.locator('[data-v14-tab="dealer"]')).toHaveCount(0);

  login=await demoLogin(page,'SELLER');expect(login.status).toBe(200);
  await page.reload({waitUntil:'domcontentloaded'});
  ops=await openAccount(page);
  const dealerTab=ops.locator('[data-v14-tab="dealer"]');await expect(dealerTab).toBeVisible();await dealerTab.click();
  const panel=ops.locator('[data-v14-panel="dealer"]');await expect(panel).toBeVisible();

  const card=panel.locator('[data-v24-lead][data-listing="'+cfg.listingId+'"]');await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('data-stage','NEGOTIATING');
  await expect(card).toContainText(/Ответить на предложение|Respond to offer/i);
  await expect(card.locator('[data-v24-route="OFFER"][data-id="'+offerId+'"]')).toBeVisible();

  const capabilities=await page.evaluate(async()=>{const r=await fetch('/api/dealer/leads/capabilities');return{status:r.status,body:await r.json()}});
  expect(capabilities.status).toBe(200);expect(capabilities.body.capabilities.contractVersion).toBe('v24');expect(capabilities.body.capabilities.projectionOnly).toBe(true);

  await card.locator('[data-v24-route="OFFER"][data-id="'+offerId+'"]').click();
  await expect(ops.locator('[data-v14-panel="offers"]')).toBeVisible();
  const sheet=page.locator('#actionSheet[open]');await expect(sheet).toBeVisible();await expect(sheet).toContainText(/NEGOTIATION/i);await expect(sheet).toContainText(/Ваш ход|Your action/i);
 }finally{
  if(offerId){
   try{
    login=await demoLogin(page,'BUYER');
    if(login.status===200)await apiPost(page,'/api/offers/'+offerId+'/actions',{action:'WITHDRAW',expectedVersion:1,clientActionId:'v24-cleanup-'+Date.now()+'-'+Math.random()},login.body.csrf)
   }catch{}
  }
 }
});
