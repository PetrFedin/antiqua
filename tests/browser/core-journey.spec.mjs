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
  const dossierCard=page.locator(`[data-open-passport="${lot.id}"]:visible`).first();await expect(dossierCard).toBeVisible();await dossierCard.locator('h3').click();
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


test('collection records and curated Collections are separate workflows',async({page})=>{
  await page.goto('/',{waitUntil:'domcontentloaded'});
  const login=await page.evaluate(async()=>{const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona:'BUYER'})});return{status:r.status,body:await r.json()}});expect(login.status).toBe(200);

  await page.reload({waitUntil:'domcontentloaded'});await clickNav(page,'account');
  const ops=page.locator('#v14Operations');await expect(ops).toBeVisible();
  const recordsTab=ops.locator('[data-v14-tab="records"]'),collectionsTab=ops.locator('[data-v14-tab="collections"]');
  await expect(recordsTab).toBeVisible();await expect(collectionsTab).toBeVisible();

  await recordsTab.click();await expect(ops.locator('#v14RecordForm')).toBeVisible();await expect(ops.locator('#v14CollectionCreateForm')).toBeHidden();
  await collectionsTab.click();await expect(ops.locator('#v14CollectionCreateForm')).toBeVisible();await expect(ops.locator('#v14RecordForm')).toBeHidden();

  const title=`Browser curated ${Date.now()}`;
  await ops.locator('#v14CollectionCreateForm input[name="title"]').fill(title);
  await ops.locator('#v14CollectionCreateForm select[name="collectionType"]').selectOption('CURATED');
  await ops.locator('#v14CollectionCreateForm select[name="visibility"]').selectOption('PRIVATE');
  const createResponse=page.waitForResponse(r=>r.url().includes('/api/collections')&&r.request().method()==='POST');
  await ops.locator('#v14CollectionCreateForm button[type="submit"],#v14CollectionCreateForm button').last().click();
  expect((await createResponse).status()).toBe(201);
  await expect(page.locator('#v14Operations')).toContainText(title);

  const mine=await page.evaluate(async()=>{const r=await fetch('/api/collections/mine');return{status:r.status,body:await r.json()}});
  expect(mine.status).toBe(200);const collection=mine.body.collections.find(c=>(c.title?.en||c.title)===title);expect(collection?.id).toBeTruthy();expect(collection.items||[]).toHaveLength(0);

  await clickNav(page,'shop');
  const catalog=await page.evaluate(async()=>{const r=await fetch('/api/catalog');return r.json()}),lot=catalog.lots?.find(x=>x.id==='lot-108')||catalog.lots?.[0];expect(lot?.id).toBeTruthy();
  const dossierCard=page.locator(`[data-open-passport="${lot.id}"]:visible`).first();await expect(dossierCard).toBeVisible();await dossierCard.locator('h3').click();await expect(page.locator('#dialog[open]')).toBeVisible();

  const legacyCollectRequests=[];page.on('request',r=>{if(new URL(r.url()).pathname===`/api/lots/${lot.id}/collect`)legacyCollectRequests.push(r.url())});
  const add=page.locator(`#dialog[open] [data-collect="${lot.id}"]`);await expect(add).toBeVisible();await add.click();
  const sheet=page.locator('#actionSheet[open]');await expect(sheet).toBeVisible();
  await sheet.locator('#curatedCollectionId').selectOption(collection.id);
  await sheet.locator('#curatedCollectionSection').fill('Browser boundary');
  const membershipResponse=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/collections/${collection.id}/objects`&&r.request().method()==='POST');
  await sheet.locator('#confirmCollectionAdd').click();expect((await membershipResponse).status()).toBe(200);
  await expect(page.locator('#actionSheet[open]')).toHaveCount(0);
  expect(legacyCollectRequests).toEqual([]);

  const after=await page.evaluate(async()=>{const [m,r]=await Promise.all([fetch('/api/collections/mine').then(x=>x.json()),fetch('/api/collection-records').then(x=>x.json())]);return{mine:m,records:r}});
  const curated=after.mine.collections.find(c=>c.id===collection.id);expect(curated.items.some(i=>i.objectId===lot.id)).toBe(true);
  expect(after.records.records.some(r=>r.objectId===lot.id)).toBe(false);
});


test('purpose-led catalogue exposes next bid, live timer and whole-card dossier navigation',async({page})=>{
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await clickNav(page,'shop');

  const purposeBar=page.locator('.purpose-bar');await expect(purposeBar).toBeVisible();
  for(const mode of ['ALL','BUY','AUCTION','EXHIBIT','HISTORY'])await expect(purposeBar.locator(`[data-purpose-filter="${mode}"]`)).toBeVisible();

  await purposeBar.locator('[data-purpose-filter="AUCTION"]').click();
  const cards=page.locator('#catalogGrid [data-open-passport]');
  expect(await cards.count()).toBeGreaterThan(0);
  const first=cards.first();await expect(first).toBeVisible();
  await expect(first.locator('[data-auction-timer]')).toBeVisible();
  await expect(first).toContainText(/Следующая|Next/i);
  await expect(first).toContainText(/шаг|step/i);

  await first.locator('h3').click();
  const dossier=page.locator('#dialog[open]');await expect(dossier).toBeVisible();
  await expect(dossier.locator('[data-auction-timer]')).toBeVisible();
  await expect(dossier).toContainText(/Следующая ставка|Next bid/i);
  await dossier.locator('[data-close-dialog]').click();
  await expect(page.locator('#dialog[open]')).toHaveCount(0);
});

test('seller workspace creates complete object drafts and safely toggles storefront visibility',async({page})=>{
  await page.goto('/',{waitUntil:'domcontentloaded'});
  const login=await page.evaluate(async()=>{const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona:'SELLER'})});return{status:r.status,body:await r.json()}});expect(login.status).toBe(200);

  await page.reload({waitUntil:'domcontentloaded'});await clickNav(page,'account');
  const createPanel=page.locator('.seller-workspace-form');await expect(createPanel.locator('summary')).toBeVisible();await createPanel.locator('summary').click();
  const form=page.locator('#sellerDraftCreateForm');await expect(form).toBeVisible();
  const token=Date.now().toString();
  const values={
    titleRu:`Браузерный предмет ${token}`,titleEn:`Browser object ${token}`,
    categoryRu:'Декоративное искусство',categoryEn:'Decorative Arts',
    makerRu:'Тестовый мастер',makerEn:'Test maker',
    periodRu:'XX век',periodEn:'20th century',
    originRu:'Франция',originEn:'France',
    materialsRu:'Бронза',materialsEn:'Bronze',
    dimensionsRu:'20 × 10 см',dimensionsEn:'20 × 10 cm',
    descriptionRu:'Описание предмета для браузерного теста',descriptionEn:'Object description for browser proof',
    provenanceRu:'Частная коллекция, тестовая запись',provenanceEn:'Private collection, test record',
    conditionRu:'Хорошее состояние',conditionEn:'Good condition',
    shippingFrom:'Paris'
  };
  for(const [name,value] of Object.entries(values))await form.locator(`[name="${name}"]`).fill(value);
  await form.locator('[name="saleRoute"]').selectOption('AUCTION');
  await form.locator('[name="estimateLow"]').fill('1000');
  await form.locator('[name="estimateHigh"]').fill('1500');

  const createdResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/seller/drafts'&&r.request().method()==='POST');
  await form.locator('button[type="submit"]').click();
  const created=await createdResponse;expect(created.status()).toBe(201);
  const createdBody=await created.json();expect(createdBody.draft?.id).toBeTruthy();

  const mediaSheet=page.locator('#actionSheet[open]');await expect(mediaSheet).toBeVisible();
  await expect(mediaSheet).toContainText(/Object Storage|Медиа предмета|Object media/i);
  await expect(mediaSheet).toContainText(/не настроен|not configured/i);
  await mediaSheet.locator('[data-close-sheet]').click();

  const manage=page.locator('[data-manage-listing]').first();await expect(manage).toBeVisible();
  const listingId=await manage.getAttribute('data-manage-listing');expect(listingId).toBeTruthy();
  await manage.click();
  let listingForm=page.locator('#sellerListingForm');await expect(listingForm).toBeVisible();
  await listingForm.locator('[name="status"]').selectOption('INACTIVE');
  let patched=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/seller/listings/${listingId}`&&r.request().method()==='PATCH');
  await listingForm.locator('button[type="submit"]').click();expect((await patched).status()).toBe(200);

  const manageAgain=page.locator(`[data-manage-listing="${listingId}"]`);await expect(manageAgain).toBeVisible();await manageAgain.click();
  listingForm=page.locator('#sellerListingForm');await expect(listingForm.locator('[name="status"]')).toHaveValue('INACTIVE');
  await listingForm.locator('[name="status"]').selectOption('ACTIVE');
  patched=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/seller/listings/${listingId}`&&r.request().method()==='PATCH');
  await listingForm.locator('button[type="submit"]').click();expect((await patched).status()).toBe(200);
});


test('seller analytics reflects measured buyer demand without exposing buyer identity',async({page})=>{
  await page.goto('/',{waitUntil:'domcontentloaded'});
  const buyer=await page.evaluate(async()=>{const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona:'BUYER'})});return{status:r.status,body:await r.json()}});expect(buyer.status).toBe(200);
  const csrf=buyer.body.csrf;expect(csrf).toBeTruthy();
  const denied=await page.evaluate(async()=>{const r=await fetch('/api/seller/analytics');return r.status});expect(denied).toBe(403);
  const signals=await page.evaluate(async csrf=>{
    const post=async(path,body)=>{const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify(body)});let json={};try{json=await r.json()}catch{}return{status:r.status,body:json}};
    const saved=await post('/api/lots/lot-109/save',{enabled:true});
    const conversation=await post('/api/conversations',{listingId:'lst-109',subject:'Analytics proof'});
    const offer=await post('/api/listings/lst-109/offers',{amount:7000});
    return{saved,conversation,offer};
  },csrf);
  expect(signals.saved.status).toBe(200);expect(signals.conversation.status).toBe(201);expect(signals.offer.status).toBe(201);

  const seller=await page.evaluate(async()=>{const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona:'SELLER'})});return{status:r.status,body:await r.json()}});expect(seller.status).toBe(200);
  const analytics=await page.evaluate(async()=>{const r=await fetch('/api/seller/analytics');return{status:r.status,body:await r.json()}});
  expect(analytics.status).toBe(200);expect(analytics.body.analytics?.measurement?.viewsTracked).toBe(true);expect(analytics.body.analytics?.measurement?.viewDefinition).toBe('DEDUPED_30_MINUTE_PASSPORT_SESSIONS');
  const row=analytics.body.analytics?.objects?.find(x=>x.objectId==='lot-109');expect(row).toBeTruthy();expect(row.saved).toBeGreaterThanOrEqual(1);expect(row.conversations).toBeGreaterThanOrEqual(1);expect(row.offers).toBeGreaterThanOrEqual(1);
  expect(JSON.stringify(analytics.body)).not.toContain(buyer.body.account.id);

  await page.reload({waitUntil:'domcontentloaded'});await clickNav(page,'account');
  const panel=page.locator('#sellerAnalyticsV17');await expect(panel).toBeVisible();
  await expect(panel).toContainText(/Спрос и коммерческая воронка|Demand & commercial funnel/i);
  await expect(panel).toContainText(/30-минутном окне|30-minute window/i);
  await expect(panel.locator('.seller-analytics-object')).toHaveCount(2);
});
