export const COLLECTION_SURFACES=Object.freeze({
  CURATED_COLLECTION:Object.freeze({
    kind:'CURATED_COLLECTION',
    route:'/api/collections',
    purpose:'CURATED_NARRATIVE_GROUPING',
    privacy:'VISIBILITY_CONTROLLED',
    authoritativeOwnership:false,
    publicByDefault:false
  }),
  COLLECTION_RECORD:Object.freeze({
    kind:'COLLECTION_RECORD',
    route:'/api/collection-records',
    purpose:'PRIVATE_CUSTODY_AND_CARE_RECORD',
    privacy:'ACCOUNT_ONLY',
    authoritativeOwnership:false,
    publicByDefault:false
  }),
  PERSONAL_LIST_MARKER:Object.freeze({
    kind:'PERSONAL_LIST_MARKER',
    route:'/api/lots/:id/collect',
    purpose:'PRIVATE_PERSONAL_MARKER',
    privacy:'ACCOUNT_ONLY',
    authoritativeOwnership:false,
    publicByDefault:false
  })
});

export function collectionSurface(kind){
  const key=String(kind||'').toUpperCase(),surface=COLLECTION_SURFACES[key];
  if(!surface)throw Object.assign(new Error('Unknown collection surface'),{status:500,code:'COLLECTION_SURFACE_UNKNOWN'});
  return surface;
}

export function collectionSurfaceCapabilities(){
  return{
    version:'V16',
    distinctSurfaces:true,
    curatedCollections:COLLECTION_SURFACES.CURATED_COLLECTION,
    privateCollectionRecords:COLLECTION_SURFACES.COLLECTION_RECORD,
    personalListMarker:COLLECTION_SURFACES.PERSONAL_LIST_MARKER,
    rule:'Collection, Collection Record and personal marker are separate entities and must not imply one another.'
  };
}
