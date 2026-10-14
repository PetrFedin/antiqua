import {test,expect} from '@playwright/test';

test('Artwork Dossier preserves responsive experience and exposes a redacted public API',async({page,request})=>{
  const api=await request.get('/api/lots/lot-109/dossier');
  expect(api.status()).toBe(200);
  const payload=await api.json();
  expect(payload.dossier?.schemaVersion).toBe('antiqua-artwork-dossier-public-v58');
  expect(payload.dossier?.objectId).toBe('lot-109');
  expect(payload.dossier?.boundaries?.readModelOnly).toBe(true);
  expect(payload.dossier?.boundaries?.credentialProvesRoleNotTruth).toBe(true);
  expect(payload.dossier?.boundaries?.currentAskingPriceIncluded).toBe(false);
  expect(payload.dossier?.boundaries?.sourceAccountAndDocumentIdsIncluded).toBe(false);
  expect(payload.dossier?.boundaries?.scholarlyDetailsRequireSeparatePublicationGrant).toBe(true);
  expect(payload.dossier?.boundaries?.authenticityCertified).toBe(false);
  expect(payload.dossier?.scholarlyContributions).toEqual([]);
  expect(payload.dossier?.publicDossierSha256).toMatch(/^[0-9a-f]{64}$/);
  expect(payload.capabilities?.schemaVersion).toBe('antiqua-artwork-dossier-public-v58');
  expect(payload.capabilities?.credentialsAtReview).toBe(false);
  expect(payload.capabilities?.scholarlyContributions).toBe(false);
  expect(payload.dossier?.boundaries?.conflictsAndGapsPreserved).toBe(true);
  expect(payload.capabilities?.expertScore).toBe(false);
  expect(payload.capabilities?.authenticityCertified).toBe(false);

  const overview=await request.get('/api/provenance-evidence-overview');
  expect(overview.status()).toBe(200);
  const overviewPayload=await overview.json();
  expect(overviewPayload?.overview?.schemaVersion).toBe('antiqua-provenance-evidence-overview-v1');

  await page.goto('/?object=lot-109#gallery',{waitUntil:'domcontentloaded'});
  const dialog=page.locator('#dialog[open]');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/Вид через лагуну|View across the lagoon/i);
  await expect(dialog.locator('a[href="#dossier-scholarly"]')).toBeVisible();
  await expect(dialog.locator('a[href="#dossier-market-history"]')).toBeVisible();
  await expect(dialog.locator('#dossier-scholarly')).toBeVisible();
  await expect(dialog.locator('#dossier-market-history')).toBeVisible();
  await expect(dialog).toContainText(/Credential подтверждает роль|credential attests role/i);
  await expect(dialog).toContainText(/История рынка|Market history/i);

  const summary=dialog.locator('.artwork-research-summary');
  await expect(summary).toBeVisible();
  expect(await summary.locator('> div').count()).toBe(4);

  const viewport=page.viewportSize();
  if(viewport?.width&&viewport.width<=620){
    const tabs=dialog.locator('.dossier-tabs');
    await expect(tabs).toBeVisible();
    const overflow=await tabs.evaluate(el=>getComputedStyle(el).overflowX);
    expect(['auto','scroll']).toContain(overflow);
  }

  const en=dialog.locator('[data-lang="en"]').first();
  await expect(en).toBeVisible();
  await en.click();
  await expect(dialog).toContainText(/Artwork history/i);
  await expect(dialog).not.toContainText(/Object history/i);
});
