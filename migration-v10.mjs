import {readFile} from 'node:fs/promises';
import {v10Migration} from './migration-manifest-v16.mjs';

export async function migrateV10(db){
  if(db?.kind!=='POSTGRES'||!db.pool)return {applied:false,reason:'MEMORY_FALLBACK'};
  const sql=await readFile(v10Migration.path,'utf8');
  await db.pool.query(sql);
  return {applied:true,version:v10Migration.version};
}
