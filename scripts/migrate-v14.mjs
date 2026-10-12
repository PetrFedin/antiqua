import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {migrationManifest} from '../migration-manifest-v16.mjs';
import {
  verifyDatabaseTarget,
  inspectDatabaseLineage,
  requireMigrationApproval
} from '../db-identity-gate-v55.mjs';

if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const target=verifyDatabaseTarget(process.env.DATABASE_URL);
if(target.mode==='managed' && process.env.PREVIEW_MODE!=='true')
  throw new Error('ANTIQUA_DB_GATE: MIGRATION_REQUIRES_PREVIEW_MODE');

const pool=new Pool({
  connectionString:process.env.DATABASE_URL,
  ssl:process.env.PGSSL==='disable'?false:{rejectUnauthorized:false},
  max:1
});
let client;
const lockKey=4815162342;
let locked=false;

function normalizedMigrationSQL(sql,version){
  const hasBegin=/^\s*BEGIN\s*;/i.test(sql);
  const hasCommit=/COMMIT\s*;\s*$/i.test(sql);
  if(hasBegin!==hasCommit)throw new Error('ANTIQUA_DB_GATE: INVALID_TRANSACTION_WRAPPER '+version);
  // Some canonical SQL files contain their own outer BEGIN/COMMIT.
  // Remove only the two outer statements so the version marker and DDL share
  // a single transaction controlled by this runner.
  if(hasBegin)return sql.replace(/^\s*BEGIN\s*;/i,'').replace(/COMMIT\s*;\s*$/i,'').trim();
  return sql;
}

try{
  client=await pool.connect();
  await client.query('SELECT pg_advisory_lock($1)',[lockKey]);
  locked=true;

  // Database/project identity is checked before connection. The schema and
  // migration prefix must match before the first modifying SQL command.
  const snapshot=await inspectDatabaseLineage(client);
  requireMigrationApproval(target,snapshot);
  const remaining=migrationManifest.slice(snapshot.migrationCount);
  console.log('ANTIQUA migration admission passed; pending count:',remaining.length);

  for(const m of remaining){
    const sql=normalizedMigrationSQL(await readFile(m.path,'utf8'),m.version);
    await client.query('BEGIN');
    try{
      await client.query(sql);
      await client.query(
        'INSERT INTO public.schema_migrations(version) VALUES($1) ON CONFLICT(version) DO NOTHING',
        [m.version]
      );
      await client.query('COMMIT');
      console.log('Applied',m.file);
    }catch(e){
      await client.query('ROLLBACK');
      throw e;
    }
  }

  const actual=(await client.query(
    'SELECT version FROM public.schema_migrations ORDER BY version'
  )).rows.map(row=>row.version);
  const expected=migrationManifest.map(m=>m.version);
  if(JSON.stringify(actual)!==JSON.stringify(expected))
    throw new Error('ANTIQUA_DB_GATE: POST_MIGRATION_MANIFEST_MISMATCH');
  const complete=await inspectDatabaseLineage(client);
  if(complete.pendingVersions.length!==0)
    throw new Error('ANTIQUA_DB_GATE: POST_MIGRATION_LINEAGE_INCOMPLETE');
  // The same process may start the runtime immediately after migration. Its
  // inventory has legitimately changed; refresh only this process's approved
  // fingerprint. Subsequent deployments still require an independent review.
  if(target.mode==='managed')
    process.env.ANTIQUA_REVIEWED_DB_FINGERPRINT=complete.fingerprint;
  console.log('ANTIQUA schema migrations complete',actual.length,actual.at(-1));
}finally{
  if(client){
    if(locked)try{await client.query('SELECT pg_advisory_unlock($1)',[lockKey])}catch{}
    client.release();
  }
  await pool.end();
}
