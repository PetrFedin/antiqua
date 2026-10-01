import {test,expect} from '@playwright/test';
async function login(page,persona){return page.evaluate(async persona=>{const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona})});return{status:r.status,body:await r.json()}},persona)}
test('Dealer Pilot Workspace renders signed commercial proof for seller',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});
 const auth=await login(page,'SELLER');expect(auth.status).toBe(200);
 const caps=await page.evaluate(async()=>{const r=await fetch('/api/pilot/commercial-proof/capabilities');return{status:r.status,body:await r.json()}});
 expect(caps.status).toBe(200);expect(caps.body.capabilities.contractVersion).toBe('v35');expect(caps.body.capabilities.causalClaims).toBe(false);
 for(const path of ['/api/pilot/commercial-proof','/api/dealer/performance','/api/partner/pilot-analytics','/api/dealer/pilots']){
  const x=await page.evaluate(async path=>{const r=await fetch(path);let body={};try{body=await r.json()}catch{}return{path,status:r.status,body}},path);
  expect(x.status,`${path}: ${JSON.stringify(x.body)}`).toBe(200);
 }
 await page.goto('/#pilot',{waitUntil:'domcontentloaded'});
 const ws=page.locator('.pilot-workspace');await expect(ws).toBeVisible();
 await expect(ws).toContainText(/Pilot commercial control|Коммерческий контроль пилота/i);
 await expect(ws).toContainText(/PILOT SCORECARD/i);
 await expect(ws).toContainText(/BASELINE VS PILOT/i);
 await expect(ws).toContainText(/D7/);await expect(ws).toContainText(/D30/);await expect(ws).toContainText(/D90/);
 await expect(ws).toContainText(/OBJECT PERFORMANCE/i);
 await expect(ws).toContainText(/OUTCOME LEDGER/i);
 await expect(ws).toContainText(/SIGNED EVIDENCE PACK/i);
 await expect(ws.locator('a[href="/api/pilot/commercial-proof/report"]')).toBeVisible();
 const evidence=ws.locator('.pilot-evidence');await expect(evidence).toContainText(/SHA-256/i);await expect(evidence).toContainText(/HMAC-SHA256/i);
 await expect(ws).toContainText(/не заявляет причинность|does not claim causality/i);
});
