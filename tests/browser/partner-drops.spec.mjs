import {test,expect} from '@playwright/test';

test('Partner Drop keeps fair audience before and after the event',async({page})=>{
 await page.goto('/#exhibitions',{waitUntil:'domcontentloaded'});
 const capabilities=await page.evaluate(async()=>{const r=await fetch('/api/partner-drops/capabilities');return{status:r.status,body:await r.json()}});expect(capabilities.status).toBe(200);expect(capabilities.body.capabilities.fakeScarcityAllowed).toBe(false);expect(capabilities.body.capabilities.archivePersists).toBe(true);
 const card=page.locator('.exhibition-card').first();await expect(card).toBeVisible();await expect(card).toContainText(/Кураторский выпуск|Curated drop/i);await card.click();
 const panel=page.locator('[data-partner-drop-panel]');await expect(panel).toBeVisible();await expect(panel).toContainText(/Antiqua Editorial/);await expect(panel).toContainText(/Цена и доступность|Price and availability/i);
 const follow=panel.locator('[data-drop-follow]');await expect(follow).toBeVisible();
 const response=page.waitForResponse(r=>/\/api\/exhibitions\/[^/]+\/follow$/.test(new URL(r.url()).pathname)&&r.request().method()==='POST');await follow.click();expect((await response).status()).toBe(200);await expect(follow).toContainText(/Слежу|Following/i);
 const drop=await page.evaluate(async()=>{const id=location.hash.split('/')[1],r=await fetch('/api/exhibitions/'+id+'/drop');return{status:r.status,body:await r.json()}});expect(drop.status).toBe(200);expect(drop.body.drop.follow.following).toBe(true);expect(drop.body.drop.format).toBe('CURATED_DROP');
 const unfollow=page.waitForResponse(r=>/\/api\/exhibitions\/[^/]+\/follow$/.test(new URL(r.url()).pathname)&&r.request().method()==='POST');await follow.click();expect((await unfollow).status()).toBe(200);await expect(follow).toContainText(/Следить|Follow/i);
});
