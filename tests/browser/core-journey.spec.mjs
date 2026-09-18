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
  const cardTitle=page.getByText(titlePattern,{exact:false}).first();await expect(cardTitle).toBeVisible();await cardTitle.click();
  await expect(page.locator('body')).toContainText(/Provenance|Провенанс|Object passport|Паспорт объекта/i);
  const revision=page.locator('.passport-revision-list .passport-revision').first();await expect(revision).toBeVisible();await expect(revision).toContainText(/v1/i);

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
