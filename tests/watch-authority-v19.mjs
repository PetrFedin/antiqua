import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const market=await readFile(new URL('../routes-market-v09.mjs',import.meta.url),'utf8');
const preferences=await readFile(new URL('../routes-preferences-v14.mjs',import.meta.url),'utf8');
const watch=await readFile(new URL('../watch-events-v19.mjs',import.meta.url),'utf8');
assert.equal(market.includes("const save=url.pathname.match"),false,'legacy market preference mutation route must stay removed');
assert.match(preferences,/\(save\|collect\|alert\)/,'preferences route must remain the single object-flag HTTP authority');
assert.match(watch,/enqueueOutboxTx/,'PostgreSQL WATCH notification effects must use transactional outbox');
assert.match(watch,/WATCH_LISTING_CHANGED/);
assert.match(watch,/WATCH_AUCTION_ACTIVITY/);
console.log('ANTIQUA v19 WATCH authority: one preference route + transactional event delivery contract passed');
