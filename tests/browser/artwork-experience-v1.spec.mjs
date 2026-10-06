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


test.describe('Artist and Collection responsive surfaces',()=>{
 for(const viewport of [
  {name:'mobile',width:390,height:844},
  {name:'tablet',width:834,height:1112},
  {name:'desktop',width:1440,height:1000}
 ]){
  test(viewport.name+' keeps artist research and collection wall usable',async({page})=>{
   await page.setViewportSize({width:viewport.width,height:viewport.height});
   await page.addInitScript(()=>localStorage.removeItem('antiqua_lang'));

   await page.goto('/#creators',{waitUntil:'domcontentloaded'});
   const creator=page.locator('.creator-card').first();await expect(creator).toBeVisible();
   await creator.click();
   const profile=page.locator('.artist-profile-v1');await expect(profile).toBeVisible();
   await expect(profile.locator('.artist-profile-hero-v1')).toBeVisible();
   await expect(profile.locator('.artist-profile-facts')).toBeVisible();
   await expect(profile.locator('.artist-profile-context-grid')).toBeVisible();
   await expect(profile.locator('.artist-works-v1')).toBeAttached();
   const artistText=await profile.innerText();
   expect(artistText).not.toMatch(/COLLECTOR INTELLIGENCE|ARTIST PERFORMANCE|RESEARCH STATUS/);

   await page.goto('/#collections',{waitUntil:'domcontentloaded'});
   const collection=page.locator('.collection-card').first();await expect(collection).toBeVisible();
   await collection.click();
   const detail=page.locator('.collection-detail-v1');await expect(detail).toBeVisible();
   await expect(detail.locator('.collection-hero-v1')).toBeVisible();
   await expect(detail.locator('.collection-wall')).toBeVisible();
   await expect(detail).toContainText('Визуальная коллекция');
   await expect(detail).not.toContainText(/страхован|место хранения|владелец:/i);
  });
 }
});

test('Research slot reserves layout while intelligence loads',async({page})=>{
 await page.addInitScript(()=>localStorage.removeItem('antiqua_lang'));
 let delayed=false;
 await page.route('**/api/lots/lot-101/intelligence?limit=6',async route=>{
  delayed=true;
  await new Promise(r=>setTimeout(r,700));
  await route.continue();
 });
 await page.goto('/?object=lot-101#gallery',{waitUntil:'domcontentloaded'});
 const dialog=page.locator('#dialog[open]');await expect(dialog).toBeVisible();
 const placeholder=dialog.locator('#scholarlyIntelligencePlaceholder');
 await expect(placeholder).toBeVisible();
 const box=await placeholder.boundingBox();
 expect(box?.height||0).toBeGreaterThan(500);
 await expect(dialog.locator('.artwork-experience-v1')).toBeVisible();
 expect(delayed).toBe(true);
});

test('Mobile research navigation stays touchable and scrolls to real dossier sections',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>localStorage.removeItem('antiqua_lang'));
 await page.goto('/?object=lot-101#gallery',{waitUntil:'domcontentloaded'});
 const nav=page.locator('#dialog[open] .artwork-research-nav');await expect(nav).toBeVisible();
 await expect(nav.locator('button')).toHaveCount(5);
 const provenance=nav.getByRole('button',{name:'Провенанс'});
 await provenance.click();
 await expect(page.locator('#dialog[open] #dossier-provenance')).toBeAttached();
 const box=await provenance.boundingBox();
 expect(box?.height||0).toBeGreaterThanOrEqual(38);
});
