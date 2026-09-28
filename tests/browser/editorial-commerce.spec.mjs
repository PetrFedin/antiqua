import {test,expect} from '@playwright/test';

async function login(page,persona){return page.evaluate(async persona=>{const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona})});return{status:r.status,body:await r.json()}},persona)}

test('Editorial Commerce connects story discovery to Passport and measurable attribution',async({page})=>{
 await page.goto('/#journal',{waitUntil:'domcontentloaded'});
 const card=page.locator('.editorial-card').filter({hasText:/Как начать коллекцию|How to start a collection/i});await expect(card).toBeVisible();
 const storyResponse=page.waitForResponse(r=>/\/api\/editorial\/[^/]+$/.test(new URL(r.url()).pathname)&&r.request().method()==='GET');await card.click();expect((await storyResponse).status()).toBe(200);
 const story=page.locator('.editorial-story');await expect(story).toBeVisible();await expect(story).toContainText(/Как начать коллекцию|How to start a collection/i);
 const id=await story.getAttribute('data-editorial-story');expect(id).toBeTruthy();
 await expect(story.locator('[data-editorial-object="lot-103"]')).toBeVisible();
 const eventResponse=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/editorial/${id}/events`&&r.request().method()==='POST');await story.locator('[data-editorial-object="lot-103"]').click();expect((await eventResponse).status()).toBe(200);
 await expect(page.locator('#dialog[open]')).toBeVisible();
 await page.locator('#dialog [data-close-dialog]').first().click().catch(()=>page.keyboard.press('Escape'));
 const auth=await login(page,'OPERATOR');expect(auth.status).toBe(200);
 const analytics=await page.evaluate(async id=>{const r=await fetch('/api/editorial/'+id+'/analytics');return{status:r.status,body:await r.json()}},id);expect(analytics.status).toBe(200);expect(analytics.body.rows.some(x=>x.eventType==='STORY_OPEN'&&x.uniqueViewers>=1)).toBe(true);expect(analytics.body.rows.some(x=>x.eventType==='OBJECT_OPEN'&&x.targetKey==='lot-103')).toBe(true);
 const caps=await page.evaluate(async()=>{const r=await fetch('/api/editorial/capabilities');return r.json()});expect(caps.capabilities.contentToCommerceMeasured).toBe(true);expect(caps.capabilities.anonymousRawIdentifiersStored).toBe(false);
});
