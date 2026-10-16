import assert from 'node:assert/strict';
import {isPaintingCategory} from '../art-domain-v50.mjs';
import {collectionReviewQueue} from '../collection-publication-v73.mjs';
for(const medium of ['Painting','Watercolour','Oil painting','Живопись'])assert.equal(isPaintingCategory(medium),true);
for(const medium of ['Drawing','Engraving','Print','Furniture','Clock','гравюра','графика'])assert.equal(isPaintingCategory(medium),false);
await assert.rejects(collectionReviewQueue({id:'u',roles:['BUYER']}),e=>e.code==='POSTGRES_REQUIRED'||e.code==='FORBIDDEN');
console.log('v77 canonical painting-only and queue fail-closed smoke PASS');
