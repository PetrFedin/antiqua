import assert from 'node:assert/strict';
import {legacyCatalogueGuardV91,catalogNotAdmittedV91} from '../legacy-catalog-admission-v91.mjs';

const LEGACY=[
 '/api/catalog',
 '/api/sellers/dealer-3',
 '/api/lots/lot-109/passport',
 '/api/auctions/auc-3/history'
];
for(const pathname of LEGACY){
 assert.equal(legacyCatalogueGuardV91({pathname,method:'GET',preview:false}),true,
  pathname+' must not serve memory-only inventory in production');
 assert.equal(legacyCatalogueGuardV91({pathname,method:'GET',preview:true}),false,
  pathname+' remains only in disposable preview');
 assert.equal(legacyCatalogueGuardV91({pathname,method:'POST',preview:false}),false,
  'GET-only guard must not change mutation route behavior');
}
for(const pathname of [
 '/api/health','/api/ready','/api/auth/me',
 '/api/network/profiles','/api/lots/lot-109/decision-dossier',
 '/api/listings/lst-109/diligence-progress',
 '/api/collections/mine',
 '/api/lots/lot-109/provenance'
]){
 assert.equal(legacyCatalogueGuardV91({pathname,method:'GET',preview:false}),false,
  'do not overblock unrelated authoritative route: '+pathname);
}
const notice=catalogNotAdmittedV91();
assert.deepEqual(notice,{
 error:'Canonical published artwork catalogue not admitted',
 code:'PUBLIC_ARTWORK_CATALOG_NOT_ADMITTED'
});
assert.ok(!JSON.stringify(notice).includes('postgresql://'));
assert.equal(legacyCatalogueGuardV91({pathname:null,method:'GET',preview:false}),false);
assert.equal(legacyCatalogueGuardV91({pathname:'/api/catalog/',method:'GET',preview:false}),false);
console.log('ANTIQUA v91: unverified public memory catalogue fails closed outside preview, isolated test and privacy-safe 503 PASS');
