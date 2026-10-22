import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

// The research/dossier response is an explicitly MOCKED publication admission.
// Inquiry and Condition-Report POSTs below use the REAL preview HTTP endpoints.
const hash='c'.repeat(64),receipt='d'.repeat(64);
const items=['ARTWORK_IDENTITY','ATTRIBUTION','PROVENANCE','CONDITION',
 'SCHOLARSHIP','SALE_HISTORY','LEGAL_TITLE','IMAGE_RIGHTS'];
const statuses=['RECORDED','DISPUTED','CONFLICTED','NOT_ASSESSED',
 'NOT_PUBLICLY_RELEASED','NO_PUBLIC_RESULTS','NOT_VERIFIED','NOT_INDEPENDENTLY_VERIFIED'];
const mock={
 dossier:{objectId:'lot-109',projectionSha256:hash,
   confidentialOwner:{name:'SECRET_BUYER_IDENTITY_V88'}},
 readiness:{
  schemaVersion:'antiqua-decision-readiness-v1',
  objectId:'lot-109',sourceProjectionSha256:hash,reportSha256:receipt,
  decisionState:'HUMAN_REVIEW_REQUIRED',
  boundaries:{proofOfAuthenticity:false,proofOfLegalTitle:false,
   priceOrReturnRecommendation:false,privateRoomCreated:false},
  checks:items.map((code,i)=>({code,status:statuses[i],action:'REVIEW_'+code}))
 }
};

async function mockReadiness(page){
 await page.route('**/api/lots/lot-109/decision-dossier',route=>
   route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(mock)}));
}
async function login(page,persona){
 const r=await page.evaluate(async persona=>{
  const response=await fetch('/api/auth/demo-login',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({persona})
  });
  return response.status;
 },persona);
 expect(r).toBe(200);
}
async function openPainting(page){
 await page.goto('/?object=lot-109#gallery',{waitUntil:'domcontentloaded'});
 const dialog=page.locator('#dialog[open]');
 await expect(dialog).toBeVisible();
 const section=dialog.locator('#dossier-readiness');
 await expect(section).toHaveAttribute('data-readiness-state','ready');
 await expect(section.locator('.readiness-check')).toHaveCount(8);
 await expect(dialog.locator('#dossierWhyV27')).toBeVisible();
 await expect(dialog.locator('.dossier-tabs a[href="#dossier-readiness"]')).toBeVisible();
 return {dialog,section};
}
async function visibleAction(section,code){
 const button=section.locator('[data-readiness-request="'+code+'"]');
 await expect(button).toBeVisible();
 await expect(button).toBeEnabled();
 return button;
}
test('v88: unauthenticated diligence goes through login boundary; never auto-sends',async({page})=>{
 await mockReadiness(page);
 const {dialog,section}=await openPainting(page);
 // The preview may start with an authenticated demo BUYER session.
 // Assert the anonymous boundary only after explicit logout.
 const identity=await page.evaluate(async()=>{
  const r=await fetch('/api/auth/me');return r.json();
 });
 if(identity.account){
  const logout=await page.evaluate(async csrf=>{
   const r=await fetch('/api/auth/logout',{
    method:'POST',headers:{'x-csrf-token':csrf}
   });return r.status;
  },identity.csrf);
  expect(logout).toBe(200);
 }
 const anonymous=await page.evaluate(async()=>{
  const r=await fetch('/api/auth/me');return r.json();
 });
 expect(anonymous.account).toBeNull();
 const prov=await visibleAction(section,'PROVENANCE');
 const condition=await visibleAction(section,'CONDITION');
 await expect(section.locator('[data-readiness-request]')).toHaveCount(2);
 await prov.click();
 let sheet=page.locator('#actionSheet[open]');
 await expect(sheet).toContainText(/Войдите, чтобы написать дилеру|Sign in to contact the dealer/);
 await sheet.locator('[data-close-sheet]').first().click();
 await condition.click();
 sheet=page.locator('#actionSheet[open]');
 await expect(sheet).toContainText(/Войдите в аккаунт покупателя|Sign in with a buyer account/);
 await expect(sheet.locator('#v21InquiryForm,#v23ServiceRequestForm')).toHaveCount(0);
 await expect(section).not.toContainText('SECRET_BUYER_IDENTITY_V88');
 await sheet.locator('[data-close-sheet]').first().click();
 await expect(dialog).toBeVisible();
});
test('v88: buyer provenance checklist -> real seller conversation with sourced topic',async({page},info)=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await login(page,'BUYER');
 await mockReadiness(page);
 const {section}=await openPainting(page);
 const prov=await visibleAction(section,'PROVENANCE');
 await mkdir('artifacts/visual-proof',{recursive:true});
 await section.screenshot({path:'artifacts/visual-proof/v88-ready-'+info.project.name+'.png'});
 await prov.click();
 const sheet=page.locator('#actionSheet[open]');
 const form=sheet.locator('#v21InquiryForm');
 await expect(form).toBeVisible();
 await expect(form).toHaveAttribute('data-listing','lst-109');
 await expect(form.locator('[name="inquiryType"]')).toHaveValue('PROVENANCE');
 await sheet.screenshot({path:'artifacts/visual-proof/v88-provenance-request-'+info.project.name+'.png'});
 const body='v88 '+info.project.name+' provenance source request '+Date.now();
 await form.locator('[name="message"]').fill(body);
 const request=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/inquiries'&&r.request().method()==='POST');
 await form.locator('button[type="submit"]').click();
 const response=await request;
 expect([200,201]).toContain(response.status());
 const payload=await response.json();
 expect(payload.message?.body).toBe(body);
 expect(payload.message?.attachments?.[0]?.inquiryType).toBe('PROVENANCE');
 const id=payload.conversation?.id;
 expect(id).toBeTruthy();
 const read=await page.evaluate(async id=>{
  const r=await fetch('/api/conversations/'+encodeURIComponent(id));
  return {status:r.status,body:await r.json()};
 },id);
 expect(read.status).toBe(200);
 expect(read.body.conversation.messages.some(x=>x.body===body)).toBe(true);
});
test('v88: buyer condition checklist -> real versioned report request, not a message',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await login(page,'BUYER');
 await mockReadiness(page);
 const {section}=await openPainting(page);
 const condition=await visibleAction(section,'CONDITION');
 await condition.click();
 const sheet=page.locator('#actionSheet[open]');
 const form=sheet.locator('#v23ServiceRequestForm[data-kind="condition"]');
 await expect(form).toBeVisible();
 await expect(form).toHaveAttribute('data-listing','lst-109');
 await form.locator('textarea[name="note"]').fill('v88 condition checklist: restoration details required');
 const request=page.waitForResponse(r=>{
  const u=new URL(r.url());
  return u.pathname==='/api/listings/lst-109/condition-report-requests'&&r.request().method()==='POST';
 });
 await form.locator('button[type="submit"]').click();
 const response=await request;
 expect([200,201]).toContain(response.status());
 const payload=await response.json();
 expect(payload.request?.status).toBe('REQUESTED');
 expect(payload.request?.version).toBe(1);
 expect(payload.request?.versions).toHaveLength(0);
 await expect(page.locator('#actionSheet[open]')).toHaveCount(0);
});
test('v88: selling your own work never grants a buyer request action',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await login(page,'SELLER');
 await mockReadiness(page);
 const {dialog,section}=await openPainting(page);
 await expect(section.locator('[data-readiness-request]')).toHaveCount(2);
 const prov=section.locator('[data-readiness-request="PROVENANCE"]');
 const condition=section.locator('[data-readiness-request="CONDITION"]');
 await expect(prov).toBeDisabled();
 await expect(condition).toBeDisabled();
 await expect(dialog.locator('[data-object-inquiry]')).toHaveCount(0);
 await expect(dialog.locator('[data-v23-service="condition"]')).toHaveCount(0);
 await expect(page.locator('#actionSheet[open]')).toHaveCount(0);
});
test('v88: deleting and restoring the canonical dealer dock revokes and restores shortcuts',async({page})=>{
 await mockReadiness(page);
 const {section}=await openPainting(page);
 const provenance=await visibleAction(section,'PROVENANCE');
 const condition=await visibleAction(section,'CONDITION');
 await page.evaluate(()=>{
  const dialog=document.querySelector('#dialog[open]');
  const commerce=dialog.querySelector('.dossier-commerce-dock');
  window.__v88TestDock=commerce;
  commerce.remove();
 });
 await expect(provenance).toBeDisabled();
 await expect(condition).toBeDisabled();
 await expect(page.locator('#actionSheet[open]')).toHaveCount(0);
 await page.evaluate(()=>{
  const body=document.querySelector('#dialog[open] .dossier-body');
  body.append(window.__v88TestDock);
  delete window.__v88TestDock;
 });
 await expect(provenance).toBeEnabled();
 await expect(condition).toBeEnabled();
});
test('v88: non-admitted public dossier never offers service shortcuts',async({page})=>{
 await page.route('**/api/lots/lot-109/decision-dossier',route=>
   route.fulfill({status:503,contentType:'application/json',body:'{"code":"DECISION_DOSSIER_NOT_ADMITTED"}'}));
 await page.goto('/?object=lot-109#gallery',{waitUntil:'domcontentloaded'});
 const section=page.locator('#dialog[open] #dossier-readiness');
 await expect(section).toHaveAttribute('data-readiness-state','unavailable');
 await expect(section.locator('[data-readiness-request]')).toHaveCount(0);
 await expect(section.locator('.readiness-check')).toHaveCount(0);
});
