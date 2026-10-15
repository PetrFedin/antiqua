import {Pool} from 'pg';
import {
  verifyDatabaseTarget,
  inspectDatabaseLineage,
  summarizeDatabaseInspection
} from '../db-identity-gate-v55.mjs';

if(!process.env.DATABASE_URL)
  throw new Error('ANTIQUA_DB_GATE: DATABASE_URL_REQUIRED');
const target=verifyDatabaseTarget(process.env.DATABASE_URL);
const pool=new Pool({
  connectionString:process.env.DATABASE_URL,
  ssl:process.env.PGSSL==='disable'?false:{rejectUnauthorized:true},
  max:1
});
let client;
try{
  client=await pool.connect();
  const inventory=await inspectDatabaseLineage(client);
  // This command never performs DDL/DML and never prints credentials.
  // Owner reviews the inventory and fingerprint out of band before allowing
  // the migration runner to connect with ANTIQUA_REVIEWED_DB_FINGERPRINT.
  console.log(JSON.stringify(summarizeDatabaseInspection(target,inventory),null,2));
}finally{
  if(client)client.release();
  await pool.end();
}
