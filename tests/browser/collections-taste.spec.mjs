import {test,expect} from '@playwright/test';

async function demoLogin(page){
 return page.evaluate(async()=>{const csrf=decodeURIComponent(document.cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith('antiqua_csrf='))?.split('=').slice(1).join('=')||'');const headers={'content-type':'application/json'};if(csrf)headers['x-csrf-token']=csrf;const r=await fetch('/api/auth/demo-login',{method:'POST',headers,body:JSON.stringify({persona:'BUYER'})});return{status:r.status,body:await r.json()}})
}
async function post(page,path,csrf,body){return page.evaluate(async({path,csrf,body})=>{const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify(body)});let json={};try{json=await r.json()}catch{}return{status:r.status,body:json}},{path,csrf,body})}

test('Collections and Taste turns save into a private collection and explainable discovery',async({page})=>{
 await page.goto('/#gallery',{waitUntil:'domcontentloaded'});
 const login=await demoLogin(page);expect(login.status).toBe(200);const csrf=login.body.csrf;
 const saved=await post(page,'/api/lots/lot-101/save',csrf,{enabled:true});expect(saved.status).toBe(200);
 await page.reload({waitUntil:'domcontentloaded'});

 await page.locator('[data-nav="collections"]:visible').first().click();
 await expect(page).toHaveURL(/#collections/);
 const hub=page.locator('.collections-taste-page');await expect(hub).toBeVisible();
 await expect(hub.locator('[data-saved-section] [data-open-passport="lot-101"]')).toBeVisible();
 await expect(hub).toContainText(/Для вас|For you/i);

 const title='Browser Private Collection '+Date.now();
 await hub.locator('[data-consumer-collection-create]').first().click();
 const sheet=page.locator('#actionSheet[open]');await expect(sheet).toBeVisible();
 await sheet.locator('#consumerCollectionCreateForm input[name="title"]').fill(title);
 await sheet.locator('#consumerCollectionCreateForm select[name="visibility"]').selectOption('PRIVATE');
 const createResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/collections'&&r.request().method()==='POST');
 await sheet.locator('#consumerCollectionCreateForm button').click();
 const created=await createResponse;expect(created.status()).toBe(201);const createdBody=await created.json();const collectionId=createdBody.collection.id;
 await expect(hub.locator('[data-my-collections]')).toContainText(title);

 const publicCollections=await page.evaluate(async()=>{const r=await fetch('/api/collections');return{status:r.status,body:await r.json()}});
 expect(publicCollections.status).toBe(200);expect((publicCollections.body.collections||[]).some(c=>c.id===collectionId)).toBe(false);

 await page.goto('/#gallery',{waitUntil:'domcontentloaded'});
 const card=page.locator('[data-open-passport="lot-101"]:visible').first();await expect(card).toBeVisible();await card.locator('h3').click();
 const dossier=page.locator('#dialog[open]');await expect(dossier).toBeVisible();
 const collect=dossier.locator('[data-collect="lot-101"]');await expect(collect).toBeVisible();await collect.click();
 const addSheet=page.locator('#actionSheet[open]');await expect(addSheet).toBeVisible();await addSheet.locator('#curatedCollectionId').selectOption(collectionId);
 const addResponse=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/collections/${collectionId}/objects`&&r.request().method()==='POST');
 await addSheet.locator('#confirmCollectionAdd').click();expect((await addResponse).status()).toBe(200);

 await page.goto('/#collections',{waitUntil:'domcontentloaded'});
 const refreshed=page.locator('.collections-taste-page');await expect(refreshed).toBeVisible();
 const mine=refreshed.locator('[data-my-collections] .taste-collection-card').filter({hasText:title});await expect(mine).toBeVisible();await expect(mine).toContainText(/1\s+(работ|work)/i);

 const taste=await page.evaluate(async()=>{const r=await fetch('/api/taste/recommendations?limit=12');return{status:r.status,body:await r.json()}});
 expect(taste.status).toBe(200);expect(taste.body.capabilities.explainable).toBe(true);expect(taste.body.capabilities.aiUsed).toBe(false);expect(taste.body.capabilities.priceUsedForMatching).toBe(false);
 expect((taste.body.recommendations||[]).some(x=>x.object.id==='lot-101')).toBe(false);
 for(const x of (taste.body.recommendations||[]).filter(x=>!x.coldStart))expect(x.reasons.length).toBeGreaterThan(0);

 const recs=refreshed.locator('[data-personalized-discovery] .taste-art-card');if(await recs.count())await expect(recs.first().locator('.taste-reasons')).toBeVisible();
 const dismiss=refreshed.locator('[data-personalized-discovery] [data-taste-dismiss]').first();
 if(await dismiss.count()){
  const id=await dismiss.getAttribute('data-taste-dismiss');const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/taste/signals'&&r.request().method()==='POST');await dismiss.click();expect((await response).status()).toBe(201);await expect(refreshed.locator(`[data-taste-dismiss="${id}"]`)).toHaveCount(0)
 }
 const unsave=await post(page,'/api/lots/lot-101/save',csrf,{enabled:false});expect(unsave.status).toBe(200);
});
