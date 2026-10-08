import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const start=await readFile(new URL('../scripts/start-v52.mjs',import.meta.url),'utf8');
const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const runtime=await readFile(new URL('../runtime-v09.mjs',import.meta.url),'utf8');

assert.equal(pkg.scripts.start,'node scripts/start-v52.mjs');
assert.match(start,/ANTIQUA_MIGRATE_ON_START==='true'/);
assert.match(start,/DATABASE_URL is required when ANTIQUA_MIGRATE_ON_START=true/);
assert.match(start,/await import\('\.\/migrate-v14\.mjs'\)/);
assert.match(start,/await import\('\.\.\/server-v14\.mjs'\)/);
assert.ok(
  start.indexOf("await import('./migrate-v14.mjs')") <
  start.indexOf("await import('../server-v14.mjs')"),
  'migration bootstrap must execute before server/runtime import'
);
assert.match(runtime,/db\.kind==='POSTGRES'&&!EXTERNAL_MANAGED_SCHEMA/);
assert.doesNotMatch(runtime,/ANTIQUA_MIGRATE_ON_START/);

console.log('ANTIQUA v52 startup bootstrap: explicit migration-before-server contract passed');
