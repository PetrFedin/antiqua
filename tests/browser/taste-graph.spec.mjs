import {test,expect} from '@playwright/test';

async function demoLogin(page){
 return page.evaluate(async()=>{const csrf=decodeURIComponent(document.cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith('antiqua_csrf='))?.split('=').slice(1).join('=')||'');const headers={'content-type':'application/json'};if(csrf)headers['x-csrf-token']=csrf;const r=await fetch('/api/auth/demo-login',{method:'POST',headers,body:JSON.stringify({persona:'BUYER'})});return{status:r.status,body:await r.json()}})
}
async function post(page,path,csrf,body){return page.evaluate(async({path,csrf,body})=>{const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify(body)});return{status:r.status,body:await r.json()}},{path,csrf,body})}
async function patch(page,path,csrf,body){return page.evaluate(async({path,csrf,body})=>{const r=await fetch(path,{method:'PATCH',headers:{'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify(body)});return{status:r.status,body:await r.json()}},{path,csrf,body})}

test('Taste Graph turns explicit actions into explainable discovery and respects dismiss',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});const login=await demoLogin(page);expect(login.status).toBe(200);const csrf=login.body.csrf;
 const saved=await post(page,'/api/lots/lot-101/save',csrf,{enabled:true});expect(saved.status).toBe(200);
 const follow=await post(page,'/api/discovery/subscriptions',csrf,{subscriptionType:'FOLLOW_CATEGORY',label:'Sculpture',category:'Sculpture'});expect(follow.status).toBe(201);const subId=follow.body.subscription.id;
 await page.reload({waitUntil:'domcontentloaded'});
 const feed=page.locator('[data-culture-feed]');await expect(feed).toBeVisible();await expect(feed).toContainText(/вашим действиям|your actions/i);await expect(feed.locator('[data-taste-explain]')).toBeVisible();
 const api=await page.evaluate(async()=>{const r=await fetch('/api/taste/recommendations?limit=8');return{status:r.status,body:await r.json()}});expect(api.status).toBe(200);expect(api.body.capabilities.explainable).toBe(true);expect(api.body.capabilities.aiUsed).toBe(false);expect(api.body.capabilities.priceUsedForMatching).toBe(false);expect(api.body.profile.signalCounts.SAVED).toBeGreaterThan(0);expect(api.body.profile.signalCounts.FOLLOW_CATEGORY).toBeGreaterThan(0);
 const sculpture=api.body.recommendations.find(x=>x.object.id==='lot-112');expect(sculpture).toBeTruthy();expect(sculpture.reasons.some(x=>x.dimension==='department'&&x.signals.some(s=>s.type==='FOLLOW_CATEGORY'))).toBe(true);
 await feed.locator('[data-taste-explain]').click();const sheet=page.locator('#actionSheet[open]');await expect(sheet).toBeVisible();await expect(sheet).toContainText(/TASTE GRAPH/i);await expect(sheet).toContainText(/FOLLOW CATEGORY|FOLLOW_CATEGORY/i);await sheet.locator('[data-close-sheet]').click();
 const dismiss=feed.locator('[data-taste-dismiss]').first();await expect(dismiss).toBeVisible();const dismissedId=await dismiss.getAttribute('data-taste-dismiss');const wait=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/taste/signals'&&r.request().method()==='POST');await dismiss.click();const response=await wait;expect(response.status()).toBe(201);await expect(page.locator('[data-taste-dismiss="'+dismissedId+'"]')).toHaveCount(0);
 await page.goto('/?object=lot-112#shop',{waitUntil:'domcontentloaded'});const dialog=page.locator('#dialog[open]');await expect(dialog).toBeVisible();await expect(dialog.locator('[data-taste-follow="FOLLOW_MAKER"]')).toBeVisible();await expect(dialog.locator('[data-taste-follow="FOLLOW_CATEGORY"]')).toBeVisible();
 const unsave=await post(page,'/api/lots/lot-101/save',csrf,{enabled:false});expect(unsave.status).toBe(200);const archived=await patch(page,'/api/discovery/subscriptions/'+subId,csrf,{status:'ARCHIVED'});expect(archived.status).toBe(200);
});
