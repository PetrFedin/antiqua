import {test,expect} from '@playwright/test';
for(const locale of ['ru','en'])for(const width of [320,390,800]){
 test('v66 mobile index '+locale+' '+width,async({page})=>{
  await page.setViewportSize({width,height:568});
  await page.goto('/#gallery',{waitUntil:'domcontentloaded'});
  if(locale==='en')await page.locator('[data-lang="en"]').click();
  const bar=page.locator('.mobile-tabbar');
  await expect(bar.locator('a[data-nav],button[data-mobile-more]')).toHaveCount(5);
  const info=await bar.locator('a[data-nav],button[data-mobile-more]').evaluateAll(items=>items.map(el=>({height:el.getBoundingClientRect().height,labelSize:parseFloat(getComputedStyle(el.querySelector('span')).fontSize)})));
  for(const row of info){expect(row.height).toBeGreaterThanOrEqual(44);expect(row.labelSize).toBeGreaterThanOrEqual(10)}
  const more=bar.locator('[data-mobile-more]');await more.click();
  const dialog=page.locator('#mobileMoreDialog[open]');
  await expect(dialog.locator('a[data-nav]')).toHaveCount(4);
  await expect(dialog.locator('[data-mobile-more-close]')).toBeFocused();
  await page.keyboard.press('Escape');await expect(page.locator('#mobileMoreDialog[open]')).toHaveCount(0);
  await more.click();await dialog.locator('[data-nav="auctions"]').click();
  await expect(page).toHaveURL(/#auctions/);await expect(more).toHaveAttribute('aria-current','page');
  await bar.locator('[data-nav="gallery"]').click();await expect(more).not.toHaveAttribute('aria-current','page');
 });
}
