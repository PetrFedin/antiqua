import {test,expect} from '@playwright/test';

test('Partner and Investor Showcase explains collaboration paths and honest product readiness',async({page})=>{
 await page.goto('/#partners',{waitUntil:'domcontentloaded'});
 const root=page.locator('.showcase-page');await expect(root).toBeVisible();
 await expect(root).toContainText(/Платформа, на которой человек становится коллекционером|The platform where a person becomes a collector/i);
 const roles=root.locator('.showcase-role-card');await expect(roles).toHaveCount(6);
 await expect(roles).toContainText([/Организатор ярмарки|Fair organizer/i,/Галерея или ассоциация|Gallery or association/i,/Инвестор|Investor/i]);
 const readiness=root.locator('.showcase-readiness-grid article');await expect(readiness).toHaveCount(8);
 await expect(root.locator('.showcase-readiness-grid article.blocked')).toContainText(/PostgreSQL live/i);
 await expect(root.locator('.showcase-readiness-grid article.blocked')).toContainText(/MEMORY_FALLBACK|отдельная БД|dedicated DB/i);await expect(root).toContainText(/Dealer Interest Signals/i);await expect(root).toContainText(/Partner Pilot Analytics/i);

 await page.locator('a[href="#partners/fair"]').first().click();
 const fair=page.locator('.showcase-detail');await expect(fair).toBeVisible();await expect(fair).toContainText(/10–20 участников|10–20 exhibitors/i);await expect(fair).toContainText(/300–500 предметов|300–500 objects/i);
 const fairProof=fair.locator('.showcase-proof-links a');await expect(fairProof).toHaveCount(3);await expect(fairProof.first()).toHaveAttribute('href','#exhibitions');

 await page.goto('/#partners/investor',{waitUntil:'domcontentloaded'});
 const investor=page.locator('.showcase-detail');await expect(investor).toBeVisible();await expect(investor).toContainText(/Инвестор|Investor/i);await expect(investor).toContainText(/2 pilot commitments|2 письменных pilot commitments/i);
 await expect(page.locator('.showcase-funding-grid article')).toHaveCount(4);await expect(page.locator('.showcase-funding-grid')).toContainText(/Durable production/);await expect(page.locator('.showcase-funding-grid')).toContainText(/Partner pilots/);await expect(page.locator('.showcase-funding-grid')).toContainText(/Demand engine/);
});
