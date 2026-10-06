import {test,expect} from '@playwright/test';

async function login(page,persona){
 return page.evaluate(async persona=>{
  const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona})});
  let body={};try{body=await r.json()}catch{}
  return{status:r.status,body};
 },persona)
}

test('Paid Gallery Growth workspace exposes an authority-derived evidence ladder',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});
 const auth=await login(page,'SELLER');expect(auth.status).toBe(200);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.goto('/#pilot',{waitUntil:'domcontentloaded'});
 const root=page.locator('.pilot-workspace');await expect(root).toBeVisible();
 const ladder=root.locator('.paid-pilot-readiness');await expect(ladder).toBeVisible();
 await expect(ladder).toContainText(/PAID PILOT EVIDENCE LADDER/i);
 for(const label of ['SCOPE FROZEN','COUNTERPARTY ACCEPTED','LAUNCH READY','LAUNCHED','PRICE ACCEPTED','INVOICE','VERIFIED CASH','DIRECT COST CAPTURE','FINAL REVIEW','RENEWAL DECISION']){
  await expect(ladder).toContainText(new RegExp(label,'i'));
 }
});

test('Paid-pilot ladder remains readable on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/',{waitUntil:'domcontentloaded'});
 const auth=await login(page,'SELLER');expect(auth.status).toBe(200);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.goto('/#pilot',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.paid-pilot-readiness')).toBeVisible();
 await expect(page.locator('.paid-pilot-readiness')).toContainText(/VERIFIED CASH/i);
});
