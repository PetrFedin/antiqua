import {test,expect} from '@playwright/test';

test('dossier shows explainable similar objects and navigates without stale recommendations',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});
 const card=page.locator('[data-open-passport="lot-109"]:visible').first();await expect(card).toBeVisible();await card.locator('h3').click();
 const dialog=page.locator('#dialog[open]');await expect(dialog).toBeVisible();await expect(dialog).toContainText(/Вид через лагуну|View across the lagoon/i);
 const panel=dialog.locator('#dossierSimilarV18');await expect(panel).toBeVisible();
 await expect(panel).toContainText(/Похожие произведения|Similar artworks|Похожие предметы|Similar objects/i);
 await expect(panel).toContainText(/персонализация|personalization/i);
 const cards=panel.locator('.similarity-card');expect(await cards.count()).toBeGreaterThan(0);
 const first=cards.first();await expect(first).toContainText(/Та же категория|Same category/i);await expect(first).toContainText(/Близкий исторический период|Related historical period/i);
 const firstId=await first.getAttribute('data-similar-object');expect(firstId).toBe('lot-102');
 await first.locator('[data-passport]').first().click();
 await expect(dialog).toContainText(/Портрет в синем интерьере|Portrait in a blue interior/i);
 const refreshed=dialog.locator('#dossierSimilarV18');await expect(refreshed).toBeVisible();
 await expect(refreshed.locator('[data-similar-object="lot-109"]')).toBeVisible();
 await expect(dialog.locator('#dossierSimilarV18')).toHaveCount(1);
});
