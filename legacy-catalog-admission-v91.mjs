// ANTIQUA v91: legacy public endpoints still read preview-memory seed rows.
// In managed mode they must not pretend to show authentic published inventory.
// A real PostgreSQL/rights-admitted projection must supersede this barrier.
const legacyPublicPatterns=[
 /^\/api\/catalog$/,
 /^\/api\/sellers\/[^/]+$/,
 /^\/api\/lots\/[^/]+\/passport$/,
 /^\/api\/auctions\/[^/]+\/history$/
];
export function legacyCatalogueGuardV91({pathname,method,preview}={}){
 if(preview||method!=='GET'||typeof pathname!=='string')return false;
 return legacyPublicPatterns.some(pattern=>pattern.test(pathname));
}
export function catalogNotAdmittedV91(){
 return{
  error:'Canonical published artwork catalogue not admitted',
  code:'PUBLIC_ARTWORK_CATALOG_NOT_ADMITTED'
 };
}
