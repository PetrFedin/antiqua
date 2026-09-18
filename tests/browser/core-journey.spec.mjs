import {test,expect} from '@playwright/test';

const nav=(page,key)=>page.locator(`[data-nav="${key}"]:visible`).first();

async function clickNav(page,key){
  const node=nav(page,key);
  await expect(node,`visible navigation target: ${key}`).toBeVisible();
  await node.click();
  return node;
}

async function switchLocale(page,label){
  const node=page.locator(`[data-lang="${String(label).toLowerCase()}"]:visible`).first();
  if(!await node.isVisible().catch(()=>false))return false;
  await node.click();
  return true;
}

test('catalog -> object dossier -> locale -> authenticated account works in a real browser',async({page,request})=>{
  const pageErrors=[],consoleErrors=[];
  page.on('pageerror',e=>pageErrors.push(String(e?.message||e)));
  page.on('console',m=>{if(m.type()==='error'&&!/favicon|Failed to load resource/i.test(m.text()))consoleErrors.push(m.text())});

  const response=await page.goto('/',{waitUntil:'domcontentloaded'});expect(response?.ok()).toBeTruthy();
  await expect(page.locator('body')).toContainText('ANTIQUA');
  await expect(nav(page,'shop')).toBeVisible();
  await expect(nav(page,'auctions')).toBeVisible();
  await expect(nav(page,'account')).toBeVisible();

  await clickNav(page,'auctions');
  await expect(page.locator('body')).toContainText(/Auction|Аукцион/i);
  await clickNav(page,'shop');

  const catalogResponse=await request.get('/api/catalog');expect(catalogResponse.ok()).toBeTruthy();
  const catalog=await catalogResponse.json(),lot=catalog.lots?.[0];expect(lot).toBeTruthy();
  const titleEn=String(lot.title?.en||lot.title||'').trim(),titleRu=String(lot.title?.ru||'').trim();expect(titleEn||titleRu).toBeTruthy();
  const titlePattern=new RegExp([titleEn,titleRu].filter(Boolean).map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'i');
  const cardTitle=page.getByText(titlePattern,{exact:false}).first();await expect(cardTitle).toBeVisible();
  const dossierAction=page.locator(`[data-passport="${lot.id}"]:visible`).first();await expect(dossierAction).toBeVisible();await dossierAction.click();
  await expect(page.locator('#dialog[open]')).toBeVisible();await expect(page.locator('#dialog[open]')).toContainText(/Provenance|Провенанс|Passport history|История паспорта/i);
  const revision=page.locator('#dialog[open] .passport-revision-list .passport-revision').first();await expect(revision).toBeVisible();await expect(revision).toContainText(/v1/i);
  const closeDossier=page.locator('#dialog[open] [data-close-dialog]').first();await expect(closeDossier).toBeVisible();await closeDossier.click();await expect(page.locator('#dialog[open]')).toHaveCount(0);

  const switchedRu=await switchLocale(page,'RU');
  if(switchedRu)await expect(page.locator('body')).toContainText(/Каталог|Аукцион|Коллекц/i);
  const switchedEn=await switchLocale(page,'EN');
  if(switchedEn)await expect(page.locator('body')).toContainText(/Catalog|Auction|Collection/i);

  const login=await page.evaluate(async()=>{const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona:'BUYER'})});return{status:r.status,body:await r.json()}});expect(login.status).toBe(200);expect(login.body.account?.id).toBeTruthy();
  const me=await page.evaluate(async()=>{const r=await fetch('/api/auth/me');return{status:r.status,body:await r.json()}});expect(me.status).toBe(200);expect(me.body.account?.id).toBe(login.body.account.id);
  await page.reload({waitUntil:'domcontentloaded'});await clickNav(page,'account');
  const displayName=String(me.body.account?.displayName||'').trim();if(displayName)await expect(page.locator('body')).toContainText(displayName);

  expect(pageErrors,`page errors: ${pageErrors.join(' | ')}`).toEqual([]);
  expect(consoleErrors,`console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('browser session changes identity without leaking the previous authenticated account',async({page})=>{
  await page.goto('/',{waitUntil:'domcontentloaded'});
  const buyer=await page.evaluate(async()=>{const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona:'BUYER'})});return r.json()});expect(buyer.account?.id).toBeTruthy();
  let me=await page.evaluate(async()=>{const r=await fetch('/api/auth/me');return r.json()});expect(me.account?.id).toBe(buyer.account.id);
  const seller=await page.evaluate(async()=>{const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona:'SELLER'})});return r.json()});expect(seller.account?.id).toBeTruthy();expect(seller.account.id).not.toBe(buyer.account.id);
  me=await page.evaluate(async()=>{const r=await fetch('/api/auth/me');return r.json()});expect(me.account?.id).toBe(seller.account.id);expect(me.account?.id).not.toBe(buyer.account.id);
  await page.reload({waitUntil:'domcontentloaded'});await clickNav(page,'account');
  const sellerName=String(me.account?.displayName||'').trim();if(sellerName)await expect(page.locator('body')).toContainText(sellerName);
  const buyerName=String(buyer.account?.displayName||'').trim();if(buyerName&&buyerName!==sellerName)await expect(page.locator('body')).not.toContainText(buyerName);
});


test('operator cockpit is permission-gated and visible only to the operator',async({page})=>{
  await page.goto('/',{waitUntil:'domcontentloaded'});
  let login=await page.evaluate(async()=>{const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona:'BUYER'})});return{status:r.status,body:await r.json()}});expect(login.status).toBe(200);
  let cockpit=await page.evaluate(async()=>{const r=await fetch('/api/operator/cockpit');return{status:r.status,body:await r.json()}});expect(cockpit.status).toBe(403);
  await page.reload({waitUntil:'domcontentloaded'});await clickNav(page,'account');await expect(page.locator('#v16Cockpit')).toHaveCount(0);

  login=await page.evaluate(async()=>{const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona:'OPERATOR'})});return{status:r.status,body:await r.json()}});expect(login.status).toBe(200);expect(login.body.account?.roles||[]).toContain('ADMIN');
  cockpit=await page.evaluate(async()=>{const r=await fetch('/api/operator/cockpit');return{status:r.status,body:await r.json()}});expect(cockpit.status).toBe(200);expect(cockpit.body.cockpit?.capabilities?.readOnly).toBe(true);
  await page.reload({waitUntil:'domcontentloaded'});await clickNav(page,'account');
  const panel=page.locator('#v16Cockpit');await expect(panel).toBeVisible();await expect(panel).toContainText(/Operator cockpit|Операторский кокпит|Что требует решения сейчас|What requires action now/i);
  await expect(panel.locator('.v16-cockpit-metric')).toHaveCount(4);
});


test('Collection, Collection Record and Personal List are distinct user surfaces',async({page,request})=>{
  await page.goto('/',{waitUntil:'domcontentloaded'});
  const login=await page.evaluate(async()=>{const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona:'BUYER'})});return{status:r.status,body:await r.json()}});expect(login.status).toBe(200);

  await page.reload({waitUntil:'domcontentloaded'});
  await switchLocale(page,'EN');
  await clickNav(page,'shop');

  const catalogResponse=await request.get('/api/catalog');expect(catalogResponse.ok()).toBeTruthy();
  const catalog=await catalogResponse.json(),lot=catalog.lots?.[0];expect(lot?.id).toBeTruthy();

  const dossierAction=page.locator(`[data-passport="${lot.id}"]:visible`).first();await expect(dossierAction).toBeVisible();await dossierAction.click();
  const dialog=page.locator('#dialog[open]');await expect(dialog).toBeVisible();
  const personalButton=dialog.locator(`[data-collect="${lot.id}"]`);await expect(personalButton).toBeVisible();await expect(personalButton).toContainText(/personal list/i);
  await personalButton.click();
  await expect(dialog.locator(`[data-collect="${lot.id}"]`)).toContainText(/personal list/i);
  await dialog.locator('[data-close-dialog]').first().click();

  await clickNav(page,'account');
  const personal=page.locator('.personal-list-block');await expect(personal).toBeVisible();await expect(personal).toContainText(/Personal list/i);
  await expect(personal).toContainText(/not an ownership record/i);
  await expect(personal.locator(`[data-personal-list-object="${lot.id}"]`)).toHaveCount(1);

  const operations=page.locator('#v14Operations');await expect(operations).toBeVisible();
  const recordTab=operations.locator('[data-v14-tab="collection"]');await expect(recordTab).toContainText(/Private records/i);await recordTab.click();
  const recordPanel=operations.locator('[data-v14-panel="collection"]');await expect(recordPanel).toBeVisible();await expect(recordPanel).toContainText(/Private object records, storage & insurance/i);await expect(recordPanel).toContainText(/not a public Collection/i);await expect(recordPanel).toContainText(/not proof of legal ownership/i);

  await clickNav(page,'collections');
  await expect(page.locator('main')).toContainText(/Curated collections/i);
  await expect(page.locator('main')).toContainText(/controlled visibility/i);

  const surfaces=await page.evaluate(async()=>{const [v,c,r]=await Promise.all([fetch('/api/collection-surfaces').then(x=>x.json()),fetch('/api/collections').then(x=>x.json()),fetch('/api/collection-records').then(x=>x.json())]);return{v,c,r}});
  expect(surfaces.v.collectionSurfaces.distinctSurfaces).toBe(true);
  expect(surfaces.c.surface.kind).toBe('CURATED_COLLECTION');
  expect(surfaces.r.surface.kind).toBe('COLLECTION_RECORD');

  const state=await page.evaluate(async()=>fetch('/api/client-state').then(x=>x.json()));
  expect(state.personalList).toContain(lot.id);
});
