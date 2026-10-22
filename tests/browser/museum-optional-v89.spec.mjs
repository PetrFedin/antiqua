import {test,expect} from '@playwright/test';

// Public museum educational references are NOT Antiqua inventory. The
// production source importer is disabled in isolated CI; browser fixtures
// explicitly simulate published source metadata rather than borrowing live
// network claims.
const valid={
 status:'SOURCE_FIELDS_FILTERED',
 source:'ART_INSTITUTE_OF_CHICAGO',
 sourceFieldsValidated:true,
 data:[{
  id:16568,title:'Water Lilies',artist_display:'Claude Monet (French)',
  artwork_type_title:'Painting',is_public_domain:true,
  image_id:'12345678-1234-4abc-8abc-123456789abc',
  date_display:'1906',medium_display:'Oil on canvas',
  dimensions:'Synthetic test dimensions',main_reference_number:'TEST-ONLY',
  privateOwnerName:'DO_NOT_DISCLOSE'
 }]
};

test('v89 default CI preview keeps museum source offline and accepts no proxy params',async({request})=>{
 const available=await request.get('/api/museum/optional');
 expect(available.status()).toBe(200);
 const body=await available.json();
 expect(body.status).toBe('UNAVAILABLE');
 expect(body.data).toEqual([]);
 expect(body.sourceFieldsValidated).toBe(false);
 const params=await request.get('/api/museum/optional?url=https://evil.example/private');
 expect(params.status()).toBe(400);
 const wrongMethod=await request.post('/api/museum/optional',{data:{}});
 expect(wrongMethod.status()).toBe(405);
 expect(wrongMethod.headers().allow).toBe('GET');
});

test('v89 browser connects only to own API; offline source preserves four museum artworks',async({page})=>{
 const remote=[];
 page.on('request',request=>{
  if(new URL(request.url()).hostname==='api.artic.edu')remote.push(request.url());
 });
 await page.goto('/#gallery',{waitUntil:'domcontentloaded'});
 const panel=page.locator('[data-museum-open-access]');
 await expect(panel).toHaveAttribute('data-museum-hydrated','true');
 await expect(panel.locator('.museum-artwork-card')).toHaveCount(4);
 expect(remote).toEqual([]);
 for(const id of ['27992','20684','28560','14655']){
  const card=panel.locator('[data-museum-artwork="'+id+'"]');
  await expect(card).toBeVisible();
  await expect(card.locator('a[href="https://www.artic.edu/artworks/'+id+'"]')).toBeVisible();
  await expect(card).toContainText(/НЕ ПРОДАЁТСЯ|NOT FOR SALE/);
 }
 await expect(panel.locator('[data-museum-artwork="16568"]')).toHaveCount(0);
});

test('v89 permitted fixture has source-linked, noncommercial artwork; private fields never rendered',async({page})=>{
 await page.route('**/api/museum/optional',route=>route.fulfill({
  status:200,contentType:'application/json',body:JSON.stringify(valid)
 }));
 await page.goto('/#gallery',{waitUntil:'domcontentloaded'});
 const panel=page.locator('[data-museum-open-access]');
 await expect(panel).toHaveAttribute('data-museum-hydrated','true');
 await expect(panel.locator('.museum-artwork-card')).toHaveCount(5);
 const card=panel.locator('[data-museum-artwork="16568"]');
 await expect(card).toBeVisible();
 await expect(card).toContainText(/Клод Моне|Claude Monet/);
 await expect(card).toContainText(/МУЗЕЙ|MUSEUM/);
 await expect(card.locator('a[href="https://www.artic.edu/artworks/16568"]')).toBeVisible();
 await expect(card).not.toContainText('DO_NOT_DISCLOSE');
 await expect(card.locator('[data-passport], [data-bid], [data-offer]')).toHaveCount(0);
});

test('v89 forged source status and object fields fail closed on frontend too',async({page})=>{
 const forged=structuredClone(valid);
 forged.status='ARTWORK_AUTHENTICATED';
 forged.data[0].is_public_domain=false;
 await page.route('**/api/museum/optional',route=>route.fulfill({
  status:200,contentType:'application/json',body:JSON.stringify(forged)
 }));
 await page.goto('/#gallery',{waitUntil:'domcontentloaded'});
 const panel=page.locator('[data-museum-open-access]');
 await expect(panel).toHaveAttribute('data-museum-hydrated','true');
 await expect(panel.locator('.museum-artwork-card')).toHaveCount(4);
 await expect(panel.locator('[data-museum-artwork="16568"]')).toHaveCount(0);
});
