import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const paintings='[data-museum-open-access]';
async function gallery(page,locale){
  await page.route('https://api.artic.edu/**',route=>route.abort());
  await page.goto('/#gallery',{waitUntil:'domcontentloaded'});
  if(locale==='en')await page.locator('[data-lang="en"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang',locale);
  await expect(page.locator('[data-culture-hero]')).toBeVisible();
  await expect(page.locator(paintings)).toBeVisible();
}
test('v64 painting-only homepage does not promote antique editorial/collections or unrelated exhibitions',async({page})=>{
 await gallery(page,'ru');
 const root=page.locator('[data-culture-root]');
 await expect(root).not.toContainText(/письменный стол как маленький|патина|Часы, рукописи и мебель|Европейский интерьер|Предметы в диалоге/i);
 await expect(root.locator('[data-culture-drop],.culture-editorial,.culture-collection-card')).toHaveCount(0);
 await expect(root.locator('[data-art-study="museum-verified"]')).toBeVisible();
 await expect(root.locator('[data-art-study]')).toContainText('Art Institute of Chicago');
 await expect(root.locator('[data-culture-feed] .culture-object-card')).not.toHaveCount(0);
 await expect(page.locator('#cultureCatalogue')).toBeVisible();
});
test('v64 accessible first pathway scrolls within Gallery instead of navigating away',async({page})=>{
 await gallery(page,'ru');
 const path=page.locator('button[data-museum-waypoint]');
 await expect(path).toHaveCount(1);
 await expect(path).toContainText('Смотреть');
 await expect(path).toHaveAttribute('type','button');
 await path.click();
 await expect(page).toHaveURL(/#gallery$/);
 const heading=page.locator('.museum-open-head h2');
 await expect(heading).toBeFocused();
 await expect(page.locator(paintings)).toBeVisible();
 await expect(page.locator('.culture-pathways a[href="#creators"]')).toHaveCount(1);
 await expect(page.locator('.culture-pathways a[href="#collections"]')).toHaveCount(1);
});
for(const locale of ['ru','en']){
 for(const viewport of [{width:320,height:568},{width:390,height:844},{width:834,height:1112},{width:1440,height:900}]){
  test('v64 editorial layout '+locale+' '+viewport.width+'x'+viewport.height,async({page},info)=>{
   await page.setViewportSize(viewport);
   await gallery(page,locale);
   const h1=page.locator('.culture-hero h1');
   await expect(h1).toHaveAttribute('aria-label',locale==='ru'?'Искусство ближе, чем кажется.':'Art is closer than you think.');
   await expect(page.locator('.culture-pathways')).toBeVisible();
   const dims=await page.evaluate(()=>{
    const html=document.documentElement;
    const root=document.querySelector('.culture-discovery-root');
    const hero=document.querySelector('.culture-hero');
    const h1=hero?.querySelector('h1');
    const museum=document.querySelector('.museum-open-grid');
    const artwork=document.querySelector('.museum-artwork-image img');
    const one=document.querySelector('.culture-path');
    return{
     overflow:html.scrollWidth-innerWidth,
     rootOverflow:root.scrollWidth-root.clientWidth,
     h1Right:h1?.getBoundingClientRect().right??99999,
     h1Viewport:hero?.querySelector('.culture-hero-copy')?.getBoundingClientRect().right??0,
     imageFit:artwork?getComputedStyle(artwork).objectFit:null,
     museumColumns:getComputedStyle(museum).gridTemplateColumns.split(' ').length,
     pathways:one?.tagName
    };
   });
   expect(dims.overflow).toBeLessThanOrEqual(2);
   expect(dims.rootOverflow).toBeLessThanOrEqual(2);
   expect(dims.h1Right).toBeLessThanOrEqual(dims.h1Viewport+2);
   expect(dims.imageFit).toBe('contain');
   expect(dims.museumColumns).toBe(viewport.width<=360?1:viewport.width<=800?2:12);
   expect(dims.pathways).toBe('BUTTON');
   await mkdir('artifacts/visual-proof',{recursive:true});
   await page.screenshot({path:'artifacts/visual-proof/v64-cover-'+locale+'-'+viewport.width+'-'+info.project.name+'.png'});
   await page.locator(paintings).scrollIntoViewIfNeeded();
   await page.screenshot({path:'artifacts/visual-proof/v64-museum-'+locale+'-'+viewport.width+'-'+info.project.name+'.png'});
  });
 }
}
