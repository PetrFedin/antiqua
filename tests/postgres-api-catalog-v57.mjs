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
    await client.query('GRANT CREATE ON SCHEMA public TO anon');
    await client.query('GRANT SELECT ON TABLE public._antiqua_api_probe_v57 TO anon');
    // A table-level privilege audit alone misses column-only grants.
    await client.query('CREATE TABLE public._antiqua_column_probe_v58(id INTEGER, private_email TEXT)');
    await client.query('GRANT SELECT(private_email) ON TABLE public._antiqua_column_probe_v58 TO authenticated');
    await client.query('CREATE SEQUENCE public._antiqua_api_sequence_v57');
    await client.query('GRANT USAGE ON SEQUENCE public._antiqua_api_sequence_v57 TO anon');
    await client.query("CREATE FUNCTION public._antiqua_api_function_v57() RETURNS INTEGER LANGUAGE SQL AS 'SELECT 1'");
    // An intermediate inherited role is as effective as a direct grant.
    await client.query('CREATE ROLE _antiqua_api_inherited_v57 NOLOGIN');
    await client.query('GRANT _antiqua_api_inherited_v57 TO authenticated');
    await client.query('ALTER DEFAULT PRIVILEGES FOR ROLE antiqua IN SCHEMA public GRANT SELECT ON TABLES TO _antiqua_api_inherited_v57');

    // Validate the distinction between a real role's allowed probe and a
    // different table with no SELECT grant. Errors occur only in savepoints,
    // so this test never leaves the parent transaction aborted.
    await client.query('CREATE TABLE public._antiqua_private_probe_v57(id INTEGER)');
    await client.query('SAVEPOINT negative_role_probe');
    try {
      await client.query('SET LOCAL ROLE anon');
      await assert.rejects(
        ()=>client.query('SELECT * FROM public._antiqua_private_probe_v57'),
        e=>e?.code==='42501',
        'anon must not read ungranted private data'
      );
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT negative_role_probe');
      await client.query('RELEASE SAVEPOINT negative_role_probe');
    }
    await client.query('SAVEPOINT column_only_role_probe');
    try {
      await client.query('SET LOCAL ROLE authenticated');
      await client.query('SELECT private_email FROM public._antiqua_column_probe_v58');
      await assert.rejects(
        ()=>client.query('SELECT id FROM public._antiqua_column_probe_v58'),
        e=>e?.code==='42501',
        'authenticated must not read a column without a grant'
      );
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT column_only_role_probe');
      await client.query('RELEASE SAVEPOINT column_only_role_probe');
    }
    await client.query('SAVEPOINT allowed_role_probe');
    try {
      await client.query('SET LOCAL ROLE anon');
      await client.query('SELECT * FROM public._antiqua_api_probe_v57');
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT allowed_role_probe');
      await client.query('RELEASE SAVEPOINT allowed_role_probe');
    }

    const evidence=await inspectDataApiGrants(client);
    assert.ok(evidence.roles.includes('anon'));
    assert.ok(evidence.roles.includes('authenticated'));
    const columnRow=evidence.relations.find(r=>r.object_name==='_antiqua_column_probe_v58'&&r.role_name==='authenticated');
    assert.ok(columnRow,'read-only catalog must observe column-grant fixture');
    assert.equal(columnRow.can_select,false,'table-level SELECT must be denied');
    assert.equal(columnRow.can_select_any_column,true,'column-level SELECT must be visible');
    assert.ok(evidence.relations.some(r=>r.object_name==='_antiqua_api_probe_v57'&&r.role_name==='anon'&&r.can_select));
    assert.ok(evidence.sequences.some(r=>r.sequence_name==='_antiqua_api_sequence_v57'&&r.role_name==='anon'&&r.can_use));
    assert.ok(evidence.functions.some(r=>r.signature.includes('_antiqua_api_function_v57')&&r.role_name==='anon'&&r.can_execute));
    assert.ok(evidence.schemas.some(r=>r.role_name==='anon'&&r.can_use));
    assert.ok(evidence.schemas.some(r=>r.role_name==='anon'&&r.can_create));
    assert.ok(evidence.defaultPrivileges.some(r=>r.schema_name==='public'&&r.owner_role==='antiqua'&&r.api_grants));

    const report=evaluateDataApiGrants(evidence);
    assert.ok(report.unsafeTables.includes('anon:_antiqua_api_probe_v57'));
    assert.ok(report.unexpectedDirectAccess.includes('authenticated:_antiqua_column_probe_v58'));
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
