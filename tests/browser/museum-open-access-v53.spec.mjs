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
