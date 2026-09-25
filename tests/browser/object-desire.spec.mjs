import {test,expect} from '@playwright/test';

test('Object Desire Page keeps desire, commerce and trust ahead of research depth',async({page})=>{
 await page.goto('/?object=lot-107#shop',{waitUntil:'domcontentloaded'});
 const dialog=page.locator('#dialog[open]');await expect(dialog).toBeVisible();
 const dossier=dialog.locator('.native-dossier.desire-v27');await expect(dossier).toBeVisible();
 const body=dossier.locator('.dossier-body');
 await expect(body.locator('.dossier-toolbar h2')).toBeVisible();
 await expect(body.locator('#dossierWhyV27')).toBeVisible();
 await expect(body.locator('.dossier-commerce-dock')).toBeVisible();
 await expect(body.locator('#dossierTrustV27')).toBeVisible();
 await expect(body.locator('#dossier-provenance')).toBeVisible();
 await expect(body.locator('#dossier-condition')).toBeVisible();
 await expect(body.locator('#dossierStoryV27')).toBeVisible();
 await expect(body.locator('#dossier-overview')).toBeVisible();
 await expect(body.locator('#dossier-evidence')).toBeVisible();
 await expect(body.locator('#dossierWhyV27')).toContainText(/Каталожная запись|catalogue record/i);
 await expect(body.locator('#dossierTrustV27')).toContainText(/Каталог|Catalogue/i);
 const order=await body.evaluate(el=>[...el.children].map((n,i)=>({i,id:n.id,cls:n.className})));
 const idx=key=>order.find(x=>x.id===key||String(x.cls).includes(key))?.i??-1;
 expect(idx('dossierWhyV27')).toBeGreaterThan(-1);
 expect(idx('dossier-commerce-dock')).toBeGreaterThan(idx('dossierWhyV27'));
 expect(idx('dossierTrustV27')).toBeGreaterThan(idx('dossier-commerce-dock'));
 expect(idx('dossier-provenance')).toBeGreaterThan(idx('dossierTrustV27'));
 expect(idx('dossier-condition')).toBeGreaterThan(idx('dossier-provenance'));
 expect(idx('dossierStoryV27')).toBeGreaterThan(idx('dossier-condition'));
 expect(idx('dossier-overview')).toBeGreaterThan(idx('dossierStoryV27'));
 expect(idx('dossier-evidence')).toBeGreaterThan(idx('dossier-overview'));
 const viewport=page.viewportSize();
 if(viewport&&viewport.width<=800){
  await expect(dossier.locator('.dossier-hero')).toBeVisible();
  const position=await body.locator('.dossier-commerce-dock').evaluate(el=>getComputedStyle(el).position);expect(position).toBe('sticky');
 }
});
