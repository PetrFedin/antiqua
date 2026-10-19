import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
async function login(page,persona){
 return page.evaluate(async role=>{
  const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona:role})});
  return {status:r.status,body:await r.json()};
 },persona);
}
async function post(page,path,csrf,body){
 return page.evaluate(async v=>{
  const r=await fetch(v.path,{method:'POST',headers:{'content-type':'application/json','x-csrf-token':v.csrf},body:JSON.stringify(v.body)});
  return{status:r.status,body:await r.json()};
 },{path,csrf,body});
}
for(const scenario of [{width:320,lang:'ru'},{width:390,lang:'en'},{width:834,lang:'ru'},{width:1440,lang:'en'}]){
 test('v69 artist editorial, honest sources, '+scenario.lang+' '+scenario.width,async({page},info)=>{
  await page.setViewportSize({width:scenario.width,height:scenario.width>800?900:720});
  await page.goto('/',{waitUntil:'domcontentloaded'});
  const seller=await login(page,'SELLER');
  expect(seller.status).toBe(200);
  const token='Archive '+scenario.lang+' '+scenario.width+' '+Date.now();
  const created=await post(page,'/api/creators',seller.body.csrf,{
   nameEn:token,nameRu:'Художник '+token,creatorType:'ARTIST',
   salesModel:'INDEPENDENT',disciplines:[{en:'Painting',ru:'Живопись'}]
  });
  expect(created.status).toBe(201);
  const operator=await login(page,'OPERATOR');
  expect(operator.status).toBe(200);
  const pub=await post(page,'/api/creators/'+created.body.creator.id+'/publish',operator.body.csrf,{});
  expect(pub.status).toBe(200);
  await login(page,'BUYER');
  await page.goto('/#creators',{waitUntil:'domcontentloaded'});
  if(scenario.lang==='en')await page.locator('[data-lang="en"]:visible').first().click();
  await expect(page.locator('html')).toHaveAttribute('lang',scenario.lang);
  const directory=page.locator('.artist-directory-v69');
  await expect(directory).toBeVisible();
  const card=directory.locator('.creator-card').filter({hasText:token});
  await expect(card).toBeVisible();
  await expect(directory.locator('.artist-directory-meter')).toContainText(scenario.lang==='ru'?'опубликованных профилей':'published profiles');
  await card.click();
  const profile=page.locator('.artist-profile-v69');
  await expect(profile).toBeVisible();
  await expect(profile.locator('h1')).toContainText(token);
  await expect(profile.locator('.artist-cover-edition')).toContainText('ARTIST DOSSIER');
  await expect(profile.locator('.artist-profile-facts dd')).toHaveText(['0','0','0']);
  await expect(profile).toContainText(scenario.lang==='ru'?'Публичные биографические источники пока не добавлены':'No public biography sources have been added yet');
  await expect(profile.locator('.artist-chronology')).toHaveCount(0);
  await expect(profile.locator('[data-creator-follow]')).toBeVisible();
  expect(await profile.locator('.creator-profile-hero').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(25, 43, 33)');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  expect(overflow,'artist horizontal overflow').toBeLessThanOrEqual(2);
  if([320,1440].includes(scenario.width)){
   await mkdir('artifacts/visual-proof',{recursive:true});
   await page.screenshot({path:'artifacts/visual-proof/v69-artist-'+scenario.lang+'-'+scenario.width+'-'+info.project.name+'.png'});
  }
 });
}
