import assert from 'node:assert/strict';
import {db} from '../runtime-v09.mjs';
import {recordObjectView,aggregateObjectViews,listRecentlyViewed,clearRecentlyViewed,engagementCapabilities} from '../engagement-v17.mjs';

const buyer=await db.findAccountByEmail('buyer@demo.antiqua');
const seller=await db.findAccountByEmail('seller@demo.antiqua');
const operator=await db.findAccountByEmail('operator@demo.antiqua');
assert.ok(buyer?.id&&seller?.sellerId&&operator?.id);

const t=Math.floor(Date.now()/(30*60*1000))*(30*60*1000)+60_000,req={headers:{'x-forwarded-for':'203.0.113.44','user-agent':'ANTIQUA engagement proof'},socket:{remoteAddress:'127.0.0.1'}};
let x=await recordObjectView(db,req,buyer,'lot-109',{at:t,ownerSellerId:seller.sellerId});
assert.equal(x.recorded,true);
x=await recordObjectView(db,req,buyer,'lot-109',{at:t+5*60*1000,ownerSellerId:seller.sellerId});
assert.equal(x.recorded,true);assert.equal(x.deduplicated,true);

let views=await aggregateObjectViews(db,['lot-109']);
assert.equal(views['lot-109'].views,1,'repeat passport opens inside 30 minutes must deduplicate');

x=await recordObjectView(db,req,seller,'lot-109',{at:t+6*60*1000,ownerSellerId:seller.sellerId});
assert.equal(x.recorded,false);assert.equal(x.reason,'SELF_SELLER');
x=await recordObjectView(db,req,operator,'lot-109',{at:t+7*60*1000,ownerSellerId:seller.sellerId});
assert.equal(x.recorded,false);assert.equal(x.reason,'STAFF');

const anonReq={headers:{'x-forwarded-for':'198.51.100.77','user-agent':'Anonymous browser'},socket:{remoteAddress:'127.0.0.1'}};
await recordObjectView(db,anonReq,null,'lot-109',{at:t,ownerSellerId:seller.sellerId});
await recordObjectView(db,anonReq,null,'lot-109',{at:t+2*60*1000,ownerSellerId:seller.sellerId});
views=await aggregateObjectViews(db,['lot-109']);
assert.equal(views['lot-109'].views,2,'buyer session plus one anonymous session expected');

const recent=await listRecentlyViewed(db,buyer.id,{limit:12});
assert.equal(recent[0].objectId,'lot-109');assert.equal(recent[0].sessions,1);
assert.equal((await listRecentlyViewed(db,seller.id)).some(r=>r.objectId==='lot-109'),false,'self seller view must not enter recent history');
const cleared=await clearRecentlyViewed(db,buyer.id);assert.equal(cleared,1);assert.equal((await listRecentlyViewed(db,buyer.id)).length,0,'clearing recent history must erase account-linked view rows');

const cap=engagementCapabilities();
assert.equal(cap.windowMinutes,30);assert.equal(cap.anonymousRawIdentifiersStored,false);assert.equal(cap.sellerViewerIdentityExposed,false);
console.log('ANTIQUA v17 engagement: deduped passport views + self/staff exclusion + recent history privacy passed');
