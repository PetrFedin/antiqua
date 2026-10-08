const migrateOnStart=process.env.ANTIQUA_MIGRATE_ON_START==='true';

if(migrateOnStart){
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required when ANTIQUA_MIGRATE_ON_START=true');
  console.log('ANTIQUA startup bootstrap: applying managed migration manifest before server start');
  await import('./migrate-v14.mjs');
  console.log('ANTIQUA startup bootstrap: migration manifest applied');
}

await import('../server-v14.mjs');
