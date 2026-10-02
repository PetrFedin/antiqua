import {test,expect} from '@playwright/test';

async function login(page,persona){return page.evaluate(async persona=>{const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona})});return{status:r.status,body:await r.json()}},persona)}
async function request(page,method,path,csrf,body={}){return page.evaluate(async({method,path,csrf,body})=>{const r=await fetch(path,{method,headers:{'content-type':'application/json',...(csrf?{'x-csrf-token':csrf}:{})},body:['GET','HEAD'].includes(method)?undefined:JSON.stringify(body)});let json={};try{json=await r.json()}catch{}return{status:r.status,body:json}},{method,path,csrf,body})}

test('Art Network publishes a pseudonymous collector only after review and exposes scoped expertise without a score',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});
 let auth=await login(page,'BUYER');expect(auth.status).toBe(200);const buyerCsrf=auth.body.csrf,token=Date.now().toString(),slug='browser-collector-'+token;
 const saved=await request(page,'PATCH','/api/network/me/profile',buyerCsrf,{slug,displayName:{en:'Browser Collector '+token,ru:'Браузерный коллекционер '+token},biography:{en:'Printmaking and works on paper.',ru:'Печатная графика и работы на бумаге.'},participantRoles:['COLLECTOR','ENTHUSIAST'],interests:['etching','lithography'],visibility:'PSEUDONYMOUS'});
 expect(saved.status).toBe(200);expect(saved.body.profile.profileStatus).toBe('DRAFT');const accountId=saved.body.profile.accountId;
 const expertise=await request(page,'POST','/api/network/me/expertise-claims',buyerCsrf,{expertiseType:'PRINTMAKING',scope:{label:{en:'European etching',ru:'Европейская офортная графика'}},evidence:{reference:'browser-proof'}});
 expect(expertise.status).toBe(201);
 const submitted=await request(page,'POST','/api/network/me/profile/submit',buyerCsrf,{});expect(submitted.status).toBe(200);expect(submitted.body.profile.profileStatus).toBe('REVIEW_PENDING');
 let publicList=await request(page,'GET','/api/network/profiles',null);expect(publicList.status).toBe(200);expect(publicList.body.profiles.some(x=>x.slug===slug)).toBe(false);

 auth=await login(page,'OPERATOR');expect(auth.status).toBe(200);
 let reviewed=await request(page,'POST','/api/network/review/profiles/'+accountId,auth.body.csrf,{decision:'APPROVE',note:'browser proof'});expect(reviewed.status).toBe(200);expect(reviewed.body.profile.profileStatus).toBe('PUBLISHED');
 reviewed=await request(page,'POST','/api/network/review/expertise/'+expertise.body.claim.id,auth.body.csrf,{decision:'VERIFY',note:'browser proof'});expect(reviewed.status).toBe(200);expect(reviewed.body.claim.status).toBe('VERIFIED');

 auth=await login(page,'BUYER');expect(auth.status).toBe(200);await page.goto('/#network',{waitUntil:'domcontentloaded'});
 const network=page.locator('.art-network-page');await expect(network).toBeVisible();await expect(network).toContainText(/Сообщество вокруг искусства|A network built around art/i);
 const card=network.locator('.art-network-card').filter({hasText:token});await expect(card).toBeVisible();await card.click();
 const profile=page.locator('.art-profile-page');await expect(profile).toBeVisible();await expect(profile).toContainText(token);await expect(profile).toContainText(/Европейская офортная графика|European etching/i);await expect(profile).toContainText(/не универсальный.*рейтинг|not a universal expert score/i);
 const apiProfile=await request(page,'GET','/api/network/profiles/'+slug,null);expect(apiProfile.status).toBe(200);expect(apiProfile.body.profile.accountId).toBeUndefined();expect(apiProfile.body.expertise[0].score).toBeUndefined();
});
