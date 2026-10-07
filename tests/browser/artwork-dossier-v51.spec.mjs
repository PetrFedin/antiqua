import {test,expect} from '@playwright/test';

test('Artwork Dossier exposes research, scholarly and market layers on responsive browser projects',async({page,request})=>{
  const api=await request.get('/api/lots/lot-109/dossier');
  expect(api.status()).toBe(200);
  const payload=await api.json();
  expect(payload.dossier?.schemaVersion).toBe('antiqua-artwork-dossier-v51');
  expect(payload.dossier?.objectId).toBe('lot-109');
  expect(payload.dossier?.boundaries?.readModelOnly).toBe(true);
  expect(payload.dossier?.boundaries?.credentialProvesRoleNotTruth).toBe(true);
  expect(payload.dossier?.boundaries?.marketHistoryExcludesCurrentAskingPrice).toBe(true);
  expect(payload.dossier?.boundaries?.conflictsAndGapsPreserved).toBe(true);
  expect(payload.capabilities?.expertScore).toBe(false);
  expect(payload.capabilities?.authenticityCertified).toBe(false);

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

  const en=page.locator('[data-lang="en"]:visible').first();
  if(await en.isVisible().catch(()=>false)){
    await en.click();
    await expect(dialog).toContainText(/Artwork history/i);
    await expect(dialog).not.toContainText(/Object history/i);
  }
});
