import {verifyDatabaseTarget} from '../db-identity-gate-v55.mjs';

// Fail closed before the preview/runtime can connect to any external database.
if(process.env.DATABASE_URL)verifyDatabaseTarget(process.env.DATABASE_URL);

const migrateOnStart=process.env.ANTIQUA_MIGRATE_ON_START==='true';

if(migrateOnStart){
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required when ANTIQUA_MIGRATE_ON_START=true');
  if(process.env.PREVIEW_MODE!=='true')throw new Error('ANTIQUA_DB_GATE: MIGRATE_ON_START_REQUIRES_PREVIEW');
  console.log('ANTIQUA startup bootstrap: applying managed migration manifest before server start');
  await import('./migrate-v14.mjs');
  console.log('ANTIQUA startup bootstrap: migration manifest applied');
}

await import('../server-v14.mjs');
