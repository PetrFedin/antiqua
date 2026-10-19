import {test, expect} from '@playwright/test';

test('v62 public provenance overview survives integrated preview runtime',async({request})=>{
  const response=await request.get('/api/provenance-evidence-overview');
  expect(response.status()).toBe(200);
  const body=await response.json();
  expect(body.overview.schemaVersion).toBe('antiqua-provenance-evidence-overview-v1');
  expect(body.overview.publicWorks).toBeGreaterThan(0);
  expect(body.overview.assertions.authenticityCertified).toBe(false);
  expect(body.overview.assertions.universalScoreUsed).toBe(false);
  expect(body.capabilities.authenticityCertification).toBe(false);
});

test('v62 museum source remains reachable while provenance API is healthy',async({page})=>{
  await page.setViewportSize({width:320,height:568});
  await page.route('https://api.artic.edu/**',route=>route.abort());
  await page.route('https://www.artic.edu/iiif/**',route=>route.abort());
  await page.route('https://commons.wikimedia.org/**',route=>route.abort());
  await page.goto('/#gallery',{waitUntil:'domcontentloaded'});
  await expect(page.locator('[data-museum-open-access]')).toBeVisible();
  const response=await page.request.get('/api/provenance-evidence-overview');
  expect(response.status()).toBe(200);
  const opener=page.locator('.culture-hero-media [data-museum-open]');
  await opener.click();
  const dialog=page.locator('dialog[data-museum-dialog][open]');
  await expect(dialog).toBeVisible();
  const source=dialog.locator('[data-museum-record]');
  await expect(source).toBeInViewport({ratio:1});
  await expect(source).toHaveAttribute('href','https://www.artic.edu/artworks/27992');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});
