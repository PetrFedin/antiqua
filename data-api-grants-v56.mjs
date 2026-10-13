// Read-only PostgreSQL catalog audit for the Supabase Data API boundary.
// This checks privileges inherited via PUBLIC as well as explicit grants.
const ROLE_NAMES=['anon','authenticated'];
export const DATA_API_ROLE_SQL="/* ANTIQUA_API_ROLES_V56 */ SELECT rolname FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated') ORDER BY rolname";
export const DATA_API_RELATION_SQL=[
  "/* ANTIQUA_API_RELATIONS_V56 */ SELECT r.rolname AS role_name, c.relname AS object_name,",
  "c.relkind AS relation_kind, c.relrowsecurity AS rls_enabled,",
  "COALESCE('security_invoker=true'=ANY(c.reloptions),false) AS security_invoker,",
  "pg_catalog.has_table_privilege(r.oid,c.oid,'SELECT') AS can_select,",
  "pg_catalog.has_table_privilege(r.oid,c.oid,'INSERT') AS can_insert,",
  "pg_catalog.has_table_privilege(r.oid,c.oid,'UPDATE') AS can_update,",
  "pg_catalog.has_table_privilege(r.oid,c.oid,'DELETE') AS can_delete",
  "FROM pg_catalog.pg_class c",
  "JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace",
  "CROSS JOIN (SELECT oid,rolname FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated')) r",
  "WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')",
  "ORDER BY c.relname,r.rolname"
].join(' ');
export const DATA_API_FUNCTION_SQL=[
  "/* ANTIQUA_API_FUNCTIONS_V56 */ SELECT r.rolname AS role_name,",
  "p.proname AS function_name, p.oid::regprocedure::text AS signature,",
  "p.prosecdef AS security_definer,",
  "pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE') AS can_execute",
  "FROM pg_catalog.pg_proc p",
  "JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace",
  "CROSS JOIN (SELECT oid,rolname FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated')) r",
  "WHERE n.nspname='public'",
  "ORDER BY p.proname,p.oid,r.rolname"
].join(' ');
export const DATA_API_SEQUENCE_SQL=[
  "/* ANTIQUA_API_SEQUENCES_V56 */ SELECT r.rolname AS role_name, c.relname AS sequence_name,",
  "pg_catalog.has_sequence_privilege(r.oid,c.oid,'USAGE') AS can_use,",
  "pg_catalog.has_sequence_privilege(r.oid,c.oid,'SELECT') AS can_select,",
  "pg_catalog.has_sequence_privilege(r.oid,c.oid,'UPDATE') AS can_update",
  "FROM pg_catalog.pg_class c",
  "JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace",
  "CROSS JOIN (SELECT oid,rolname FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated')) r",
  "WHERE n.nspname='public' AND c.relkind='S'",
  "ORDER BY c.relname,r.rolname"
].join(' ');

// The Node-only application requires both current and future public-schema
// access to be closed for API roles. Audit the effective inherited permissions.
export const DATA_API_SCHEMA_SQL=[
  "/* ANTIQUA_API_SCHEMA_V57 */ SELECT r.rolname AS role_name,",
  "pg_catalog.has_schema_privilege(r.oid,n.oid,'USAGE') AS can_use,",
  "pg_catalog.has_schema_privilege(r.oid,n.oid,'CREATE') AS can_create",
  "FROM pg_catalog.pg_namespace n",
  "CROSS JOIN pg_catalog.pg_roles r",
  "WHERE n.nspname='public' AND r.rolname IN ('anon','authenticated')",
  "ORDER BY r.rolname"
].join(' ');
export const DATA_API_DEFAULT_ACL_SQL=[
  "/* ANTIQUA_API_DEFAULT_ACL_V57 */ SELECT d.defaclobjtype AS object_type,",
  "COALESCE(n.nspname,'<global>') AS schema_name,",
  "pg_catalog.pg_get_userbyid(d.defaclrole) AS owner_role,",
  "EXISTS (SELECT 1 FROM pg_catalog.aclexplode(d.defaclacl) a",
  "LEFT JOIN pg_catalog.pg_roles granted ON granted.oid=a.grantee",
  "WHERE a.grantee=0 OR granted.rolname IN ('anon','authenticated')) AS api_grants",
  "FROM pg_catalog.pg_default_acl d",
  "LEFT JOIN pg_catalog.pg_namespace n ON n.oid=d.defaclnamespace",
  "WHERE n.nspname='public' OR d.defaclnamespace=0",
  "ORDER BY owner_role,object_type,schema_name"
].join(' ');

const truth=v=>v===true||v==='t'||v==='true';
const any=(row,keys)=>keys.some(key=>truth(row[key]));
const relationAccess=['can_select','can_insert','can_update','can_delete'];
// This service uses the Node API and its own authenticated sessions, not
// Supabase browser Data API tokens. No direct public-schema data grants are
// permitted for these roles until a separately reviewed API contract exists.
const DATA_API_EXPOSURE_ALLOWED=false;
export async function inspectDataApiGrants(client){
  // Caller already owns a BEGIN READ ONLY transaction.
  const roles=(await client.query(DATA_API_ROLE_SQL)).rows.map(x=>x.rolname);
  const relations=(await client.query(DATA_API_RELATION_SQL)).rows;
  const functions=(await client.query(DATA_API_FUNCTION_SQL)).rows;
  const sequences=(await client.query(DATA_API_SEQUENCE_SQL)).rows;
  const schemas=(await client.query(DATA_API_SCHEMA_SQL)).rows;
  const defaultPrivileges=(await client.query(DATA_API_DEFAULT_ACL_SQL)).rows;
  const unexpected=roles.filter(r=>!ROLE_NAMES.includes(r));
  if(unexpected.length)throw new Error('ANTIQUA_DB_GATE: UNEXPECTED_API_ROLE');
  return {roles,relations,functions,sequences,schemas,defaultPrivileges};
}

export function evaluateDataApiGrants(evidence){
  const roles=evidence?.roles||[];
  const relations=evidence?.relations||[];
  const functions=evidence?.functions||[];
  const sequences=evidence?.sequences||[];
  const policies=evidence?.policies||[];
  const schemas=evidence?.schemas||[];
  const defaultPrivileges=evidence?.defaultPrivileges||[];
  const unexpectedSchemaAccess=schemas.filter(r=>ROLE_NAMES.includes(r.role_name)&&
    (truth(r.can_use)||truth(r.can_create)));
  const unsafeDefaultPrivileges=defaultPrivileges.filter(r=>truth(r.api_grants));
  // Postgres grants EXECUTE on future functions to PUBLIC by default.
  // Only a reviewed, explicit global revoke by the migration owner seals it.
  const hasLockedFunctionDefaults=defaultPrivileges.some(r=>
    r.owner_role==='postgres'&&r.schema_name==='<global>'&&
    r.object_type==='f'&&!truth(r.api_grants));
  const exposedRelations=relations.filter(r=>ROLE_NAMES.includes(r.role_name)&&any(r,relationAccess));
  const broadPolicies=exposedRelations.filter(r=>r.rls_enabled).flatMap(r=>policies.filter(p=>p.tablename===r.object_name && (p.roles||[]).some(role=>role==='public'||role===r.role_name) && ['true','(true)'].includes(String(p.qual||'').toLowerCase().trim())).map(p=>r.object_name+':'+p.policyname));
  const unexpectedDirectAccess=DATA_API_EXPOSURE_ALLOWED?[]:exposedRelations;
  const unsafeTables=exposedRelations.filter(r=>['r','p','f'].includes(r.relation_kind)&&!truth(r.rls_enabled));
  // Postgres views normally run with owner permissions and can bypass RLS.
  const unsafeViews=exposedRelations.filter(r=>['v','m'].includes(r.relation_kind)&&!truth(r.security_invoker));
  const privilegedFunctions=functions.filter(r=>ROLE_NAMES.includes(r.role_name)&&truth(r.security_definer)&&truth(r.can_execute));
  const exposedFunctions=functions.filter(r=>ROLE_NAMES.includes(r.role_name)&&truth(r.can_execute));
  const exposedSequences=sequences.filter(r=>ROLE_NAMES.includes(r.role_name)&&any(r,['can_use','can_select','can_update']));
  const rlsNotEnabled=[...new Set(relations.filter(r=>['r','p','f'].includes(r.relation_kind)&&!truth(r.rls_enabled)).map(r=>r.object_name))].sort();
  return {
    roles,
    tablesWithoutRls:rlsNotEnabled,
    exposedWithRls:exposedRelations.filter(r=>truth(r.rls_enabled)).length,
    broadPolicies,
    unexpectedSchemaAccess:unexpectedSchemaAccess.map(r=>r.role_name+':public'),
    unsafeDefaultPrivileges:unsafeDefaultPrivileges.map(r=>r.owner_role+':'+r.schema_name+':'+r.object_type),
    missingLockedFunctionDefaults:hasLockedFunctionDefaults?[]:['postgres:global:functions'],
    exposedFunctions:exposedFunctions.map(r=>r.role_name+':'+r.signature),
    unexpectedDirectAccess:unexpectedDirectAccess.map(r=>r.role_name+':'+r.object_name),
    unsafeTables:unsafeTables.map(r=>r.role_name+':'+r.object_name),
    unsafeViews:unsafeViews.map(r=>r.role_name+':'+r.object_name),
    privilegedFunctions:privilegedFunctions.map(r=>r.role_name+':'+r.signature),
    exposedSequences:exposedSequences.map(r=>r.role_name+':'+r.sequence_name)
  };
}
export function enforceDataApiGrants(report,mode){
  if(mode!=='managed')return;
  if(!ROLE_NAMES.every(role=>report?.roles?.includes(role)))
    throw new Error('ANTIQUA_DB_GATE: DATA_API_ROLES_NOT_VERIFIED');
  for(const [field,code] of [
    // Specific findings precede the general Node-only authority boundary.
    // Otherwise negative tests and admission diagnostics obscure the cause.
    ['unsafeTables','UNPROTECTED_DATA_API_TABLE'],
    ['unsafeViews','UNSAFE_DATA_API_VIEW'],
    ['broadPolicies','BROAD_DATA_API_POLICY'],
    ['privilegedFunctions','EXPOSED_DEFINER_FUNCTION'],
    ['exposedSequences','EXPOSED_API_SEQUENCE'],
    ['exposedFunctions','UNAUTHORIZED_DATA_API_FUNCTION'],
    ['unsafeDefaultPrivileges','UNSAFE_DEFAULT_PRIVILEGES'],
    ['missingLockedFunctionDefaults','FUNCTION_DEFAULTS_NOT_LOCKED'],
    ['unexpectedSchemaAccess','UNAUTHORIZED_PUBLIC_SCHEMA_ACCESS'],
    ['unexpectedDirectAccess','UNAUTHORIZED_DATA_API_ACCESS']
  ]){
    if(report[field]?.length)throw new Error('ANTIQUA_DB_GATE: '+code);
  }
}
