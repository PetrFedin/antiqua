import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
for(const locale of ['ru','en']){
 for(const viewport of [{width:320,height:568},{width:390,height:844},{width:834,height:1112},{width:1440,height:900}]){
  test('v68 artwork image whole '+locale+' '+viewport.width,async({page},info)=>{
   await page.setViewportSize(viewport);
   await page.goto('/?object=lot-107#shop',{waitUntil:'domcontentloaded'});
   await expect(page.locator('#dialog[open] .native-dossier.artwork-editorial-v68')).toBeVisible();
   if(locale==='en')await page.locator('#dialog[open] [data-lang="en"]').first().click();
   await expect(page.locator('html')).toHaveAttribute('lang',locale);
   const dialog=page.locator('#dialog[open]');
   const wall=dialog.locator('.dossier-gallery');
   const image=wall.locator('.dossier-hero img');
   const btn=wall.locator('[data-dossier-mat-toggle]');
   await expect(btn).toHaveAttribute('aria-pressed','false');
   await expect(wall).toHaveAttribute('data-dossier-mat','paper');
   expect(await image.evaluate(n=>getComputedStyle(n).objectFit)).toBe('contain');
   expect(await wall.evaluate(n=>n.scrollWidth-n.clientWidth)).toBeLessThanOrEqual(2);
   const src=await image.getAttribute('src');
   await btn.click();
   await expect(btn).toHaveAttribute('aria-pressed','true');
   await expect(wall).toHaveAttribute('data-dossier-mat','ink');
   await expect(image).toHaveAttribute('src',src);
   await expect(dialog.locator('.dossier-toolbar h2')).toBeVisible();
   for(const id of ['dossier-provenance','dossier-condition','dossier-evidence'])await expect(dialog.locator('#'+id)).toBeVisible();
   await expect(dialog.locator('.dossier-commerce-dock')).toBeVisible();
   await btn.click();
   await expect(btn).toHaveAttribute('aria-pressed','false');
   if([320,390,1440].includes(viewport.width)){
    await mkdir('artifacts/visual-proof',{recursive:true});
    await page.screenshot({path:'artifacts/visual-proof/v68-dossier-'+locale+'-'+viewport.width+'-'+info.project.name+'.png'});
   }
  });
 }
}
test('v68 mat does not change image zoom source and resets when reopened',async({page})=>{
 await page.goto('/?object=lot-107#shop',{waitUntil:'domcontentloaded'});
 const d=page.locator('#dialog[open]');
 const mat=d.locator('[data-dossier-mat-toggle]');
 await mat.click();
 await expect(d.locator('.dossier-gallery')).toHaveAttribute('data-dossier-mat','ink');
 await d.locator('.dossier-hero').click();
 const viewer=page.locator('#mediaViewer[open]');
 await expect(viewer).toBeVisible();
 await expect(viewer.locator('.media-stage img')).toHaveAttribute('src',/.+/);
 await page.keyboard.press('Escape');
 await expect(page.locator('#mediaViewer[open]')).toHaveCount(0);
 await expect(d).toBeVisible();
 await d.locator('[data-close-dialog]').click();
 await expect(page.locator('#dialog[open]')).toHaveCount(0);
 await page.goto('/?object=lot-107#shop',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#dialog[open] .dossier-gallery')).toHaveAttribute('data-dossier-mat','paper');
 await expect(page.locator('#dialog[open] [data-dossier-mat-toggle]')).toHaveCount(1);
});
