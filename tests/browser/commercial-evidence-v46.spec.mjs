import {test,expect} from '@playwright/test';

async function login(page,persona){
 return page.evaluate(async persona=>{
  const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona})});
  let body={};try{body=await r.json()}catch{}
  return{status:r.status,body};
 },persona)
}

test('Commercial Evidence Authority keeps revenue evidence operator-controlled and cash-safe',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});

 const caps=await page.evaluate(async()=>{
  const r=await fetch('/api/commercial-evidence/capabilities');
  return{status:r.status,body:await r.json()};
 });
 expect(caps.status).toBe(200);
 expect(caps.body.capabilities.contractVersion).toBe('v46');
 expect(caps.body.capabilities.operatorControlledWrites).toBe(true);
 expect(caps.body.capabilities.accountingBoundary.quoteIsRevenue).toBe(false);
 expect(caps.body.capabilities.accountingBoundary.writtenAcceptanceIsRevenue).toBe(false);
 expect(caps.body.capabilities.accountingBoundary.invoiceIsCash).toBe(false);
 expect(caps.body.capabilities.accountingBoundary.paymentReceivedIsCash).toBe(true);

 let auth=await login(page,'BUYER');
 expect(auth.status).toBe(200);
 const buyerAggregate=await page.evaluate(async()=>{
  const r=await fetch('/api/operator/investor-commercial-aggregate');
  let body={};try{body=await r.json()}catch{}
  return{status:r.status,body};
 });
 expect(buyerAggregate.status).toBe(403);

 auth=await login(page,'OPERATOR');
 expect(auth.status).toBe(200);
 const aggregate=await page.evaluate(async()=>{
  const r=await fetch('/api/operator/investor-commercial-aggregate');
  return{status:r.status,body:await r.json()};
 });
 expect(aggregate.status).toBe(200);
 expect(['POSTGRES','MEMORY_FALLBACK']).toContain(aggregate.body.commercial.persistence);
 if(aggregate.body.commercial.persistence==='MEMORY_FALLBACK'){
  expect(aggregate.body.commercial.paidPilots).toBe(0);
  expect(aggregate.body.commercial.cashReceivedMinorByCurrency).toEqual({});
  expect(aggregate.body.commercial.grossContributionMinorByCurrency).toEqual({});
  expect(aggregate.body.commercial.evidenceState).toBe('MISSING');
 }

 const durableWrite=await page.evaluate(async csrf=>{
  const r=await fetch('/api/operator/pilots/nonexistent/commercial-evidence/events',{
   method:'POST',
   headers:{'content-type':'application/json','x-csrf-token':csrf},
   body:JSON.stringify({eventType:'QUOTE_ISSUED',revenueStream:'PROFESSIONAL_SAAS',amountMinor:100000,currency:'EUR',clientActionId:'browser-v46-'+Date.now()})
  });
  let body={};try{body=await r.json()}catch{}
  return{status:r.status,body};
 },auth.body.csrf);
 if(aggregate.body.commercial.persistence==='MEMORY_FALLBACK'){
  expect(durableWrite.status).toBe(503);
  expect(durableWrite.body.code).toBe('COMMERCIAL_EVIDENCE_DURABILITY_REQUIRED');
 }else{
  expect(durableWrite.status).toBe(404);
  expect(durableWrite.body.code).toBe('PILOT_NOT_FOUND');
 }
});


test('Commercial Evidence Console is operator-only and fails closed without durable PostgreSQL',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});
 let auth=await login(page,'BUYER');expect(auth.status).toBe(200);
 await page.goto('/#account',{waitUntil:'domcontentloaded'});
 await expect(page.locator('[data-v14-tab="commercial-evidence"]')).toHaveCount(0);

 auth=await login(page,'OPERATOR');expect(auth.status).toBe(200);
 await page.goto('/#account',{waitUntil:'domcontentloaded'});
 const tab=page.locator('[data-v14-tab="commercial-evidence"]'),standalone=page.locator('#commercialEvidenceStandalone');
 await expect.poll(async()=>await tab.count()+await standalone.count()).toBeGreaterThan(0);
 const panel=await tab.count()?page.locator('[data-v14-panel="commercial-evidence"]'):standalone;if(await tab.count())await tab.click();await expect(panel).toBeVisible();
 await expect(panel).toContainText(/COMMERCIAL EVIDENCE AUTHORITY/i);
 const persistence=(await page.evaluate(async()=>{const r=await fetch('/api/operator/commercial-evidence/pilots');return(await r.json()).commercial.persistence}));
 if(persistence==='MEMORY_FALLBACK'){
  await expect(panel).toContainText(/DURABLE POSTGRESQL REQUIRED/i);
  await expect(panel.locator('[data-commercial-evidence-form]')).toHaveCount(0);
 }
});
