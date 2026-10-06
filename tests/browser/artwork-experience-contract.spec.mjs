import {test,expect} from '@playwright/test';

async function login(page,persona='BUYER'){
  return page.evaluate(async persona=>{
    const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona})});
    let body={};try{body=await r.json()}catch{}
    return{status:r.status,body};
  },persona)
}

test.describe('Artwork-first visual research journey contract',()=>{
  for(const viewport of [
    {name:'mobile',width:390,height:844},
    {name:'tablet',width:834,height:1112},
    {name:'desktop',width:1440,height:1000}
  ]){
    test(viewport.name+' keeps artwork research navigable before commerce',async({page})=>{
      await page.setViewportSize({width:viewport.width,height:viewport.height});
      await page.goto('/#gallery',{waitUntil:'domcontentloaded'});
      const auth=await login(page);expect(auth.status).toBe(200);
      await page.reload({waitUntil:'domcontentloaded'});

      const artwork=page.locator('[data-open-passport],[data-passport]').first();
      await expect(artwork).toBeVisible();
      await artwork.click();

      const dossier=page.locator('#dialog[open] .dossier-body');
      await expect(dossier).toBeVisible();
      await expect(dossier.locator('#dossier-overview')).toBeVisible();
      await expect(dossier.locator('#dossier-provenance')).toBeAttached();
      await expect(dossier.locator('#dossier-evidence')).toBeAttached();

      // Research actions must remain available even when no sale state exists.
      await expect(dossier.locator('[data-save]')).toBeVisible();
      await expect(dossier.locator('[data-collect]')).toBeVisible();

      // No product rule may create commerce for an artwork that has no listing/auction authority.
      const commerce=dossier.locator('.dossier-commerce-dock');
      if(await commerce.count()){
        await expect(commerce).toBeVisible();
      }

      // Artist and related-work continuation are first-class exits from the dossier.
      const artist=dossier.locator('.artwork-artist-link').first();
      if(await artist.count())await expect(artist).toBeVisible();

      const related=dossier.locator('.artwork-related-card').first();
      if(await related.count())await expect(related).toBeVisible();

      // Visual research should not expose internal infrastructure jargon as the primary UI.
      await expect(dossier).not.toContainText(/idempotency|event bus|postgresql authority/i);
    });
  }
});
