import assert from 'node:assert/strict';
import {Client} from 'pg';
import {verifyDatabaseTarget} from '../db-identity-gate-v55.mjs';
import {inspectDataApiGrants,evaluateDataApiGrants} from '../data-api-grants-v56.mjs';

// This test deliberately modifies only an isolated, loopback CI PostgreSQL
// and rolls back every probe. It is forbidden against external Supabase.
const target=verifyDatabaseTarget(process.env.DATABASE_URL);
assert.equal(target.mode,'isolated-test');
const client=new Client({connectionString:process.env.DATABASE_URL,ssl:false});
await client.connect();
try{
  await client.query('BEGIN');
  try{
    for(const role of ['anon','authenticated']){
      const exists=await client.query('SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=$1',[role]);
      if(!exists.rowCount)await client.query('CREATE ROLE "'+role+'" NOLOGIN');
    }
    await client.query('CREATE TABLE public._antiqua_api_probe_v57(id INTEGER)');
    await client.query('GRANT USAGE ON SCHEMA public TO anon');
    await client.query('GRANT SELECT ON TABLE public._antiqua_api_probe_v57 TO anon');
    await client.query('CREATE SEQUENCE public._antiqua_api_sequence_v57');
    await client.query('GRANT USAGE ON SEQUENCE public._antiqua_api_sequence_v57 TO anon');
    await client.query("CREATE FUNCTION public._antiqua_api_function_v57() RETURNS INTEGER LANGUAGE SQL AS 'SELECT 1'");
    await client.query('ALTER DEFAULT PRIVILEGES FOR ROLE antiqua IN SCHEMA public GRANT SELECT ON TABLES TO authenticated');

    const evidence=await inspectDataApiGrants(client);
    assert.ok(evidence.roles.includes('anon'));
    assert.ok(evidence.roles.includes('authenticated'));
    assert.ok(evidence.relations.some(r=>r.object_name==='_antiqua_api_probe_v57'&&r.role_name==='anon'&&r.can_select));
    assert.ok(evidence.sequences.some(r=>r.sequence_name==='_antiqua_api_sequence_v57'&&r.role_name==='anon'&&r.can_use));
    assert.ok(evidence.functions.some(r=>r.signature.includes('_antiqua_api_function_v57')&&r.role_name==='anon'&&r.can_execute));
    assert.ok(evidence.schemas.some(r=>r.role_name==='anon'&&r.can_use));
    assert.ok(evidence.defaultPrivileges.some(r=>r.schema_name==='public'&&r.owner_role==='antiqua'&&r.api_grants));

    const report=evaluateDataApiGrants(evidence);
    assert.ok(report.unsafeTables.includes('anon:_antiqua_api_probe_v57'));
    assert.ok(report.exposedFunctions.some(s=>s.includes('_antiqua_api_function_v57')));
    assert.ok(report.exposedSequences.includes('anon:_antiqua_api_sequence_v57'));
    assert.ok(report.unexpectedSchemaAccess.includes('anon:public'));
    assert.ok(report.unsafeDefaultPrivileges.some(s=>s.includes('antiqua:public:r')));
    console.log('ANTIQUA v57 PostgreSQL catalog and privilege exposure PASS (rollback pending)');
  }finally{
    await client.query('ROLLBACK');
  }
}finally{
  await client.end();
}
