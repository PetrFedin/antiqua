import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {provenanceEvidenceOverview} from '../provenance-evidence-passport-v43.mjs';

assert.equal(process.env.PREVIEW_MODE, 'true', 'preview only');
assert.equal(process.env.DATABASE_URL, undefined, 'must not connect to an external database');
const json=async path=>JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const policy=await json('../docs/P0_UX_SECURITY_SOURCES_V62.json');
const base=await json('../docs/P0_INTEGRATION_SOURCES_2026-10-15.json');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
assert.equal(policy.productionAdmitted,false);
assert.equal(policy.reviewed,false);
assert.equal(policy.repository,'PetrFedin/antiqua');
assert.equal(base.productionAdmitted,false);
assert.equal(base.sharedWorkflowResolution.independentReviewReceived,false);
assert.equal(policy.sourceSecurity.sha,base.sharedWorkflowResolution.securityParent);
assert.equal(policy.sourceMuseum.sha,base.sharedWorkflowResolution.museumParent);
const main=policy.mainBaseline, security=policy.sourceSecurity.sha, museum=policy.sourceMuseum.sha;
for (const parent of [main,security,museum]){
  assert.match(parent,/^[a-f0-9]{40}$/);
  git('merge-base','--is-ancestor',parent,'HEAD');
}
assert.equal(policy.preservedMuseumFiles.length,11);
assert.ok(!base.databaseFiles.includes('.github/workflows/browser-e2e.yml'));
// v63 deliberate presentation changes: HTML stylesheet wiring and frontend allowlist.
const editorialExceptions=new Set(['public/index.html','tests/frontend-consolidation-v16.mjs']);
for(const path of policy.preservedMuseumFiles){
  if(editorialExceptions.has(path))continue;
  assert.equal(git('hash-object',path),git('rev-parse',museum+':'+path),'museum source changed: '+path);
}
for(const path of editorialExceptions)assert.ok(policy.preservedMuseumFiles.includes(path));
for (const path of base.databaseFiles){
  if(path==='tests/db-identity-gate-v55.mjs'){
    // Explicitly allowed single-line appended migration count; every other
    // pinned byte remains exact. No schema identity or tenancy checks bypassed.
    const pinned=git('show',base.databaseSecurity.sha+':'+path);
    const current=(await readFile(new URL('../'+path,import.meta.url),'utf8')).trimEnd();
    assert.equal((pinned.match(/assert\.equal\(expected\.length,33\);/g)||[]).length,1);
    assert.equal(current,pinned.replace('assert.equal(expected.length,33);','assert.equal(expected.length,34);').trimEnd());
    continue;
  }
  assert.equal(git('hash-object',path),git('rev-parse',base.databaseSecurity.sha+':'+path),'database source changed: '+path);
}
for (const [path,blob] of Object.entries(base.privacyFiles)){
  assert.equal(git('hash-object',path),blob,'public privacy source changed: '+path);
}
assert.equal(git('ls-tree','-r',main,'--','migrations'),git('ls-tree','-r','HEAD','--','migrations').split('\n').filter(x=>!x.includes('034_v73_collection_publication_authority.sql')).join('\n'),
  'canonical SQL migration files modified');
const migrationPaths=git('ls-tree','-r','--name-only','HEAD','--','migrations')
  .split('\n').filter(p=>/\/\d{3}_.+\.sql$/.test(p));
assert.equal(migrationPaths.length,34);
assert.equal(migrationPaths.at(-1),'migrations/034_v73_collection_publication_authority.sql');
const workflow=await readFile(new URL('../.github/workflows/browser-e2e.yml',import.meta.url),'utf8');
assert.ok(workflow.includes('hardening/db-identity-gate-v55'),'database security PR gate lost');
assert.ok(workflow.includes('@playwright/test@1.63.0'),'audited test runner missing');
assert.ok(workflow.includes('npm audit --include=dev --audit-level=high'),'dev audit missing');
assert.ok(!workflow.includes('@playwright/test@1.55.0'),'outdated runner resurrected');
assert.ok(!workflow.includes('npm install --no-save'),'unaudited ephemeral runner resurrected');
assert.ok(workflow.includes('for spec in tests/browser/*.spec.mjs'),'full browser syntax gate lost');
const css=await readFile(new URL('../public/museum-resilience.css',import.meta.url),'utf8');
assert.ok(Buffer.byteLength(css,'utf8')<8192,'companion stylesheet too large');
assert.ok(!/@import|!important|url\s*\(/i.test(css),'companion stylesheet adds external/override behavior');
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
assert.ok(html.includes('href="/museum-resilience.css"'),'failure-state CSS not loaded');
const provenance=await provenanceEvidenceOverview();
assert.equal(provenance.schemaVersion,'antiqua-provenance-evidence-overview-v1');
assert.ok(provenance.publicWorks>0,'preview provenance read model unexpectedly empty');
assert.equal(provenance.assertions.authenticityCertified,false);
const receipt={
  schemaVersion:'antiqua-p0-combined-evidence-v62',
  testedCommit:git('rev-parse','HEAD'),
  testedTree:git('rev-parse','HEAD^{tree}'),
  sources:{security,museum,main},
  verifiedMuseumSourceFiles:policy.preservedMuseumFiles.length,
  verifiedDatabaseSourceFiles:base.databaseFiles.length,
  verifiedPrivacySourceFiles:Object.keys(base.privacyFiles).length,
  originalMigrationFiles:migrationPaths.length,
  workflowResolution:'VERIFIED',
  previewProvenanceEndpointModel:'PASS',
  managedDatabaseAccessed:false,
  independentReviewReceived:false,
  productionAdmitted:false,
  evidenceSha256:createHash('sha256').update(JSON.stringify({security,museum,main,migrationPaths})).digest('hex')
};
await mkdir('artifacts',{recursive:true});
await writeFile('artifacts/p0-combined-v62.json',JSON.stringify(receipt,null,2)+'\n');
console.log('ANTIQUA P0 two-parent UX/security contract PASS (production HOLD)');
console.log(JSON.stringify(receipt));
