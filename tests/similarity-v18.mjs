import assert from 'node:assert/strict';
import {similarObjectsFor,similarityCapabilities} from '../similarity-v18.mjs';

const cap=similarityCapabilities();
assert.equal(cap.method,'CATALOGUE_RULES_V1');
assert.equal(cap.personalized,false);
assert.equal(cap.behavioralInputs,false);
assert.equal(cap.opaqueScore,false);

const a=await similarObjectsFor('lot-109',{limit:4});
assert.ok(a);assert.equal(a.source.id,'lot-109');assert.ok(a.items.length>=1&&a.items.length<=4);
assert.equal(a.items.some(x=>x.id==='lot-109'),false,'source object must never recommend itself');
assert.equal(a.items[0].id,'lot-107','same-department works-on-paper candidate with overlapping material, period and origin should lead lot-109 similarity');
assert.ok(a.items[0].reasons.some(x=>x.code==='SAME_DEPARTMENT'));
assert.ok(a.items[0].reasons.some(x=>x.code==='PERIOD_OVERLAP'));
assert.equal(JSON.stringify(a).includes('"score"'),false,'no opaque similarity score may be exposed');
assert.equal(JSON.stringify(a).includes('PRICE_PROXIMITY'),false,'price must not influence or explain artistic similarity');

const again=await similarObjectsFor('lot-109',{limit:4});
assert.deepEqual(again.items.map(x=>x.id),a.items.map(x=>x.id),'ranking must be deterministic');
assert.deepEqual(again.items.map(x=>x.reasons.map(r=>r.code)),a.items.map(x=>x.reasons.map(r=>r.code)),'reasons must be deterministic');

const print=await similarObjectsFor('lot-103',{limit:12});assert.ok(print.items.some(x=>x.reasons.some(r=>r.code==='SAME_DEPARTMENT')),'print similarity should preserve the canonical artwork department signal');

const one=await similarObjectsFor('lot-109',{limit:1});assert.equal(one.items.length,1);
assert.equal(await similarObjectsFor('missing-object'),null);
console.log('ANTIQUA v18 similarity: deterministic catalogue rules + explicit reasons + no personalization/opaque score passed');
