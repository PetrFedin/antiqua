const TYPES=new Set([
 'PAINTING','DRAWING','ENGRAVING','ETCHING','LITHOGRAPH','WOODCUT','LINOCUT',
 'SCREENPRINT','WATERCOLOR','GOUACHE','PASTEL','MIXED_MEDIA','OTHER_PRINT','OTHER_WORK_ON_PAPER'
]);
const STATUSES=new Set(['CANDIDATE','REVIEWED','PUBLISHED','REJECTED']);
const DEMO_EXPLICIT=Object.freeze({
 'lot-104':Object.freeze({status:'PUBLISHED',workType:'PAINTING',source:'CURATED_PREVIEW',version:'FINE_ART_V1',reviewed:true}),
 'lot-108':Object.freeze({status:'PUBLISHED',workType:'OTHER_WORK_ON_PAPER',source:'CURATED_PREVIEW',version:'FINE_ART_V1',reviewed:true})
});
const clone=x=>x==null?null:structuredClone(x);

export function normalizeGalleryClassification(input={}){
 const status=String(input.status||'').toUpperCase(),workType=String(input.workType||input.type||'').toUpperCase();
 if(!STATUSES.has(status)||!TYPES.has(workType))return null;
 return{
  status,workType,
  source:String(input.source||'EXPLICIT_CATALOGUE').slice(0,80),
  version:String(input.version||'FINE_ART_V1').slice(0,80),
  reviewed:Boolean(input.reviewed),
  reviewer:input.reviewer?String(input.reviewer).slice(0,120):null,
  reviewedAt:input.reviewedAt||null,
  note:input.note||null
 }
}

export function fineArtClassificationFor(object){
 if(!object)return null;
 const p=object.passport||object;
 const explicit=p.galleryClassification||object.galleryClassification||p.metadata?.galleryClassification||null;
 return normalizeGalleryClassification(explicit)||clone(DEMO_EXPLICIT[String(object.id||p.id||'')])||null
}

export function isFineArtPublished(object){
 const x=fineArtClassificationFor(object);
 return Boolean(x&&x.status==='PUBLISHED'&&TYPES.has(x.workType))
}

export function projectFineArt(object){
 const classification=fineArtClassificationFor(object);
 return classification?{...object,galleryClassification:classification}:object
}

export function fineArtCapabilities(){
 return{
  contractVersion:'v41',
  authority:'OBJECT_PASSPORT_PROJECTION',
  destructiveMigration:false,
  explicitReviewRequired:true,
  statuses:[...STATUSES],
  workTypes:[...TYPES],
  defaultConsumerScope:'FINE_ART',
  legacyDirectAccess:true,
  automatedMappingMayPublish:false
 }
}
