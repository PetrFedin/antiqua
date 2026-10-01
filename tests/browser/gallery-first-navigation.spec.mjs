import {test,expect} from '@playwright/test';

test('Gallery-first navigation keeps consumer journey separate from professional tools',async({page})=>{
 await page.goto('/#gallery',{waitUntil:'domcontentloaded'});
 const nav=page.locator('.main-nav');
 if(await page.locator('.mobile-tabbar').isVisible()){await page.setViewportSize({width:1280,height:900});await page.reload({waitUntil:'domcontentloaded'})}
 await expect(nav.locator('[data-nav="gallery"]')).toHaveText(/Галерея|Gallery/i);
 await expect(nav.locator('[data-nav="creators"]')).toHaveText(/Художники|Artists/i);
 await expect(nav.locator('[data-nav="collections"]')).toBeVisible();
 await expect(nav.locator('[data-nav="learn"]')).toHaveText(/Знания|Learn/i);
 await expect(nav.locator('[data-nav="events"]')).toHaveText(/События|Events/i);
 await expect(nav.locator('[data-nav="auctions"]')).toHaveText(/Аукцион|Auction/i);
 await expect(nav.locator('[data-nav="dealers"]')).toHaveCount(0);
 await expect(page.locator('#catalogGrid [data-open-passport]').first()).toBeVisible();

 await nav.locator('[data-nav="learn"]').click();
 await expect(page).toHaveURL(/#learn/);
 await expect(page.locator('main')).toContainText(/Журнал|Journal|истори|story/i);

 await page.locator('.main-nav [data-nav="events"]').click();
 await expect(page).toHaveURL(/#events/);
 await expect(page.locator('main')).toBeVisible();
});

test('Gallery-first mobile tab bar exposes the core art journey',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/#gallery',{waitUntil:'domcontentloaded'});
 const tabs=page.locator('.mobile-tabbar');
 for(const key of ['gallery','creators','collections','learn','auctions','account'])await expect(tabs.locator(`[data-nav="${key}"]`)).toBeVisible();
 await expect(tabs.locator('[data-nav="dealers"]')).toHaveCount(0);
});
