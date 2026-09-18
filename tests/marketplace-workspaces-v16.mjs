import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [app,css,market,core,collection]=await Promise.all([
  readFile(new URL('../public/app.js',import.meta.url),'utf8'),
  readFile(new URL('../public/styles.css',import.meta.url),'utf8'),
  readFile(new URL('../routes-market-v09.mjs',import.meta.url),'utf8'),
  readFile(new URL('../public/modules/core.js',import.meta.url),'utf8'),
  readFile(new URL('../public/modules/collection.js',import.meta.url),'utf8')
]);

for(const [name,pattern] of [
  ['purpose filter',/data-purpose-filter/],
  ['whole card dossier target',/data-open-passport/],
  ['auction timer',/data-auction-timer/],
  ['next bid calculation',/currentBid\)\+Number\(auction\.increment/],
  ['seller draft create',/sellerDraftCreateForm/],
  ['seller draft edit',/sellerDraftEditForm/],
  ['seller listing manager',/sellerListingForm/],
  ['private media upload',/\/api\/media\/upload-intent/]
])assert.match(app,pattern,name);

assert.match(css,/market-card-v16/,'compact marketplace card styles');
assert.match(css,/\.purpose-bar/,'purpose quick-filter styles');
assert.match(market,/manageListing=url\.pathname\.match/,'seller listing management route');assert.ok(market.includes('/api\\/seller\\/listings\\/'),'seller listing path');
assert.match(market,/LISTING_LIFECYCLE_LOCKED/,'listing lifecycle guard');
assert.match(market,/\['ACTIVE','INACTIVE'\]/,'only free listing visibility states are seller-managed');
assert.match(core,/safe\('\/api\/catalog'\)/,'account operations load catalogue choices');
assert.match(collection,/PUBLIC · .*витрин|PUBLIC · SHOWCASE/s,'public collections are explicit showcases');
assert.match(collection,/select name="objectId"/,'collection operations use object choices instead of raw ID entry');

console.log('ANTIQUA v16 marketplace workspaces: purpose-led cards + auction UX + seller controls + collection showcases contract passed');
