import {createHash} from 'node:crypto';
import {migrationVersions} from './migration-manifest-v16.mjs';

// Negative identities come from independently verified projects, not a guessed Antiqua ref.
// The allow-ref must come from a fresh, reviewed Supabase management API response.
const EXCLUDED_REFS=new Set([
  'yutrntnncubcssqbohco', // Fintech; old, invalid Antiqua attribution
  'lnsrmbbtxzwclfvngvfl', // Marco Pescarolo
  'yiiylfzwfpicrzpbgazl'  // MFW
]);
const LOOPBACKS=new Set(['localhost','127.0.0.1','[::1]']);
const ISOLATED_DB_NAMES=new Set(['antiqua_test','antiqua_storage_test']);
const FOUNDATIONAL_TABLES=['accounts','objects','listings','auctions','media_assets'];
function stop(code){throw new Error('ANTIQUA_DB_GATE: '+code)}

export function verifyDatabaseTarget(connectionString,env=process.env){
  if(typeof connectionString!=='string'||!connectionString.trim())stop('DATABASE_URL_REQUIRED');
  let url;
  try{url=new URL(connectionString)}catch{stop('DATABASE_URL_INVALID')}
  if(!['postgres:','postgresql:'].includes(url.protocol))stop('INVALID_DB_PROTOCOL');
  const host=url.hostname.toLowerCase();
  const dbName=decodeURIComponent(url.pathname.replace(/^\//,''));
  const username=decodeURIComponent(url.username);
  if(LOOPBACKS.has(host)){
    if(env.ANTIQUA_ISOLATED_TEST_DB!=='true'||env.PREVIEW_MODE!=='true')stop('LOCAL_DB_TEST_ONLY');
    if(!ISOLATED_DB_NAMES.has(dbName)||username!=='antiqua')stop('ISOLATED_TEST_DB_MISMATCH');
    return Object.freeze({mode:'isolated-test',database:dbName,projectRef:null});
  }

  // No implicit approval: even the correct-looking URL cannot attest that it
  // actually belongs to Antiqua. The owner must independently review metadata.
  const ref=String(env.ANTIQUA_CONFIRMED_SUPABASE_REF||'').trim();
  if(!/^[a-z0-9]{20}$/.test(ref))stop('CONFIRMED_PROJECT_REF_REQUIRED');
  if(EXCLUDED_REFS.has(ref))stop('NON_ANTIQUA_PROJECT_REF');
  if(env.ANTIQUA_DB_IDENTITY_APPROVED!=='true')stop('PRIMARY_PROJECT_EVIDENCE_REQUIRED');
  if(env.ANTIQUA_EXTERNAL_MANAGED_SCHEMA!=='true')stop('EXTERNAL_SCHEMA_AUTHORITY_REQUIRED');
  if(!host.endsWith('.pooler.supabase.com'))stop('SUPAVISOR_SESSION_POOLER_REQUIRED');
  if(url.port!=='5432')stop('SESSION_POOLER_PORT_5432_REQUIRED');
  if(username!=='postgres.'+ref)stop('POOLER_USERNAME_REF_MISMATCH');
  if(dbName!=='postgres')stop('DB_NAME_MISMATCH');
  if(env.PGSSL==='disable'||(url.searchParams.has('sslmode')&&url.searchParams.get('sslmode')!=='verify-full'))stop('SSL_REQUIRED');
  return Object.freeze({mode:'managed',database:dbName,projectRef:ref});
}

// Preview credentials and seeded VERIFIED KYC/KYB demo accounts must never
// be written to a managed PostgreSQL, including while PREVIEW_MODE=true.
export function permitsDemoSeeding(preview,dbKind,databaseUrl,env=process.env){
  if(!preview)return false;
  if(dbKind==='MEMORY_FALLBACK')return !databaseUrl;
  if(dbKind!=='POSTGRES'||!databaseUrl)return false;
  return verifyDatabaseTarget(databaseUrl,env).mode==='isolated-test';
}

export async function inspectDatabaseLineage(client){
  await client.query('BEGIN READ ONLY');
  try{
    const identity=(await client.query(
      "SELECT current_database() AS database, current_user AS username, current_setting('search_path') AS search_path"
    )).rows[0];
    const tables=(await client.query(
      "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename"
    )).rows.map(x=>x.tablename);
    const hasHistory=tables.includes('schema_migrations');
    const applied=hasHistory?(await client.query(
      'SELECT version FROM public.schema_migrations ORDER BY version'
    )).rows.map(x=>x.version):[];
    const expected=migrationVersions();

    // Never run Antiqua migrations against a populated foreign or corrupt schema.
    if(!hasHistory&&tables.length>0)stop('UNRECOGNIZED_EXISTING_PUBLIC_SCHEMA');
    if(hasHistory&&applied.length===0)stop('EMPTY_UNEXPECTED_MIGRATION_HISTORY');
    if(applied.length>expected.length)stop('MIGRATION_HISTORY_TOO_LONG');
    if(applied.some((v,i)=>v!==expected[i]))stop('UNEXPECTED_OR_GAPPED_MIGRATION_HISTORY');
    if(applied.length&&FOUNDATIONAL_TABLES.some(t=>!tables.includes(t)))stop('FOUNDATION_TABLES_MISSING');

    const inventory={
      database:identity.database,
      username:identity.username,
      searchPath:identity.search_path,
      publicTables:tables,
      appliedVersions:applied
    };
    const fingerprint=createHash('sha256').update(JSON.stringify(inventory)).digest('hex');
    return Object.freeze({
      ...inventory,
      fingerprint,
      pendingVersions:expected.slice(applied.length),
      migrationCount:applied.length,
      expectedCount:expected.length
    });
  }finally{await client.query('ROLLBACK')}
}

export function requireMigrationApproval(target,inventory,env=process.env){
  if(target.database!==inventory.database)stop('CONNECTED_DATABASE_MISMATCH');
  if(target.mode==='isolated-test')return;
  if(inventory.username!=='postgres')stop('CONNECTED_ROLE_MISMATCH');
  const reviewed=String(env.ANTIQUA_REVIEWED_DB_FINGERPRINT||'').trim().toLowerCase();
  if(!/^[0-9a-f]{64}$/.test(reviewed))stop('SCHEMA_INVENTORY_REVIEW_REQUIRED');
  if(reviewed!==inventory.fingerprint)stop('SCHEMA_INVENTORY_CHANGED');
}

export function summarizeDatabaseInspection(target,inventory){
  // No passwords, DSNs or authentication tokens in stdout / CI artifacts.
  return {
    mode:target.mode,
    database:inventory.database,
    role:inventory.username,
    searchPath:inventory.searchPath,
    projectRef:target.projectRef,
    appliedVersions:inventory.appliedVersions,
    pendingVersions:inventory.pendingVersions,
    publicTables:inventory.publicTables,
    schemaFingerprint:inventory.fingerprint
  };
}
