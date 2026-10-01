import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const runtime=await readFile(new URL('../runtime-v09.mjs',import.meta.url),'utf8');
assert.match(runtime,/ANTIQUA_EXTERNAL_MANAGED_SCHEMA/);
assert.match(runtime,/db\.kind==='POSTGRES'&&!EXTERNAL_MANAGED_SCHEMA/);
console.log('ANTIQUA external managed Postgres: runtime migration bypass contract passed');
