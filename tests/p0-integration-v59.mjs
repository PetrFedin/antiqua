import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {verifyDatabaseTarget,permitsDemoSeeding} from '../db-identity-gate-v55.mjs';
import {DATA_API_RELATION_SQL,evaluateDataApiGrants,enforceDataApiGrants} from '../data-api-grants-v56.mjs';
import {
  buildProvenanceEvidencePassport,
  projectPublicProvenanceEvidencePassport,
  provenanceEvidenceOverview
} from '../provenance-evidence-passport-v43.mjs';
import {buildArtworkResearchProjection} from '../artwork-dossier-v51.mjs';
import {projectPublicArtworkResearchDossier} from '../artwork-dossier-public-v58.mjs';
import {buildResearchInterchangeProfile} from '../research-interchange-profile-v47.mjs';
import {projectPublicResearchInterchangeProfile} from '../research-interchange-public-v58.mjs';

// This is an isolated preview contract check, never a managed DB admission.
assert.equal(process.env.DATABASE_URL,undefined,'no external DB URL allowed');
assert.equal(process.env.PREVIEW_MODE,'true');
const manifest=JSON.parse(await readFile(
  new URL('../docs/P0_INTEGRATION_SOURCES_2026-10-15.json',import.meta.url),'utf8'));
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
assert.equal(manifest.repository,'PetrFedin/antiqua');
assert.equal(manifest.productionAdmitted,false);
for(const sha of [manifest.main,manifest.databaseSecurity.sha,manifest.publicPrivacy.sha]){
  assert.match(sha,/^[a-f0-9]{40}$/);
  git('merge-base','--is-ancestor',sha,'HEAD');
}
for(const [path,expected] of Object.entries(manifest.privacyFiles)){
  assert.equal(git('rev-parse',manifest.publicPrivacy.sha+':'+path),expected,
    'pinned privacy source '+path);
  assert.equal(git('hash-object',path),expected,'source changed: '+path);
}
for(const path of manifest.databaseFiles){
  if(path==='tests/db-identity-gate-v55.mjs'){
    // Narrow append-only migration expectation adjustment: all other bytes of
    // the pinned v55 database identity test must be unchanged.
    const baseline=git('show',manifest.databaseSecurity.sha+':'+path);
    const current=await readFile(new URL('../'+path,import.meta.url),'utf8');
    assert.equal((baseline.match(/assert\.equal\(expected\.length,33\);/g)||[]).length,1);
    assert.equal(current.trimEnd(),baseline.replace('assert.equal(expected.length,33);',
      'assert.equal(expected.length,34);').trimEnd(),'only the appended migration count may differ');
    continue;
  }
  assert.equal(git('hash-object',path),
    git('rev-parse',manifest.databaseSecurity.sha+':'+path),
    'security boundary changed: '+path);
}
assert.equal(git('ls-tree','-r',manifest.main,'--','migrations'),
  git('ls-tree','-r','HEAD','--','migrations').split('\n').filter(x=>!x.includes('034_v73_collection_publication_authority.sql')).join('\n'),
  '001-033 baseline cannot change inside P0 integration');
const migrations=git('ls-tree','-r','--name-only','HEAD','--','migrations')
  .split('\n').filter(x=>/\/\d{3}_.+\.sql$/.test(x));
assert.equal(migrations.length,34,'expect 001–033 immutable and the new v73 migration 034');
assert.equal(migrations.at(-1),'migrations/034_v73_collection_publication_authority.sql');

// Inject a private owner, storage location and document ID into the canonical
// research authority. Public passport, Dossier and Interchange may never emit
// those values, even when queried together in the combined runtime.
const privateValue='INTEGRATION_PRIVATE_CANARY_20261015';
const raw=buildProvenanceEvidencePassport({
  object:{id:'integration-art',objectCode:'AQ-INTEGRATION',
    passport:{title:{en:'Synthetic painting'},maker:{en:'Synthetic school'},
      attributionStatus:'DISPUTED'}},
  latestRevision:{id:privateValue,revisionNo:2,
    passportHash:'a'.repeat(64),createdAt:'2026-10-15T00:00:00.000Z'},
  entries:[{id:privateValue,sequenceNo:1,
    event:{kind:'OWNERSHIP',ownerName:privateValue,storage:privateValue,
      conflict:true},
    evidenceClass:'OWNER_DEALER_STATEMENT',evidenceStatus:'DISPUTED',
    evidenceRef:privateValue}]
});
const publicPassport=projectPublicProvenanceEvidencePassport(raw);
const publicDossier=projectPublicArtworkResearchDossier(
  buildArtworkResearchProjection({
    objectId:'integration-art',provenancePassport:publicPassport,
    scholarlyContributions:[{id:privateValue,summary:{en:privateValue}}],
    marketHistory:[]
  }));
const publicInterchange=projectPublicResearchInterchangeProfile(
  buildResearchInterchangeProfile({passport:raw,
    media:[{id:privateValue,url:privateValue}]}));
assert.equal(publicDossier.schemaVersion,'antiqua-artwork-dossier-public-v58');
assert.equal(publicDossier.provenancePassport.provenanceEvents[0].conflict,true);
assert.equal(publicInterchange.evidenceState.completeness,'CONFLICTED');
assert.deepEqual(publicDossier.scholarlyContributions,[]);
assert.deepEqual(publicInterchange.media,[]);
assert.ok(!JSON.stringify({publicPassport,publicDossier,publicInterchange})
  .includes(privateValue),'private owner/media/doc leaked through public APIs');

// Database identity and effective grants must stay fail closed when privacy
// changes are overlaid. Column-only SELECT/UPDATE are forbidden too.
assert.equal(permitsDemoSeeding(true,'MEMORY_FALLBACK',undefined),true);
assert.equal(permitsDemoSeeding(true,'MEMORY_FALLBACK','configured-DB'),false);
const foreignRef='yiiylfzwfpicrzpbgazl';
assert.throws(()=>verifyDatabaseTarget(
  'postgresql://postgres.'+foreignRef+
    ':fixture@aws-0-eu-central-1.pooler.supabase.com:5432/postgres',{
    ANTIQUA_CONFIRMED_SUPABASE_REF:foreignRef,
    ANTIQUA_DB_IDENTITY_APPROVED:'true',
    ANTIQUA_EXTERNAL_MANAGED_SCHEMA:'true'
  }),/NON_ANTIQUA_PROJECT_REF/);
assert.match(DATA_API_RELATION_SQL,/has_any_column_privilege/);
const unsafe=evaluateDataApiGrants({
  roles:['anon','authenticated'],
  relations:[{role_name:'anon',object_name:'private_people',
    relation_kind:'r',rls_enabled:true,can_select:false,
    can_select_any_column:true}],
  functions:[],sequences:[],schemas:[],
  defaultPrivileges:[{owner_role:'postgres',schema_name:'<global>',
    object_type:'f',api_grants:false}]
});
assert.throws(()=>enforceDataApiGrants(unsafe,'managed'),
  /ANTIQUA_DB_GATE: UNAUTHORIZED_DATA_API_ACCESS/);

const overview=await provenanceEvidenceOverview();
assert.equal(overview.schemaVersion,'antiqua-provenance-evidence-overview-v1');
assert.ok(overview.publicWorks>0,'preview overview must not fail on undefined lots');
const evidence={
  schemaVersion:'antiqua-p0-integration-evidence-v1',
  testedCommit:git('rev-parse','HEAD'),
  testedTree:git('rev-parse','HEAD^{tree}'),
  pinnedSources:{
    databaseSecurity:manifest.databaseSecurity.sha,
    publicPrivacy:manifest.publicPrivacy.sha
  },
  verifiedPrivacyFiles:Object.keys(manifest.privacyFiles).length,
  verifiedDatabaseFiles:manifest.databaseFiles.length,
  canonicalMigrations:migrations.length,
  publicPrivacyCanary:'PASS',
  privilegedDatabaseAccessed:false,
  independentReviewReceived:false,
  productionAdmitted:false,
  outstandingGates:manifest.externalGates
};
await mkdir('artifacts',{recursive:true});
await writeFile('artifacts/p0-integration-v59.json',
  JSON.stringify(evidence,null,2)+'\n');
console.log('ANTIQUA P0 integrated contract PASS (NOT production admitted)');
console.log(JSON.stringify(evidence));
