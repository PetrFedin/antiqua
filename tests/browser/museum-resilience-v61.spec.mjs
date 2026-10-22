import {test, expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const metadataURL = /^https:\/\/api\.artic\.edu\/api\/v1\/artworks\?/;
const sourceURL = 'https://www.artic.edu/artworks/27992';
const fixture = overrides => ({
  id: 16568, title: 'Water Lilies', artist_display: 'Claude Monet (French)',
  artwork_type_title: 'Painting', is_public_domain: true,
  image_id: '12345678-1234-4abc-8abc-123456789abc',
  medium_display: 'Oil on canvas', date_display: '1906',
  dimensions: 'Synthetic test dimensions', main_reference_number: 'TEST',
  ...overrides
});

async function blockImages(page) {
  await page.route('https://www.artic.edu/iiif/**', route => route.abort());
  await page.route('https://commons.wikimedia.org/**', route => route.abort());
}
async function offlineGallery(page, locale = 'ru') {
  await page.route('https://api.artic.edu/**', route => route.abort());
  await blockImages(page);
  await page.goto('/#gallery', {waitUntil: 'domcontentloaded'});
  if (locale === 'en') await page.locator('[data-lang="en"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  await expect(page.locator('[data-museum-open-access]')).toBeVisible();
}

// These cases prove viewport intersection, not only DOM/CSS visibility.
for (const locale of ['ru', 'en']) {
  for (const viewport of [{width: 320, height: 568}, {width: 568, height: 320}]) {
    test(`v61 offline source reachable ${locale} ${viewport.width}x${viewport.height}`, async ({page}, info) => {
      await page.setViewportSize(viewport);
      await offlineGallery(page, locale);
      const opener = page.locator('.culture-hero-media [data-museum-open]');
      await opener.click();
      const modal = page.locator('dialog[data-museum-dialog][open]');
      await expect(modal).toHaveClass(/museum-work-dialog-unavailable/);
      const source = modal.locator('[data-museum-record]');
      const close = modal.locator('.museum-work-close');
      await expect(source).toHaveCount(1);
      await expect(source).toHaveAttribute('href', sourceURL);
      await expect(source).toHaveAttribute('rel', 'noopener noreferrer');
      await expect(source).toHaveClass(/museum-image-source-link/);
      await expect(source).toBeInViewport({ratio: 1});
      await expect(close).toBeInViewport({ratio: 1});
      await expect(close).toBeFocused();
      const canvas = await modal.locator('.museum-work-canvas').boundingBox();
      expect(canvas.height).toBeLessThan(205);
      const overflow = await modal.evaluate(el => el.scrollWidth - el.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      // Keyboard access follows close -> visible source; background stays inert.
      await page.keyboard.press('Tab');
      await expect(source).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(close).toBeFocused();
      await mkdir('artifacts/visual-proof', {recursive: true});
      await page.screenshot({path: `artifacts/visual-proof/v61-offline-${locale}-${viewport.width}-${info.project.name}.png`});
      await page.keyboard.press('Escape');
      await expect(page.locator('dialog[data-museum-dialog]')).toHaveCount(0);
      await expect(page.locator('html')).not.toHaveClass(/museum-modal-open/);
      await expect(opener).toBeFocused();
    });
  }
}

test('v61 stalled image CDN falls back to the authentic museum source, not a blank painting',async({page})=>{
  test.setTimeout(40_000);
  const release=[];
  const hang=route=>new Promise(resolve=>{release.push(async()=>{
    await route.abort().catch(()=>{});resolve();
  });});
  await page.route('https://commons.wikimedia.org/**',route=>
    route.request().url().includes('Georges_Seurat')?hang(route):route.continue());
  await page.route('https://www.artic.edu/iiif/**',route=>
    route.request().url().includes('2d484387-2509-5e8e-2c43-22f9981972eb')?
      hang(route):route.continue());
  try{
    await page.goto('/#gallery',{waitUntil:'domcontentloaded'});
    const card=page.locator('[data-museum-artwork="27992"]');
    await expect(card).toBeVisible();
    await expect(card.locator('.museum-image-fallback')).toBeVisible({timeout:18_500});
    await expect(card.locator('a[href="https://www.artic.edu/artworks/27992"]')).toBeVisible();
    await expect(card.locator('.museum-artwork-image img')).toHaveCount(0);
  }finally{await Promise.all(release.map(fn=>fn()))}
});

test('v61 hydration preserves the focused core painting node', async ({page}) => {
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  await page.route(metadataURL, async route => {
    await ready;
    await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({data: [fixture()]})});
  });
  await blockImages(page);
  try {
    await page.goto('/#gallery', {waitUntil: 'domcontentloaded'});
    const gallery = page.locator('[data-museum-open-access]');
    const opener = gallery.locator('[data-museum-open="27992"]');
    await expect(opener).toBeVisible();
    await opener.focus();
    await expect(opener).toBeFocused();
    const handle = await opener.elementHandle();
    release();
    await expect(gallery).toHaveAttribute('data-museum-hydrated', 'true');
    await expect(gallery.locator('[data-museum-artwork="16568"]')).toHaveCount(1);
    expect(await handle.evaluate(el => el.isConnected && el === document.activeElement)).toBe(true);
    await expect(gallery.locator('[data-museum-count]')).toHaveAttribute('role', 'status');
    await expect(gallery.locator('[data-museum-count]')).toHaveAttribute('aria-atomic', 'true');
  } finally {
    release();
  }
});

test('v61 malformed neighbours do not erase valid metadata; duplicate identities are withheld', async ({page}) => {
  await page.route(metadataURL, route => route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({data: [
    null, 'not a record', [], fixture(),
    fixture({id: 61128}), fixture({id: 61128, is_public_domain: false}),
    fixture({id: 16571, is_public_domain: false}),
    fixture({id: 111442, artwork_type_title: 'Sculpture'}),
    fixture({id: 25865, image_id: 'invalid'})
  ]})}));
  await blockImages(page);
  await page.goto('/#gallery', {waitUntil: 'domcontentloaded'});
  const gallery = page.locator('[data-museum-open-access]');
  await expect(gallery).toHaveAttribute('data-museum-hydrated', 'true');
  await expect(gallery.locator('[data-museum-artwork]')).toHaveCount(5);
  await expect(gallery.locator('[data-museum-artwork="16568"]')).toHaveCount(1);
  for (const id of [61128, 16571, 111442, 25865]) {
    await expect(gallery.locator(`[data-museum-artwork="${id}"]`)).toHaveCount(0);
  }
});

for (const medium of ['Oil on board', 'constructor', '__proto__']) {
  test(`v61 unreviewed medium stays source-qualified: ${medium}`, async ({page}) => {
    await page.route(metadataURL, route => route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({data: [fixture({medium_display: medium})]})}));
    await blockImages(page);
    await page.goto('/#gallery', {waitUntil: 'domcontentloaded'});
    const painting = page.locator('[data-museum-artwork="16568"]');
    await expect(painting).toBeVisible();
    // No guessed support material and no inherited Object.prototype value.
    await expect(painting.locator('.museum-artwork-facts')).toHaveText('1906 \u00b7 \u0422\u0435\u0445\u043d\u0438\u043a\u0430 \u2014 \u0432 \u043c\u0443\u0437\u0435\u0439\u043d\u043e\u0439 \u0437\u0430\u043f\u0438\u0441\u0438');
    await page.locator('[data-lang="en"]').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('[data-museum-artwork="16568"] .museum-artwork-facts')).toHaveText('1906 \u00b7 ' + medium);
  });
}

test('v61 navigation releases the museum dialog and restores page focus', async ({page}) => {
  await offlineGallery(page);
  await page.locator('.culture-hero-media [data-museum-open]').click();
  await expect(page.locator('dialog[data-museum-dialog][open]')).toBeVisible();
  await page.evaluate(() => { window.location.hash = '#collections'; });
  await expect(page.locator('dialog[data-museum-dialog]')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveClass(/museum-modal-open/);
  await expect(page.locator('#app')).toBeFocused();
});

test('v61 offline source opens the exact museum record without external navigation in test', async ({page, context}) => {
  await context.route(sourceURL, route => route.fulfill({status: 200, contentType: 'text/html', body: '<!doctype html><title>Synthetic museum source fixture</title>'}));
  await offlineGallery(page);
  await page.locator('.culture-hero-media [data-museum-open]').click();
  const link = page.locator('dialog[data-museum-dialog] .museum-image-source-link');
  await expect(link).toBeVisible();
  const popupPromise = context.waitForEvent('page');
  await link.click();
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  expect(popup.url()).toBe(sourceURL);
  expect(await popup.evaluate(() => window.opener === null)).toBe(true);
  await popup.close();
});
