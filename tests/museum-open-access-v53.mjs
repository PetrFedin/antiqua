import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const museum=readFileSync(new URL('../public/modules/museum-open-access.js',import.meta.url),'utf8');
const home=readFileSync(new URL('../public/modules/culture-discovery.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
const seed=readFileSync(new URL('../data-v08.mjs',import.meta.url),'utf8');
const server=readFileSync(new URL('../server-v14.mjs',import.meta.url),'utf8');

test('public-domain reference paintings are separated from sale inventory',()=>{
  assert.match(museum,/museum-artwork-badge/);
  assert.match(museum,/NOT FOR SALE/);
  assert.match(museum,/is_public_domain !== true/);
  assert.match(museum,/artwork_type_title !== 'Painting'/);
  assert.match(museum,/ID_PATTERN\.test/);
  assert.doesNotMatch(museum,/data-passport|data-save|currentBid|makeOffer|placeBid|saleType/);
});
test('featured Seurat uses a primary-source IIIF id and real attribution',()=>{
  assert.match(museum,/id: 27992, imageId: '2d484387-2509-5e8e-2c43-22f9981972eb'/);
  assert.match(museum,/Georges Seurat/);
  assert.match(museum,/Art Institute of Chicago/);
  assert.match(museum,/creativecommons\.org\/publicdomain\/zero/);
});
test('museum hero and independent gallery are wired into the gallery-first flow',()=>{
  assert.match(home,/featuredMuseumPainting/);
  assert.match(home,/museumImageUrl\(museum,843\)/);
  assert.match(home,/open\.dataset\.museumOpen/);
  assert.match(home,/root\.append\(museumGalleryPanel\(\)\)/);
  assert.doesNotMatch(home,/open\.dataset\.passport=f\.cover\.id/);
});
test('visual gallery is responsive and keeps missing external images honest',()=>{
  assert.match(css,/@media\(max-width:540px\).*?\.museum-open-access/s);
  assert.match(museum,/museum-image-unavailable/);
  assert.match(museum,/article\.dataset\.museumImageId = item\.imageId/);
  assert.match(museum,/sourceFor\(item\)/);
  assert.match(museum,/AbortController/);
  assert.match(museum,/museum-work-disclaimer/);
});
test('the existing mock sale lot never pretends to be a museum painting',()=>{
  assert.match(seed,/painting-placeholder\.svg/);
  assert.doesNotMatch(seed,/artic\.edu\/artworks/);
});

test('museum metadata fetch is narrowly allowed by the application CSP',()=>{
  assert.match(server,/connect-src 'self' https:\/\/api\.artic\.edu; frame-ancestors 'none'/);
  assert.doesNotMatch(server,/connect-src[^;]*\*/);
});
