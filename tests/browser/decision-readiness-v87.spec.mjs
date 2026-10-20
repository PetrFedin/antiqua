import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const works=['ARTWORK_IDENTITY','ATTRIBUTION','PROVENANCE','CONDITION',
 'SCHOLARSHIP','SALE_HISTORY','LEGAL_TITLE','IMAGE_RIGHTS'];
const codes=['RECORDED','DISPUTED','CONFLICTED','NOT_ASSESSED',
 'NOT_PUBLICLY_RELEASED','NO_PUBLIC_RESULTS','NOT_VERIFIED','NOT_INDEPENDENTLY_VERIFIED'];
const hash='a'.repeat(64);
const mock={
 dossier:{objectId:'lot-109',projectionSha256:hash,
  confidentialOwner:{name:'SECRET_UNSAFE_CLIENT_FIELD_V87'}},
 readiness:{
  schemaVersion:'antiqua-decision-readiness-v1',
  objectId:'lot-109',sourceProjectionSha256:hash,reportSha256:'b'.repeat(64),
  decisionState:'HUMAN_REVIEW_REQUIRED',
  boundaries:{proofOfAuthenticity:false,proofOfLegalTitle:false,
   priceOrReturnRecommendation:false,privateRoomCreated:false},
  checks:works.map((code,i)=>({code,status:codes[i],action:'REVIEW_'+code}))
 }
};
for(const size of [{width:320,height:568},{width:1440,height:900}]){
 test('v87 public dossier unavailable fails closed '+size.width,async({page},info)=>{
  await page.setViewportSize(size);
  await page.goto('/?object=lot-109#gallery',{waitUntil:'domcontentloaded'});
  const dlg=page.locator('#dialog[open]');
  await expect(dlg).toBeVisible();
  const panel=dlg.locator('#dossier-readiness');
  await expect(panel).toHaveAttribute('data-readiness-state','unavailable');
  await expect(panel).toContainText(/Расширенный список вопросов|detailed checklist requires/i);
  await expect(panel.locator('.readiness-check')).toHaveCount(0);
  // The v27 Artwork Experience async reconciler must preserve this tab.
  await expect(dlg.locator('#dossierWhyV27')).toBeVisible();
  await expect(dlg.locator('.dossier-tabs a[href="#dossier-readiness"]')).toBeVisible();
  const overflow=await dlg.locator('.dossier-body').evaluate(x=>x.scrollWidth-x.clientWidth);
  expect(overflow).toBeLessThanOrEqual(3);
  if(size.width===1440){
   await mkdir('artifacts/visual-proof',{recursive:true});
   await panel.screenshot({path:'artifacts/visual-proof/v87-preview-unavailable-'+info.project.name+'.png'});
  }
 });
 test('v87 mocked authorized dossier renders human-review checks '+size.width,async({page},info)=>{
  await page.setViewportSize(size);
  await page.route('**/api/lots/lot-109/decision-dossier',async route=>{
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(mock)});
  });
  await page.goto('/?object=lot-109#gallery',{waitUntil:'domcontentloaded'});
  const dlg=page.locator('#dialog[open]');
  const panel=dlg.locator('#dossier-readiness');
  await expect(panel).toHaveAttribute('data-readiness-state','ready');
  await expect(panel.locator('.readiness-check')).toHaveCount(8);
  await expect(dlg.locator('#dossierWhyV27')).toBeVisible();
  await expect(dlg.locator('.dossier-tabs a[href="#dossier-readiness"]')).toBeVisible();
  await expect(panel.locator('[data-readiness-code="PROVENANCE"]')).toContainText('Есть противоречия');
  await expect(panel.locator('[data-readiness-code="LEGAL_TITLE"]')).toContainText('Не подтверждено');
  await expect(panel).toContainText('Решение требует участия человека');
  await expect(panel).not.toContainText('SECRET_UNSAFE_CLIENT_FIELD_V87');
  const overflow=await panel.evaluate(x=>x.scrollWidth-x.clientWidth);
  expect(overflow).toBeLessThanOrEqual(3);
  await expect(panel.locator('a[href="#dossier-evidence"]')).toHaveCount(2);
  if(size.width===1440){
   await mkdir('artifacts/visual-proof',{recursive:true});
   await panel.screenshot({path:'artifacts/visual-proof/v87-readiness-mocked-'+info.project.name+'.png'});
  }
  await dlg.locator('[data-lang="en"]').first().click();
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(panel).toHaveAttribute('data-readiness-state','ready');
  await expect(panel.locator('[data-readiness-code="PROVENANCE"]')).toContainText('Conflicting evidence');
  await expect(panel).toContainText('Human review is required');
  await expect(panel.locator('.readiness-check')).toHaveCount(8);
 });
}
test('v87 rejects a dishonest authorized payload rather than displaying claims',async({page})=>{
 await page.route('**/api/lots/lot-109/decision-dossier',async route=>{
  const poisoned=structuredClone(mock);
  poisoned.readiness.boundaries.proofOfAuthenticity=true;
  poisoned.readiness.checks[0].status='AUTO_CERTIFIED';
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(poisoned)});
 });
 await page.goto('/?object=lot-109#gallery',{waitUntil:'domcontentloaded'});
 const panel=page.locator('#dialog[open] #dossier-readiness');
 await expect(panel).toHaveAttribute('data-readiness-state','unavailable');
 await expect(panel.locator('.readiness-check')).toHaveCount(0);
 await expect(panel).not.toContainText('AUTO_CERTIFIED');
});
