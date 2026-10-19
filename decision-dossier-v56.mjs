import {createHash} from 'node:crypto';

// DD-01 remains a PURE pre-release contract, not a route, a permission grant,
// or a substitute for verified Artwork/Room authorities.
// Only a v58 PUBLIC_REDACTED Artwork Dossier may be projected. Never accept
// the raw v51 source: it may contain private provenance, contributor and sales.
export const DECISION_DOSSIER_SCHEMA='antiqua-decision-dossier-contract-v2';
export const DECISION_DOSSIER_PUBLIC_SOURCE='antiqua-artwork-dossier-public-v58';

const EVIDENCE_CLASSES=new Set([
  'PRIMARY_DOCUMENT','INSTITUTIONAL_RECORD','AUCTION_DEALER_RECORD',
  'SCHOLARLY_PUBLICATION','OWNER_DEALER_STATEMENT','EXPERT_INTERPRETATION',
  'MACHINE_CANDIDATE','UNSPECIFIED'
]);
const EVENT_KINDS=new Set([
  'EXHIBITION','PUBLICATION','OWNERSHIP','TRANSFER','AUCTION','SALE',
  'CONSERVATION','RESTORATION','ATTRIBUTION','OTHER'
]);
const EVIDENCE_STATUSES=new Set([
  'VERIFIED','UNVERIFIED','DISPUTED','PENDING','UNKNOWN',
  'UNRESOLVED','REJECTED','CANDIDATE','UNSPECIFIED'
]);
const ATTRIBUTION_STATUSES=new Set([
  'ATTRIBUTED','CONFIRMED','DISPUTED','PENDING','UNSPECIFIED','UNKNOWN',
  'SIGNED','SCHOOL_OF','CIRCLE_OF','FOLLOWER_OF','AFTER','WORKSHOP_OF'
]);
const MARKET_STATUSES=new Set(['SOLD','UNSOLD','REOFFERED','VOID']);
const GAP_CODES=[
  'NO_PROVENANCE_EVENTS','MISSING_EVIDENCE_REFERENCE',
  'UNRESOLVED_EVIDENCE_STATUS','UNCLASSIFIED_EVIDENCE','CONFLICTING_ASSERTION'
];
const fail=code=>{throw Object.assign(new Error('DECISION_DOSSIER: '+code),{code})};
const token=(v,set,fallback='UNSPECIFIED')=>{
  const t=String(v??'').trim().toUpperCase();
  return set.has(t)?t:fallback;
};
const boundedText=(v,length=240)=>typeof v==='string'?v.slice(0,length):null;
const localized=v=>{
  if(typeof v==='string')return boundedText(v);
  if(!v||typeof v!=='object'||Array.isArray(v))return null;
  const out={};
  for(const k of ['ru','en','it'])if(typeof v[k]==='string')out[k]=boundedText(v[k]);
  return Object.keys(out).length?out:null;
};
const natural=(v,cap)=>{
  const n=Number(v);
  return Number.isSafeInteger(n)&&n>=0?Math.min(n,cap):0;
};
const revisionNumber=v=>{
  const n=Number(v);return Number.isSafeInteger(n)&&n>0?n:null;
};
const minorUnits=v=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:null;
const safeDate=v=>{
  if(typeof v!=='string'||!(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/).test(v))return null;
  const d=new Date(v);return Number.isFinite(d.getTime())?d.toISOString():null;
};
const isSha=v=>typeof v==='string'&&/^[0-9a-f]{64}$/i.test(v);
const stable=x=>{
  if(x===null||typeof x!=='object')return JSON.stringify(x);
  if(Array.isArray(x))return '['+x.map(stable).join(',')+']';
  return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}';
};

function evidenceProjection(passport){
  const events=Array.isArray(passport.provenanceEvents)?passport.provenanceEvents:[];
  const sorted=events.map((event,index)=>({event,index}))
    .sort((a,b)=>{
      const an=revisionNumber(a.event?.sequenceNo)??(a.index+1);
      const bn=revisionNumber(b.event?.sequenceNo)??(b.index+1);
      return an-bn||a.index-b.index;
    });
  const publicEvents=sorted.map(({event},index)=>({
    id:'public-event-'+(index+1),
    sequenceNo:index+1,
    eventKind:token(event?.event?.kind,EVENT_KINDS,'OTHER'),
    evidenceClass:token(event?.evidenceClass,EVIDENCE_CLASSES),
    evidenceStatus:token(event?.evidenceStatus,EVIDENCE_STATUSES),
    evidenceReferenceExists:event?.evidenceReferenceRecorded===true,
    unresolved:Boolean(event?.unresolved),
    conflict:Boolean(event?.conflict)
  }));
  const sourceGaps=passport.evidenceSummary?.gapIndex?.byCode||{};
  const gaps=Object.fromEntries(GAP_CODES.map(code=>
    [code,natural(sourceGaps[code],Math.max(1,publicEvents.length))]));
  if(publicEvents.length===0)gaps.NO_PROVENANCE_EVENTS=1;
  const unresolved=publicEvents.filter(x=>x.unresolved).length;
  const conflicting=publicEvents.filter(x=>x.conflict).length;
  const status=publicEvents.length===0?'NO_PROVENANCE_EVIDENCE':
    conflicting?'CONFLICTED':
    unresolved||Object.values(gaps).some(Boolean)?'INCOMPLETE':'EVIDENCE_INDEXED';
  return {
    status,events:publicEvents,eventCount:publicEvents.length,
    conflictCount:conflicting,unresolvedCount:unresolved,
    gapCodes:gaps,
    warning:'Indexed evidence does not certify authenticity or legal title.'
  };
}

function marketProjection(dossier,objectId){
  // Never infer approval from a 'SOLD' string alone. The only acceptable
  // producer is the already redacted, publication-authorized v58 authority.
  const rows=Array.isArray(dossier.marketHistory)?dossier.marketHistory:[];
  return rows.filter(row=>{
    if(row?.final!==true||row.objectId!==objectId)return false;
    const status=String(row.status||'');
    if(!MARKET_STATUSES.has(status))return false;
    if(status==='SOLD')return row.realized===true&&
      minorUnits(row.realizedAmountMinor)!==null;
    return row.realized===false;
  }).map((row,i)=>{
    const sold=row.status==='SOLD';
    return {
      id:'public-sale-'+(i+1),
      status:row.status,
      endedAt:safeDate(row.endedAt),
      currency:/^[A-Z]{3}$/.test(String(row.currency||''))?row.currency:null,
      hammerAmountMinor:sold?minorUnits(row.hammerAmountMinor):null,
      realizedAmountMinor:sold?minorUnits(row.realizedAmountMinor):null
    };
  });
}

/**
 * Caller must first prove Artwork publication and retrieve the v58 public
 * Dossier from the approved source authority. The boolean is a pre-release
 * contract parameter, NEVER a replacement for server authorization.
 */
export function buildPublicDecisionDossierContract(researchDossier,{
  publicVisibilityConfirmed=false
}={}){
  if(publicVisibilityConfirmed!==true)fail('PUBLIC_ARTWORK_AUTHORITY_REQUIRED');
  if(researchDossier?.schemaVersion!==DECISION_DOSSIER_PUBLIC_SOURCE||
      researchDossier?.boundaries?.readModelOnly!==true||
      researchDossier?.boundaries?.publicationScope!=='PUBLIC_REDACTED'||
      researchDossier?.boundaries?.evidenceHashScope!=='DISCLOSED_FIELDS_ONLY'||
      researchDossier?.boundaries?.authenticityCertified!==false||
      researchDossier?.boundaries?.publicSourceFieldsOnly!==true||
      researchDossier?.boundaries?.sourceAccountAndDocumentIdsIncluded!==false||
      researchDossier?.boundaries?.sourceUnredactedPassportHashIncluded!==false||
      researchDossier?.boundaries?.unpublishedScholarEvidenceIncluded!==false||
      researchDossier?.boundaries?.currentAskingPriceIncluded!==false||
      researchDossier?.boundaries?.auctionBuyerOrSettlementIdentityIncluded!==false||
      researchDossier?.boundaries?.scholarlyDetailsRequireSeparatePublicationGrant!==true)
    fail('REDACTED_V58_RESEARCH_AUTHORITY_REQUIRED');
  if(Array.isArray(researchDossier.scholarlyContributions)&&
      researchDossier.scholarlyContributions.length>0)
    fail('UNREDACTED_SCHOLARLY_SOURCE');
  const objectId=researchDossier.objectId;
  const passport=researchDossier.provenancePassport;
  if(typeof objectId!=='string'||objectId.length===0||objectId.length>150||
      passport?.work?.objectId!==objectId)
    fail('ARTWORK_IDENTITY_MISMATCH');
  if(passport?.disclosureBoundary?.scope!=='PUBLIC_REDACTED'||
      passport?.disclosureBoundary?.evidenceHashScope!=='DISCLOSED_FIELDS_ONLY'||
      passport?.disclosureBoundary?.rawEvidenceReferenceIncluded!==false||
      passport?.disclosureBoundary?.ownerIdentityIncluded!==false||
      passport?.disclosureBoundary?.exactStorageLocationIncluded!==false||
      passport?.disclosureBoundary?.privateDocumentIncluded!==false||
      passport?.disclosureBoundary?.sourceEventIdsIncluded!==false||
      passport?.disclosureBoundary?.sourceRevisionIdIncluded!==false)
    fail('PUBLIC_PROVENANCE_DISCLOSURE_REQUIRED');
  if(passport?.assertions?.authenticityCertified!==false||
      passport?.assertions?.attributionCertified!==false)
    fail('UNSUPPORTED_AUTHENTICITY_ASSERTION');
  const sourceSha=passport.evidencePackageSha256;
  if(!isSha(sourceSha))fail('PUBLIC_EVIDENCE_HASH_REQUIRED');
  const no=revisionNumber(passport.passportRevision?.revisionNo);
  const provenance=evidenceProjection(passport);
  const canonical={
    schemaVersion:DECISION_DOSSIER_SCHEMA,
    objectId,
    work:{
      objectCode:boundedText(passport.work.objectCode,120),
      title:localized(passport.work.title),
      artist:localized(passport.work.maker),
      attributionStatus:token(passport.work.attributionStatus,ATTRIBUTION_STATUSES)
    },
    provenance,
    scholarship:[],
    scholarlyDisclosureStatus:'REQUIRES_EXPLICIT_PUBLICATION_GRANT',
    marketHistory:marketProjection(researchDossier,objectId),
    condition:{status:'NOT_ASSESSED',assessment:null},
    currentSale:{status:'NOT_ASSESSED',askingPrice:null,offerEnabled:false},
    source:{
      authority:DECISION_DOSSIER_PUBLIC_SOURCE,
      passportRevisionId:no===null?null:'public-revision-'+no,
      passportRevisionNo:no,
      publicEvidenceProjectionSha256:sourceSha,
      evidenceHashScope:'DISCLOSED_FIELDS_ONLY'
    },
    disclosure:{
      scope:'PUBLIC_ONLY',
      privateOwnerIdentityIncluded:false,
      privateEventIdsIncluded:false,
      exactStorageLocationIncluded:false,
      privateDocumentsIncluded:false,
      scholarlyCredentialsIncluded:false,
      confidentialValuationIncluded:false,
      privateSaleIdentityIncluded:false,
      authenticityCertified:false,
      attributionCertified:false,
      investmentReturnProjected:false,
      immutableSourceAuthority:'ARTWORK_PASSPORT'
    }
  };
  return {...canonical,
    projectionSha256:createHash('sha256').update(stable(canonical)).digest('hex')};
}
