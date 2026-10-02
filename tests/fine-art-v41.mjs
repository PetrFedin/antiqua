import assert from 'node:assert/strict';
import {lots} from '../data-v08.mjs';
import {fineArtClassificationFor,isFineArtPublished,fineArtCapabilities} from '../fine-art-v41.mjs';

const painting=lots.find(x=>x.id==='lot-104');
const legacy=lots.find(x=>x.id==='lot-101');
const demo=lots.find(x=>x.id==='lot-203');

assert.equal(fineArtClassificationFor(painting)?.workType,'PAINTING');
assert.equal(isFineArtPublished(painting),true);
assert.equal(isFineArtPublished(legacy),false);
assert.equal(isFineArtPublished(demo),true);
assert.equal(fineArtClassificationFor(demo)?.workType,'ETCHING');
assert.equal(isFineArtPublished({id:'candidate',galleryClassification:{status:'CANDIDATE',workType:'PAINTING'}}),false);
assert.equal(fineArtCapabilities().automatedMappingMayPublish,false);
assert.equal(fineArtCapabilities().legacyDirectAccess,true);
console.log('ANTIQUA v41 fine-art projection: explicit publication + legacy isolation passed');
