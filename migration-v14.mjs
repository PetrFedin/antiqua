import {readFile} from 'node:fs/promises';
import {v14PlusMigrations} from './migration-manifest-v16.mjs';

export async function migrateV14(db){
  if(db?.kind!=='POSTGRES'||!db.pool)return {applied:false,reason:'MEMORY_FALLBACK'};
  const c=await db.pool.connect(),lockKey=4815162342;
  try{
    await c.query('SELECT pg_advisory_lock($1)',[lockKey]);
    for(const m of v14PlusMigrations){
      await c.query('BEGIN');
      try{
        await c.query(await readFile(m.path,'utf8'));
        await c.query('INSERT INTO schema_migrations(version) VALUES($1) ON CONFLICT(version) DO NOTHING',[m.version]);
        await c.query('COMMIT');
      }catch(e){await c.query('ROLLBACK');throw e}
    }
    return {applied:true,versions:v14PlusMigrations.map(x=>x.version)};
  }finally{try{await c.query('SELECT pg_advisory_unlock($1)',[lockKey])}catch{}c.release()}
}
