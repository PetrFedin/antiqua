import {test,expect} from '@playwright/test';

const allowed=new Set(['PAINTING','DRAWING','ENGRAVING','ETCHING','LITHOGRAPH','WOODCUT','LINOCUT','SCREENPRINT','WATERCOLOR','GOUACHE','PASTEL','MIXED_MEDIA','OTHER_PRINT','OTHER_WORK_ON_PAPER']);

test('Fine-art API scope publishes only explicitly admitted art while full catalogue keeps legacy objects',async({request})=>{
 const [allRes,artRes]=await Promise.all([request.get('/api/catalog'),request.get('/api/catalog?scope=FINE_ART')]);
 expect(allRes.ok()).toBeTruthy();expect(artRes.ok()).toBeTruthy();
 const all=await allRes.json(),art=await artRes.json();
 expect(art.scope).toBe('FINE_ART');
 expect(art.fineArt.explicitReviewRequired).toBe(true);
 expect(art.fineArt.automatedMappingMayPublish).toBe(false);
 expect(art.lots.length).toBeGreaterThanOrEqual(8);
 expect(all.lots.some(x=>x.id==='lot-101')).toBe(true);
 expect(art.lots.some(x=>x.id==='lot-101')).toBe(false);
 expect(art.lots.some(x=>x.id==='lot-104'&&x.galleryClassification?.workType==='PAINTING')).toBe(true);
 expect(art.lots.some(x=>x.id==='lot-203'&&x.galleryClassification?.workType==='ETCHING')).toBe(true);
 for(const work of art.lots){
  expect(work.galleryClassification?.status).toBe('PUBLISHED');
  expect(allowed.has(work.galleryClassification?.workType)).toBe(true);
 }
 expect(art.auctions.some(x=>x.lotId==='lot-104')).toBe(true);
});

test('Default Gallery is fine-art-first while a legacy object remains directly researchable',async({page})=>{
 await page.goto('/#gallery',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#catalogGrid [data-open-passport]').first()).toBeVisible();
 await expect(page.locator('#catalogGrid [data-open-passport="lot-101"]')).toHaveCount(0);
 await expect(page.locator('#catalogGrid [data-open-passport="lot-201"]')).toBeVisible();
 await expect(page.locator('main')).toContainText(/живопись|график|гравюр|painting|works on paper|prints/i);

 await page.goto('/?object=lot-101#gallery',{waitUntil:'domcontentloaded'});
 const dialog=page.locator('#dialog[open]');await expect(dialog).toBeVisible();
 await expect(dialog).toContainText(/Каминные часы|mantel clock/i);
 await expect(page).toHaveURL(/object=lot-101/);
});

test('Fine-art Taste recommendations never reintroduce unclassified legacy objects',async({page})=>{
 await page.goto('/#gallery',{waitUntil:'domcontentloaded'});
 const taste=await page.evaluate(async()=>{const r=await fetch('/api/taste/recommendations?limit=20&scope=FINE_ART');return{status:r.status,body:await r.json()}});
 expect(taste.status).toBe(200);
 expect(taste.body.capabilities.explainable).toBe(true);
 expect(taste.body.capabilities.aiUsed).toBe(false);
 expect(taste.body.recommendations.length).toBeGreaterThan(0);
 expect(taste.body.recommendations.some(x=>x.object.id==='lot-101')).toBe(false);
 for(const row of taste.body.recommendations)expect(row.object.galleryClassification?.status).toBe('PUBLISHED');
});
