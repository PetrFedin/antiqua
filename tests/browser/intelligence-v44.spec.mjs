import {test,expect} from '@playwright/test';

async function login(page,persona){
 return page.evaluate(async persona=>{
  const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona})});
  return{status:r.status,body:await r.json()};
 },persona)
}

test('v0.44 Intelligence Authority exposes explainable projection boundaries',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});
 const caps=await page.evaluate(async()=>{const r=await fetch('/api/intelligence/capabilities');return{status:r.status,body:await r.json()}});
 expect(caps.status).toBe(200);
 expect(caps.body.capabilities.architecture).toBe('SHARED_FACTS_MULTIPLE_PROJECTIONS');
 expect(caps.body.capabilities.writesNewAuthority).toBe(false);
 expect(caps.body.capabilities.opaqueScores).toBe(false);
 expect(caps.body.capabilities.authenticityScore).toBe(false);
 expect(caps.body.capabilities.appraisalScore).toBe(false);
});

test('Collector Intelligence remains explainable and private from sellers',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});
 const auth=await login(page,'BUYER');expect(auth.status).toBe(200);
 const api=await page.evaluate(async()=>{const r=await fetch('/api/intelligence/collector?limit=8');return{status:r.status,body:await r.json()}});
 expect(api.status).toBe(200);
 expect(api.body.intelligence.interpretation.affinityPointsNotProbability).toBe(true);
 expect(api.body.intelligence.interpretation.purchaseIntentNotInferredFromPassiveSignals).toBe(true);
 expect(api.body.intelligence.privacy.sellerCannotSeePersonalTasteProfile).toBe(true);
 await page.goto('/#account',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#collectorIntelligenceV44')).toBeVisible();
 await expect(page.locator('#collectorIntelligenceV44')).toContainText(/COLLECTOR INTELLIGENCE/i);
});

test('Professional Intelligence aggregates artists and artworks without passive identity exposure',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});
 const auth=await login(page,'SELLER');expect(auth.status).toBe(200);
 const api=await page.evaluate(async()=>{const r=await fetch('/api/intelligence/professional?limit=12');return{status:r.status,body:await r.json()}});
 expect(api.status).toBe(200);
 expect(api.body.intelligence.interpretation.passiveSignalsAreNotUniquePeople).toBe(true);
 expect(api.body.intelligence.interpretation.identityOnlyAvailableInsideExplicitLeadWorkflow).toBe(true);
 expect(api.body.intelligence.contentEvidence.causalClaim).toBe(false);
 await page.goto('/#account',{waitUntil:'domcontentloaded'});
 const dealerTab=page.locator('[data-v14-tab="dealer"]');await expect(dealerTab).toBeVisible();await dealerTab.click();
 await expect(page.locator('#professionalIntelligenceV44')).toBeVisible();
 await expect(page.locator('#professionalIntelligenceV44')).toContainText(/PROFESSIONAL INTELLIGENCE/i);
});

test('Artwork Dossier shows scholarly intelligence without authenticity or appraisal claims',async({page})=>{
 await page.goto('/?object=lot-101#gallery',{waitUntil:'domcontentloaded'});
 const dialog=page.locator('#dialog[open]');await expect(dialog).toBeVisible();
 const api=await page.evaluate(async()=>{const r=await fetch('/api/lots/lot-101/intelligence?limit=6');return{status:r.status,body:await r.json()}});
 expect(api.status).toBe(200);
 expect(api.body.intelligence.attribution.verdict).toBe('NO_AUTHENTICITY_VERDICT');
 expect(api.body.intelligence.market.interpretation).toBe('CATALOGUE_COMPARABLES_NOT_APPRAISAL');
 expect(api.body.intelligence.boundaries.privateOwnerLocationExcluded).toBe(true);
 const scholarly=dialog.locator('#scholarlyIntelligenceV44');await expect(scholarly).toBeVisible();
 await expect(scholarly).toContainText(/MARKET & SCHOLARLY INTELLIGENCE/i);
 await expect(scholarly).toContainText(/NO_AUTHENTICITY_VERDICT/i);
 await expect(scholarly).toContainText(/COMPARABLES ≠ APPRAISAL/i);
});
