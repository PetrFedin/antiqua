import {test,expect} from '@playwright/test';

async function demoLogin(page,persona){
 return page.evaluate(async persona=>{const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona})});return{status:r.status,body:await r.json()}},persona)
}
async function apiPost(page,path,body,csrf){
 return page.evaluate(async args=>{const r=await fetch(args.path,{method:'POST',headers:{'content-type':'application/json','x-csrf-token':args.csrf},body:JSON.stringify(args.body)});let json={};try{json=await r.json()}catch{}return{status:r.status,body:json}}, {path,body,csrf})
}

test('Partner Pilot attributes exhibition -> ensemble -> object -> offer and exposes owner-only methodology',async({page})=>{
 const exhibitionId='ex-objects-in-dialogue',objectId='lot-109';let offerId=null,buyerId=null;
 const dropWait=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/exhibitions/'+exhibitionId+'/pilot/events'&&r.request().method()==='POST');
 await page.goto('/#exhibition/'+exhibitionId,{waitUntil:'domcontentloaded'});
 expect([200,201]).toContain((await dropWait).status());

 const caps=await page.evaluate(async()=>{const r=await fetch('/api/partner-pilot/capabilities');return{status:r.status,body:await r.json()}});
 expect(caps.status).toBe(200);expect(caps.body.capabilities.attribution).toBe('PARTNER_PATH_ONLY');expect(caps.body.capabilities.anonymousLongTermRetention).toBe(false);expect(caps.body.capabilities.objectWideDemandCreditedToPartner).toBe(false);
 await expect(page.locator('[data-partner-drop-panel]')).toBeVisible();
 await expect(page.locator('.partner-pilot-analytics')).toHaveCount(0);

 const ensemble=page.locator('.exhibition-page a[href="#ensemble/ens-neoclassical-room"]').first();await expect(ensemble).toBeVisible();await ensemble.click();await expect(page).toHaveURL(/#ensemble\/ens-neoclassical-room$/);

 let login=await demoLogin(page,'BUYER');expect(login.status).toBe(200);buyerId=login.body.account.id;
 await page.reload({waitUntil:'domcontentloaded'});
 const objectButton=page.locator('[data-passport="'+objectId+'"]').first();await expect(objectButton).toBeVisible();
 const objectWait=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/exhibitions/'+exhibitionId+'/pilot/events'&&r.request().method()==='POST');
 await objectButton.click();expect([200,201]).toContain((await objectWait).status());
 const dialog=page.locator('#dialog[open]');await expect(dialog).toBeVisible();

 const catalog=await page.evaluate(async()=>{const r=await fetch('/api/catalog');return r.json()});
 const listing=catalog.listings.find(x=>x.lotId===objectId);expect(listing).toBeTruthy();
 const offerButton=dialog.locator('[data-offer="'+listing.id+'"]').first();await expect(offerButton).toBeVisible();await offerButton.click();
 const sheet=page.locator('#actionSheet[open]');await expect(sheet).toBeVisible();
 const amount=Math.max(1,Math.floor(Number(listing.price)*0.9));await sheet.locator('#offerAmount').fill(String(amount));
 const offerWait=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/listings/'+listing.id+'/offers'&&r.request().method()==='POST');
 await sheet.locator('#confirmOffer').click();const offerResponse=await offerWait;expect([200,201]).toContain(offerResponse.status());const offer=await offerResponse.json();offerId=offer.offer?.id;expect(offerId).toBeTruthy();

 try{
  login=await demoLogin(page,'OPERATOR');expect(login.status).toBe(200);await page.reload({waitUntil:'domcontentloaded'});await page.goto('/#exhibition/'+exhibitionId,{waitUntil:'domcontentloaded'});
  const dashboard=page.locator('.partner-pilot-analytics');await expect(dashboard).toBeVisible();await expect(dashboard).toContainText(/Что действительно пришло|What actually came/i);await expect(dashboard).toContainText(/D7/);await expect(dashboard).toContainText(/D30/);

  const analytics=await page.evaluate(async id=>{const r=await fetch('/api/exhibitions/'+id+'/pilot/analytics');return{status:r.status,body:await r.json()}},exhibitionId);
  expect(analytics.status).toBe(200);const a=analytics.body.analytics;expect(a.attributed.counts.OBJECT_OPEN).toBeGreaterThanOrEqual(1);expect(a.attributed.counts.OFFER_CREATED).toBeGreaterThanOrEqual(1);expect(a.attributed.explicitIntent).toBeGreaterThanOrEqual(1);expect(a.methodology.objectWideDemandExcluded).toBe(true);expect(a.retention.anonymousRetentionMeasured).toBe(false);expect(JSON.stringify(a)).not.toContain(buyerId);
 }finally{
  if(offerId){login=await demoLogin(page,'BUYER');if(login.status===200)await apiPost(page,'/api/offers/'+offerId+'/actions',{action:'WITHDRAW',expectedVersion:1,clientActionId:'v33-cleanup-'+Date.now()+'-'+Math.random()},login.body.csrf).catch(()=>{})}
 }
});
