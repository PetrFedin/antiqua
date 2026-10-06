import assert from 'node:assert/strict';
import {lots} from '../data-v08.mjs';
import {publicArtworkEligible,filterPublicArtworks,artworkScopeVersion} from '../artwork-scope-v43.mjs';

assert.equal(artworkScopeVersion,'v43-artwork-first');
assert.equal(filterPublicArtworks(lots).length,lots.length,'all preview lots must be artwork-eligible');
for(const work of lots)assert.equal(publicArtworkEligible(work),true,`${work.id} must be artwork-eligible`);

const rejected=[
 {department:{en:'European Furniture'},title:{en:'Walnut commode'},materials:{en:'Walnut, brass'}},
 {department:{en:'Silver'},title:{en:'Pair of candlesticks'},materials:{en:'Silver'}},
 {department:{en:'Sculpture'},title:{en:'Bronze bust'},materials:{en:'Bronze'}},
 {department:{en:'Books & Manuscripts'},title:{en:'Illuminated manuscript leaf'},materials:{en:'Parchment'}}
];
for(const item of rejected)assert.equal(publicArtworkEligible(item),false,`${item.title.en} must be excluded`);

const accepted=[
 {department:{en:'Painting'},materials:{en:'Oil on canvas'}},
 {department:{en:'Drawing'},materials:{en:'Graphite on paper'}},
 {department:{en:'Print'},technique:{en:'Etching'}},
 {department:{en:'Works on Paper'},technique:{en:'Watercolour'}}
];
for(const item of accepted)assert.equal(publicArtworkEligible(item),true);

console.log('v0.43 artwork scope: PASS');
