import {test,expect} from '@playwright/test';

test('Art Network creates one privacy-safe cultural profile and keeps professional claims unverified',async({page})=>{
 await page.goto('/#network',{waitUntil:'domcontentloaded'});
 await expect(page.locator('main')).toContainText(/Сообщество искусства|Art community/i);
 await expect(page.locator('.main-nav [data-nav="network"]')).toBeVisible();

 const token=Date.now().toString(36);
 await page.locator('#artProfileForm [name="displayName"]').fill('Art Enthusiast '+token);
 await page.locator('#artProfileForm [name="headline"]').fill('Painting, graphics and engraving');
 await page.locator('#artProfileForm [name="visibility"]').selectOption('PUBLIC');
 await Promise.all([
  page.waitForLoadState('domcontentloaded'),
  page.locator('#artProfileForm button[type="submit"],#artProfileForm button').click()
 ]);
 await page.goto('/#network',{waitUntil:'domcontentloaded'});

 const me=await page.evaluate(async()=>fetch('/api/art-profile/me').then(r=>r.json()));
 expect(me.profile).toBeTruthy();
 expect(me.profile.visibility).toBe('PUBLIC');
 const slug=me.profile.slug;

 const enthusiast=page.locator('[data-art-role="ENTHUSIAST"]');
 await expect(enthusiast).toBeVisible();await enthusiast.click();
 await expect(enthusiast).toContainText(/SELF DECLARED|SELF_DECLARED/i);

 const expert=page.locator('[data-art-role="EXPERT"]');
 await expect(expert).toBeVisible();await expert.click();
 await expect(expert).toContainText(/SELF DECLARED|SELF_DECLARED/i);

 const pub=await page.evaluate(async slug=>fetch('/api/art-profiles/'+encodeURIComponent(slug)).then(async r=>({status:r.status,body:await r.json()})),slug);
 expect(pub.status).toBe(200);
 expect(pub.body.profile.roles.some(r=>r.role==='ENTHUSIAST')).toBe(true);
 expect(pub.body.profile.roles.some(r=>r.role==='EXPERT')).toBe(false);
 expect(pub.body.profile.expertise).toEqual([]);
 expect('accountId' in pub.body.profile).toBe(false);
 expect('email' in pub.body.profile).toBe(false);

 await page.goto('/#profile/'+encodeURIComponent(slug),{waitUntil:'domcontentloaded'});
 await expect(page.locator('.network-profile-page')).toBeVisible();
 await expect(page.locator('.network-profile-page')).toContainText('Art Enthusiast '+token);
 await expect(page.locator('.network-profile-page')).not.toContainText(/buyer@demo\.antiqua/i);
 await expect(page.locator('.network-profile-page')).not.toContainText(/Expert ✓|Эксперт ✓/i);

 const hidden=await page.evaluate(async()=>{
  const csrf=decodeURIComponent(document.cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith('antiqua_csrf='))?.split('=').slice(1).join('=')||'');
  const patch=await fetch('/api/art-profile/me',{method:'PATCH',headers:{'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify({visibility:'PRIVATE'})});
  const body=await patch.json();return{status:patch.status,body};
 });
 expect(hidden.status).toBe(200);expect(hidden.body.profile.visibility).toBe('PRIVATE');
 const gone=await page.evaluate(async slug=>{const r=await fetch('/api/art-profiles/'+encodeURIComponent(slug));return{status:r.status}},slug);
 expect(gone.status).toBe(404);
});

test('Art Network mobile navigation exposes Community without professional surfaces',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/#network',{waitUntil:'domcontentloaded'});
 const tabs=page.locator('.mobile-tabbar');
 await expect(tabs.locator('[data-nav="network"]')).toBeVisible();
 await expect(tabs.locator('[data-nav="dealers"]')).toHaveCount(0);
 await expect(page.locator('.network-hero')).toBeVisible();
});
