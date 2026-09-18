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
for(const p of publicFiles)assert.doesNotMatch(p,/(?:^|\\/)(?:v\\d+)(?:\\/|$)|(?:-addon)?-v\\d+|commerce-v\\d+|ux-v\\d+|experience-v\\d+/, 'legacy versioned frontend asset remains: '+p);
for(const p of ['index.html','styles.css','main.js','app.js','operations.js','modules/core.js','modules/discovery.js','modules/collection.js','modules/transactions.js','modules/cockpit.js'])assert.ok(publicFiles.includes(p),'canonical frontend asset missing: '+p);
const index=await read('index.html');
const styles=[...index.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/g)].map(x=>x[1]);
const scripts=[...index.matchAll(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/g)].map(x=>x[1]);
assert.deepEqual(styles,['/styles.css']);
assert.deepEqual(scripts,['/main.js']);
assert.doesNotMatch(index,/(?:styles|app|operations)(?:-addon)?-v\d+/);

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
const expected=['main.js','app.js','operations.js','modules/core.js','modules/discovery.js','modules/collection.js','modules/transactions.js','modules/cockpit.js'].sort();
assert.deepEqual([...seen].sort(),expected);

const css=await read('styles.css');
assert.ok(css.length>90000,'canonical stylesheet appears incomplete');
for(const marker of ['styles-v07.css','styles-addon-v08.css','styles-addon-v09.css','styles-addon-v10.css','styles-v11.css','commerce-v11.css','styles-v12.css','styles-v13.css','styles-v14.css'])assert.match(css,new RegExp(marker.replaceAll('.','\\.')));
assert.match(css,/v16-cockpit/);
console.log('ANTIQUA v16 frontend consolidation: single entrypoint + canonical module graph + preserved CSS cascade passed');
