import {test,expect} from '@playwright/test';

// Visual proof uses the real preview application started by playwright.config.mjs.
// No production database, external credentials or commercial mutations.
const viewports=[
  {name:'iphone',width:390,height:844},
  {name:'ipad',width:834,height:1112},
  {name:'desktop',width:1440,height:900}
];

// A visible DOM node is not evidence that its remote artwork bitmap loaded.
// Wake lazy assets before full-page capture and record loaded/fallback states.
async function settleMuseumGalleryImages(gallery) {
  await expect(gallery).toHaveAttribute('data-museum-hydrated','true',{timeout:15_000});
  const cards=gallery.locator('.museum-artwork-card');
  await expect(cards).toHaveCount(9,{timeout:15_000});
  await cards.locator('img').evaluateAll(images => {
    images.forEach(image => { image.loading='eager'; });
  });
  await expect.poll(
    () => cards.evaluateAll(items => items.map(card => {
      const image=card.querySelector('.museum-artwork-image img');
      return image?.complete && image.naturalWidth>0 ? 'loaded'
        : card.querySelector('.museum-image-fallback') ? 'fallback' : 'pending';
    }).filter(state => state==='pending').length),
    {timeout:30_000,intervals:[300,700,1500]}
  ).toBe(0);
  return cards.evaluateAll(items => items.map(card => ({
    id:card.dataset.museumArtwork,
    status:card.querySelector('.museum-artwork-image img')?.naturalWidth>0?'loaded':'fallback'
  })));
}

test('v0.54 external museum artwork images must decode, not just exist in DOM',async({page})=>{
  test.setTimeout(90_000);
  await page.setViewportSize({width:834,height:1112});
  await page.goto('/#gallery',{waitUntil:'domcontentloaded'});
  const gallery=page.locator('[data-museum-open-access]');
  await expect(gallery).toBeVisible();
  const state=await settleMuseumGalleryImages(gallery);
  console.log('MUSEUM_IMAGE_STATES',JSON.stringify(state));
  expect(state).toHaveLength(9);
  for(const id of ['27992','20684','28560','14655','16568','16571','111442','61128','25865']) {
    expect(state.find(item=>item.id===id)?.status,
      'museum image '+id+' must be genuinely loaded').toBe('loaded');
  }
});

for(const device of viewports){
  test('v0.54 gallery visual proof '+device.name,async({page})=>{
    test.setTimeout(90_000);
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
    await settleMuseumGalleryImages(gallery);
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
  await page.route('https://commons.wikimedia.org/**',route=>route.abort());
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
