import {test,expect} from '@playwright/test';
for(const width of [320,390,834,1440]){
 test('v70 painting-only public collections '+width,async({page})=>{
  await page.setViewportSize({width,height:800});
  await page.goto('/#collections',{waitUntil:'domcontentloaded'});
  const section=page.locator('.collection-register-v70');
  await expect(section).toBeVisible();
  await expect(section.locator('.collection-register-empty')).toBeVisible();
  await expect(section).not.toContainText('European Interiors: Objects in Dialogue');
  await expect(section.locator('.collection-register-cta')).toHaveAttribute('href','#gallery');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
  await page.goto('/#collection/col-european-interiors',{waitUntil:'domcontentloaded'});
  await expect(page.locator('.collection-not-admitted')).toBeVisible();
  await expect(page.locator('.collection-object')).toHaveCount(0);
 });
}
test('v70 private collection creation remains private',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});
 const login=await page.evaluate(async()=>{const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona:'BUYER'})});return{status:r.status,body:await r.json()}});
 expect(login.status).toBe(200);
 await page.goto('/#account',{waitUntil:'domcontentloaded'});
 await page.locator('[data-v14-tab="collections"]').click();
 const panel=page.locator('.collection-studio-v70');
 await expect(panel).toBeVisible();
 const form=panel.locator('#v14CollectionCreateForm');
 const consent=form.locator('[data-collection-publication-consent]');
 await expect(consent).toBeHidden();
 await form.locator('select[name="visibility"]').selectOption('PUBLIC');
 await expect(consent).toBeVisible();
 await form.locator('select[name="visibility"]').selectOption('PRIVATE');
 await expect(consent).toBeHidden();
 const name='Private study '+Date.now();
 await form.locator('input[name="title"]').fill(name);
 const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/collections'&&r.request().method()==='POST');
 await form.locator('button').last().click();
 expect((await response).status()).toBe(201);
 const publicData=await page.evaluate(()=>fetch('/api/collections').then(r=>r.json()));
 expect(publicData.collections.some(c=>(c.title?.en||c.title)===name)).toBe(false);
 await expect(panel.locator('.collection-studio-card').filter({hasText:name})).toBeVisible();
});


// Previously, the rendered form and its submit handler had mismatched IDs.
for(const width of [390,1440]){
 test('v76 owner creates collection and adds real painting via browser '+width,async({page})=>{
  await page.setViewportSize({width,height:800});
  await page.goto('/',{waitUntil:'domcontentloaded'});
  expect(await page.evaluate(async()=>{
   const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona:'BUYER'})});
   return r.status;
  })).toBe(200);
  await page.goto('/#account',{waitUntil:'domcontentloaded'});
  await page.locator('[data-v14-tab="collections"]').click();
  let studio=page.locator('.collection-studio-v70');
  await expect(studio).toBeVisible();
  const name='Artwork collection '+width+' '+Date.now();
  const create=studio.locator('#v14CollectionCreateForm');
  await create.locator('input[name="title"]').fill(name);
  const createdResponse=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/collections');
  await create.locator('button').click();
  const created=await createdResponse;
  expect(created.status()).toBe(201);
  const id=(await created.json()).collection.id;
  studio=page.locator('.collection-studio-v70');
  await expect(studio.locator('.collection-studio-card').filter({hasText:name})).toBeVisible();
  const add=studio.locator('#v14CollectionArtworkForm');
  await expect(add).toBeVisible();
  await add.locator('select[name="collectionId"]').selectOption(id);
  await add.locator('select[name="objectId"]').selectOption('lot-108');
  const section='Paintings study '+width;
  await add.locator('input[name="section"]').fill(section);
  const addedResponse=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/collections/'+id+'/objects');
  await add.locator('button').click();
  const response=await addedResponse;
  expect(response.status()).toBe(200);
  const linked=(await response.json()).collection.items.find(x=>x.objectId==='lot-108');
  expect(linked).toBeTruthy();
  expect(linked.section).toBe(section);
  await expect(page.locator('.collection-studio-card').filter({hasText:name})).toContainText('1');
  const stored=await page.evaluate(async id=>{
   const r=await fetch('/api/collections/mine');
   const d=await r.json();
   return d.collections.find(x=>x.id===id);
  },id);
  expect(stored?.items?.some(x=>x.objectId==='lot-108')).toBe(true);
  const publication=await page.evaluate(async()=>fetch('/api/collections').then(r=>r.json()));
  expect(publication.collections.some(x=>x.id===id)).toBe(false);
 });
}
