// ANTIQUA v82: real browser portfolio media, NO fabricated screenshots or stock video.
// Capture the running CI-local application; this is NOT an online deployment proof.
import {chromium} from 'playwright';
import {mkdir,writeFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const BASE=process.env.PORTFOLIO_BASE_URL||'http://127.0.0.1:12029';
const url=new URL(BASE);
if(!['127.0.0.1','localhost'].includes(url.hostname))
 throw new Error('Portfolio capture requires a loopback running app, never a third-party account/session.');
const ROOT=resolve('artifacts/portfolio-media');
const IMAGE=join(ROOT,'screenshots'),VIDEO=join(ROOT,'videos'),RAW=join(ROOT,'raw');
await Promise.all([IMAGE,VIDEO,RAW].map(p=>mkdir(p,{recursive:true})));
const assert=(yes,msg)=>{if(!yes)throw new Error('PORTFOLIO_QA: '+msg)};
const browser=await chromium.launch({headless:true});
const history=[];
const meta={
 project:'ANTIQUA',captureVersion:'v88',
 source:'RUNNING_CI_LOCAL_APP',production:false,
 url:BASE,repo:'PetrFedin/antiqua',
 prHead:process.env.PORTFOLIO_PR_SHA||null,checkedOutSha:process.env.PORTFOLIO_CHECKOUT_SHA||null,
 capturedAt:new Date().toISOString(),
 usage:'Demo/test data only. Museum open-access artworks are not Antiqua inventory or offers for sale.',
 screenshots:[],videos:[],scenarios:history
};
async function ready(page){
 await page.evaluate(()=>document.fonts?.ready||Promise.resolve());
 await page.waitForTimeout(750);
}
async function snap(page,name,selector=null){
 const file=name+'.png';
 if(selector){
  const subject=page.locator(selector).first();
  await subject.waitFor({state:'visible',timeout:12000});
  await subject.scrollIntoViewIfNeeded();
 }
 await ready(page);
 await page.screenshot({path:join(IMAGE,file),fullPage:false,animations:'disabled',caret:'hide'});
 const toast=await page.locator('#toast').textContent();
 assert(!/Cannot read|TypeError|ReferenceError/.test(toast||''),'Runtime error in captured screen: '+toast);
 const fileBytes=(await stat(join(IMAGE,file))).size;
 assert(fileBytes>16000,'Screenshot is unexpectedly blank or tiny: '+file);
 meta.screenshots.push({file:'screenshots/'+file,width:page.viewportSize().width,height:page.viewportSize().height,bytes:fileBytes,source:'actual Chromium viewport'});
}
async function login(page,persona){
 const r=await page.evaluate(async role=>{
  const response=await fetch('/api/auth/demo-login',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({persona:role})
  });
  return response.status;
 },persona);
 assert(r===200,'Demo sign-in failed: '+persona+': '+r);
 // Direct HTTP login changes cookies; reload also refreshes the app shell.
 await page.reload({waitUntil:'domcontentloaded'});
}
async function accountTab(page,tab){
 await page.goto(BASE+'/#account',{waitUntil:'domcontentloaded'});
 await page.locator('[data-v14-tab="'+tab+'"]').waitFor({state:'visible',timeout:20000});
 await page.locator('[data-v14-tab="'+tab+'"]').click();
 await page.locator('[data-v14-panel="'+tab+'"]').waitFor({state:'visible',timeout:10000});
}

/* v88 visual proof intentionally mocks ONLY the published redacted Decision
 * Dossier. All seller/condition forms and resulting HTTP requests are real
 * interactions with disposable MEMORY_FALLBACK preview data. */
const demoChecks=['ARTWORK_IDENTITY','ATTRIBUTION','PROVENANCE','CONDITION',
 'SCHOLARSHIP','SALE_HISTORY','LEGAL_TITLE','IMAGE_RIGHTS'];
const demoStatuses=['RECORDED','DISPUTED','CONFLICTED','NOT_ASSESSED',
 'NOT_PUBLICLY_RELEASED','NO_PUBLIC_RESULTS','NOT_VERIFIED','NOT_INDEPENDENTLY_VERIFIED'];
const demoDossier={
 dossier:{objectId:'lot-109',projectionSha256:'a'.repeat(64)},
 readiness:{
  schemaVersion:'antiqua-decision-readiness-v1',objectId:'lot-109',
  sourceProjectionSha256:'a'.repeat(64),reportSha256:'b'.repeat(64),
  decisionState:'HUMAN_REVIEW_REQUIRED',
  boundaries:{proofOfAuthenticity:false,proofOfLegalTitle:false,
   priceOrReturnRecommendation:false,privateRoomCreated:false},
  checks:demoChecks.map((code,i)=>({code,status:demoStatuses[i],action:'REVIEW_'+code}))
 }
};
async function installDiligenceFixture(page){
 await page.route('**/api/lots/lot-109/decision-dossier',route=>
  route.fulfill({status:200,contentType:'application/json',
   body:JSON.stringify(demoDossier)}));
}
async function waitDiligence(page){
 await page.locator('#dialog[open] #dossier-readiness[data-readiness-state="ready"]').waitFor({state:'visible'});
 await page.locator('#dialog[open] [data-readiness-request="PROVENANCE"]:not([disabled])').waitFor({state:'visible'});
 await page.locator('#dialog[open] [data-readiness-request="CONDITION"]:not([disabled])').waitFor({state:'visible'});
}
async function labelDiligenceFixture(page){
 await page.evaluate(()=>{
  const panel=document.querySelector('#dialog[open] #dossier-readiness');
  if(!panel||panel.querySelector('[data-fixture-disclaimer]'))return;
  const mark=document.createElement('p');
  mark.dataset.fixtureDisclaimer='public-mock';
  mark.setAttribute('role','note');
  mark.textContent='ДЕМО · Публичное Decision Dossier смоделировано. Не экспертиза и не production.';
  mark.style.cssText='background:#fff3da;border:1px solid #9f7b3f;color:#503b1c;padding:10px;font:600 12px/1.4 Arial,sans-serif';
  panel.prepend(mark);
 });
}
async function frameDiligence(page){
 // Scroll the actual heading (not the parent section) into the center of the
 // nested native dialog. Depending on artwork height the section's top can
 // be beyond the scroll range and explicit scrollTop math can be clamped.
 const heading=page.locator('#dialog[open] #dossier-readiness>h3');
 await heading.scrollIntoViewIfNeeded();
 await heading.evaluate(el=>el.scrollIntoView({behavior:'instant',block:'center',inline:'nearest'}));
 await page.waitForTimeout(220);
 const dimensions=await heading.evaluate(el=>{
  const h=el.getBoundingClientRect();
  const dialog=el.closest('dialog')?.getBoundingClientRect();
  return {headingTop:h.top,headingBottom:h.bottom,
   viewport:window.innerHeight,dialogTop:dialog?.top,dialogBottom:dialog?.bottom};
 });
 const aligned=dimensions.headingTop>0&&
  dimensions.headingBottom<dimensions.viewport&&
  dimensions.headingTop>=(dimensions.dialogTop??0);
 assert(aligned,'Decision Readiness heading outside captured frame: '+JSON.stringify(dimensions));
}
async function labelDiligenceForm(page){
 await page.evaluate(()=>{
  const form=document.querySelector('#actionSheet[open] .action-sheet-body');
  if(!form||form.querySelector('[data-fixture-disclaimer]'))return;
  const mark=document.createElement('p');mark.dataset.fixtureDisclaimer='public-mock';
  mark.setAttribute('role','note');
  mark.textContent='ДЕМО: досье смоделировано; эта форма отправляет запрос в реальный тестовый API Antiqua.';
  mark.style.cssText='background:#fff3da;border:1px solid #9f7b3f;color:#503b1c;padding:8px;font:600 11px/1.4 Arial,sans-serif';
  form.prepend(mark);
 });
}

try{
 const probe=await browser.newPage();
 const response=await probe.request.get(BASE+'/api/health');
 assert(response.status()===200,'The real local Antiqua server must be running');
 const health=await response.json();
 meta.server={status:health.status,persistence:health.persistence?.kind||null,preview:health.preview};
 assert(health.preview===true,'This proof must not operate against production/private data');
 assert(meta.server.persistence==='MEMORY_FALLBACK','v88 fixture proof requires disposable in-memory preview storage');
 await probe.close();
 // Eight portfolio-ready UI states, with separate demo roles and no private data.
 const desktop=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,locale:'ru-RU'});
 const front=await desktop.newPage();
 await front.goto(BASE+'/#gallery',{waitUntil:'domcontentloaded'});
 await snap(front,'01-gallery-editorial-desktop','[data-culture-hero]');
 await snap(front,'02-museum-paintings-desktop','[data-museum-open-access]');
 await front.locator('.culture-hero-media [data-museum-open]').click();
 await front.locator('dialog[data-museum-dialog][open]').waitFor({state:'visible'});
 await snap(front,'03-museum-artwork-dialog-desktop','dialog[data-museum-dialog][open]');
 await front.locator('dialog[data-museum-dialog] .museum-work-close').click();
 await front.goto(BASE+'/#collections',{waitUntil:'domcontentloaded'});
 await snap(front,'04-public-collection-admission-desktop','.collection-register-v70');
 await desktop.close();
 const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,locale:'ru-RU'});
 const mobilePage=await mobile.newPage();
 await mobilePage.goto(BASE+'/#gallery',{waitUntil:'domcontentloaded'});
 await snap(mobilePage,'05-gallery-mobile','[data-culture-hero]');
 await snap(mobilePage,'06-museum-mobile','[data-museum-open-access]');
 await mobilePage.locator('.culture-hero-media [data-museum-open]').click();
 await snap(mobilePage,'07-artwork-dialog-mobile','dialog[data-museum-dialog][open]');
 await mobile.close();
 const collectorCtx=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const collector=await collectorCtx.newPage();
 await collector.goto(BASE+'/',{waitUntil:'domcontentloaded'});
 await login(collector,'BUYER');
 await accountTab(collector,'collections');
 await snap(collector,'08-owner-collection-studio','.collection-studio-v70');
 await collectorCtx.close();
 const curatorCtx=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const curator=await curatorCtx.newPage();
 await curator.goto(BASE+'/',{waitUntil:'domcontentloaded'});
 await login(curator,'OPERATOR');
 await accountTab(curator,'collection-review');
 await snap(curator,'09-reviewer-workspace','.review-workspace-v79');
 await curator.locator('[data-review-queue-load]').click();
 await curator.locator('[data-review-output]').waitFor({state:'visible'});
 await snap(curator,'10-reviewer-queue-preview-limitation','.review-workspace-v79');
 await curatorCtx.close();

 // Additional investor-preview proof: full UI but MOCKED public publication.
 const ddCtx=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,locale:'ru-RU'});
 const dd=await ddCtx.newPage();
 await dd.goto(BASE+'/',{waitUntil:'domcontentloaded'});
 await login(dd,'BUYER');
 await installDiligenceFixture(dd);
 await dd.goto(BASE+'/?object=lot-109#gallery',{waitUntil:'domcontentloaded'});
 await waitDiligence(dd);
 await labelDiligenceFixture(dd);
 await frameDiligence(dd);
 await snap(dd,'11-collector-readiness-MOCKED-public-dossier');
 meta.screenshots.at(-1).authority='MOCKED_PUBLIC_DOSSIER_REAL_UI';
 await dd.locator('[data-readiness-request="PROVENANCE"]').click();
 await dd.locator('#actionSheet[open] #v21InquiryForm').waitFor({state:'visible'});
 await labelDiligenceForm(dd);
 await snap(dd,'12-provenance-inquiry-MOCKED-public-dossier','#actionSheet[open]');
 meta.screenshots.at(-1).authority='MOCKED_PUBLIC_DOSSIER_REAL_UI_FORM';
 await ddCtx.close();

 // Record the actual browser interactions. 24+ seconds of real app state,
 // not a motion graphic assembled from still images.
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 async function record(name,role,routine){
  const dims={width:1280,height:720};
  const context=await browser.newContext({viewport:dims,deviceScaleFactor:1,locale:'ru-RU',recordVideo:{dir:RAW,size:dims}});
  const page=await context.newPage(),started=Date.now();
  if(role){
   await page.goto(BASE+'/',{waitUntil:'domcontentloaded'});
   await login(page,role);
  }
  await routine(page);
  const elapsed=Date.now()-started;
  if(elapsed<24600)await pause(24600-elapsed);
  const source=page.video();
  await page.close();
  await context.close();
  const raw=await source.path();
  const target=join(VIDEO,name+'.mp4');
  const convert=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',raw,
   '-an','-c:v','libx264','-preset','veryfast','-crf','22',
   '-pix_fmt','yuv420p','-movflags','+faststart','-r','24',target],{encoding:'utf8'});
  assert(convert.status===0,'FFmpeg encode failed: '+convert.stderr);
  const info=spawnSync('ffprobe',['-v','error','-show_entries','format=duration',
   '-of','default=nw=1:nk=1',target],{encoding:'utf8'});
  const duration=Number(info.stdout.trim());
  assert(Number.isFinite(duration)&&duration>=20&&duration<=30,
   'Real interaction video should be 20–30 sec, got '+duration);
  const data=await stat(target);
  assert(data.size>200000,'MP4 unexpectedly small: '+name);
  meta.videos.push({file:'videos/'+name+'.mp4',durationSeconds:Math.round(duration*100)/100,
   width:dims.width,height:dims.height,bytes:data.size,method:'Playwright recordVideo + ffmpeg H.264'});
 }
 await record('antiqua-visitor-gallery-24s',null,async page=>{
  await page.goto(BASE+'/#gallery',{waitUntil:'domcontentloaded'});
  await page.locator('[data-culture-hero]').waitFor({state:'visible'});
  await pause(2500);
  await page.locator('.culture-hero-media [data-museum-open]').click();
  await page.locator('dialog[data-museum-dialog][open]').waitFor({state:'visible'});
  await pause(3200);
  await page.locator('.museum-work-close').click();
  await page.locator('[data-museum-open-access]').scrollIntoViewIfNeeded();
  await pause(2500);
  await page.locator('[data-museum-filter="landscape"]').click();
  await pause(1900);
  // Open-access search results are network-dependent. A returned empty
  // landscape filter must never make the entire investor capture hang.
  const filtered=page.locator('[data-museum-artwork] [data-museum-open]');
  const filteredExists=await filtered.count()>0;
  if(filteredExists)await filtered.first().click();
  else await page.locator('.culture-hero-media [data-museum-open]').click();
  await page.locator('dialog[data-museum-dialog][open]').waitFor({state:'visible'});
  if(!filteredExists)history.push({captureNotice:
    'Open-access landscape filter empty; recorded the actual featured museum artwork instead.'});
  await pause(3100);
  await page.locator('.museum-work-close').click();
  await page.goto(BASE+'/#collections',{waitUntil:'domcontentloaded'});
  await page.locator('.collection-register-v70').waitFor({state:'visible'});
  await pause(1500);
  history.push({clip:'antiqua-visitor-gallery-24s',steps:['gallery','open sourced museum painting','museum filters','open painting details','public collection admission']});
 });
 await record('antiqua-owner-collection-24s','BUYER',async page=>{
  await accountTab(page,'collections');
  await pause(2300);
  const form=page.locator('#v14CollectionCreateForm');
  await form.locator('input[name="title"]').fill('ANTIQUA · пример исследовательской подборки');
  await form.locator('select[name="visibility"]').selectOption('PRIVATE');
  const creating=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/collections'&&r.request().method()==='POST');
  await form.locator('button').click();
  const response=await creating;
  assert(response.status()===201,'Collection creation in real UI must succeed');
  const id=(await response.json()).collection.id;
  await pause(2200);
  const add=page.locator('#v14CollectionArtworkForm');
  await add.waitFor({state:'visible'});
  await add.locator('select[name="collectionId"]').selectOption(id);
  await add.locator('select[name="objectId"]').selectOption('lot-108');
  await add.locator('input[name="section"]').fill('Живопись · исследование');
  const adding=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/collections/'+id+'/objects');
  await add.locator('button').click();
  const added=await adding;
  assert(added.status()===200,'Artwork membership must save through authenticated API');
  await page.locator('.collection-studio-card').filter({hasText:'ANTIQUA · пример'}).waitFor({state:'visible'});
  await pause(2400);
  await page.locator('.collection-studio-card').filter({hasText:'ANTIQUA · пример'}).locator('a[href^="#collection/"]').click();
  await pause(2000);
  history.push({clip:'antiqua-owner-collection-24s',steps:['private collector workspace','real create POST','real painting membership POST','collection detail'],previewDataOnly:true});
 });

 await record('antiqua-buyer-diligence-24s', 'BUYER',async page=>{
  await installDiligenceFixture(page);
  await page.goto(BASE+'/?object=lot-109#gallery',{waitUntil:'domcontentloaded'});
  await waitDiligence(page);
  await labelDiligenceFixture(page);
  await frameDiligence(page);
  await pause(2100);
  await page.locator('[data-readiness-request="PROVENANCE"]').click();
  let form=page.locator('#actionSheet[open] #v21InquiryForm');
  await form.waitFor({state:'visible'});
  await labelDiligenceForm(page);
  await form.locator('textarea[name="message"]').fill('Демо: запрос источников провенанса для исследования картины.');
  await pause(1800);
  let posted=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/inquiries'&&r.request().method()==='POST');
  await form.locator('button[type="submit"]').click();
  assert([200,201].includes((await posted).status()),'Real test-only provenance inquiry must reach server');
  await pause(1400);
  await frameDiligence(page);
  await pause(800);
  await page.locator('[data-readiness-request="CONDITION"]').click();
  form=page.locator('#actionSheet[open] #v23ServiceRequestForm[data-kind="condition"]');
  await form.waitFor({state:'visible'});
  await labelDiligenceForm(page);
  await form.locator('textarea[name="note"]').fill('Демо: прошу состояние живописного слоя и сведения о реставрациях.');
  await pause(1800);
  posted=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/listings/lst-109/condition-report-requests'&&r.request().method()==='POST');
  await form.locator('button[type="submit"]').click();
  assert([200,201].includes((await posted).status()),'Real test-only condition report request must reach server');
  await pause(1600);
  history.push({clip:'antiqua-buyer-diligence-24s',
   steps:['MOCKED publication-admitted dossier explicitly labelled',
    'buyer selects provenance inquiry','real test-only seller message POST',
    'buyer selects versioned condition report','real test-only report-request POST'],
   sourceAuthority:'MOCKED_PUBLIC_DOSSIER_REAL_PREVIEW_HTTP',
   previewDataOnly:true});
 });
 meta.videos.at(-1).sourceAuthority='MOCKED_PUBLIC_DOSSIER_REAL_PREVIEW_HTTP';

 await writeFile(join(ROOT,'capture-receipt.json'),JSON.stringify(meta,null,2)+'\n');
 console.log('ANTIQUA real portfolio media capture PASS: '+meta.screenshots.length+
  ' screenshots, '+meta.videos.length+' 20–30s MP4s; SHA '+(meta.prHead||'unknown'));
}finally{await browser.close()}
