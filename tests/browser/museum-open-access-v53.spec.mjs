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
  const img=card.locator('img');
  await expect(img).toHaveAttribute('src',/2d484387-2509-5e8e-2c43-22f9981972eb/);
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
