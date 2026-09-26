import {test,expect} from '@playwright/test';

async function login(page,persona){return page.evaluate(async persona=>{const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona})});return{status:r.status,body:await r.json()}},persona)}
async function post(page,path,csrf,body){return page.evaluate(async({path,csrf,body})=>{const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify(body)});let json={};try{json=await r.json()}catch{}return{status:r.status,body:json}},{path,csrf,body})}

test('Creator Graph publishes a real profile workflow without bypassing primary-market authority',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});let auth=await login(page,'SELLER');expect(auth.status).toBe(200);const sellerCsrf=auth.body.csrf,token=Date.now().toString();
 const created=await post(page,'/api/creators',sellerCsrf,{nameEn:'Browser Studio '+token,nameRu:'Браузерная мастерская '+token,creatorType:'CRAFTSPERSON',salesModel:'INDEPENDENT',disciplines:[{en:'Collectible objects',ru:'Коллекционные предметы'}]});expect(created.status).toBe(201);const creator=created.body.creator;
 const linked=await post(page,'/api/creators/'+creator.id+'/objects',sellerCsrf,{objectId:'lot-109',creatorRole:'MAKER',marketContext:'PRIMARY',attributionStatus:'SELF_DECLARED'});expect(linked.status).toBe(200);
 let privateProfile=await page.evaluate(async id=>{const r=await fetch('/api/creators/'+id);return{status:r.status,body:await r.json()}},creator.id);expect(privateProfile.status).toBe(200);
 auth=await login(page,'OPERATOR');expect(auth.status).toBe(200);const published=await post(page,'/api/creators/'+creator.id+'/publish',auth.body.csrf,{});expect(published.status).toBe(200);expect(published.body.creator.profileStatus).toBe('PUBLISHED');
 auth=await login(page,'BUYER');expect(auth.status).toBe(200);await page.goto('/#creators',{waitUntil:'domcontentloaded'});const card=page.locator('.creator-card').filter({hasText:token});await expect(card).toBeVisible();await card.click();
 const profile=page.locator('.creator-profile');await expect(profile).toBeVisible();await expect(profile).toContainText(token);await expect(profile).toContainText(/Первичный рынок|Primary market/i);await expect(profile.locator('[data-passport="lot-109"]')).toBeVisible();
 const follow=profile.locator('[data-creator-follow]');const response=page.waitForResponse(r=>/\/api\/creators\/[^/]+\/follow$/.test(new URL(r.url()).pathname)&&r.request().method()==='POST');await follow.click();expect((await response).status()).toBe(200);await expect(follow).toContainText(/Слежу|Following/i);
 const publicProfile=await page.evaluate(async id=>{const r=await fetch('/api/creators/'+id);return{status:r.status,body:await r.json()}},creator.id);expect(publicProfile.status).toBe(200);expect(publicProfile.body.works.some(w=>w.object.id==='lot-109'&&w.listing?.salesAuthorized===true)).toBe(true);
});
