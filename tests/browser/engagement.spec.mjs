import {test,expect} from '@playwright/test';

test('authenticated passport views become recent history and privacy-safe seller analytics',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});
 const buyer=await page.evaluate(async()=>{const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona:'BUYER'})});return{status:r.status,body:await r.json()}});
 expect(buyer.status).toBe(200);expect(buyer.body.account?.id).toBeTruthy();

 const engagement=await page.evaluate(async()=>{
  const first=await fetch('/api/lots/lot-109/passport'),second=await fetch('/api/lots/lot-109/passport'),recent=await fetch('/api/engagement/recent');
  return{first:first.status,second:second.status,recentStatus:recent.status,recent:await recent.json()};
 });
 expect(engagement.first).toBe(200);expect(engagement.second).toBe(200);expect(engagement.recentStatus).toBe(200);
 const recent=engagement.recent.items.find(x=>x.objectId==='lot-109');expect(recent).toBeTruthy();expect(recent.sessions).toBeGreaterThanOrEqual(1);

 await page.goto('/#account',{waitUntil:'domcontentloaded'});
 const recentPanel=page.locator('#recentlyViewedV17');await expect(recentPanel).toBeVisible();await expect(recentPanel).toContainText(/Недавно просмотренные|Recently viewed/i);

 const seller=await page.evaluate(async()=>{const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona:'SELLER'})});return{status:r.status,body:await r.json()}});
 expect(seller.status).toBe(200);
 let analytics=await page.evaluate(async()=>{const r=await fetch('/api/seller/analytics');return{status:r.status,body:await r.json()}});
 expect(analytics.status).toBe(200);expect(analytics.body.analytics?.measurement?.viewsTracked).toBe(true);expect(analytics.body.analytics?.measurement?.viewDefinition).toBe('DEDUPED_30_MINUTE_PASSPORT_SESSIONS');
 let row=analytics.body.analytics.objects.find(x=>x.objectId==='lot-109');expect(row?.views).toBeGreaterThanOrEqual(1);
 const before=row.views;

 const selfView=await page.evaluate(async()=>{const r=await fetch('/api/lots/lot-109/passport');return r.status});expect(selfView).toBe(200);
 analytics=await page.evaluate(async()=>{const r=await fetch('/api/seller/analytics');return{status:r.status,body:await r.json()}});
 row=analytics.body.analytics.objects.find(x=>x.objectId==='lot-109');expect(row.views).toBe(before);
 expect(JSON.stringify(analytics.body)).not.toContain(buyer.body.account.id);

 await page.goto('/#account',{waitUntil:'domcontentloaded'});
 const sellerPanel=page.locator('#sellerAnalyticsV17');await expect(sellerPanel).toBeVisible();await expect(sellerPanel).toContainText(/30-минутном окне|30-minute window/i);
});
