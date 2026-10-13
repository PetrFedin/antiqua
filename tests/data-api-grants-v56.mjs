import assert from 'node:assert/strict';
import {evaluateDataApiGrants,enforceDataApiGrants} from '../data-api-grants-v56.mjs';
const roles=['anon','authenticated'];
const empty={roles,relations:[],functions:[],sequences:[],schemas:[],defaultPrivileges:[{owner_role:'postgres',schema_name:'<global>',object_type:'f',api_grants:false}]};
const accepted=evaluateDataApiGrants(empty);
assert.deepEqual(accepted.unsafeTables,[]);
enforceDataApiGrants(accepted,'managed');
assert.throws(()=>enforceDataApiGrants(evaluateDataApiGrants({...empty,roles:['anon']}),'managed'),/DATA_API_ROLES_NOT_VERIFIED/);
function reject(input,code){
  const report=evaluateDataApiGrants({...empty,...input});
  assert.throws(()=>enforceDataApiGrants(report,'managed'),new RegExp(code));
  return report;
}
const openTable={role_name:'anon',object_name:'sessions',relation_kind:'r',rls_enabled:false,can_select:true};
reject({relations:[openTable]},'UNPROTECTED_DATA_API_TABLE');
reject({relations:[{...openTable,relation_kind:'p',role_name:'authenticated',can_select:false,can_update:true}]},'UNPROTECTED_DATA_API_TABLE');
reject({relations:[{...openTable,relation_kind:'v',object_name:'sensitive_view',security_invoker:false}]},'UNSAFE_DATA_API_VIEW');
reject({relations:[{...openTable,relation_kind:'m',object_name:'sensitive_materialized'}]},'UNSAFE_DATA_API_VIEW');
reject({functions:[{role_name:'authenticated',signature:'public.private_dump()',security_definer:true,can_execute:true}]},'EXPOSED_DEFINER_FUNCTION');
reject({sequences:[{role_name:'anon',sequence_name:'account_id_seq',can_use:true}]},'EXPOSED_API_SEQUENCE');
const denied=evaluateDataApiGrants({...empty,relations:[{...openTable,can_select:false,rls_enabled:false}]});
enforceDataApiGrants(denied,'managed');
assert.deepEqual(denied.tablesWithoutRls,['sessions']);
const rlsGranted=evaluateDataApiGrants({...empty,relations:[{...openTable,rls_enabled:true}]});
assert.throws(()=>enforceDataApiGrants(rlsGranted,'managed'),/UNAUTHORIZED_DATA_API_ACCESS/);
assert.equal(rlsGranted.exposedWithRls,1);
enforceDataApiGrants(evaluateDataApiGrants({...empty,roles:[]}), 'isolated-test');
reject({
  relations:[{...openTable,rls_enabled:true}],
  policies:[{tablename:'sessions',policyname:'public_all_rows',roles:['public'],qual:'true'}]
},'BROAD_DATA_API_POLICY');
reject({
  relations:[{...openTable,role_name:'authenticated',rls_enabled:true}],
  policies:[{tablename:'sessions',policyname:'all_authenticated',roles:['authenticated'],qual:'(true)'}]
},'BROAD_DATA_API_POLICY');
const scoped=evaluateDataApiGrants({...empty,
  relations:[{...openTable,rls_enabled:true}],
  policies:[{tablename:'sessions',policyname:'self_only',roles:['anon'],qual:'account_id = auth.uid()'}]
});
assert.throws(()=>enforceDataApiGrants(scoped,'managed'),/UNAUTHORIZED_DATA_API_ACCESS/);
reject({functions:[{role_name:'anon',signature:'public.anonymous_helper()',security_definer:false,can_execute:true}]},'UNAUTHORIZED_DATA_API_FUNCTION');
reject({schemas:[{role_name:'anon',can_use:true,can_create:false}]},'UNAUTHORIZED_PUBLIC_SCHEMA_ACCESS');
reject({schemas:[{role_name:'authenticated',can_use:false,can_create:true}]},'UNAUTHORIZED_PUBLIC_SCHEMA_ACCESS');
reject({defaultPrivileges:[
  {owner_role:'postgres',schema_name:'<global>',object_type:'f',api_grants:false},
  {owner_role:'postgres',schema_name:'public',object_type:'r',api_grants:true}
]},'UNSAFE_DEFAULT_PRIVILEGES');
reject({defaultPrivileges:[]},'FUNCTION_DEFAULTS_NOT_LOCKED');
reject({defaultPrivileges:[{owner_role:'postgres',schema_name:'<global>',object_type:'f',api_grants:true}]},'UNSAFE_DEFAULT_PRIVILEGES');
const locked=evaluateDataApiGrants(empty);
assert.deepEqual(locked.missingLockedFunctionDefaults,[]);
assert.deepEqual(locked.unexpectedSchemaAccess,[]);
enforceDataApiGrants(locked,'managed');
console.log('ANTIQUA v56 Data API negative grant/RLS tests PASS');
