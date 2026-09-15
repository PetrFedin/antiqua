import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const migration=fileURLToPath(new URL('./migrations/002_v10_collection_graph_and_auction_integrity.sql',import.meta.url));

export async function migrateV10(db){
  if(db?.kind!=='POSTGRES'||!db.pool)return {applied:false,reason:'MEMORY_FALLBACK'};
  const sql=await readFile(migration,'utf8');
  await db.pool.query(sql);
  return {applied:true,version:'002_v10_collection_graph_and_auction_integrity'};
}
