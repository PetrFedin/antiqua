import {test,expect} from '@playwright/test';

async function demoLogin(page,persona){
 return page.evaluate(async persona=>{const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona})});return{status:r.status,body:await r.json()}},persona);
}
async function mutateListing(page,csrf,price){
 return page.evaluate(async({csrf,price})=>{const r=await fetch('/api/seller/listings/lst-109',{method:'PATCH',headers:{'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify({price})});return{status:r.status,body:await r.json()}},{csrf,price});
}
async function setWatch(page,csrf,enabled){
 return page.evaluate(async({csrf,enabled})=>{const r=await fetch('/api/lots/lot-109/alert',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify({enabled})});return{status:r.status,body:await r.json()}},{csrf,enabled});
}

test('WATCH turns dossier follow into watchlist and readable seller-change notification',async({page})=>{
 let originalPrice=null,buyerCsrf=null;
 await page.goto('/',{waitUntil:'domcontentloaded'});
 const buyer=await demoLogin(page,'BUYER');expect(buyer.status).toBe(200);buyerCsrf=buyer.body.csrf;
 const catalog=await page.evaluate(async()=>fetch('/api/catalog').then(r=>r.json()));originalPrice=catalog.listings.find(x=>x.id==='lst-109')?.price;expect(originalPrice).toBeTruthy();
 try{
  await page.goto('/?object=lot-109#shop',{waitUntil:'domcontentloaded'});
  const dialog=page.locator('#dialog[open]');await expect(dialog).toBeVisible();
  const watch=dialog.locator('[data-watch="lot-109"]');await expect(watch).toBeVisible();
  const watchedResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/lots/lot-109/alert'&&r.request().method()==='POST');
  await watch.click();expect((await watchedResponse).status()).toBe(200);await expect(watch).toHaveClass(/active/);await expect(watch).toContainText(/Наблюдаю|Watching/i);
  await dialog.locator('[data-close-dialog]').click();

  await page.goto('/#account',{waitUntil:'domcontentloaded'});
  const watchlist=page.locator('#watchlistV19');await expect(watchlist).toBeVisible();await expect(watchlist).toContainText(/Ореховый комод|A walnut commode/i);await expect(watchlist.locator('[data-watch="lot-109"]')).toBeVisible();

  const seller=await demoLogin(page,'SELLER');expect(seller.status).toBe(200);
  const changed=await mutateListing(page,seller.body.csrf,Number(originalPrice)-100);expect(changed.status).toBe(200);expect(changed.body.watch?.subscribers).toBeGreaterThanOrEqual(1);

  const buyerAgain=await demoLogin(page,'BUYER');expect(buyerAgain.status).toBe(200);buyerCsrf=buyerAgain.body.csrf;
  await page.reload({waitUntil:'domcontentloaded'});
  const item=page.locator('.activity-item').filter({hasText:/Изменение наблюдаемого предмета|Watched object changed/i}).first();
  await expect(item).toBeVisible();await expect(item).toContainText(/Ореховый комод|A walnut commode/i);await expect(item).toContainText(/Цена|Price/i);

  const stop=page.locator('#watchlistV19 [data-watch="lot-109"]');await expect(stop).toBeVisible();
  const stoppedResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/lots/lot-109/alert'&&r.request().method()==='POST');
  await stop.click();expect((await stoppedResponse).status()).toBe(200);
  await expect(page.locator('#watchlistV19 [data-watch="lot-109"]')).toHaveCount(0);

  const sellerAgain=await demoLogin(page,'SELLER');expect(sellerAgain.status).toBe(200);
  const restored=await mutateListing(page,sellerAgain.body.csrf,Number(originalPrice));expect(restored.status).toBe(200);expect(restored.body.watch?.subscribers||0).toBe(0);
 }finally{
  try{const b=await demoLogin(page,'BUYER');if(b.status===200)await setWatch(page,b.body.csrf,false)}catch{}
  if(originalPrice!=null){try{const s=await demoLogin(page,'SELLER');if(s.status===200)await mutateListing(page,s.body.csrf,Number(originalPrice))}catch{}}
 }
});
