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
  // Four curated paintings are always available. Five additional records
  // appear ONLY after the museum API confirms public domain, Painting
  // classification, unique ID and a valid IIIF image identifier.
  await expect.poll(()=>cards.count(),{timeout:15_000}).toBeGreaterThanOrEqual(4);
  const count=await cards.count();
  expect(count,'never manufacture optional museum records on API failure').toBeLessThanOrEqual(9);
  for(const id of ['27992','20684','28560','14655'])
    await expect(gallery.locator('[data-museum-artwork="'+id+'"]')).toHaveCount(1);
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

test('v0.54 museum artwork images must decode or show an honest source-linked fallback',async({page})=>{
  test.setTimeout(90_000);
  await page.setViewportSize({width:834,height:1112});
  await page.goto('/#gallery',{waitUntil:'domcontentloaded'});
  const gallery=page.locator('[data-museum-open-access]');
  await expect(gallery).toBeVisible();
  const state=await settleMuseumGalleryImages(gallery);
  console.log('MUSEUM_IMAGE_STATES',JSON.stringify(state));
  expect(state.length).toBeGreaterThanOrEqual(4);
  expect(state.length).toBeLessThanOrEqual(9);
  for(const id of ['27992','20684','28560','14655']) {
    const record=state.find(item=>item.id===id);
    expect(record,'the curated museum image must be represented: '+id).toBeTruthy();
  }
  for(const record of state) {
    expect(['loaded','fallback'],'no silently blank card '+record.id).toContain(record.status);
    if(record.status==='fallback') {
      const card=gallery.locator('[data-museum-artwork="'+record.id+'"]');
      await expect(card.locator('.museum-image-fallback')).toBeVisible();
      await expect(card.locator('a[href="https://www.artic.edu/artworks/'+record.id+'"]')).toBeVisible();
    }
  }
});

for(const device of viewports){
  test('v0.54 gallery visual proof '+device.name,async({page})=>{
    test.setTimeout(120_000);
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
    const states=await settleMuseumGalleryImages(gallery);
    // Full-page screenshots can omit off-screen decoded bitmaps in headless Chromium.
    // The actual visitor scrolls; create viewport proof per museum grid row as well.
    expect(states.length).toBeGreaterThanOrEqual(4);
    expect(states.length).toBeLessThanOrEqual(9);
    for(const state of states)
      expect(['loaded','fallback'],'no silently blank artwork '+state.id+' on '+device.name).toContain(state.status);
    const cards=gallery.locator('.museum-artwork-card');
    const columns=device.width>=881?3:2;
    for(let i=0;i<states.length;i+=columns){
      const card=cards.nth(i);
      await card.scrollIntoViewIfNeeded();
      if(states[i].status==='loaded')
        await expect(card.locator('.museum-artwork-image img')).toHaveJSProperty('complete',true);
      else
        await expect(card.locator('.museum-image-fallback')).toBeVisible();
      // Two compositor frames after actual scrolling: capture loaded bitmap
      // OR the truthful offline fallback, never an invisible remote asset.
      await page.evaluate(()=>new Promise(resolve=>
        requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await page.screenshot({
        path:'artifacts/visual-proof/gallery-row-'+device.name+'-'+Math.floor(i/columns)+'.png',
        fullPage:false
      });
    }
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

test('v0.54 withheld museum metadata never creates fictitious optional works',async({page})=>{
  await page.route(/\/api\/museum\/optional(?:\?|$)/,route=>
    route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'SOURCE_FIELDS_FILTERED',source:'ART_INSTITUTE_OF_CHICAGO',sourceFieldsValidated:true,data:[]})}));
  await page.goto('/#gallery',{waitUntil:'domcontentloaded'});
  const gallery=page.locator('[data-museum-open-access]');
  await expect(gallery).toHaveAttribute('data-museum-hydrated','true');
  const cards=gallery.locator('.museum-artwork-card');
  await expect(cards).toHaveCount(4);
  for(const id of ['16568','16571','111442','61128','25865'])
    await expect(gallery.locator('[data-museum-artwork="'+id+'"]')).toHaveCount(0);
  await expect(gallery.locator('[data-museum-count]')).toContainText(/4 /);
});

test('v0.54 source API unavailable remains an honest reference gallery',async({page})=>{
  await page.route('**/api/museum/optional',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'UNAVAILABLE',source:'ART_INSTITUTE_OF_CHICAGO',sourceFieldsValidated:false,data:[]})}));
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

test('v60 320px offline museum hero shrinks while source, caption and dialog remain reachable',async({page})=>{
  test.setTimeout(40_000);
  await page.route('**/api/museum/optional',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'UNAVAILABLE',source:'ART_INSTITUTE_OF_CHICAGO',sourceFieldsValidated:false,data:[]})}));
  await page.route('https://www.artic.edu/iiif/**',route=>route.abort());
  await page.route('https://commons.wikimedia.org/**',route=>route.abort());
  await page.setViewportSize({width:320,height:568});
  await page.goto('/#gallery',{waitUntil:'domcontentloaded'});
  const hero=page.locator('.culture-hero-media.culture-hero-media-unavailable');
  await expect(hero).toBeVisible();
  await expect(hero.locator('.museum-image-fallback')).toContainText(/недоступно|unavailable/i);
  const geometry=await hero.evaluate(el=>{
    const root=el.getBoundingClientRect();
    const note=el.querySelector('.museum-image-fallback').getBoundingClientRect();
    const caption=el.querySelector('.culture-hero-caption').getBoundingClientRect();
    return {height:root.height,captionWithin:caption.bottom<=root.bottom+2,
      contentSeparate:note.bottom<=caption.top+2,
      aspect:getComputedStyle(el).aspectRatio};
  });
  expect(geometry.height,'fallback must not reserve a full-height artwork').toBeLessThan(360);
  expect(geometry.captionWithin).toBe(true);
  expect(geometry.contentSeparate).toBe(true);
  expect(geometry.aspect).toBe('auto');
  await hero.scrollIntoViewIfNeeded();
  await page.screenshot({path:'artifacts/visual-proof/offline-museum-320.png',fullPage:false});
  await hero.locator('[data-museum-open]').click();
  const modal=page.locator('dialog[data-museum-dialog][open]');
  await expect(modal).toBeVisible();
  await expect(modal.locator('a[href="https://www.artic.edu/artworks/27992"]')).toBeVisible();
  const close=modal.locator('.museum-work-close');
  await expect(close).toBeVisible();
  const closeBox=await close.boundingBox();
  expect(closeBox.y).toBeGreaterThanOrEqual(0);
  expect(closeBox.y+closeBox.height).toBeLessThanOrEqual(568);
  const modalRect=await modal.boundingBox();
  expect(modalRect.height).toBeLessThanOrEqual(568);
  await page.screenshot({path:'artifacts/visual-proof/offline-dialog-320.png',fullPage:false});
  await page.keyboard.press('Escape');
  await expect(modal).not.toBeVisible();
});
