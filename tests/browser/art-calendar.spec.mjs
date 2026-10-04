import {test,expect} from '@playwright/test';

async function login(page,persona){return page.evaluate(async persona=>{const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona})});return{status:r.status,body:await r.json()}},persona)}
async function req(page,method,path,csrf,body={}){return page.evaluate(async({method,path,csrf,body})=>{const r=await fetch(path,{method,headers:{'content-type':'application/json',...(csrf?{'x-csrf-token':csrf}:{})},body:['GET','HEAD'].includes(method)?undefined:JSON.stringify(body)});let json={};try{json=await r.json()}catch{}return{status:r.status,body:json}},{method,path,csrf,body})}

test('Art Calendar publishes reviewed events, plans privately and renders detail/ICS',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});let auth=await login(page,'BUYER');expect(auth.status).toBe(200);const buyerCsrf=auth.body.csrf,token=Date.now().toString(),startsAt=new Date(Date.now()+48*3600000).toISOString(),endsAt=new Date(Date.now()+50*3600000).toISOString();
 const created=await req(page,'POST','/api/calendar/events',buyerCsrf,{eventType:'ARTIST_TALK',title:{en:'Browser Art Talk '+token,ru:'Браузерный арт-разговор '+token},summary:{en:'A reviewed event.',ru:'Проверяемое событие.'},visibility:'PUBLIC',attendanceMode:'IN_PERSON',startsAt,endsAt,timezone:'Europe/Amsterdam',venueName:{en:'Browser Gallery',ru:'Браузерная галерея'},city:{en:'Amsterdam',ru:'Амстердам'},country:{en:'Netherlands',ru:'Нидерланды'},metadata:{internal:'hidden'}});
 expect(created.status).toBe(201);const id=created.body.event.id;
 let submitted=await req(page,'POST','/api/calendar/events/'+id+'/submit',buyerCsrf,{});expect(submitted.status).toBe(200);expect(submitted.body.event.status).toBe('REVIEW_PENDING');
 let publicEvent=await req(page,'GET','/api/calendar/events/'+id,null);expect(publicEvent.status).toBe(404);

 auth=await login(page,'OPERATOR');expect(auth.status).toBe(200);const reviewed=await req(page,'POST','/api/calendar/review/events/'+id,auth.body.csrf,{decision:'APPROVE',note:'browser proof'});expect(reviewed.status).toBe(200);expect(reviewed.body.event.status).toBe('PUBLISHED');
 auth=await login(page,'BUYER');expect(auth.status).toBe(200);

 await page.goto('/#events',{waitUntil:'domcontentloaded'});const calendar=page.locator('.art-calendar-page');await expect(calendar).toBeVisible();const card=calendar.locator('.art-calendar-card').filter({hasText:token});await expect(card).toBeVisible();
 await calendar.locator('[data-calendar-filter="week"]').click();await expect(card).toBeVisible();
 const planned=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/calendar/events/'+id+'/participation'&&r.request().method()==='POST');await card.locator('[data-state="PLANNED"]').click();expect((await planned).status()).toBe(200);await expect(card.locator('[data-state="PLANNED"]')).toHaveClass(/active/);
 await card.locator('.calendar-card-main').click();const detail=page.locator('.art-event-page');await expect(detail).toBeVisible();await expect(detail).toContainText(token);await expect(detail.locator('a.calendar-ics')).toHaveAttribute('href',new RegExp('/api/calendar/events/'+id+'\\.ics$'));

 publicEvent=await req(page,'GET','/api/calendar/events/'+id,null);expect(publicEvent.status).toBe(200);expect(publicEvent.body.event.ownerAccountId).toBeUndefined();expect(publicEvent.body.event.metadata).toBeUndefined();
 const mine=await req(page,'GET','/api/calendar/me',null);expect(mine.status).toBe(200);expect(mine.body.items.some(x=>x.id===id&&x.participation?.state==='PLANNED')).toBe(true);
 await page.goto('/#event-submit',{waitUntil:'domcontentloaded'});await expect(page.locator('#artEventSubmitForm')).toBeVisible();
});
