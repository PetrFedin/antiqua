import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const migrations=['./migrations/003_v14_e2e_lifecycles.sql','./migrations/004_v14_verification_states.sql'].map(p=>fileURLToPath(new URL(p,import.meta.url)));

export async function migrateV14(db){
  if(db?.kind!=='POSTGRES'||!db.pool)return {applied:false,reason:'MEMORY_FALLBACK'};
  for(const file of migrations)await db.pool.query(await readFile(file,'utf8'));
  return {applied:true,versions:['003_v14_e2e_lifecycles','004_v14_verification_states']};
}
