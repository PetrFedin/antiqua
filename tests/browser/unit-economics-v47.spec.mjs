import {test,expect} from '@playwright/test';

async function login(page,persona){
 return page.evaluate(async persona=>{
  const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona})});
  let body={};try{body=await r.json()}catch{}
  return{status:r.status,body};
 },persona)
}

test('v0.47 Unit Economics keeps unsupported finance KPIs locked',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});
 const caps=await page.evaluate(async()=>{const r=await fetch('/api/unit-economics/capabilities');return{status:r.status,body:await r.json()}});
 expect(caps.status).toBe(200);
 expect(caps.body.capabilities.contractVersion).toBe('v47');
 expect(caps.body.capabilities.boundaries.grossContributionIsNotGrossMargin).toBe(true);
 expect(caps.body.capabilities.boundaries.recurringCashShareIsNotARR).toBe(true);
 expect(caps.body.capabilities.boundaries.acquisitionCostPerPaidPilotIsNotCAC).toBe(true);

 let auth=await login(page,'BUYER');expect(auth.status).toBe(200);
 const denied=await page.evaluate(async()=>{const r=await fetch('/api/operator/unit-economics');let body={};try{body=await r.json()}catch{}return{status:r.status,body}});
 expect(denied.status).toBe(403);

 auth=await login(page,'OPERATOR');expect(auth.status).toBe(200);
 const unit=await page.evaluate(async()=>{const r=await fetch('/api/operator/unit-economics');return{status:r.status,body:await r.json()}});
 expect(unit.status).toBe(200);
 const e=unit.body.unitEconomics.economics;
 for(const k of ['ARR','GAAP_IFRS_REVENUE','GROSS_MARGIN','CAC','CAC_PAYBACK','LTV','LTV_CAC','NET_REVENUE_RETENTION','PAID_CONVERSION'])expect(e.locks[k].state).toBe('LOCKED');

 await page.goto('/#traction',{waitUntil:'domcontentloaded'});
 const root=page.locator('.traction-page');await expect(root).toBeVisible();
 await expect(root).toContainText(/UNIT ECONOMICS AUTHORITY/i);
 await expect(root).toContainText(/Direct contribution ratio/i);
 await expect(root).toContainText(/Recurring cash share/i);
 await expect(root).toContainText(/ARR/);
 await expect(root).toContainText(/CAC PAYBACK/i);
 await expect(root).toContainText(/LOCKED/i);
});

test('v0.47 economics remains readable on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/',{waitUntil:'domcontentloaded'});
 const auth=await login(page,'OPERATOR');expect(auth.status).toBe(200);
 await page.goto('/#traction',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.traction-page')).toBeVisible();
 await expect(page.locator('.traction-block',{hasText:/UNIT ECONOMICS AUTHORITY/i})).toBeVisible();
});
