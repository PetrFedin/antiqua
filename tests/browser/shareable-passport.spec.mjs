import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__antiquaCopied=String(text)}}});
 });
});

test('direct passport link opens exact object and closes cleanly',async({page})=>{
 await page.goto('/?object=lot-109#gallery',{waitUntil:'domcontentloaded'});
 const dialog=page.locator('#dialog[open]');await expect(dialog).toBeVisible();await expect(dialog).toContainText(/Ореховый комод|A walnut commode/i);
 expect(new URL(page.url()).searchParams.get('object')).toBe('lot-109');
 await dialog.locator('[data-close-dialog]').click();await expect(page.locator('#dialog[open]')).toHaveCount(0);
 await expect.poll(()=>new URL(page.url()).searchParams.has('object')).toBe(false);
});

test('catalogue passport uses one history entry and Back closes it after related-object navigation',async({page})=>{
 await page.goto('/#gallery',{waitUntil:'domcontentloaded'});
 const card=page.locator('[data-open-passport="lot-109"]:visible').first();await expect(card).toBeVisible();await card.locator('h3').click();
 const dialog=page.locator('#dialog[open]');await expect(dialog).toBeVisible();
 expect(new URL(page.url()).searchParams.get('object')).toBe('lot-109');

 const similar=dialog.locator('#dossierSimilarV18 [data-similar-object="lot-106"]');await expect(similar).toBeVisible();
 await similar.locator('[data-passport]').first().click();
 await expect.poll(()=>new URL(page.url()).searchParams.get('object')).toBe('lot-106');
 await expect(dialog.locator('.dossier-toolbar .eyebrow').first()).toContainText('AQ-106-2026');

 await page.goBack();await expect(page.locator('#dialog[open]')).toHaveCount(0);
 await expect.poll(()=>new URL(page.url()).searchParams.has('object')).toBe(false);
 await expect(page.locator('[data-nav="gallery"]:visible').first()).toBeVisible();
});

test('copy-link emits canonical Gallery URL for current passport',async({page})=>{
 await page.goto('/#collections',{waitUntil:'domcontentloaded'});
 const open=await page.evaluate(async()=>{const r=await fetch('/api/lots/lot-109/passport');return r.status});expect(open).toBe(200);
 await page.evaluate(()=>{location.hash='gallery'});
 await page.locator('[data-open-passport="lot-109"]:visible').first().locator('h3').click();
 const button=page.locator('#dialog[open] [data-share-object="lot-109"]');await expect(button).toBeVisible();await button.click();
 const copied=await page.evaluate(()=>window.__antiquaCopied);expect(copied).toBeTruthy();
 const u=new URL(copied);expect(u.searchParams.get('object')).toBe('lot-109');expect(u.hash).toBe('#gallery');expect(u.origin).toBe(new URL(page.url()).origin);
});

test('invalid shared object cleans URL instead of leaving broken dossier state',async({page})=>{
 await page.goto('/?object=missing-object#gallery',{waitUntil:'domcontentloaded'});
 await expect.poll(()=>new URL(page.url()).searchParams.has('object')).toBe(false);
 await expect(page.locator('#dialog[open]')).toHaveCount(0);
});


test('navigating away from Gallery closes passport and removes object deep link',async({page})=>{
 await page.goto('/?object=lot-110#gallery',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#dialog[open]')).toBeVisible();
 await expect.poll(()=>new URL(page.url()).searchParams.get('object')).toBe('lot-110');
 await page.evaluate(()=>{location.hash='account'});
 await expect(page.locator('#dialog[open]')).toHaveCount(0);
 await expect.poll(()=>new URL(page.url()).searchParams.has('object')).toBe(false);
 await expect.poll(()=>new URL(page.url()).hash).toBe('#account');
});
