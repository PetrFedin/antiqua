import assert from 'node:assert/strict';
import {evaluateProductionAdmission} from '../production-admission-v49.mjs';
import {migrationVersions} from '../migration-manifest-v16.mjs';

const expected=migrationVersions();

const ready=evaluateProductionAdmission({
  persistenceKind:'POSTGRES',
  databaseConfigured:true,
  preview:false,
  externalManagedSchema:true,
  appliedVersions:expected,
  commit:'abc123'
});
assert.equal(ready.productionReady,true);
assert.equal(ready.status,'READY');
assert.equal(ready.migrations.expectedHead,'033_v46_independent_passport_verification');
assert.equal(ready.migrations.exact,true);
assert.deepEqual(ready.blockers,[]);

const memory=evaluateProductionAdmission({
  persistenceKind:'MEMORY_FALLBACK',
  databaseConfigured:false,
  preview:true,
  externalManagedSchema:false,
  appliedVersions:null
});
assert.equal(memory.productionReady,false);
assert.ok(memory.blockers.includes('DATABASE_URL_MISSING'));
assert.ok(memory.blockers.includes('PERSISTENCE_NOT_POSTGRES'));
assert.ok(memory.blockers.includes('PREVIEW_MODE_ENABLED'));
assert.ok(memory.blockers.includes('EXTERNAL_MANAGED_SCHEMA_DISABLED'));

const drift=evaluateProductionAdmission({
  persistenceKind:'POSTGRES',
  databaseConfigured:true,
  preview:false,
  externalManagedSchema:true,
  appliedVersions:expected.slice(0,-1)
});
assert.equal(drift.productionReady,false);
assert.ok(drift.blockers.includes('MIGRATION_DRIFT'));
assert.deepEqual(drift.migrations.missing,['033_v46_independent_passport_verification']);

console.log('production admission v49 PASS');
