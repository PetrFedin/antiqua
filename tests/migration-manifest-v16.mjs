import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {migrationManifest,baselineMigration,v10Migration,v14PlusMigrations,migrationVersions} from '../migration-manifest-v16.mjs';

assert.equal(migrationManifest.length,18);
assert.equal(new Set(migrationVersions()).size,migrationManifest.length,'migration versions must be unique');
assert.equal(baselineMigration.version,'001_v09_foundation');
assert.equal(v10Migration.version,'002_v10_collection_graph_and_auction_integrity');
assert.equal(v14PlusMigrations[0].version,'003_v14_e2e_lifecycles');
assert.equal(v14PlusMigrations.at(-1).version,'018_v23_condition_viewing');

for(let i=0;i<migrationManifest.length;i++){
 const m=migrationManifest[i],prefix=String(i+1).padStart(3,'0')+'_';
 assert.ok(m.file.startsWith(prefix),`migration order mismatch at ${m.file}`);
 const sql=await readFile(m.path,'utf8');
 assert.ok(sql.trim().length>0,`migration ${m.file} is empty`);
}

console.log('ANTIQUA v23 migration manifest: one ordered authority 001..018 with complete files passed');
