import {test,expect} from '@playwright/test';

async function login(page,persona){return page.evaluate(async persona=>{const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona})});return{status:r.status,body:await r.json()}},persona)}
async function post(page,path,csrf,body){return page.evaluate(async({path,csrf,body})=>{const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify(body)});let json={};try{json=await r.json()}catch{}return{status:r.status,body:json}},{path,csrf,body})}

test('Art Calendar publishes reviewed events, detects plan conflicts and exports real ICS',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});let auth=await login(page,'OPERATOR');expect(auth.status).toBe(200);const operatorCsrf=auth.body.csrf,token=Date.now().toString(),base=Date.now()+3*864e5;
 const create=async(suffix,offset)=>{const made=await post(page,'/api/calendar/events',operatorCsrf,{slug:'browser-calendar-'+suffix+'-'+token,title:{en:'Browser Calendar '+suffix+' '+token,ru:'Браузерный календарь '+suffix+' '+token},summary:{en:'Reviewed art calendar event',ru:'Проверенное событие арт-календаря'},eventType:'CURATOR_TOUR',venueMode:'PHYSICAL',venueName:{en:'Antiqua Test Gallery',ru:'Тестовая галерея Antiqua'},city:{en:'Amsterdam',ru:'Амстердам'},country:{en:'Netherlands',ru:'Нидерланды'},timezone:'Europe/Amsterdam',startsAt:new Date(base+offset).toISOString(),endsAt:new Date(base+offset+90*60000).toISOString(),visibility:'PUBLIC'});expect(made.status).toBe(201);const id=made.body.event.id;expect((await post(page,'/api/calendar/events/'+id+'/submit',operatorCsrf,{})).status).toBe(200);expect((await post(page,'/api/calendar/review/events/'+id,operatorCsrf,{decision:'APPROVE',note:'browser proof'})).status).toBe(200);return id};
 const a=await create('a',0),b=await create('b',30*60000);
 auth=await login(page,'BUYER');expect(auth.status).toBe(200);const buyerCsrf=auth.body.csrf;expect((await post(page,'/api/calendar/participation',buyerCsrf,{entityType:'EVENT',entityId:a,state:'PLANNED'})).status).toBe(200);expect((await post(page,'/api/calendar/participation',buyerCsrf,{entityType:'EVENT',entityId:b,state:'PLANNED'})).status).toBe(200);
 await page.goto('/#events',{waitUntil:'domcontentloaded'});const calendar=page.locator('.cultural-calendar-page');await expect(calendar).toBeVisible();await expect(calendar).toContainText(token);await expect(calendar.locator('.calendar-conflicts')).toBeVisible();await expect(calendar.locator('.calendar-conflicts')).toContainText(/Два события идут одновременно|Two events overlap/i);
 const card=calendar.locator('.calendar-card').filter({hasText:'a '+token});await expect(card).toBeVisible();await card.locator('.calendar-card-main').click();const detail=page.locator('.calendar-event-page');await expect(detail).toBeVisible();await expect(detail).toContainText(token);await expect(detail.locator('[data-calendar-state="PLANNED"]')).toHaveClass(/active/);
 const ics=await page.evaluate(async id=>{const r=await fetch('/api/calendar/events/'+id+'/ics');return{status:r.status,type:r.headers.get('content-type'),body:await r.text()}},a);expect(ics.status).toBe(200);expect(ics.type).toMatch(/text\/calendar/);expect(ics.body.startsWith('BEGIN:VCALENDAR')).toBe(true);expect(ics.body).toContain('BEGIN:VEVENT');
});


test('guest calendar action routes to account sign-in instead of leaking an API error',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});
 const operator=await login(page,'OPERATOR');expect(operator.status).toBe(200);const csrf=operator.body.csrf,token='guest-'+Date.now(),base=Date.now()+2*864e5;
 const made=await post(page,'/api/calendar/events',csrf,{slug:'browser-calendar-'+token,title:{en:'Guest Calendar '+token,ru:'Гостевой календарь '+token},summary:{en:'Guest CTA proof',ru:'Проверка гостевого CTA'},eventType:'OPENING',venueMode:'PHYSICAL',venueName:{en:'Antiqua Guest Gallery',ru:'Гостевая галерея Antiqua'},city:{en:'Amsterdam',ru:'Амстердам'},country:{en:'Netherlands',ru:'Нидерланды'},timezone:'Europe/Amsterdam',startsAt:new Date(base).toISOString(),endsAt:new Date(base+60*60000).toISOString(),visibility:'PUBLIC'});expect(made.status).toBe(201);
 const eventId=made.body.event.id;expect((await post(page,'/api/calendar/events/'+eventId+'/submit',csrf,{})).status).toBe(200);expect((await post(page,'/api/calendar/review/events/'+eventId,csrf,{decision:'APPROVE',note:'guest CTA proof'})).status).toBe(200);
 await page.context().clearCookies();
 await page.goto('/#events',{waitUntil:'domcontentloaded'});
 const auth=await page.evaluate(async()=>{const r=await fetch('/api/auth/me');return r.json()});expect(auth.account).toBeNull();
 const calendar=page.locator('.cultural-calendar-page');await expect(calendar).toBeVisible();
 const card=calendar.locator('.calendar-card').filter({hasText:token});await expect(card).toBeVisible();
 const save=card.locator('[data-calendar-signin]').first();await expect(save).toBeVisible();await save.click();
 await expect.poll(()=>new URL(page.url()).hash).toBe('#account');
 await expect(page.locator('#app')).toContainText(/Войти|Sign in|Аккаунт|Account/i);
});
