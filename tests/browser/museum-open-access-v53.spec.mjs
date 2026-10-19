import {test,expect} from '@playwright/test';

test('Museum open-access exhibition is art-first, attributed and not a fake sale listing',async({page})=>{
  await page.goto('/#gallery',{waitUntil:'domcontentloaded'});
  const section=page.locator('[data-museum-open-access]');
  await expect(section).toBeVisible();
  await expect(section).toContainText('Art Institute of Chicago');
  await expect(section).toContainText(/НЕ ПРОДАЁТСЯ|NOT FOR SALE/i);
  const card=section.locator('[data-museum-artwork="27992"]');
  await expect(card).toBeVisible();
  await expect(card).toContainText(/Жорж Сёра|Georges Seurat/);
  await expect(card.locator('a[href="https://www.artic.edu/artworks/27992"]')).toBeVisible();
  await expect(card.locator('[data-passport]')).toHaveCount(0);
  await expect(card).not.toContainText(/Купить|Buy now|Ставка|Bid now/i);
  // IIIF identity must remain verifiable when the external CDN is offline.
  // The app replaces failed images with an explicit source-linked fallback.
  await expect(card).toHaveAttribute('data-museum-image-id','2d484387-2509-5e8e-2c43-22f9981972eb');
  await expect(card.locator('img, .museum-image-fallback').first()).toBeVisible();
  await card.locator('[data-museum-open]').click();
  const dialog=page.locator('dialog[data-museum-dialog][open]');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/Музейная работа для изучения|Museum reference artwork/);
  await expect(dialog.locator('a[href="https://www.artic.edu/artworks/27992"]')).toBeVisible();
  await dialog.locator('.museum-work-close').click();
  await expect(dialog).not.toBeVisible();
});

test('Museum reference imagery stays usable on iPhone-sized gallery screen',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#gallery',{waitUntil:'domcontentloaded'});
  const root=page.locator('[data-museum-open-access]');
  await expect(root).toBeVisible();
  const grid=root.locator('.museum-open-grid');
  await expect(grid).toBeVisible();
  await root.locator('[data-museum-filter="figures"]').click();
  await expect(root.locator('[data-museum-artwork="27992"]')).toBeVisible();
  await root.locator('[data-museum-artwork="27992"] [data-museum-open]').click();
  await expect(page.locator('dialog[data-museum-dialog][open]')).toBeVisible();
});


test('museum four-image gallery and mobile dialog keep scroll and close usable',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#gallery',{waitUntil:'domcontentloaded'});
  const root=page.locator('[data-museum-open-access]');
  await expect(root.locator('[data-museum-artwork="27992"]')).toBeVisible();
  await expect(root.locator('[data-museum-artwork="20684"]')).toBeVisible();
  await expect(root.locator('[data-museum-artwork="28560"]')).toBeVisible();
  await expect(root.locator('[data-museum-artwork="14655"]')).toBeVisible();
  await root.locator('[data-museum-artwork="28560"] [data-museum-open]').click();
  const modal=page.locator('dialog[data-museum-dialog][open]');
  await expect(modal).toBeVisible();
  const geometry=await modal.evaluate(el=>({height:el.getBoundingClientRect().height,viewport:innerHeight,close:el.querySelector('.museum-work-close').getBoundingClientRect().toJSON()}));
  expect(geometry.height).toBeLessThanOrEqual(geometry.viewport+1);
  expect(geometry.close.top).toBeGreaterThanOrEqual(0);
  expect(geometry.close.bottom).toBeLessThanOrEqual(geometry.viewport);
  await expect(page.locator('html')).toHaveClass(/museum-modal-open/);
  await modal.locator('.museum-work-close').click();
  await expect(page.locator('html')).not.toHaveClass(/museum-modal-open/);
});

test('v60 reviewed Russian museum captions survive verified metadata hydration',async({page})=>{
  await page.route(/^https:\/\/api\.artic\.edu\/api\/v1\/artworks\?/,route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({data:[
      {id:16568,title:'Water Lilies',artist_display:'Claude Monet (French)',
        artwork_type_title:'Painting',is_public_domain:true,
        image_id:'12345678-1234-4abc-8abc-123456789abc',
        medium_display:'Oil on canvas',date_display:'1906',
        dimensions:'test dimensions',main_reference_number:'1933.1157'},
      {id:61128,title:'Not released',artist_display:'Private',
        artwork_type_title:'Painting',is_public_domain:false,
        image_id:'12345678-1234-4abc-8abc-123456789abc'},
      {id:16571,title:'Bad IIIF identity',artist_display:'Private',
        artwork_type_title:'Painting',is_public_domain:true,
        image_id:'not-a-valid-iiif-id'}
    ]})
  }));
  await page.goto('/#gallery',{waitUntil:'domcontentloaded'});
  const gallery=page.locator('[data-museum-open-access]');
  await expect(gallery).toHaveAttribute('data-museum-hydrated','true');
  const painting=gallery.locator('[data-museum-artwork="16568"]');
  await expect(painting).toBeVisible();
  await expect(painting).toContainText('Кувшинки');
  await expect(painting).toContainText('Клод Моне');
  await expect(painting).toContainText('Холст, масло');
  await expect(painting).not.toContainText('Water Lilies');
  await expect(gallery.locator('[data-museum-artwork="61128"]')).toHaveCount(0);
  await expect(gallery.locator('[data-museum-artwork="16571"]')).toHaveCount(0);
  await painting.locator('[data-museum-open]').click();
  const dialog=page.locator('dialog[data-museum-dialog][open]');
  await expect(dialog.locator('h2')).toHaveText('Кувшинки');
  await expect(dialog).toContainText('Клод Моне');
  await dialog.locator('.museum-work-close').click();
  await expect(dialog).not.toBeVisible();
});
