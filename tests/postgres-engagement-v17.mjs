import assert from 'node:assert/strict';
import {db} from '../runtime-v09.mjs';
import {recordObjectView,aggregateObjectViews,listRecentlyViewed,clearRecentlyViewed} from '../engagement-v17.mjs';

if(!process.env.DATABASE_URL){
 console.log('ANTIQUA v17 PostgreSQL engagement: skipped (DATABASE_URL not set)');
 process.exit(0);
}
assert.equal(db.kind,'POSTGRES');
const buyer=await db.findAccountByEmail('buyer@demo.antiqua');
const seller=await db.findAccountByEmail('seller@demo.antiqua');
assert.ok(buyer?.id&&seller?.sellerId);

const t=Math.floor(Date.now()/(30*60*1000))*(30*60*1000)+60_000,req={headers:{'x-forwarded-for':'203.0.113.91','user-agent':'Postgres engagement proof'},socket:{remoteAddress:'127.0.0.1'}};
const first=await recordObjectView(db,req,buyer,'lot-109',{at:t,ownerSellerId:seller.sellerId});
await recordObjectView(db,req,buyer,'lot-109',{at:t+60_000,ownerSellerId:seller.sellerId});

const direct=(await db.pool.query("SELECT object_id,account_id,viewer_key_hash,window_started_at,first_viewed_at,last_viewed_at FROM object_view_events WHERE object_id='lot-109' AND account_id=$1 AND window_started_at=$2",[buyer.id,first.view.windowStartedAt])).rows;
assert.equal(direct.length,1,'PostgreSQL unique window authority must deduplicate repeated view');
assert.match(direct[0].viewer_key_hash,/^[0-9a-f]{64}$/);
assert.ok(direct[0].last_viewed_at>=direct[0].first_viewed_at);

const cols=(await db.pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='object_view_events'")).rows.map(r=>r.column_name);
assert.equal(cols.includes('ip'),false);assert.equal(cols.includes('user_agent'),false);assert.equal(cols.includes('raw_identifier'),false);

const recent=await listRecentlyViewed(db,buyer.id);
assert.equal(recent[0].objectId,'lot-109');assert.equal(recent[0].sessions,1);
const views=await aggregateObjectViews(db,['lot-109'],{excludeAccountId:seller.id});
assert.ok(views['lot-109'].views>=1);

const cleared=await clearRecentlyViewed(db,buyer.id);assert.ok(cleared>=1);assert.equal((await listRecentlyViewed(db,buyer.id)).length,0);

await assert.rejects(()=>db.pool.query("INSERT INTO object_view_events(id,object_id,viewer_key_hash,window_started_at,first_viewed_at,last_viewed_at) VALUES('view-orphan-proof','missing-object','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',now(),now(),now())"),e=>e.code==='23503');
console.log('ANTIQUA v17 PostgreSQL engagement: durable dedupe + object FK + recent projection + no raw network identifiers passed');
