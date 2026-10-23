import {test,expect} from '@playwright/test';
const codes=['ARTWORK_IDENTITY','ATTRIBUTION','PROVENANCE','CONDITION',
 'SCHOLARSHIP','SALE_HISTORY','LEGAL_TITLE','IMAGE_RIGHTS'];
const states=['RECORDED','DISPUTED','CONFLICTED','NOT_ASSESSED',
 'NOT_PUBLICLY_RELEASED','NO_PUBLIC_RESULTS','NOT_VERIFIED','NOT_INDEPENDENTLY_VERIFIED'];
const h='a'.repeat(64);
const mock={
 dossier:{objectId:'lot-109',projectionSha256:h},
 readiness:{
  schemaVersion:'antiqua-decision-readiness-v1',objectId:'lot-109',
  sourceProjectionSha256:h,reportSha256:'b'.repeat(64),
  decisionState:'HUMAN_REVIEW_REQUIRED',
  boundaries:{proofOfAuthenticity:false,proofOfLegalTitle:false,
   priceOrReturnRecommendation:false,privateRoomCreated:false},
  checks:codes.map((code,i)=>({code,status:states[i]}))
 }
};
const scope='/api/listings/lst-109/diligence-progress';
const mockPublic=page=>page.route('**/api/lots/lot-109/decision-dossier',route=>
 route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(mock)}));
async function login(page,persona){
 const code=await page.evaluate(async persona=>{
  const r=await fetch('/api/auth/demo-login',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify({persona})});
  return r.status;
 },persona);
 expect(code).toBe(200);
}
async function openBuyerPainting(page){
 await mockPublic(page);
 await page.goto('/?object=lot-109#gallery',{waitUntil:'domcontentloaded'});
 const dialog=page.locator('#dialog[open]');
 await expect(dialog).toBeVisible();
 const panel=dialog.locator('#dossier-readiness');
 await expect(panel).toHaveAttribute('data-readiness-state','ready');
 await expect(panel.locator('.readiness-check')).toHaveCount(8);
 return {dialog,panel,progress:panel.locator('[data-buyer-progress]')};
}
test('v90 buyer progress shows only authenticated service facts, no private message or false certification',async({page,request})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await login(page,'BUYER');
 const {panel,progress}=await openBuyerPainting(page);
 await expect(progress).toHaveAttribute('data-progress-state','ready');
 await expect(progress.locator('[data-progress-track]')).toHaveCount(2);
 const response=await page.evaluate(async()=>{
  const r=await fetch('/api/listings/lst-109/diligence-progress');
  return {status:r.status,data:await r.json()};
 });
 expect(response.status).toBe(200);
 const p=response.data.progress;
 expect(p.scope).toBe('CURRENT_BUYER_ONLY');
 expect(p.authority).toBe('BUYER_SCOPED_WORKFLOW_EVENTS');
 expect(p.objectId).toBe('lot-109');
 expect(p.listingId).toBe('lst-109');
 expect(p.tracks.map(x=>x.code)).toEqual(['PROVENANCE','CONDITION']);
 expect(p.summary.tracks).toBe(2);
 expect(p.summary.initiated).toBeGreaterThanOrEqual(0);
 expect(p.summary.initiated).toBeLessThanOrEqual(2);
 expect(p.limitations.authenticityCertified).toBe(false);
 expect(p.limitations.legalTitleVerified).toBe(false);
 expect(p.limitations.transactionCompleted).toBe(false);
 expect(JSON.stringify(p)).not.toMatch(/SECRET_CLIENT_MESSAGE|privateFileUrl|buyerAccountId|sellerAccountId|signedUrl/);
 await expect(panel).not.toContainText('Authenticity certified');
 const other=await page.evaluate(async()=>{
  const r=await fetch('/api/listings/lst-110/diligence-progress');
  return {status:r.status,body:await r.json()};
 });
 expect(other.status).toBe(200);
 expect(other.body.progress?.objectId).toBe('lot-110');
 expect(other.body.progress?.listingId).toBe('lst-110');
 const wrong=await page.evaluate(async()=>{
  const r=await fetch('/api/listings/lst-109/diligence-progress?objectId=lot-110');
  return r.status;
 });
 expect(wrong).toBe(400);
 const method=await page.evaluate(async()=>{
  const r=await fetch('/api/listings/lst-109/diligence-progress',{method:'POST'});
  return r.status;
 });
 expect(method).toBe(405);
});

test('v90 real seller enquiry and condition request update same visible collector status',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await login(page,'BUYER');
 const {panel,progress}=await openBuyerPainting(page);
 await expect(progress).toHaveAttribute('data-progress-state','ready');
 const button=panel.locator('[data-readiness-request="PROVENANCE"]');
 await expect(button).toBeEnabled();
 await button.click();
 const form=page.locator('#actionSheet[open] #v21InquiryForm');
 await expect(form).toBeVisible();
 await form.locator('[name="message"]').fill(
  'Please send the documented chain of custody and source citations for this painting, v90.');
 const posted=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/inquiries'&&
   r.request().method()==='POST');
 await form.locator('button[type="submit"]').click();
 expect([200,201]).toContain((await posted).status());
 await expect(progress.locator('[data-progress-track="PROVENANCE"]'))
  .toHaveAttribute('data-progress-state','SENT',{timeout:10000});
 const condition=panel.locator('[data-readiness-request="CONDITION"]');
 await expect(condition).toBeEnabled();
 await condition.click();
 const cf=page.locator('#actionSheet[open] #v23ServiceRequestForm[data-kind="condition"]');
 await expect(cf).toBeVisible();
 await cf.locator('[name="note"]').fill(
  'Please provide a versioned conservation condition report for the canvas and frame.');
 const sent=page.waitForResponse(r=>
  new URL(r.url()).pathname==='/api/listings/lst-109/condition-report-requests'&&
  r.request().method()==='POST');
 await cf.locator('button[type="submit"]').click();
 expect([200,201]).toContain((await sent).status());
 await expect(progress.locator('[data-progress-track="CONDITION"]'))
  .toHaveAttribute('data-progress-state','REQUESTED',{timeout:10000});
 await expect(progress).not.toContainText('Certified');
});

test('v90 buyer progress is not publicly disclosed after logout',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await login(page,'BUYER');
 const {progress}=await openBuyerPainting(page);
 await expect(progress).toHaveAttribute('data-progress-state','ready');
 const logout=await page.evaluate(async()=>{
  const me=await (await fetch('/api/auth/me')).json();
  const r=await fetch('/api/auth/logout',{method:'POST',
   headers:{'x-csrf-token':me.csrf}});
  return r.status;
 });
 expect(logout).toBe(200);
 const privateRead=await page.evaluate(async()=>{
  const r=await fetch('/api/listings/lst-109/diligence-progress');
  return r.status;
 });
 expect(privateRead).toBe(401);
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent(
  'antiqua:diligence-updated',{detail:{listingId:'lst-109'}})));
 await expect(progress).toHaveAttribute('data-progress-state','sign-in');
 await expect(progress.locator('[data-progress-track]')).toHaveCount(0);
});

test('v90 seller cannot inspect the private buyer enquiry trail',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await login(page,'SELLER');
 const status=await page.evaluate(async()=>{
  const r=await fetch('/api/listings/lst-109/diligence-progress');
  return r.status;
 });
 expect([403,404]).toContain(status);
 const {progress}=await openBuyerPainting(page);
 await expect(progress).toHaveAttribute('data-progress-state',status===403?'buyer-only':'unavailable');
 await expect(progress.locator('[data-progress-track]')).toHaveCount(0);
});

test('v90 forged buyer-progress response cannot create a certificate or false reply',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await login(page,'BUYER');
 await page.route('**/api/listings/lst-109/diligence-progress',route=>{
  const poisoned={
   progress:{
    schemaVersion:'antiqua-buyer-diligence-v1',objectId:'lot-109',listingId:'lst-109',
    scope:'CURRENT_BUYER_ONLY',authority:'BUYER_SCOPED_WORKFLOW_EVENTS',
    tracks:[{code:'PROVENANCE',state:'AUTHENTICITY_CERTIFIED'},
     {code:'CONDITION',state:'REPORT_PUBLISHED'}],
    summary:{tracks:2,initiated:2,repliedOrPublished:2},
    limitations:{authenticityCertified:true,legalTitleVerified:true,
     sourceDocumentsDelivered:true,conditionProfessionallyCertified:true,
     privateDocumentAccessGranted:true,transactionCompleted:true}
   }
  };
  return route.fulfill({status:200,contentType:'application/json',
   body:JSON.stringify(poisoned)});
 });
 const {progress}=await openBuyerPainting(page);
 await expect(progress).toHaveAttribute('data-progress-state','unavailable');
 await expect(progress.locator('[data-progress-track]')).toHaveCount(0);
 await expect(progress).not.toContainText('AUTHENTICITY_CERTIFIED');
});
