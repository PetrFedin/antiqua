import {test,expect} from '@playwright/test';

test('World of Art discovery layer leads into the authoritative Gallery',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});
 const hero=page.locator('[data-culture-hero]');await expect(hero).toBeVisible();await expect(hero.locator('h1')).toHaveAttribute('aria-label',/Искусство ближе, чем кажется|Art is closer than you think/i);
 const feed=page.locator('[data-culture-feed]');await expect(feed).toBeVisible();await expect(feed.locator('.culture-object-card').first()).toBeVisible();
 // Historical decorative-object exhibitions must not be promoted on the painting homepage.
 const study=page.locator('[data-art-study="museum-verified"]');await expect(study).toBeVisible();
 await expect(page.locator('[data-culture-drop]')).toHaveCount(0);
 const catalogue=page.locator('#cultureCatalogue');await expect(catalogue).toBeVisible();await expect(catalogue.locator('#catalogSearch')).toBeVisible();await expect(catalogue.locator('#catalogGrid [data-open-passport]').first()).toBeVisible();
 const title=await feed.locator('.culture-object-card h3').first().innerText();await feed.locator('.culture-object-open').first().click();const dialog=page.locator('#dialog[open]');await expect(dialog).toBeVisible();await expect(dialog.locator('.dossier-body h2')).toContainText(title);
});
