import {test,expect} from '@playwright/test';

test('Partner and Investor Showcase explains stakeholder value, revenue gates and honest readiness',async({page})=>{
 await page.goto('/#partners',{waitUntil:'domcontentloaded'});
 const root=page.locator('.showcase-page');await expect(root).toBeVisible();
 await expect(root).toContainText(/Экосистема вокруг произведения искусства|An ecosystem around the artwork/i);

 const roles=root.locator('.showcase-role-card');await expect(roles).toHaveCount(8);
 await expect(root).toContainText(/Коллекционер и ценитель|Collector & art lover/i);
 await expect(root).toContainText(/Галерея|Gallery/i);
 await expect(root).toContainText(/Эксперт, куратор, историк|Expert, curator & historian/i);
 await expect(root).toContainText(/Музей, фонд, наследие|Museum, foundation & estate/i);
 await expect(root).toContainText(/Инвестор|Investor/i);

 const revenue=root.locator('.showcase-revenue-grid article');await expect(revenue).toHaveCount(5);
 await expect(root.locator('.showcase-revenue-grid')).toContainText(/Professional SaaS/);
 await expect(root.locator('.showcase-revenue-grid')).toContainText(/Partner Editions/);
 await expect(root.locator('.showcase-revenue-grid')).toContainText(/Transaction revenue/);
 await expect(root.locator('.showcase-revenue-grid')).toContainText(/Institutional Research/);
 await expect(root).toContainText(/структурная модель, не финансовый прогноз|structural model, not a financial forecast/i);

 const flywheel=root.locator('.showcase-flywheel>div');await expect(flywheel).toHaveCount(6);
 await expect(root.locator('.showcase-moat-grid article')).toHaveCount(4);
 await expect(root.locator('.showcase-moat-grid')).toContainText(/Artwork graph/i);
 await expect(root.locator('.showcase-moat-grid')).toContainText(/Trust graph/i);
 await expect(root.locator('.showcase-moat-grid')).toContainText(/Demand graph/i);

 const readiness=root.locator('.showcase-readiness-grid article');await expect(readiness).toHaveCount(6);
 await expect(root.locator('.showcase-readiness-grid')).toContainText(/Paid demand proof/i);
 const blocked=root.locator('.showcase-readiness-grid article.blocked');await expect(blocked).toHaveCount(2);await expect(blocked.filter({hasText:'PostgreSQL live'})).toBeVisible();await expect(blocked.filter({hasText:'Paid demand proof'})).toBeVisible();

 await page.locator('a[href="#partners/fair"]').first().click();
 const fair=page.locator('.showcase-detail');await expect(fair).toBeVisible();
 await expect(fair).toContainText(/10–20 участников|10–20 participants/i);
 await expect(fair).toContainText(/300–500 работ|300–500 works/i);
 await expect(fair).toContainText(/Кто и за что платит|Who pays and why/i);

 await page.goto('/#partners/investor',{waitUntil:'domcontentloaded'});
 const investor=page.locator('.showcase-detail');await expect(investor).toBeVisible();
 await expect(investor).toContainText(/2\+ written pilot commitments|2\+ письменных pilot commitments/i);
 await expect(investor).toContainText(/unit economics|willingness to pay/i);
 await expect(page.locator('.showcase-funding-grid article')).toHaveCount(4);
 await expect(page.locator('.showcase-funding-grid')).toContainText(/Durable production/);
 await expect(page.locator('.showcase-funding-grid')).toContainText(/Paid partner pilots/);
 await expect(page.locator('.showcase-funding-grid')).toContainText(/Consumer retention/);
 await expect(page.locator('.showcase-funding-grid')).toContainText(/Unit economics/);
});

test('Investor economics remains readable on iPhone-sized viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/#partners/investor',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.showcase-page')).toBeVisible();
 await expect(page.locator('.showcase-revenue-grid article')).toHaveCount(5);
 await expect(page.locator('.showcase-role-card').first()).toBeVisible();
 await expect(page.locator('.showcase-investor-cta .primary-button')).toBeVisible();
});
