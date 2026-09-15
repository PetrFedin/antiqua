import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Pool} from 'pg';

if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSL==='disable'?false:{rejectUnauthorized:false},max:1});
const client=await pool.connect();
const lockKey=4815162342;
try{
  await client.query('SELECT pg_advisory_lock($1)',[lockKey]);
  for(const file of ['001_v09_foundation.sql','002_v10_collection_graph_and_auction_integrity.sql']){
    const path=fileURLToPath(new URL(`../migrations/${file}`,import.meta.url));
    const sql=await readFile(path,'utf8');
    await client.query(sql);
    console.log(`Applied ${file}`);
  }
  const versions=(await client.query('SELECT version,applied_at FROM schema_migrations ORDER BY applied_at,version')).rows;
  console.log('ANTIQUA schema migrations complete',versions.map(x=>x.version).join(', '));
}finally{
  try{await client.query('SELECT pg_advisory_unlock($1)',[lockKey])}catch{}
  client.release();
  await pool.end();
}
