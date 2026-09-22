import {test,expect} from '@playwright/test';

async function demoLogin(page,persona){
 return page.evaluate(async persona=>{const r=await fetch('/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona})});return{status:r.status,body:await r.json()}},persona);
}
async function post(page,path,csrf,body={},headers={}){
 return page.evaluate(async({path,csrf,body,headers})=>{const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrf,...headers},body:JSON.stringify(body)});let json={};try{json=await r.json()}catch{}return{status:r.status,body:json}},{path,csrf,body,headers});
}
async function getJson(page,path){
 return page.evaluate(async path=>{const r=await fetch(path);let body={};try{body=await r.json()}catch{}return{status:r.status,body}},path);
}

test('buyer workspace projects outbid and seller-counter next actions',async({page},testInfo)=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});
 const buyer=await demoLogin(page,'BUYER');expect(buyer.status).toBe(200);const buyerCsrf=buyer.body.csrf;

 const catalog=(await getJson(page,'/api/catalog')).body;
 const auction=catalog.auctions.find(a=>a.state==='LIVE'&&!['auc-104','auc-105'].includes(a.id));expect(auction).toBeTruthy();
 let before=(await getJson(page,'/api/buyer/intents')).body.intents;
 const ownBefore=before.bids.find(x=>x.auctionId===auction.id);
 const firstMax=Math.max(Number(auction.currentBid)+Number(auction.increment)+100000,Number(ownBefore?.maxAmount||0)+100000);
 const registered=await post(page,'/api/sales/'+catalog.sale.id+'/register',buyerCsrf,{acceptTerms:true,termsVersion:'v22-browser-proof'});expect(registered.status).toBe(200);
 const bid=await post(page,'/api/auctions/'+auction.id+'/bid',buyerCsrf,{maxAmount:firstMax},{'idempotency-key':'v22-buyer-'+testInfo.project.name+'-'+Date.now()});expect([200,201]).toContain(bid.status);

 const token=Date.now()+'-'+Math.random().toString(16).slice(2),second=await page.evaluate(async token=>{const r=await fetch('/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({accountType:'BUYER',displayName:'V22 competing bidder',email:'v22-bid-'+token+'@example.test',password:'BuyerIntent!22'})});return{status:r.status,body:await r.json()}},token);
 expect(second.status).toBe(201);
 const secondReg=await post(page,'/api/sales/'+catalog.sale.id+'/register',second.body.csrf,{acceptTerms:true,termsVersion:'v22-browser-proof'});expect(secondReg.status).toBe(200);
 const secondBid=await post(page,'/api/auctions/'+auction.id+'/bid',second.body.csrf,{maxAmount:firstMax+200000},{'idempotency-key':'v22-other-'+testInfo.project.name+'-'+token});expect([200,201]).toContain(secondBid.status);

 const buyerAgain=await demoLogin(page,'BUYER');expect(buyerAgain.status).toBe(200);
 const outbid=(await getJson(page,'/api/buyer/intents')).body.intents.bids.find(x=>x.auctionId===auction.id);expect(outbid).toBeTruthy();expect(outbid.leading).toBe(false);expect(outbid.nextAction.type).toBe('RAISE_MAX');expect(outbid.maxAmount).toBe(firstMax);

 const activeListing=catalog.listings.find(x=>x.id==='lst-110'&&x.status==='ACTIVE'&&x.negotiable);expect(activeListing).toBeTruthy();
 const offerAmount=Math.max(1000,Number(activeListing.price)-1100),offerResp=await post(page,'/api/listings/lst-110/offers',buyerAgain.body.csrf,{amount:offerAmount});expect(offerResp.status).toBe(201);const offerId=offerResp.body.offer.id;
 const seller=await demoLogin(page,'SELLER');expect(seller.status).toBe(200);
 const sellerCounter=Math.min(Number(activeListing.price),offerAmount+600),countered=await post(page,'/api/offers/'+offerId+'/respond',seller.body.csrf,{action:'COUNTER',amount:sellerCounter});expect(countered.status).toBe(200);expect(countered.body.offer.status).toBe('COUNTERED_BY_SELLER');

 const buyerFinal=await demoLogin(page,'BUYER');expect(buyerFinal.status).toBe(200);
 const projected=(await getJson(page,'/api/buyer/intents')).body.intents;const projectedOffer=projected.offers.find(x=>x.offerId===offerId);expect(projectedOffer.nextAction.type).toBe('REVIEW_COUNTER');expect(projectedOffer.nextAction.allowed).toContain('ACCEPT');expect(projectedOffer.nextAction.allowed).toContain('COUNTER');
 expect(projected.summary.needsAttention).toBeGreaterThanOrEqual(2);

 await page.goto('/#account',{waitUntil:'domcontentloaded'});
 const panel=page.locator('#buyerIntentV22');await expect(panel).toBeVisible();await expect(panel).toContainText(/Ставки и переговоры|Bids & negotiations/i);
 const bidCard=panel.locator('[data-buyer-intent="BID"][data-intent-id="'+auction.id+'"]');await expect(bidCard).toBeVisible();await expect(bidCard).toContainText(/Вас перебили|Outbid/i);
 const raise=bidCard.locator('[data-bid="'+auction.id+'"]');await expect(raise).toBeVisible();await raise.click();
 let sheet=page.locator('#actionSheet[open]');await expect(sheet.locator('#bidAmount')).toBeVisible();expect(Number(await sheet.locator('#bidAmount').inputValue())).toBe(outbid.nextAction.minimum);await sheet.locator('[data-close-sheet]').first().click();

 const offerCard=panel.locator('[data-buyer-intent="OFFER"][data-intent-id="'+offerId+'"]');await expect(offerCard).toBeVisible();await expect(offerCard).toContainText(/Ответ продавца|Seller counter/i);await expect(offerCard.locator('[data-buyer-offer-accept="'+offerId+'"]')).toBeVisible();
 const counterButton=offerCard.locator('[data-buyer-offer-counter="'+offerId+'"]');await expect(counterButton).toBeVisible();await counterButton.click();
 sheet=page.locator('#actionSheet[open]');const counterInput=sheet.locator('#buyerCounterAmount');await expect(counterInput).toBeVisible();
 const counterValue=Number(await counterInput.inputValue());expect(counterValue).toBeGreaterThan(offerAmount);expect(counterValue).toBeLessThan(sellerCounter);
 const counterResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/offers/'+offerId+'/respond'&&r.request().method()==='POST');
 await sheet.locator('#confirmBuyerCounter').click();expect((await counterResponse).status()).toBe(200);
 await expect(page.locator('#actionSheet[open]')).toHaveCount(0);
 const updatedCard=page.locator('#buyerIntentV22 [data-buyer-intent="OFFER"][data-intent-id="'+offerId+'"]');await expect(updatedCard).toBeVisible();await expect(updatedCard).toContainText(/Ожидаем ответ продавца|Waiting for the seller/i);await expect(updatedCard.locator('[data-buyer-offer-counter]')).toHaveCount(0);
});
