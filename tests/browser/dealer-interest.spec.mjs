import {test,expect} from '@playwright/test';

const rank={NO_SIGNAL:0,DISCOVERED:1,ENGAGED:2,INQUIRY:3,VIEWING:4,NEGOTIATING:5,TRANSACTING:6};
async function login(page,persona){
 return page.evaluate(async persona=>{
  const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona})});
  return{status:r.status,body:await r.json()};
 },persona);
}
async function post(page,path,csrf,body){
 return page.evaluate(async({path,csrf,body})=>{
  const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify(body)});
  let json={};try{json=await r.json()}catch{}
  return{status:r.status,body:json};
 },{path,csrf,body});
}

test('Dealer Interest projects anonymous demand into explicit commercial intent without exposing passive identity',async({page},testInfo)=>{
 const mobile=testInfo.project.name.includes('mobile');
 const objectId=mobile?'lot-110':'lot-109',listingId=mobile?'lst-110':'lst-109',amount=mobile?'5000':'7000';
 let offerId=null;
 await page.goto('/',{waitUntil:'domcontentloaded'});

 const publicCaps=await page.evaluate(async()=>{
  const r=await fetch('/api/dealer/interest/capabilities');
  return{status:r.status,body:await r.json()};
 });
 expect(publicCaps.status).toBe(200);
 expect(publicCaps.body.capabilities.projectionOnly).toBe(true);
 expect(publicCaps.body.capabilities.opaqueScore).toBe(false);
 expect(publicCaps.body.capabilities.passiveIdentityExposed).toBe(false);

 let auth=await login(page,'BUYER');
 expect(auth.status).toBe(200);
 const buyerId=auth.body.account.id;
 try{
  const passive=await page.evaluate(async({objectId,csrf})=>{
   const passport=await fetch('/api/lots/'+objectId+'/passport');
   const save=await fetch('/api/lots/'+objectId+'/save',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify({enabled:true})});
   return{passport:passport.status,save:save.status};
  },{objectId,csrf:auth.body.csrf});
  expect(passive.passport).toBe(200);
  expect(passive.save).toBe(200);

  const offer=await post(page,'/api/listings/'+listingId+'/offers',auth.body.csrf,{
   amount,currency:'EUR',expiresAt:new Date(Date.now()+72*3600000).toISOString(),
   comment:'Dealer Interest browser proof',clientActionId:'v32-offer-'+Date.now()+'-'+Math.random()
  });
  expect([200,201]).toContain(offer.status);
  offerId=offer.body.offer?.id;
  expect(offerId).toBeTruthy();

  auth=await login(page,'SELLER');
  expect(auth.status).toBe(200);
  const interest=await page.evaluate(async()=>{
   const r=await fetch('/api/dealer/interest');
   return{status:r.status,body:await r.json()};
  });
  expect(interest.status).toBe(200);
  const row=interest.body.interest.objects.find(x=>x.objectId===objectId);
  expect(row).toBeTruthy();
  expect(rank[row.stage]).toBeGreaterThanOrEqual(rank.NEGOTIATING);
  expect(row.passive.views).toBeGreaterThanOrEqual(1);
  expect(row.passive.saved).toBeGreaterThanOrEqual(1);
  expect(row.privacy.passiveViewerIdentityExposed).toBe(false);
  expect(JSON.stringify(row)).not.toContain(buyerId);

  await page.reload({waitUntil:'domcontentloaded'});
  await page.goto('/#account',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#sellerAnalyticsV17')).toBeVisible();
  const panel=page.locator('#dealerInterestV32');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(/Где интерес становится намерением|Where interest becomes intent/i);
  await expect(panel).toContainText(/нет скрытого score|no hidden score/i);
  await expect(panel).toContainText(/не складываются|are not added/i);
  const card=panel.locator('.v32-interest-card:has([data-passport="'+objectId+'"])').first();
  await expect(card).toBeVisible();
  await expect(card).toContainText(/Переговоры|Negotiating|Сделка|Transacting/i);
  await expect(card.locator('[data-v32-open-dealer]')).toBeVisible();
 }finally{
  auth=await login(page,'BUYER').catch(()=>null);
  if(auth?.status===200){
   if(offerId)await post(page,'/api/offers/'+offerId+'/actions',auth.body.csrf,{action:'WITHDRAW',expectedVersion:1,clientActionId:'v32-cleanup-'+Date.now()+'-'+Math.random()}).catch(()=>{});
   await post(page,'/api/lots/'+objectId+'/save',auth.body.csrf,{enabled:false}).catch(()=>{});
  }
 }
});
