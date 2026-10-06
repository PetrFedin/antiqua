import {test,expect} from '@playwright/test';

test('Investor traction dashboard separates capability from missing commercial proof',async({page})=>{
 await page.goto('/#traction',{waitUntil:'domcontentloaded'});
 const root=page.locator('.traction-page');await expect(root).toBeVisible();
 await expect(root).toContainText(/Только доказанные цифры|Only evidence-backed numbers/i);
 await expect(root.locator('.traction-metric')).toHaveCount(8);
 await expect(root).toContainText(/MEMORY_FALLBACK|POSTGRES/);
 await expect(root.locator('.traction-badge')).toContainText([/PRODUCT CAPABILITY|MISSING|ASSUMPTION/]);
 await expect(root.locator('.traction-funnel>div')).toHaveCount(6);
 const evidenceTables=root.locator('.traction-evidence-table');await expect(evidenceTables).toHaveCount(2);await expect(evidenceTables.nth(0).locator(':scope>div')).toHaveCount(6);await expect(evidenceTables.nth(1).locator(':scope>div')).toHaveCount(6);
 await expect(root).toContainText(/COMMERCIAL EVIDENCE AUTHORITY/i);
 await expect(root).toContainText(/QUOTE \/ LOI/i);
 await expect(root).toContainText(/NOT REVENUE/i);
 await expect(root).toContainText(/PAYMENT_RECEIVED/i);
 await expect(root).toContainText(/VERIFIED CASH/i);
 await expect(root.locator('.traction-gate-grid article')).toHaveCount(6);
 await expect(root).toContainText(/Paid pilot|Платные пилоты/i);
 await expect(root).toContainText(/Gross contribution/i);
});

test('Investor traction dashboard is readable on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/#traction',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.traction-page')).toBeVisible();
 await expect(page.locator('.traction-metric').first()).toBeVisible();
 await expect(page.locator('.traction-next .primary-button')).toBeVisible();
});
