import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Pool} from 'pg';

if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSL==='disable'?false:{rejectUnauthorized:false},max:1});
const client=await pool.connect(),lockKey=4815162342;
const files=['001_v09_foundation.sql','002_v10_collection_graph_and_auction_integrity.sql','003_v14_e2e_lifecycles.sql','004_v14_verification_states.sql','005_v14_account_object_flags.sql','006_v14_discovery_matches.sql','007_v14_ownership_history.sql','008_v15_financial_exactly_once.sql','009_v15_ownership_invariants.sql','010_v15_worker_outbox.sql','011_v15_durable_organizations.sql','012_v16_lifecycle_events.sql'];
try{
 await client.query('SELECT pg_advisory_lock($1)',[lockKey]);
 for(const file of files){const path=fileURLToPath(new URL(`../migrations/${file}`,import.meta.url)),sql=await readFile(path,'utf8'),version=file.replace(/\.sql$/,'');await client.query('BEGIN');try{await client.query(sql);await client.query('INSERT INTO schema_migrations(version) VALUES($1) ON CONFLICT(version) DO NOTHING',[version]);await client.query('COMMIT');console.log(`Applied ${file}`)}catch(e){await client.query('ROLLBACK');throw e}}
 const versions=(await client.query('SELECT version,applied_at FROM schema_migrations ORDER BY applied_at,version')).rows;console.log('ANTIQUA schema migrations complete',versions.map(x=>x.version).join(', '));
}finally{try{await client.query('SELECT pg_advisory_unlock($1)',[lockKey])}catch{}client.release();await pool.end()}
