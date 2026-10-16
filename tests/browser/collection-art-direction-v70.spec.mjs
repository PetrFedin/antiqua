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
