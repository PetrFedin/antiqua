import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {migrationManifest} from '../migration-manifest-v16.mjs';

if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSL==='disable'?false:{rejectUnauthorized:false},max:1});
const client=await pool.connect(),lockKey=4815162342;
try{
 await client.query('SELECT pg_advisory_lock($1)',[lockKey]);
 for(const m of migrationManifest){
  const sql=await readFile(m.path,'utf8');
  await client.query('BEGIN');
  try{
   await client.query(sql);
   await client.query('INSERT INTO schema_migrations(version) VALUES($1) ON CONFLICT(version) DO NOTHING',[m.version]);
   await client.query('COMMIT');
   console.log(`Applied ${m.file}`);
  }catch(e){await client.query('ROLLBACK');throw e}
 }
 const versions=(await client.query('SELECT version,applied_at FROM schema_migrations ORDER BY applied_at,version')).rows;
 console.log('ANTIQUA schema migrations complete',versions.map(x=>x.version).join(', '));
}finally{
 try{await client.query('SELECT pg_advisory_unlock($1)',[lockKey])}catch{}
 client.release();
 await pool.end();
}
