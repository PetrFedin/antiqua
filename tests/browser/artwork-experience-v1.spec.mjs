import {test,expect} from '@playwright/test';

test.describe('Artwork Experience v1',()=>{
 for(const viewport of [
  {name:'mobile',width:390,height:844},
  {name:'tablet',width:834,height:1112},
  {name:'desktop',width:1440,height:1000}
 ]){
  test(viewport.name+' renders Russian-first source-backed research journey',async({page})=>{
   await page.setViewportSize({width:viewport.width,height:viewport.height});
   await page.addInitScript(()=>localStorage.removeItem('antiqua_lang'));
   await page.goto('/?object=lot-101#gallery',{waitUntil:'domcontentloaded'});

   await expect.poll(()=>page.evaluate(()=>document.documentElement.lang)).toBe('ru');
   const dialog=page.locator('#dialog[open]');await expect(dialog).toBeVisible();
   const experience=dialog.locator('.artwork-experience-v1');await expect(experience).toBeVisible();

   await expect(experience).toContainText('История произведения');
   await expect(experience).toContainText('Карта доказательств');
   await expect(experience).toContainText('Открытые вопросы исследования');
   await expect(experience.locator('.artwork-evidence-card')).toHaveCount(6);
   await expect(experience).toContainText('Доказательства провенанса');
   await expect(experience.locator('.artwork-provenance-summary')).toBeVisible();

   const api=await page.evaluate(async()=>{
    const r=await fetch('/api/lots/lot-101/intelligence?limit=6');
    return{status:r.status,body:await r.json()};
   });
   expect(api.status).toBe(200);
   expect(Array.isArray(api.body.intelligence.story.events)).toBe(true);
   expect(api.body.intelligence.story.limitations.guessedDates).toBe(false);
   expect(api.body.intelligence.story.limitations.privateOwnerDataExcluded).toBe(true);
   expect(api.body.intelligence.provenanceEvidence).toBeTruthy();
   expect(api.body.intelligence.provenanceEvidence.assertions.authenticityCertified).toBe(false);

   const text=await experience.innerText();
   expect(text).not.toMatch(/CREATOR_PROFILE_NOT_LINKED|PROVENANCE_TIMELINE_NOT_RECORDED|BIBLIOGRAPHY_NOT_LINKED|EXHIBITION_HISTORY_NOT_LINKED|NO_PLATFORM_MARKET_COMPARABLES|PROVENANCE_EVIDENCE_REVIEW_OPEN|OWNER_DEALER_STATEMENT|SCHOLARLY_PUBLICATION|INSTITUTIONAL_RECORD|MACHINE_CANDIDATE/);

   const evidence=experience.locator('.artwork-evidence-card').first();
   const target=await evidence.getAttribute('data-evidence-target');
   expect(target).toBeTruthy();
   await evidence.click();
   await expect(dialog.locator(target)).toBeAttached();

   await page.locator('[data-lang="en"]').click();
   await expect.poll(()=>page.evaluate(()=>document.documentElement.lang)).toBe('en');
   await expect(experience).toContainText('Artwork Story');
   await expect(experience).toContainText('Evidence Map');
   await expect(experience).toContainText('Research Questions');
   await expect(experience).toContainText('Provenance Evidence');
  });
 }
});

test('Russian locale does not silently fall back to English localized data',async({page})=>{
 await page.addInitScript(()=>localStorage.removeItem('antiqua_lang'));
 await page.goto('/',{waitUntil:'domcontentloaded'});
 const result=await page.evaluate(async()=>{
  const m=await import('/modules/core.js');
  return{lang:m.lang(),value:m.local({en:'English only'})};
 });
 expect(result.lang).toBe('ru');
 expect(result.value).toBe('');
 await expect(page.locator('#footerDossier strong')).toHaveText('Досье произведения');
 await expect(page.locator('.main-nav')).toHaveAttribute('aria-label','Основная навигация');
});
