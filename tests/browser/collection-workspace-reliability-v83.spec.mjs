import {test,expect} from '@playwright/test';

async function account(page,persona){
 await page.goto('/',{waitUntil:'domcontentloaded'});
 expect(await page.evaluate(async persona=>(await fetch('/api/auth/demo-login',{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona})
 })).status,persona)).toBe(200);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.goto('/#account',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v14Operations')).toBeVisible();
}

test('v83 saved reviewer tab falls back for buyer',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('antiqua_v14_tab','collection-review'));
 await account(page,'BUYER');
 await expect(page.locator('[data-v14-tab="collection-review"]')).toHaveCount(0);
 await expect(page.locator('[data-v14-panel="discovery"]')).toBeVisible();
 await expect(page.locator('[data-v14-tab="discovery"]')).toHaveClass(/active/);
});

test('v83 reviewer UI preserves delivery key after lost reply (transport fixture)',async({page})=>{
 // UI-only transport fault injection; real PostgreSQL authorization is covered
 // separately by postgres-collection-publication-http-v81, never bypassed here.
 await account(page,'OPERATOR');
 await expect(page.locator('#persona')).toHaveText(/Оператор|Operator/);
 const sent=[];
 await page.route('**/api/collection-publication/queue',route=>route.fulfill({json:{items:[{
  id:'delivery-fixture',title:'Transport test dossier',stage:'CATALOGUE',publicationState:'SUBMITTED'
 }]}}));
 await page.route('**/api/collections/delivery-fixture/publication/review',route=>route.fulfill({json:{
  collectionId:'delivery-fixture',reviewToken:'a'.repeat(64),stage:'CATALOGUE',title:'Transport test dossier',
  works:[{objectId:'painting-fixture',title:'Study',painting:true,privacyReady:true}]
 }}));
 await page.route('**/api/collections/delivery-fixture/publication/approve',async route=>{
  sent.push(route.request().postDataJSON());
  if(sent.length===1)return route.abort('failed');
  return route.fulfill({json:{idempotent:true}});
 });
 await page.locator('[data-v14-tab="collection-review"]').click();
 await page.locator('[data-review-queue-load]').click();
 await page.locator('[data-review-open="delivery-fixture"]').click();
 const form=page.locator('#collectionReviewDecisionForm');
 await form.locator('textarea').fill('Catalogue independently assessed for delivery test');
 await form.locator('button[type="submit"]').click();
 await expect(page.locator('#toast')).toHaveClass(/show/);
 await expect(form.locator('button[type="submit"]')).toBeEnabled();
 await form.locator('button[type="submit"]').click();
 await expect(page.locator('[data-review-open="delivery-fixture"]')).toBeVisible();
 expect(sent).toHaveLength(2);
 expect(sent[1]).toEqual(sent[0]);
 expect(sent[0].idempotencyKey).toMatch(/^web-/);
 expect(sent[0].reviewToken).toBe('a'.repeat(64));
});

// Verify that the shell agrees with the authenticated server session.
test('v83 role label and persona cycle reflect actual review roles',async({page})=>{
 await account(page,'OPERATOR');
 await expect(page.locator('#persona')).toHaveText(/Оператор|Operator/);
 const next=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/demo-login');
 await page.locator('#persona').click();
 expect((await next).request().postDataJSON().persona).toBe('BUYER');
 await expect(page.locator('#persona')).toHaveText(/Покупатель|Buyer/);
});

test('v83 account navigation tolerates delayed client-state hydration',async({page})=>{
 await account(page,'BUYER');
 let release,started;
 const gate=new Promise(r=>{release=r});
 const requested=new Promise(r=>{started=r});
 await page.route('**/api/client-state',async route=>{started();await gate;await route.continue()});
 await page.goto('/#gallery',{waitUntil:'domcontentloaded'});
 await page.reload({waitUntil:'domcontentloaded'});
 await requested;
 await page.evaluate(()=>{location.hash='account'});
 await expect(page.locator('[aria-busy="true"]')).toBeVisible();
 await expect(page.locator('#toast')).not.toContainText(/Cannot read|TypeError|null/);
 release();
 await expect(page.locator('.account-v12')).toBeVisible();
 await expect(page.locator('#toast')).not.toContainText(/Cannot read|TypeError|null/);
});

test('v84 stale review asks to reopen the dossier (transport fixture)',async({page})=>{
 await account(page,'OPERATOR');
 await page.route('**/api/collection-publication/queue',r=>r.fulfill({json:{items:[{id:'stale-fixture',title:'Versioned dossier',stage:'CATALOGUE'}]}}));
 await page.route('**/api/collections/stale-fixture/publication/review',r=>r.fulfill({json:{collectionId:'stale-fixture',title:'Versioned dossier',stage:'CATALOGUE',reviewToken:'b'.repeat(64),works:[{objectId:'painting-fixture',painting:true,privacyReady:true}]}}));
 let posts=0;
 await page.route('**/api/collections/stale-fixture/publication/approve',r=>{posts++;return r.fulfill({status:409,json:{error:'The review changed',code:'STALE_REVIEW'}})});
 await page.locator('[data-v14-tab="collection-review"]').click();
 await page.locator('[data-review-queue-load]').click();
 await page.locator('[data-review-open="stale-fixture"]').click();
 const form=page.locator('#collectionReviewDecisionForm');
 await form.locator('textarea').fill('Catalogue assessment from an obsolete review round');
 await form.locator('button[type="submit"]').click();
 await expect(page.locator('#toast')).toContainText(/актуальную версию|current version/);
 await expect(form).toBeVisible();
 await expect(form.locator('button[type="submit"]')).toBeEnabled();
 expect(posts).toBe(1);
});
