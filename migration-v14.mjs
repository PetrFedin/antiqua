import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const migration=fileURLToPath(new URL('./migrations/003_v14_e2e_lifecycles.sql',import.meta.url));

export async function migrateV14(db){
  if(db?.kind!=='POSTGRES'||!db.pool)return {applied:false,reason:'MEMORY_FALLBACK'};
  await db.pool.query(await readFile(migration,'utf8'));
  return {applied:true,version:'003_v14_e2e_lifecycles'};
}
