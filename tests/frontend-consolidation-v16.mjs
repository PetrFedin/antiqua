import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=resolve(fileURLToPath(new URL('..',import.meta.url)),'public');
const read=async p=>readFile(resolve(ROOT,p),'utf8');
async function listFiles(dir=ROOT){
  const out=[];
  for(const e of await readdir(dir,{withFileTypes:true})){
    const p=resolve(dir,e.name);
    if(e.isDirectory())out.push(...await listFiles(p));
    else out.push(relative(ROOT,p).replaceAll('\\\\','/'));
  }
  return out;
}
const publicFiles=(await listFiles()).sort();
for(const p of publicFiles){const parts=p.split('/');const versioned=parts.some(part=>/^v\\d+$/.test(part))||/(?:-addon)?-v\\d+|commerce-v\\d+|ux-v\\d+|experience-v\\d+/.test(p);assert.equal(versioned,false,'legacy versioned frontend asset remains: '+p)}
for(const p of ['index.html','styles.css','museum-resilience.css','art-direction.css','dossier-art-direction.css','artist-art-direction.css','collection-art-direction.css','main.js','app.js','operations.js','modules/mobile-navigation.js','modules/core.js','modules/discovery.js','modules/collection.js','modules/collection-publication-ui.js','modules/transactions.js','modules/cockpit.js','modules/seller-analytics.js','modules/dealer-interest.js','modules/engagement.js','modules/similarity.js','modules/auction-results.js','modules/inquiry.js','modules/offers.js','modules/services.js','modules/dealer-leads.js','modules/market-intelligence.js','modules/culture-discovery.js','modules/museum-open-access.js','modules/object-desire.js','modules/dossier-art-direction.js','modules/taste-signals.js','modules/partner-drops.js','modules/creators.js','modules/related-works.js','modules/artwork-dossier.js','modules/decision-readiness.js','modules/art-network.js','modules/cultural-calendar.js','modules/editorial-commerce.js','modules/partner-investor-showcase.js','modules/dealer-pilot-workspace.js','modules/pilot-counterparty.js','modules/pilot-verification.js','modules/pilot-launch.js'])assert.ok(publicFiles.includes(p),'canonical frontend asset missing: '+p);
const index=await read('index.html');
const styles=[...index.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/g)].map(x=>x[1]);
const scripts=[...index.matchAll(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/g)].map(x=>x[1]);
// One canonical base cascade plus one explicitly scoped museum failure-state
// companion. Keep an exact ordered allowlist: unknown/remote/legacy sheets fail.
assert.deepEqual(styles,['/styles.css','/museum-resilience.css','/art-direction.css','/dossier-art-direction.css','/artist-art-direction.css','/collection-art-direction.css']);
assert.deepEqual(scripts,['/main.js']);
assert.doesNotMatch(index,/(?:styles|app|operations)(?:-addon)?-v\d+/);
const museumCss=await read('museum-resilience.css');
assert.ok(museumCss.length>0 && Buffer.byteLength(museumCss,'utf8')<8192,'museum companion must remain small');
assert.doesNotMatch(museumCss,/@import\b|url\s*\(|!important/i,'museum companion cannot load assets or override authority with important');
const scopedRules=[...museumCss.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{/g)];
assert.ok(scopedRules.length>0,'museum companion must contain rules');
for(const [,raw] of scopedRules){
  const header=raw.trim();
  if(header.startsWith('@')){
    assert.match(header,/^@media\s*\((?:min|max)-width:\s*\d+px\)$/,'only viewport media queries are allowed');
    continue;
  }
  for(const selector of header.split(',').map(s=>s.trim())){
    assert.ok(selector.startsWith('.museum-') || selector==='.culture-hero-media [data-museum-open]:focus-visible','unscoped museum selector: '+selector);
  }
}

const editorialCss=await read('art-direction.css');
assert.ok(editorialCss.length>2500 && Buffer.byteLength(editorialCss,'utf8')<23000,'editorial sheet must be bounded');
assert.doesNotMatch(editorialCss,/@import\b|url\s*\(|!important|@font-face/i,'editorial sheet must be local and auditable');
assert.match(editorialCss,/\.culture-pathways\s*\{/);
assert.match(editorialCss,/\.museum-open-grid\s*\{/);
assert.match(editorialCss,/\.culture-art-study\s*\{/);
assert.doesNotMatch(editorialCss,/https?:\/\//i,'no third-party assets in visual layer');
assert.match(index,/id="mobileMoreDialog"/);
assert.match(index,/data-mobile-more/);
const roomCss=await read('dossier-art-direction.css');
assert.ok(roomCss.length>3500 && Buffer.byteLength(roomCss,'utf8')<12000,'dossier art direction budget');
assert.doesNotMatch(roomCss,/@import\b|url\s*\(|!important|@font-face|https?:\/\//i,'dossier CSS cannot import images, fonts or priority overrides');
assert.match(roomCss,/#dialog \.artwork-editorial-v68 \.dossier-hero img/);
assert.match(roomCss,/object-fit:contain/);
const artistCss=await read('artist-art-direction.css');
assert.ok(Buffer.byteLength(artistCss,'utf8')>4500 && Buffer.byteLength(artistCss,'utf8')<12500,'artist stylesheet must be locally bounded');
assert.doesNotMatch(artistCss,/@import\b|url\s*\(|!important|@font-face|https?:\/\//i,'artist stylesheet cannot fetch media/fonts or override authority');
assert.match(artistCss,/\.artist-profile-v69 \.creator-profile-hero/);
assert.match(artistCss,/\.artist-profile-v69 \.creator-work-card img/);
assert.match(artistCss,/object-fit:contain/);
const collectionCss=await read('collection-art-direction.css');
assert.ok(Buffer.byteLength(collectionCss,'utf8')>4000 && Buffer.byteLength(collectionCss,'utf8')<15000);
assert.doesNotMatch(collectionCss,/@import\b|url\s*\(|!important|@font-face|https?:\/\//i);
assert.match(collectionCss,/\.collection-studio-v70 \.collection-studio-card/);
assert.match(collectionCss,/\.collection-study-v70 \.collection-object img/);
const seen=new Set();
async function walk(rel){
  rel=rel.replace(/^\.\//,'');
  if(seen.has(rel))return;
  seen.add(rel);
  const source=await read(rel);
  for(const m of source.matchAll(/\bimport\s+(?:[^'"]+?\s+from\s+)?["']([^"']+)["']/g)){
    const spec=m[1];assert.ok(spec.startsWith('.'),`frontend import must stay local: ${rel} -> ${spec}`);
    const target=relative(ROOT,resolve(ROOT,dirname(rel),spec)).replaceAll('\\','/');
    assert.ok(!target.startsWith('..'),`frontend import escaped public root: ${target}`);
    assert.doesNotMatch(target,/(?:^|\/)v\d+(?:\/|-)|-v\d+\.js$/,`versioned runtime import remains: ${target}`);
    await walk(target);
  }
}
await walk('main.js');
const expected=['main.js','app.js','operations.js','modules/mobile-navigation.js','modules/core.js','modules/discovery.js','modules/collection.js','modules/collection-publication-ui.js','modules/transactions.js','modules/cockpit.js','modules/seller-analytics.js','modules/dealer-interest.js','modules/engagement.js','modules/similarity.js','modules/auction-results.js','modules/inquiry.js','modules/offers.js','modules/services.js','modules/dealer-leads.js','modules/market-intelligence.js','modules/culture-discovery.js','modules/museum-open-access.js','modules/object-desire.js','modules/dossier-art-direction.js','modules/taste-signals.js','modules/partner-drops.js','modules/creators.js','modules/related-works.js','modules/artwork-dossier.js','modules/decision-readiness.js','modules/art-network.js','modules/cultural-calendar.js','modules/editorial-commerce.js','modules/partner-investor-showcase.js','modules/dealer-pilot-workspace.js','modules/pilot-counterparty.js','modules/pilot-verification.js','modules/pilot-launch.js'].sort();
assert.deepEqual([...seen].sort(),expected);

const css=await read('styles.css');
assert.ok(css.length>90000,'canonical stylesheet appears incomplete');
for(const marker of ['styles-v07.css','styles-addon-v08.css','styles-addon-v09.css','styles-addon-v10.css','styles-v11.css','commerce-v11.css','styles-v12.css','styles-v13.css','styles-v14.css'])assert.match(css,new RegExp(marker.replaceAll('.','\\.')));
assert.match(css,/v16-cockpit/);assert.match(css,/v20-public-auction-results/);assert.match(css,/auction-result-card-v20/);assert.match(css,/v21-object-inquiry/);assert.match(css,/inquiry-context-v21/);assert.match(css,/v22-offer-negotiation/);assert.match(css,/v23-condition-viewing/);assert.match(css,/v24-dealer-lead-cockpit/);assert.match(css,/v25-market-intelligence/);assert.match(css,/v0\.26 · Culture of Objects/);assert.match(css,/v0\.27 · Object Desire Page/);assert.match(css,/v0\.28 · Explainable Taste Graph/);assert.match(css,/v0\.29 · Partner Drops \/ Fair Edition Engine/);assert.match(css,/v0\.30 · Creator & Gallery Graph/);assert.match(css,/v0\.31 · Editorial Commerce/);assert.match(css,/v0\.32 · Dealer Interest Signals/);assert.match(css,/Partner & Investor Showcase/);assert.match(css,/v0\.36 · Dealer Pilot Workspace/);assert.match(css,/v0\.37 · Real Dealer Pilot Authority/);assert.match(css,/v0\.38 · Counterparty Pilot Review/);assert.match(css,/v0\.39 · Independent Pilot Verification/);assert.match(css,/v0\.40 · Real Pilot Launch/);assert.match(css,/v0\.41 · Antiqua Art Network/);assert.match(css,/v0\.42 · Cultural Calendar/);

const collectionModule=await read('modules/collection.js');
const operationsModule=await read('operations.js');
assert.match(collectionModule,/id="v14CollectionArtworkForm"/);
assert.match(operationsModule,/f\.id==='v14CollectionArtworkForm'/);
assert.doesNotMatch(operationsModule,/v14CollectionObjectForm/);
assert.match(collectionCss,/\.collection-register-v70 \.collection-register-empty\[hidden\]\{display:none\}/);

const publicationUi=await read('modules/collection-publication-ui.js');
assert.match(publicationUi,/collectionReviewDecisionForm/);
assert.match(publicationUi,/data-collection-submit/);
assert.match(publicationUi,/api\/collection-publication\/queue/);
assert.match(publicationUi,/independently verified the rights documents/);
console.log('ANTIQUA frontend consolidation: canonical module graph, base cascade and scoped museum companion passed');
