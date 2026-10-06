import {test,expect} from '@playwright/test';

test('Russian is the default locale and English is only enabled explicitly',async({page})=>{
 await page.addInitScript(()=>{localStorage.removeItem('antiqua_lang')});
 await page.goto('/#gallery',{waitUntil:'domcontentloaded'});

 await expect.poll(()=>page.evaluate(()=>document.documentElement.lang)).toBe('ru');
 await expect(page.locator('[data-lang="ru"]')).toHaveClass(/active/);
 await expect(page.locator('#brandLine')).toHaveText('ANTIQUA · ИСКУССТВО И ПРОВЕНАНС');
 await expect(page.locator('#footerDossier strong')).toHaveText('Досье произведения');
 await expect(page.locator('.main-nav')).toHaveAttribute('aria-label','Основная навигация');

 const strict=await page.evaluate(async()=>{
  const m=await import('/modules/core.js');
  return {lang:m.lang(),value:m.local({en:'English only'})};
 });
 expect(strict.lang).toBe('ru');
 expect(strict.value).toBe('');

 await page.locator('[data-lang="en"]').click();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.lang)).toBe('en');
 await expect(page.locator('[data-lang="en"]')).toHaveClass(/active/);
 await expect(page.locator('#brandLine')).toHaveText('ANTIQUA · ART & PROVENANCE');
 await expect(page.locator('#footerDossier strong')).toHaveText('Artwork Dossier');
 await expect(page.locator('.main-nav')).toHaveAttribute('aria-label','Primary navigation');

 const english=await page.evaluate(async()=>{
  const m=await import('/modules/core.js');
  return {lang:m.lang(),value:m.local({en:'English only'})};
 });
 expect(english.lang).toBe('en');
 expect(english.value).toBe('English only');
});

test('Russian static shell contains no mixed English footer labels before app hydration',async({page})=>{
 await page.addInitScript(()=>localStorage.removeItem('antiqua_lang'));
 await page.goto('/',{waitUntil:'commit'});
 await page.waitForLoadState('domcontentloaded');
 const shell=await page.locator('body').innerText();
 expect(shell).toContain('Досье произведения');
 expect(shell).toContain('Граф коллекций');
 expect(shell).toContain('Исследование и рынок');
 expect(shell).not.toContain('Artwork Dossier');
 expect(shell).not.toContain('Collection Graph');
 expect(shell).not.toContain('Research & Trade');
});
