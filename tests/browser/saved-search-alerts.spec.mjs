import {test,expect} from '@playwright/test';

async function demoLogin(page,persona){
 return page.evaluate(async persona=>{const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona})});return{status:r.status,body:await r.json()}},persona)
}
async function logoutCurrentPreviewSession(page){
 const me=await page.evaluate(async()=>{const r=await fetch('/api/auth/me');return r.json()});
 if(!me?.account)return;
 const out=await page.evaluate(async csrf=>{const r=await fetch('/api/auth/logout',{method:'POST',headers:{'x-csrf-token':csrf}});return r.status},me.csrf);
 expect(out).toBe(200)
}
async function api(page,path,csrf,method='POST',body={}){
 return page.evaluate(async({path,csrf,method,body})=>{const r=await fetch(path,{method,headers:{'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify(body)});let json={};try{json=await r.json()}catch{}return{status:r.status,body:json}},{path,csrf,method,body})
}
async function openDiscovery(page){
 await page.evaluate(()=>localStorage.setItem('antiqua_v14_tab','discovery'));
 await page.goto('/#account',{waitUntil:'domcontentloaded'});
 const ops=page.locator('#v14Operations');await expect(ops).toBeVisible();
 const panel=ops.locator('[data-v14-panel="discovery"]');await expect(panel).toBeVisible();return{ops,panel}
}
async function saveViaSheet(page,label,mode='DAILY_DIGEST',hour='8'){
 const save=page.locator('#v14SaveSearch');await expect(save).toBeVisible();await save.click();
 const form=page.locator('#v26SaveSearchForm');await expect(form).toBeVisible();
 await form.locator('[name="label"]').fill(label);await form.locator('[name="deliveryMode"]').selectOption(mode);await form.locator('[name="digestHourUtc"]').selectOption(hour);
 const wait=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/discovery/subscriptions'&&r.request().method()==='POST');
 await form.locator('button[type="submit"]').click();const response=await wait;const body=await response.json();return{status:response.status(),body}
}

test('saved search keeps deterministic criteria, delivery lifecycle and notification deep link',async({page},testInfo)=>{
 const suffix=testInfo.project.name+'-'+Date.now();
 await page.goto('/',{waitUntil:'domcontentloaded'});await logoutCurrentPreviewSession(page);
 const login=await demoLogin(page,'BUYER');expect(login.status).toBe(200);await page.reload({waitUntil:'domcontentloaded'});

 const search=page.locator('#catalogSearch');await expect(search).toBeVisible();await search.fill('Walnut');await expect(search).toHaveValue('Walnut');
 let saved=await saveViaSheet(page,'V26 daily '+suffix,'DAILY_DIGEST','8');
 expect(saved.status).toBe(201);const dailyId=saved.body.subscription.id;expect(dailyId).toBeTruthy();expect(saved.body.subscription.deliveryMode).toBe('DAILY_DIGEST');expect(saved.body.subscription.digestHourUtc).toBe(8);expect(saved.body.subscription.idempotent).toBe(false);

 const duplicate=await saveViaSheet(page,'V26 duplicate '+suffix,'IMMEDIATE','12');
 expect(duplicate.status).toBe(200);expect(duplicate.body.subscription.id).toBe(dailyId);expect(duplicate.body.subscription.idempotent).toBe(true);expect(duplicate.body.subscription.deliveryMode).toBe('DAILY_DIGEST');

 let account=await openDiscovery(page),card=account.panel.locator('[data-v26-subscription="'+dailyId+'"]');await expect(card).toBeVisible();
 await expect(card).toContainText(/Walnut/);await expect(card).toContainText(/Запрос|Query/i);await expect(card).toContainText(/08:00 UTC/);
 await expect(card).not.toContainText(/\{"q"/);

 await card.locator('[data-v26-open-search="'+dailyId+'"]').click();await expect(page).toHaveURL(/#shop$/);await expect(page.locator('#catalogSearch')).toHaveValue('Walnut');

 account=await openDiscovery(page);card=account.panel.locator('[data-v26-subscription="'+dailyId+'"]');await expect(card).toBeVisible();
 const delivery=card.locator('[data-v26-delivery="'+dailyId+'"]');const deliveryWait=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/discovery/subscriptions/'+dailyId&&r.request().method()==='PATCH');
 await delivery.selectOption('IMMEDIATE');const deliveryResponse=await deliveryWait;expect(deliveryResponse.status()).toBe(200);
 card=account.panel.locator('[data-v26-subscription="'+dailyId+'"]');await expect(card).toContainText(/Сразу|Immediate/i);

 let toggle=card.locator('[data-v14-sub-toggle="'+dailyId+'"][data-next="PAUSED"]');await expect(toggle).toBeVisible();
 let patchWait=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/discovery/subscriptions/'+dailyId&&r.request().method()==='PATCH');await toggle.click();expect((await patchWait).status()).toBe(200);
 card=account.panel.locator('[data-v26-subscription="'+dailyId+'"]');await expect(card.locator('[data-v14-sub-toggle="'+dailyId+'"][data-next="ACTIVE"]')).toBeVisible();

 toggle=card.locator('[data-v14-sub-toggle="'+dailyId+'"][data-next="ACTIVE"]');patchWait=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/discovery/subscriptions/'+dailyId&&r.request().method()==='PATCH');await toggle.click();expect((await patchWait).status()).toBe(200);
 card=account.panel.locator('[data-v26-subscription="'+dailyId+'"]');await expect(card.locator('[data-v14-sub-toggle="'+dailyId+'"][data-next="ARCHIVED"]')).toBeVisible();

 toggle=card.locator('[data-v14-sub-toggle="'+dailyId+'"][data-next="ARCHIVED"]');patchWait=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/discovery/subscriptions/'+dailyId&&r.request().method()==='PATCH');await toggle.click();expect((await patchWait).status()).toBe(200);
 card=account.panel.locator('[data-v26-subscription="'+dailyId+'"]');await expect(card.locator('[data-v14-sub-toggle="'+dailyId+'"][data-next="ACTIVE"]')).toContainText(/Подписаться снова|Subscribe again/i);

 const immediate=await api(page,'/api/discovery/subscriptions',login.body.csrf,'POST',{subscriptionType:'SAVED_SEARCH',label:'V26 alert link '+suffix,criteria:{q:'Porcelain'},deliveryMode:'IMMEDIATE',digestHourUtc:8});
 expect(immediate.status).toBe(201);const immediateId=immediate.body.subscription.id;expect(immediate.body.subscription.matchCount).toBeGreaterThan(0);
 await page.reload({waitUntil:'domcontentloaded'});
 const alert=page.locator('.activity-item').filter({hasText:'V26 alert link '+suffix});await expect(alert).toBeVisible();
 const openSearch=alert.locator('[data-v26-open-search="'+immediateId+'"]');await expect(openSearch).toBeVisible();await openSearch.click();await expect(page).toHaveURL(/#shop$/);await expect(page.locator('#catalogSearch')).toHaveValue('Porcelain');

 const clean=await api(page,'/api/discovery/subscriptions/'+immediateId,login.body.csrf,'PATCH',{status:'ARCHIVED'});expect(clean.status).toBe(200)
});
