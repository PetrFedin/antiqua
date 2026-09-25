import {test,expect} from '@playwright/test';

test('Culture of Objects discovery layer leads into the authoritative catalogue',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});
 const hero=page.locator('[data-culture-hero]');await expect(hero).toBeVisible();await expect(hero).toContainText(/Культура вещей|Culture of Objects/i);
 const feed=page.locator('[data-culture-feed]');await expect(feed).toBeVisible();await expect(feed.locator('.culture-object-card').first()).toBeVisible();
 const drop=page.locator('[data-culture-drop]');await expect(drop).toBeVisible();await expect(drop.locator('a[href^="#exhibition/"]')).toBeVisible();
 const catalogue=page.locator('#cultureCatalogue');await expect(catalogue).toBeVisible();await expect(catalogue.locator('#catalogSearch')).toBeVisible();await expect(catalogue.locator('#catalogGrid [data-open-passport]').first()).toBeVisible();
 const title=await feed.locator('.culture-object-card h3').first().innerText();await feed.locator('.culture-object-open').first().click();const dialog=page.locator('#dialog[open]');await expect(dialog).toBeVisible();await expect(dialog.locator('.dossier-body h2')).toContainText(title);
});
