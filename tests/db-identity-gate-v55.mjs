import assert from 'node:assert/strict';
import {appSecret} from '../security-v09.mjs';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  verifyDatabaseTarget,
  inspectDatabaseLineage,
  requireMigrationApproval,
  summarizeDatabaseInspection,
  permitsDemoSeeding
} from '../db-identity-gate-v55.mjs';
import {migrationVersions} from '../migration-manifest-v16.mjs';

const testUrl='postgresql://antiqua:antiqua@127.0.0.1:5432/antiqua_test';
const base={PREVIEW_MODE:'true',ANTIQUA_ISOLATED_TEST_DB:'true'};
const ref='abcdefghijklmnopqrst';
const managedUrl='postgresql://postgres.'+ref+':not-a-secret@aws-0-eu-central-1.pooler.supabase.com:5432/postgres';
const managed={PREVIEW_MODE:'true',ANTIQUA_CONFIRMED_SUPABASE_REF:ref,
  ANTIQUA_DB_IDENTITY_APPROVED:'true',ANTIQUA_EXTERNAL_MANAGED_SCHEMA:'true'};

function fails(fn,code){
  assert.throws(fn,e=>e instanceof Error&&e.message.includes('ANTIQUA_DB_GATE: '+code),code);
}
fails(()=>verifyDatabaseTarget(null),'DATABASE_URL_REQUIRED');
fails(()=>verifyDatabaseTarget('mysql://other/db'),'INVALID_DB_PROTOCOL');
fails(()=>verifyDatabaseTarget(testUrl,{}),'LOCAL_DB_TEST_ONLY');
fails(()=>verifyDatabaseTarget(testUrl,{...base,PREVIEW_MODE:'false'}),'LOCAL_DB_TEST_ONLY');
fails(()=>verifyDatabaseTarget(testUrl.replace('antiqua_test','other'),base),'ISOLATED_TEST_DB_MISMATCH');
assert.equal(verifyDatabaseTarget(testUrl,base).mode,'isolated-test');

fails(()=>verifyDatabaseTarget(managedUrl,{}),'CONFIRMED_PROJECT_REF_REQUIRED');
fails(()=>verifyDatabaseTarget(managedUrl,{...managed,ANTIQUA_CONFIRMED_SUPABASE_REF:'yiiylfzwfpicrzpbgazl'}),'NON_ANTIQUA_PROJECT_REF');
fails(()=>verifyDatabaseTarget(managedUrl,{...managed,ANTIQUA_CONFIRMED_SUPABASE_REF:'lnsrmbbtxzwclfvngvfl'}),'NON_ANTIQUA_PROJECT_REF');
fails(()=>verifyDatabaseTarget(managedUrl,{...managed,ANTIQUA_CONFIRMED_SUPABASE_REF:'yutrntnncubcssqbohco'}),'NON_ANTIQUA_PROJECT_REF');
fails(()=>verifyDatabaseTarget(managedUrl,{...managed,ANTIQUA_DB_IDENTITY_APPROVED:'false'}),'PRIMARY_PROJECT_EVIDENCE_REQUIRED');
fails(()=>verifyDatabaseTarget(managedUrl,{...managed,ANTIQUA_EXTERNAL_MANAGED_SCHEMA:'false'}),'EXTERNAL_SCHEMA_AUTHORITY_REQUIRED');
fails(()=>verifyDatabaseTarget(managedUrl.replace(':5432/',':6543/'),managed),'SESSION_POOLER_PORT_5432_REQUIRED');
fails(()=>verifyDatabaseTarget(managedUrl.replace('postgres.'+ref,'postgres.other'),managed),'POOLER_USERNAME_REF_MISMATCH');
fails(()=>verifyDatabaseTarget(managedUrl.replace('aws-0-eu-central-1.pooler.supabase.com','db.'+ref+'.supabase.co'),managed),'SUPAVISOR_SESSION_POOLER_REQUIRED');
fails(()=>verifyDatabaseTarget(managedUrl,{...managed,PGSSL:'disable'}),'SSL_REQUIRED');
fails(()=>verifyDatabaseTarget(managedUrl+'?sslmode=require',managed),'SSL_REQUIRED');
fails(()=>appSecret({...managed,DATABASE_URL:managedUrl}),'STRONG_APP_SECRET_REQUIRED');
fails(()=>appSecret({...managed,DATABASE_URL:managedUrl,APP_SECRET:'short'}),'STRONG_APP_SECRET_REQUIRED');
fails(()=>appSecret({...managed,DATABASE_URL:managedUrl,APP_SECRET:'antiqua-preview-secret-not-for-production'}),'STRONG_APP_SECRET_REQUIRED');
assert.equal(appSecret({...managed,DATABASE_URL:managedUrl,APP_SECRET:'dedicated-protected-not-reused-project-secret-2026'}),'dedicated-protected-not-reused-project-secret-2026');
assert.equal(appSecret({...base,DATABASE_URL:testUrl}),'antiqua-preview-secret-not-for-production');
const correct=verifyDatabaseTarget(managedUrl,managed);
assert.equal(correct.mode,'managed');
assert.equal(correct.projectRef,ref);

const expected=migrationVersions();
function mockPg({tables=[],versions=[],username='postgres',database='postgres',structuralChange=''}={}){
  let begun=false,rolledBack=false;
  return {
    get rolledBack(){return rolledBack},
    async query(sql){
      if(sql==='BEGIN READ ONLY'){begun=true;return{rows:[]}}
      if(sql==='ROLLBACK'){rolledBack=true;return{rows:[]}}
      assert.ok(begun,'inspection must start a read-only transaction');
      if(sql.includes('current_database()'))
        return{rows:[{database,username,search_path:'"$user", public'}]};
      if(sql.includes('pg_catalog.pg_tables'))
        return{rows:tables.map(tablename=>({tablename}))};
      if(sql.includes('public.schema_migrations'))
        return{rows:versions.map(version=>({version}))};
      if(sql.includes('pg_catalog.pg_attribute a'))
        return{rows:tables.map(table_name=>({table_name,attnum:1,attname:'id',data_type:'text',not_null:true}))};
      if(sql.includes('pg_catalog.pg_indexes'))
        return{rows:tables.includes('objects')?[{tablename:'objects',indexname:'objects_pkey',indexdef:'CREATE INDEX '+structuralChange}]:[]};
      if(sql.includes('pg_catalog.pg_constraint p'))
        return{rows:[]};
      if(sql.includes('c.relrowsecurity'))
        return{rows:tables.map(table_name=>({table_name,relrowsecurity:false,relforcerowsecurity:false}))};
      if(sql.includes('pg_catalog.pg_policies'))
        return{rows:[]};
      if(sql.includes('ANTIQUA_API_ROLES_V56'))return{rows:[{rolname:'anon'},{rolname:'authenticated'}]};
      if(sql.includes('ANTIQUA_API_RELATIONS_V56'))return{rows:[]};
      if(sql.includes('ANTIQUA_API_FUNCTIONS_V56'))return{rows:[]};
      if(sql.includes('ANTIQUA_API_SEQUENCES_V56'))return{rows:[]};
      if(sql.includes('ANTIQUA_API_SCHEMA_V57'))return{rows:[
        {role_name:'anon',can_use:false,can_create:false},
        {role_name:'authenticated',can_use:false,can_create:false}
      ]};
      if(sql.includes('ANTIQUA_API_DEFAULT_ACL_V57'))return{rows:[
        {owner_role:'postgres',schema_name:'<global>',object_type:'f',api_grants:false}
      ]};
      throw new Error('unexpected SQL: '+sql);
    }
  };
}
const empty=mockPg();
const emptyInventory=await inspectDatabaseLineage(empty);
assert.equal(empty.rolledBack,true);
assert.equal(emptyInventory.migrationCount,0);
assert.deepEqual(emptyInventory.pendingVersions,expected);
fails(()=>requireMigrationApproval(correct,emptyInventory,managed),'SCHEMA_INVENTORY_REVIEW_REQUIRED');
fails(()=>requireMigrationApproval(correct,emptyInventory,{
  ...managed,ANTIQUA_REVIEWED_DB_FINGERPRINT:'a'.repeat(64)
}),'SCHEMA_INVENTORY_CHANGED');
requireMigrationApproval(correct,emptyInventory,{
  ...managed,ANTIQUA_REVIEWED_DB_FINGERPRINT:emptyInventory.fingerprint
});
const output=JSON.stringify(summarizeDatabaseInspection(correct,emptyInventory));
assert.doesNotMatch(output,/not-a-secret/);

const some=mockPg({
  tables:['schema_migrations','accounts','objects','listings','auctions','media_assets'],
  versions:expected.slice(0,5)
});
const snapshot=await inspectDatabaseLineage(some);
assert.equal(snapshot.migrationCount,5);
assert.deepEqual(snapshot.pendingVersions,expected.slice(5));
assert.equal(some.rolledBack,true);

const foreign=mockPg({tables:['a_different_product_orders']});
await assert.rejects(()=>inspectDatabaseLineage(foreign),/UNRECOGNIZED_EXISTING_PUBLIC_SCHEMA/);
assert.equal(foreign.rolledBack,true);
const gap=mockPg({tables:['schema_migrations',...['accounts','objects','listings','auctions','media_assets']],
  versions:[expected[0],expected[2]]});
await assert.rejects(()=>inspectDatabaseLineage(gap),/UNEXPECTED_OR_GAPPED_MIGRATION_HISTORY/);
const wrongFoundation=mockPg({tables:['schema_migrations','accounts','objects'],
  versions:expected.slice(0,2)});
await assert.rejects(()=>inspectDatabaseLineage(wrongFoundation),/FOUNDATION_TABLES_MISSING/);
const complete=mockPg({
  tables:['schema_migrations','accounts','objects','listings','auctions','media_assets'],
  versions:expected
});
assert.deepEqual((await inspectDatabaseLineage(complete)).pendingVersions,[]);
const altered=mockPg({
  tables:['schema_migrations','accounts','objects','listings','auctions','media_assets'],
  versions:expected,structuralChange:' ALTERED_COLUMN'
});
const stableFingerprint=(await inspectDatabaseLineage(mockPg({
  tables:['schema_migrations','accounts','objects','listings','auctions','media_assets'],
  versions:expected
}))).fingerprint;
const changedFingerprint=(await inspectDatabaseLineage(altered)).fingerprint;
assert.notEqual(stableFingerprint,changedFingerprint,'schema changes must invalidate reviewed fingerprint');
assert.equal(expected.length,34);
// Managed Supabase must never receive seeded preview credentials or fake KYC.
// A configured PostgreSQL that fails to connect must not downgrade to memory.
assert.equal(permitsDemoSeeding(true,'MEMORY_FALLBACK',undefined,base),true);
assert.equal(permitsDemoSeeding(true,'MEMORY_FALLBACK',testUrl,base),false);
assert.equal(permitsDemoSeeding(false,'MEMORY_FALLBACK',undefined,base),false);
assert.equal(permitsDemoSeeding(true,'POSTGRES',testUrl,base),true);
assert.equal(permitsDemoSeeding(true,'POSTGRES',managedUrl,managed),false);
assert.equal(permitsDemoSeeding(false,'POSTGRES',testUrl,base),false);
const persistenceSrc=await readFile(new URL('../persistence-v09.mjs',import.meta.url),'utf8');
const runtimeSrc=await readFile(new URL('../runtime-v09.mjs',import.meta.url),'utf8');
assert.match(runtimeSrc,/permitsDemoSeeding\(PREVIEW,db\.kind,process\.env\.DATABASE_URL\)/);
assert.doesNotMatch(runtimeSrc,/if\(PREVIEW\)await seedAccounts\(db\)/);
assert.doesNotMatch(persistenceSrc,/Postgres unavailable; using preview memory fallback/);
assert.match(persistenceSrc,/A connection failure MUST halt startup/);
assert.match(runtimeSrc,/export const PREVIEW_DEMO=permitsDemoSeeding/);
assert.match(runtimeSrc,/if\(PREVIEW_DEMO\)\{for\(const l of lots\)/);
assert.doesNotMatch(runtimeSrc,/if\(PREVIEW\)\{for\(const l of lots\)/);
const serverSrc=await readFile(new URL('../server-v14.mjs',import.meta.url),'utf8');
const authSrc=await readFile(new URL('../routes-auth-v09.mjs',import.meta.url),'utf8');
assert.match(serverSrc,/if\(PREVIEW_DEMO&&\(url\.pathname/);
assert.doesNotMatch(serverSrc,/if\(PREVIEW&&\(url\.pathname/);
assert.match(authSrc,/if\(!PREVIEW_DEMO\)return send\(res,404/);
assert.match(authSrc,/currentPreviewCode:PREVIEW_DEMO\?totpCode\(secret\):undefined/);


// Prove entrypoints fail before any DNS, pool connection or DDL against a
// fake external Supabase DSN. The guard must not echo secrets in error output.
for(const file of ['../scripts/start-v52.mjs','../scripts/migrate-v14.mjs']){
  const child=spawnSync(process.execPath,[fileURLToPath(new URL(file,import.meta.url))],{
    encoding:'utf8',timeout:12000,
    env:{...process.env,DATABASE_URL:managedUrl,PREVIEW_MODE:'true',
      ANTIQUA_CONFIRMED_SUPABASE_REF:'',ANTIQUA_DB_IDENTITY_APPROVED:'false',
      ANTIQUA_EXTERNAL_MANAGED_SCHEMA:'true',ANTIQUA_MIGRATE_ON_START:'false'}
  });
  assert.equal(child.status,1,file+' must reject missing independent project proof');
  assert.match(child.stderr,/ANTIQUA_DB_GATE: CONFIRMED_PROJECT_REF_REQUIRED/);
  assert.doesNotMatch(child.stderr,/not-a-secret/,'never leak connection password');
}

// Old v09/v10 entrypoints are intentionally tombstoned: no alternate path to DDL.
for(const file of ['../scripts/migrate-v09.mjs','../scripts/migrate-v10.mjs']){
  const child=spawnSync(process.execPath,[fileURLToPath(new URL(file,import.meta.url))],{
    encoding:'utf8',timeout:12000,env:{...process.env,DATABASE_URL:managedUrl}
  });
  assert.equal(child.status,1,'legacy migration must fail');
  assert.match(child.stderr,/ANTIQUA_DB_GATE: LEGACY_MIGRATION_ENTRYPOINT_DISABLED/);
  assert.doesNotMatch(child.stderr,/not-a-secret/);
}

console.log('ANTIQUA v55 database identity and schema-lineage fail-closed tests PASS');
