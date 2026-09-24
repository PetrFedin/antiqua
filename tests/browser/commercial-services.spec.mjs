import {test,expect} from '@playwright/test';

async function demoLogin(page,persona){
 return page.evaluate(async persona=>{const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona})});return{status:r.status,body:await r.json()}},persona)
}
async function openObject(page,id){
 await page.goto('/#shop',{waitUntil:'domcontentloaded'});
 const card=page.locator('[data-open-passport="'+id+'"]:visible').first();await expect(card).toBeVisible();await card.locator('h3').click();
 const dialog=page.locator('#dialog[open]');await expect(dialog).toBeVisible();return dialog
}
async function openServices(page){
 await page.goto('/#account',{waitUntil:'domcontentloaded'});
 const ops=page.locator('#v14Operations');await expect(ops).toBeVisible();
 await ops.locator('[data-v14-tab="services"]').click();
 const panel=ops.locator('[data-v14-panel="services"]');await expect(panel).toBeVisible();return panel
}
const later=(hours)=>{const d=new Date(Date.now()+hours*3600000);const pad=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes())};

test('structured condition report request and viewing workflow stay outside generic messaging',async({page},testInfo)=>{
 const mobile=testInfo.project.name.includes('mobile');
 const cfg=mobile?{listingId:'lst-110',objectId:'lot-110',base:72}:{listingId:'lst-109',objectId:'lot-109',base:24};
 await page.goto('/',{waitUntil:'domcontentloaded'});
 let login=await demoLogin(page,'BUYER');expect(login.status).toBe(200);await page.reload({waitUntil:'domcontentloaded'});

 let dialog=await openObject(page,cfg.objectId);
 const conditionCta=dialog.locator('[data-v23-service="condition"][data-listing="'+cfg.listingId+'"]');await expect(conditionCta).toBeVisible();await conditionCta.click();
 let sheet=page.locator('#actionSheet[open]');await expect(sheet).toBeVisible();let form=sheet.locator('#v23ServiceRequestForm[data-kind="condition"]');await expect(form).toBeVisible();
 await form.locator('[name="note"]').fill('Browser '+testInfo.project.name+' condition report request');
 const conditionWait=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/listings/'+cfg.listingId+'/condition-report-requests'&&r.request().method()==='POST');
 await form.locator('button[type="submit"]').click();const conditionResponse=await conditionWait;expect([200,201]).toContain(conditionResponse.status());const condition=await conditionResponse.json();
 expect(condition.request.status).toBe('REQUESTED');expect(condition.request.version).toBe(1);expect(condition.request.versions).toHaveLength(0);

 dialog=await openObject(page,cfg.objectId);
 const viewingCta=dialog.locator('[data-v23-service="viewing"][data-listing="'+cfg.listingId+'"]');await expect(viewingCta).toBeVisible();await viewingCta.click();
 sheet=page.locator('#actionSheet[open]');form=sheet.locator('#v23ServiceRequestForm[data-kind="viewing"]');await expect(form).toBeVisible();
 await form.locator('[name="note"]').fill('Browser '+testInfo.project.name+' viewing request');
 const viewingWait=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/listings/'+cfg.listingId+'/viewing-requests'&&r.request().method()==='POST');
 await form.locator('button[type="submit"]').click();const viewingResponse=await viewingWait;expect([200,201]).toContain(viewingResponse.status());const viewing=await viewingResponse.json(),viewingId=viewing.request.id;
 expect(viewing.request.status).toBe('REQUESTED');expect(viewing.request.version).toBe(1);

 let panel=await openServices(page);
 await expect(panel.locator('[data-v23-condition-card="'+condition.request.id+'"]')).toBeVisible();
 await expect(panel.locator('[data-v23-viewing-card="'+viewingId+'"]')).toBeVisible();

 login=await demoLogin(page,'SELLER');expect(login.status).toBe(200);await page.reload({waitUntil:'domcontentloaded'});
 panel=await openServices(page);
 const dealerCard=panel.locator('[data-v23-viewing-card="'+viewingId+'"]');await expect(dealerCard).toBeVisible();await dealerCard.locator('[data-v23-viewing-propose]').click();
 form=page.locator('#v23ViewingSlotsForm');await expect(form).toBeVisible();
 await form.locator('[name="slot1"]').fill(later(cfg.base));
 await form.locator('[name="slot2"]').fill(later(cfg.base+24));
 await form.locator('[name="slot3"]').fill(later(cfg.base+48));
 const slotsWait=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/viewing-requests/'+viewingId+'/slots'&&r.request().method()==='POST');
 await form.locator('button[type="submit"]').click();const slotsResponse=await slotsWait;expect(slotsResponse.status()).toBe(201);let current=await slotsResponse.json();
 expect(current.request.status).toBe('SLOTS_PROPOSED');expect(current.request.proposalVersion).toBe(1);expect(current.request.slots.filter(x=>x.proposalVersion===1)).toHaveLength(3);

 login=await demoLogin(page,'BUYER');expect(login.status).toBe(200);await page.reload({waitUntil:'domcontentloaded'});
 panel=await openServices(page);let buyerCard=panel.locator('[data-v23-viewing-card="'+viewingId+'"]');await expect(buyerCard).toBeVisible();await buyerCard.locator('[data-v23-viewing-confirm-open]').click();
 sheet=page.locator('#actionSheet[open]');const choices=sheet.locator('[data-v23-viewing-confirm="'+viewingId+'"]');await expect(choices).toHaveCount(3);
 const confirmWait=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/viewing-requests/'+viewingId+'/confirm'&&r.request().method()==='POST');
 await choices.nth(1).click();const confirmResponse=await confirmWait;expect(confirmResponse.status()).toBe(201);current=await confirmResponse.json();
 expect(current.request.status).toBe('CONFIRMED');expect(current.request.calendarEvent.status).toBe('CONFIRMED');expect(current.request.calendarEvent.sequence).toBe(0);

 const ics=await page.evaluate(async id=>{const r=await fetch('/api/viewing-requests/'+id+'/calendar.ics');return{status:r.status,type:r.headers.get('content-type'),text:await r.text()}},viewingId);
 expect(ics.status).toBe(200);expect(ics.type).toContain('text/calendar');expect(ics.text).toContain('BEGIN:VEVENT');expect(ics.text).toContain('SEQUENCE:0');expect(ics.text).toContain('STATUS:CONFIRMED');

 panel=await openServices(page);buyerCard=panel.locator('[data-v23-viewing-card="'+viewingId+'"]');await buyerCard.locator('[data-v23-viewing-reschedule]').click();
 form=page.locator('#v23ViewingReasonForm[data-action="reschedule"]');await form.locator('[name="reason"]').fill('Browser schedule changed');
 const reWait=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/viewing-requests/'+viewingId+'/reschedule'&&r.request().method()==='POST');await form.locator('button[type="submit"]').click();
 const reResponse=await reWait;expect(reResponse.status()).toBe(201);current=await reResponse.json();expect(current.request.status).toBe('RESCHEDULE_REQUESTED');expect(current.request.version).toBe(4);

 login=await demoLogin(page,'SELLER');expect(login.status).toBe(200);await page.reload({waitUntil:'domcontentloaded'});
 panel=await openServices(page);await panel.locator('[data-v23-viewing-card="'+viewingId+'"] [data-v23-viewing-propose]').click();
 form=page.locator('#v23ViewingSlotsForm');await form.locator('[name="slot1"]').fill(later(cfg.base+72));await form.locator('[name="slot2"]').fill(later(cfg.base+96));await form.locator('[name="slot3"]').fill(later(cfg.base+120));
 const slots2Wait=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/viewing-requests/'+viewingId+'/slots'&&r.request().method()==='POST');await form.locator('button[type="submit"]').click();current=await (await slots2Wait).json();
 expect(current.request.proposalVersion).toBe(2);expect(current.request.version).toBe(5);

 login=await demoLogin(page,'BUYER');expect(login.status).toBe(200);await page.reload({waitUntil:'domcontentloaded'});
 panel=await openServices(page);await panel.locator('[data-v23-viewing-card="'+viewingId+'"] [data-v23-viewing-confirm-open]').click();sheet=page.locator('#actionSheet[open]');
 const newChoices=sheet.locator('[data-v23-viewing-confirm="'+viewingId+'"]');await expect(newChoices).toHaveCount(3);
 const confirm2Wait=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/viewing-requests/'+viewingId+'/confirm'&&r.request().method()==='POST');await newChoices.first().click();current=await (await confirm2Wait).json();
 expect(current.request.version).toBe(6);expect(current.request.calendarEvent.sequence).toBe(1);

 panel=await openServices(page);buyerCard=panel.locator('[data-v23-viewing-card="'+viewingId+'"]');await buyerCard.locator('[data-v23-viewing-cancel]').click();
 form=page.locator('#v23ViewingReasonForm[data-action="cancel"]');await form.locator('[name="reason"]').fill('Browser cancellation proof');
 const cancelWait=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/viewing-requests/'+viewingId+'/cancel'&&r.request().method()==='POST');await form.locator('button[type="submit"]').click();current=await (await cancelWait).json();
 expect(current.request.status).toBe('CANCELLED');expect(current.request.version).toBe(7);expect(current.request.calendarEvent.status).toBe('CANCELLED');expect(current.request.calendarEvent.sequence).toBe(2);

 const finalIcs=await page.evaluate(async id=>{const r=await fetch('/api/viewing-requests/'+id+'/calendar.ics');return{status:r.status,text:await r.text()}},viewingId);
 expect(finalIcs.status).toBe(200);expect(finalIcs.text).toContain('SEQUENCE:2');expect(finalIcs.text).toContain('STATUS:CANCELLED');

 const generic=await page.evaluate(async()=>{const r=await fetch('/api/inquiries/capabilities');return r.json()});
 expect(generic.capabilities.types).not.toContain('CONDITION');expect(generic.capabilities.types).not.toContain('VIEWING');
 expect(generic.capabilities.structuredWorkflows.CONDITION).toBe('/api/condition-report-requests');
});
