import {test,expect} from '@playwright/test';

// Visual proof uses the real preview application started by playwright.config.mjs.
// No production database, external credentials or commercial mutations.
const viewports=[
  {name:'iphone',width:390,height:844},
  {name:'ipad',width:834,height:1112},
  {name:'desktop',width:1440,height:900}
];

for(const device of viewports){
  test('v0.54 gallery visual proof '+device.name,async({page})=>{
    await page.setViewportSize({width:device.width,height:device.height});
    await page.goto('/#gallery',{waitUntil:'domcontentloaded'});
    const gallery=page.locator('[data-museum-open-access]');
    await expect(gallery).toBeVisible();
    const card=gallery.locator('[data-museum-artwork="27992"]');
    await expect(card).toBeVisible();
    await expect(card).toContainText(/Жорж Сёра|Georges Seurat/);
    await expect(card).toContainText(/НЕ ПРОДАЁТСЯ|NOT FOR SALE/);
    await expect(card.locator('a[href="https://www.artic.edu/artworks/27992"]')).toBeVisible();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
    expect(overflow,'document has horizontal overflow').toBe(false);
    await page.screenshot({path:'artifacts/visual-proof/gallery-'+device.name+'.png',fullPage:true});
    await card.locator('[data-museum-open]').click();
    const dialog=page.locator('dialog[data-museum-dialog][open]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/Музейная работа для изучения|Museum reference artwork/);
    await page.screenshot({path:'artifacts/visual-proof/artwork-'+device.name+'.png',fullPage:false});
    await dialog.locator('.museum-work-close').click();
    await expect(dialog).not.toBeVisible();
  });
}

test('v0.54 source API unavailable remains an honest reference gallery',async({page})=>{
  await page.route('https://api.artic.edu/**',route=>route.abort());
  await page.route('https://www.artic.edu/iiif/**',route=>route.abort());
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#gallery',{waitUntil:'domcontentloaded'});
  const root=page.locator('[data-museum-open-access]');
  await expect(root).toBeVisible();
  const card=root.locator('[data-museum-artwork="27992"]');
  await expect(card).toBeVisible();
  await expect(card.locator('.museum-image-fallback')).toBeVisible();
  await expect(card.locator('a[href="https://www.artic.edu/artworks/27992"]')).toBeVisible();
  await expect(card.locator('[data-passport]')).toHaveCount(0);
  await page.screenshot({path:'artifacts/visual-proof/offline-museum-iphone.png',fullPage:false});
});
