import {test,expect} from '@playwright/test';

async function demoLogin(page){
  return page.evaluate(async()=>{
    const csrf=decodeURIComponent(document.cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith('antiqua_csrf='))?.split('=').slice(1).join('=')||'');
    const headers={'content-type':'application/json'};if(csrf)headers['x-csrf-token']=csrf;
    const r=await fetch('/api/auth/demo-login',{method:'POST',headers,body:JSON.stringify({persona:'BUYER'})});
    return{status:r.status,body:await r.json()}
  })
}
async function post(page,path,csrf,body){
  return page.evaluate(async({path,csrf,body})=>{
    const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify(body)});
    let json={};try{json=await r.json()}catch{}
    return{status:r.status,body:json}
  },{path,csrf,body})
}

test('Private Collection feeds explainable Taste without leaking or rediscovering collected artwork',async({page})=>{
  await page.goto('/#gallery',{waitUntil:'domcontentloaded'});
  const login=await demoLogin(page);expect(login.status).toBe(200);const csrf=login.body.csrf;
  await page.reload({waitUntil:'domcontentloaded'});

  const catalog=await page.evaluate(async()=>fetch('/api/catalog').then(r=>r.json()));
  const objectId=catalog.lots?.[0]?.id;expect(objectId).toBeTruthy();

  const created=await post(page,'/api/collections',csrf,{title:'My private art study',collectionType:'PERSONAL',visibility:'PRIVATE'});
  expect(created.status).toBe(201);const collectionId=created.body.collection.id;

  const added=await post(page,'/api/collections/'+encodeURIComponent(collectionId)+'/objects',csrf,{objectId,section:'Works I return to',ownerDisplayMode:'ANONYMOUS',locationDisplayMode:'HIDDEN'});
  expect(added.status).toBe(200);

  const mine=await page.evaluate(async()=>{const r=await fetch('/api/collections/mine');return{status:r.status,body:await r.json()}});
  expect(mine.status).toBe(200);expect(mine.body.collections.some(c=>c.id===collectionId&&c.visibility==='PRIVATE')).toBe(true);

  const publicCollections=await page.evaluate(async()=>fetch('/api/collections').then(r=>r.json()));
  expect(publicCollections.collections.some(c=>c.id===collectionId)).toBe(false);

  const taste=await page.evaluate(async()=>{const r=await fetch('/api/taste/recommendations?limit=8');return{status:r.status,body:await r.json()}});
  expect(taste.status).toBe(200);
  expect(taste.body.profile.signalCounts.COLLECTED).toBeGreaterThan(0);
  expect(taste.body.recommendations.some(x=>x.object.id===objectId)).toBe(false);
  expect(taste.body.capabilities.explainable).toBe(true);
  expect(taste.body.capabilities.aiUsed).toBe(false);
  expect(taste.body.capabilities.priceUsedForMatching).toBe(false);

  await page.goto('/#gallery',{waitUntil:'domcontentloaded'});
  await expect(page.locator('[data-culture-root]')).toBeVisible();
  await expect(page.locator('[data-culture-root]')).toContainText(/Мир искусства|World of Art/i);
  await expect(page.locator('[data-culture-feed]')).toContainText(/вашим действиям|your actions/i);
});
