import {test,expect} from '@playwright/test';

test('Gallery-first navigation keeps consumer journey separate from professional tools',async({page})=>{
 await page.goto('/#gallery',{waitUntil:'domcontentloaded'});
 const nav=page.locator('.main-nav');
 if(await page.locator('.mobile-tabbar').isVisible()){await page.setViewportSize({width:1280,height:900});await page.reload({waitUntil:'domcontentloaded'})}
 await expect(nav.locator('[data-nav="gallery"]')).toHaveText(/Галерея|Gallery/i);
 await expect(nav.locator('[data-nav="creators"]')).toHaveText(/Художники|Artists/i);
 await expect(nav.locator('[data-nav="collections"]')).toBeVisible();
 await expect(nav.locator('[data-nav="network"]')).toHaveText(/Сообщество|Community/i);
 await expect(nav.locator('[data-nav="learn"]')).toHaveText(/Знания|Learn/i);
 await expect(nav.locator('[data-nav="events"]')).toHaveText(/События|Events/i);
 await expect(nav.locator('[data-nav="auctions"]')).toHaveText(/Аукцион|Auction/i);
 await expect(nav.locator('[data-nav="dealers"]')).toHaveCount(0);
 await expect(page.locator('#catalogGrid [data-open-passport]').first()).toBeVisible();

 await nav.locator('[data-nav="learn"]').click();
 await expect(page).toHaveURL(/#learn/);
 await expect(page.locator('main')).toContainText(/Журнал|Journal|истори|story/i);

 await page.locator('.main-nav [data-nav="events"]').click();
 await expect(page).toHaveURL(/#events/);
 await expect(page.locator('main')).toBeVisible();
});

test('Gallery-first mobile tab bar exposes the core art journey',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/#gallery',{waitUntil:'domcontentloaded'});
 const tabs=page.locator('.mobile-tabbar');
 for(const key of ['gallery','creators','collections','network','auctions','account'])await expect(tabs.locator(`[data-nav="${key}"]`)).toBeVisible();
 await expect(tabs.locator('[data-nav="dealers"]')).toHaveCount(0);
 await expect(tabs.locator('[data-nav="learn"]')).toHaveCount(0);
});


test('Artwork dossier exposes verified artist graph and explainable related works without inventing attribution',async({page,request})=>{
 await page.goto('/#gallery',{waitUntil:'domcontentloaded'});
 const catalog=await request.get('/api/catalog');expect(catalog.ok()).toBeTruthy();const data=await catalog.json();
 const candidates=data.lots||[];expect(candidates.length).toBeGreaterThan(0);
 let selected=null,artistRows=[],similarRows=[];
 for(const lot of candidates){
  const [artists,similar]=await Promise.all([request.get('/api/objects/'+encodeURIComponent(lot.id)+'/creators'),request.get('/api/lots/'+encodeURIComponent(lot.id)+'/similar?limit=6')]);
  expect(artists.ok()).toBeTruthy();expect(similar.ok()).toBeTruthy();
  const a=(await artists.json()).creators||[],s=(await similar.json()).items||[];
  if(a.length||s.length){selected=lot;artistRows=a;similarRows=s;break}
 }
 expect(selected).toBeTruthy();
 const card=page.locator('[data-open-passport="'+selected.id+'"]:visible').first();await expect(card).toBeVisible();await card.locator('h3').click();
 const dossier=page.locator('#dialog[open]');await expect(dossier).toBeVisible();
 await expect(dossier).toContainText(/Художник \/ автор|Artist \/ creator/i);
 if(artistRows.length){const link=dossier.locator('.artwork-artist-link').first();await expect(link).toBeVisible();await expect(link).toHaveAttribute('href',/#creator\//)}
 else await expect(dossier).toContainText(/не связан с проверенным профилем|No verified creator profile/i);
 if(similarRows.length){const related=dossier.locator('.artwork-related-card');expect(await related.count()).toBeGreaterThan(0);await expect(related.first()).toContainText(/.+/)}
});
