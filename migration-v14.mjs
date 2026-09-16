import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const migrations=[
 {version:'003_v14_e2e_lifecycles',file:'./migrations/003_v14_e2e_lifecycles.sql'},
 {version:'004_v14_verification_states',file:'./migrations/004_v14_verification_states.sql'},
 {version:'005_v14_account_object_flags',file:'./migrations/005_v14_account_object_flags.sql'}
].map(x=>({...x,path:fileURLToPath(new URL(x.file,import.meta.url))}));

export async function migrateV14(db){
  if(db?.kind!=='POSTGRES'||!db.pool)return {applied:false,reason:'MEMORY_FALLBACK'};
  const c=await db.pool.connect(),lockKey=4815162342;
  try{
    await c.query('SELECT pg_advisory_lock($1)',[lockKey]);
    for(const m of migrations){
      await c.query('BEGIN');
      try{await c.query(await readFile(m.path,'utf8'));await c.query('INSERT INTO schema_migrations(version) VALUES($1) ON CONFLICT(version) DO NOTHING',[m.version]);await c.query('COMMIT')}catch(e){await c.query('ROLLBACK');throw e}
    }
    return {applied:true,versions:migrations.map(x=>x.version)};
  }finally{try{await c.query('SELECT pg_advisory_unlock($1)',[lockKey])}catch{}c.release()}
}
