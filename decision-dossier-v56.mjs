import {createHash} from 'node:crypto';

// DD-01 (pre-release contract only): pure projection of the existing v51
// research dossier. No route, database, HTML or access-token handling.
// Caller MUST enforce published Artwork authority before providing this input.
// Do not use this for a private document without room-level authorization.
export const DECISION_DOSSIER_SCHEMA='antiqua-decision-dossier-contract-v1';
const EVIDENCE_CLASSES=new Set([
  'PRIMARY_DOCUMENT','INSTITUTIONAL_RECORD','AUCTION_DEALER_RECORD',
  'SCHOLARLY_PUBLICATION','OWNER_DEALER_STATEMENT','EXPERT_INTERPRETATION',
  'MACHINE_CANDIDATE','UNSPECIFIED'
]);
const EVENT_KINDS=new Set([
  'EXHIBITION','PUBLICATION','OWNERSHIP','TRANSFER','AUCTION',
  'SALE','CONSERVATION','RESTORATION','ATTRIBUTION','OTHER'
]);
const EVIDENCE_STATUSES=new Set([
  'VERIFIED','UNVERIFIED','DISPUTED','PENDING','UNKNOWN',
  'UNRESOLVED','REJECTED','CANDIDATE','UNSPECIFIED'
]);
const MARKET_STATUSES=new Set(['SOLD','UNSOLD','WITHDRAWN','CLOSED','PASSED','NOT_SOLD']);

const failure=(code)=>{throw Object.assign(new Error('DECISION_DOSSIER: '+code),{code})};
const token=(v,allowed,fallback)=>allowed.has(String(v??'').toUpperCase())
  ?String(v).toUpperCase():fallback;
const boundedText=(v,length=240)=>typeof v==='string'?v.slice(0,length):null;
const localized=(v)=>{
  if(typeof v==='string')return boundedText(v);
  if(!v||typeof v!=='object'||Array.isArray(v))return null;
  const out={};
  for(const key of ['ru','en','it'])if(typeof v[key]==='string')out[key]=boundedText(v[key]);
  return Object.keys(out).length?out:null;
};
const natural=v=>Number.isSafeInteger(Number(v))&&Number(v)>=0?Number(v):0;
const isoOrNull=v=>{
  if(typeof v!=='string'||!v.trim())return null;
  const n=Date.parse(v);
  return Number.isFinite(n)?new Date(n).toISOString():null;
};
function stable(x){
  if(x===null||typeof x!=='object')return JSON.stringify(x);
  if(Array.isArray(x))return '['+x.map(stable).join(',')+']';
  return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}';
}
function evidenceProjection(passport){
  const events=Array.isArray(passport.provenanceEvents)?passport.provenanceEvents:[];
  const data=events.map((e,i)=>({
    id:boundedText(e.id,120)||'unidentified-'+i,
    sequenceNo:natural(e.sequenceNo),
    eventKind:token(e.event?.kind,EVENT_KINDS,'OTHER'),
    evidenceClass:token(e.evidenceClass,EVIDENCE_CLASSES,'UNSPECIFIED'),
    evidenceStatus:token(e.evidenceStatus,EVIDENCE_STATUSES,'UNSPECIFIED'),
    evidenceReferenceExists:Boolean(e.evidenceRef),
    unresolved:Boolean(e.unresolved),
    conflict:Boolean(e.conflict)
    // Intentionally no raw event JSON, owner data, location, narrative,
    // evidenceRef, contact details, document paths or signed read URLs.
  })).sort((a,b)=>a.sequenceNo-b.sequenceNo||a.id.localeCompare(b.id));
  const summary=passport.evidenceSummary||{};
  const rawGaps=summary.gapIndex?.byCode||{};
  const gapCodes=['NO_PROVENANCE_EVENTS','MISSING_EVIDENCE_REFERENCE',
    'UNRESOLVED_EVIDENCE_STATUS','UNCLASSIFIED_EVIDENCE','CONFLICTING_ASSERTION'];
  const gaps=Object.fromEntries(gapCodes.map(key=>[key,natural(rawGaps[key])]));
  const conflicts=events.filter(e=>e.conflict).length;
  const unresolved=events.filter(e=>e.unresolved).length;
  const status=events.length===0?'NO_PROVENANCE_EVIDENCE'
    :conflicts||String(summary.completeness)==='CONFLICTED'?'CONFLICTED'
    :unresolved||Object.values(gaps).some(Boolean)?'INCOMPLETE'
    :'EVIDENCE_INDEXED';
  return {
    status,
    events:data,
    eventCount:events.length,
    conflictCount:conflicts,
    unresolvedCount:unresolved,
    gapCodes:gaps,
    warning:'Evidence-index state is not proof of authenticity or legal title.'
  };
}
function scholarlyProjection(dossier){
  const rows=Array.isArray(dossier.scholarlyContributions)?dossier.scholarlyContributions:[];
  return rows.filter(row=>row.assertions?.contributionPublished===true).map(row=>({
    contributionId:boundedText(row.id,120),
    contributionType:boundedText(row.contributionType,80),
    publishedAt:isoOrNull(row.publishedAt),
    reviewedAt:isoOrNull(row.reviewedAt),
    evidenceLinkCount:Array.isArray(row.evidenceLinks)?row.evidenceLinks.length:0,
    reviewerCredentialRecorded:Boolean(row.credentialsAtReview?.length),
    credentialDoesNotCertifyConclusion:true
    // No user IDs, account contacts, raw review disclosures or evidence URLs.
  }));
}
function marketProjection(dossier){
  const rows=Array.isArray(dossier.marketHistory)?dossier.marketHistory:[];
  return rows.filter(row=>MARKET_STATUSES.has(String(row.status||'').toUpperCase()))
    .map(row=>({
      auctionId:boundedText(row.auctionId,120),
      status:token(row.status,MARKET_STATUSES,'CLOSED'),
      endedAt:isoOrNull(row.endedAt),
      currency:/^[A-Z]{3}$/.test(String(row.currency||''))?row.currency:null,
      hammerAmountMinor:Number.isSafeInteger(row.hammerAmountMinor)&&row.hammerAmountMinor>=0
        ?row.hammerAmountMinor:null,
      realizedAmountMinor:Number.isSafeInteger(row.realizedAmountMinor)&&row.realizedAmountMinor>=0
        ?row.realizedAmountMinor:null
    }));
}

/**
 * Only accept the already-authorized PUBLIC v51 research dossier.
 * External API integration and customer publication are deliberately absent.
 * This is not a substitute for checking Artwork publication state and access.
 */
export function buildPublicDecisionDossierContract(researchDossier,{
  publicVisibilityConfirmed=false
}={}){
  if(!publicVisibilityConfirmed)failure('PUBLIC_ARTWORK_AUTHORITY_REQUIRED');
  if(researchDossier?.schemaVersion!=='antiqua-artwork-dossier-v51'
      ||researchDossier?.boundaries?.readModelOnly!==true)
    failure('V51_RESEARCH_AUTHORITY_REQUIRED');
  const objectId=researchDossier.objectId;
  const passport=researchDossier.provenancePassport;
  if(!objectId||passport?.work?.objectId!==objectId)
    failure('ARTWORK_IDENTITY_MISMATCH');
  const sourceSha=passport.evidencePackageSha256;
  if(!/^[0-9a-f]{64}$/i.test(String(sourceSha||'')))
    failure('EVIDENCE_PACKAGE_HASH_REQUIRED');
  if(passport.assertions?.authenticityCertified!==false
      ||passport.assertions?.attributionCertified!==false)
    failure('UNSUPPORTED_AUTHENTICITY_ASSERTION');
  const provenance=evidenceProjection(passport);
  const canonical={
    schemaVersion:DECISION_DOSSIER_SCHEMA,
    objectId:String(objectId),
    work:{
      objectCode:boundedText(passport.work.objectCode,120),
      title:localized(passport.work.title),
      artist:localized(passport.work.maker),
      attributionStatus:boundedText(passport.work.attributionStatus,80)
    },
    provenance,
    scholarship:scholarlyProjection(researchDossier),
    marketHistory:marketProjection(researchDossier),
    condition:{status:'NOT_ASSESSED',assessment:null},
    currentSale:{status:'NOT_ASSESSED',askingPrice:null,offerEnabled:false},
    source:{
      authority:'antiqua-artwork-dossier-v51',
      passportRevisionId:boundedText(passport.passportRevision?.revisionId,120),
      passportRevisionNo:passport.passportRevision?.revisionNo??null,
      evidencePackageSha256:sourceSha
    },
    disclosure:{
      scope:'PUBLIC_ONLY',
      privateOwnerIdentityIncluded:false,
      exactStorageLocationIncluded:false,
      privateDocumentsIncluded:false,
      confidentialValuationIncluded:false,
      authenticityCertified:false,
      attributionCertified:false,
      investmentReturnProjected:false,
      immutableSourceAuthority:'ARTWORK_PASSPORT'
    }
  };
  return {
    ...canonical,
    projectionSha256:createHash('sha256').update(stable(canonical)).digest('hex')
  };
}
