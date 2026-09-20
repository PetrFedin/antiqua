import assert from 'node:assert/strict';
import {db} from '../runtime-v09.mjs';
import {setObjectFlag} from '../preferences-v14.mjs';
import {sellerAnalyticsFor} from '../seller-analytics-v17.mjs';

if(!process.env.DATABASE_URL){
 console.log('ANTIQUA v17 PostgreSQL seller analytics: skipped (DATABASE_URL not set)');
 process.exit(0);
}

const seller=await db.findAccountByEmail('seller@demo.antiqua');
const buyer=await db.findAccountByEmail('buyer@demo.antiqua');
assert.equal(db.kind,'POSTGRES');
assert.ok(seller?.sellerId);
assert.ok(buyer?.id);

await setObjectFlag(db,buyer.id,'lot-109','SAVED',true);
const a=await sellerAnalyticsFor(seller);
const row=a.objects.find(x=>x.objectId==='lot-109');
assert.ok(row,'seller-owned listing object must be present');
assert.ok(row.saved>=1,'PostgreSQL account_object_flags must feed seller analytics');
assert.equal(a.measurement.viewsTracked,true);
 assert.equal(a.measurement.viewDefinition,'DEDUPED_30_MINUTE_PASSPORT_SESSIONS');
assert.equal(a.measurement.visitorIdentityExposed,false);
assert.equal(typeof a.summary.settledByCurrency,'object');
assert.equal(JSON.stringify(a).includes(buyer.id),false,'buyer account identity must not be exposed');
console.log('ANTIQUA v17 PostgreSQL seller analytics: durable event + view-session aggregation + privacy boundary passed');
