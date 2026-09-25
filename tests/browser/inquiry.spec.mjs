import {test,expect} from '@playwright/test';

async function demoLogin(page,persona){
 return page.evaluate(async persona=>{const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona})});return{status:r.status,body:await r.json()}},persona);
}
async function openObject(page,id){
 await page.goto('/#shop',{waitUntil:'domcontentloaded'});
 const card=page.locator('[data-open-passport="'+id+'"]:visible').first();await expect(card).toBeVisible();await card.locator('h3').click();
 const dialog=page.locator('#dialog[open]');await expect(dialog).toBeVisible();return dialog;
}
async function logoutCurrentPreviewSession(page){
 const me=await page.evaluate(async()=>{const r=await fetch('/api/auth/me');return r.json()});
 if(!me?.account)return;
 const out=await page.evaluate(async csrf=>{const r=await fetch('/api/auth/logout',{method:'POST',headers:{'x-csrf-token':csrf}});return{status:r.status,body:await r.json()}},me.csrf);
 expect(out.status).toBe(200);
 const after=await page.evaluate(async()=>{const r=await fetch('/api/auth/me');return r.json()});
 expect(after.account).toBeNull();
}

test('Object Passport inquiry reaches seller thread with durable topic context',async({page},testInfo)=>{
 const isMobile=testInfo.project.name.includes('mobile'),listingId='lst-110',objectId='lot-110',topic=isMobile?'SHIPPING':'PROVENANCE';
 await page.goto('/',{waitUntil:'domcontentloaded'});

 let dialog=await openObject(page,objectId);
 await logoutCurrentPreviewSession(page);
 const anonButton=dialog.locator('[data-object-inquiry="'+listingId+'"]');await expect(anonButton).toBeVisible();await anonButton.click();
 let sheet=page.locator('#actionSheet[open]');await expect(sheet).toBeVisible();await expect(sheet).toContainText(/Войдите, чтобы написать дилеру|Sign in to contact the dealer/i);
 await sheet.locator('[data-close-sheet]').first().click();

 const buyer=await demoLogin(page,'BUYER');expect(buyer.status).toBe(200);await page.reload({waitUntil:'domcontentloaded'});
 dialog=page.locator('#dialog[open]');if(!await dialog.isVisible().catch(()=>false))dialog=await openObject(page,objectId);
 const inquiry=dialog.locator('[data-object-inquiry="'+listingId+'"]');await expect(inquiry).toBeVisible();await inquiry.click();
 sheet=page.locator('#actionSheet[open]');await expect(sheet).toBeVisible();
 const form=sheet.locator('#v21InquiryForm');await expect(form).toBeVisible();await form.locator('[name="inquiryType"]').selectOption(topic);
 const body='Browser '+testInfo.project.name+' inquiry '+Date.now()+' about '+topic;
 await form.locator('[name="message"]').fill(body);
 const responsePromise=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/inquiries'&&r.request().method()==='POST');
 await form.locator('button[type="submit"]').click();
 const response=await responsePromise;expect([200,201]).toContain(response.status());const sent=await response.json();
 expect(sent.conversation?.id).toBeTruthy();expect(sent.message?.body).toBe(body);expect(sent.message?.attachments?.[0]?.inquiryType).toBe(topic);
 await expect(page.locator('#actionSheet[open]')).toHaveCount(0);

 const buyerThread=await page.evaluate(async id=>{const r=await fetch('/api/conversations/'+id);return{status:r.status,body:await r.json()}},sent.conversation.id);
 expect(buyerThread.status).toBe(200);expect(buyerThread.body.conversation.messages.some(m=>m.body===body)).toBe(true);

 const seller=await demoLogin(page,'SELLER');expect(seller.status).toBe(200);
 const sellerList=await page.evaluate(async()=>{const r=await fetch('/api/conversations');return{status:r.status,body:await r.json()}});
 expect(sellerList.status).toBe(200);const sellerThread=sellerList.body.conversations.find(c=>c.id===sent.conversation.id);expect(sellerThread).toBeTruthy();expect(sellerThread.unreadCount).toBeGreaterThanOrEqual(1);

 await page.evaluate(()=>{localStorage.setItem('antiqua_v14_tab','messages');location.hash='account'});await page.reload({waitUntil:'domcontentloaded'});
 const messages=page.locator('[data-v14-panel="messages"]');await expect(messages).toBeVisible();
 const threadButton=messages.locator('[data-v14-thread="'+sent.conversation.id+'"]');await expect(threadButton).toBeVisible();await threadButton.click();
 sheet=page.locator('#actionSheet[open]');await expect(sheet).toBeVisible();await expect(sheet).toContainText(body);
 const context=sheet.locator('.inquiry-context-v21').filter({hasText:isMobile?/Shipping|Доставка/i:/Provenance|Провенанс/i});await expect(context).toBeVisible();await sheet.locator('[data-close-sheet]').first().click();

 dialog=await openObject(page,objectId);await page.waitForTimeout(250);
 await expect(dialog.locator('[data-object-inquiry]')).toHaveCount(0);
});
