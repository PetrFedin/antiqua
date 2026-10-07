import {db,PREVIEW,EXTERNAL_MANAGED_SCHEMA} from './runtime-v09.mjs';
import {migrationManifest} from './migration-manifest-v16.mjs';

const expectedVersions=migrationManifest.map(x=>x.version);
const expectedHead=expectedVersions.at(-1)||null;

export function evaluateProductionAdmission({
  persistenceKind,
  databaseConfigured,
  preview,
  externalManagedSchema,
  appliedVersions=null,
  commit=null
}={}){
  const applied=Array.isArray(appliedVersions)?appliedVersions:null;
  const missing=applied?expectedVersions.filter(v=>!applied.includes(v)):[];
  const unexpected=applied?applied.filter(v=>!expectedVersions.includes(v)):[];
  const migrationsExact=Boolean(applied&&missing.length===0&&unexpected.length===0&&applied.length===expectedVersions.length);
  const blockers=[];

  if(!databaseConfigured)blockers.push('DATABASE_URL_MISSING');
  if(persistenceKind!=='POSTGRES')blockers.push('PERSISTENCE_NOT_POSTGRES');
  if(preview)blockers.push('PREVIEW_MODE_ENABLED');
  if(!externalManagedSchema)blockers.push('EXTERNAL_MANAGED_SCHEMA_DISABLED');
  if(persistenceKind==='POSTGRES'&&!applied)blockers.push('MIGRATION_CHECK_UNAVAILABLE');
  if(persistenceKind==='POSTGRES'&&applied&&!migrationsExact)blockers.push('MIGRATION_DRIFT');

  return {
    status:blockers.length?'BLOCKED':'READY',
    productionReady:blockers.length===0,
    commit:commit||null,
    runtime:{
      persistence:persistenceKind||'UNKNOWN',
      databaseConfigured:Boolean(databaseConfigured),
      previewMode:Boolean(preview),
      externalManagedSchema:Boolean(externalManagedSchema)
    },
    migrations:{
      expectedCount:expectedVersions.length,
      expectedHead,
      appliedCount:applied?applied.length:null,
      appliedHead:applied?.at(-1)||null,
      exact:migrationsExact,
      missing,
      unexpected
    },
    blockers
  };
}

export async function productionAdmissionSnapshot(){
  let appliedVersions=null;
  let migrationCheckError=null;
  if(db.kind==='POSTGRES'){
    try{
      appliedVersions=(await db.pool.query('SELECT version FROM schema_migrations ORDER BY version')).rows.map(x=>x.version);
    }catch(e){
      migrationCheckError=e?.message||'Migration check failed';
    }
  }
  const snapshot=evaluateProductionAdmission({
    persistenceKind:db.kind,
    databaseConfigured:Boolean(process.env.DATABASE_URL),
    preview:PREVIEW,
    externalManagedSchema:EXTERNAL_MANAGED_SCHEMA,
    appliedVersions,
    commit:process.env.RENDER_GIT_COMMIT||process.env.GIT_COMMIT||null
  });
  if(migrationCheckError){
    if(!snapshot.blockers.includes('MIGRATION_CHECK_UNAVAILABLE'))snapshot.blockers.push('MIGRATION_CHECK_UNAVAILABLE');
    snapshot.status='BLOCKED';
    snapshot.productionReady=false;
    snapshot.migrations.checkError='UNAVAILABLE';
  }
  return snapshot;
}
