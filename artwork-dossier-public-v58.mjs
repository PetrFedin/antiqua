import {createHash} from 'node:crypto';
import {projectPublicProvenanceEvidencePassport} from './provenance-evidence-passport-v43.mjs';

export const PUBLIC_ARTWORK_DOSSIER_VERSION_V58='antiqua-artwork-dossier-public-v58';
const FINAL_STATES=new Set(['SOLD','UNSOLD','REOFFERED','VOID']);
const ISO_CURRENCY=/^[A-Z]{3}$/;
const PUBLIC_ID=/^[A-Za-z0-9_.:-]{1,120}$/;
const safeNum=v=>Number.isSafeInteger(Number(v))&&Number(v)>=0?Number(v):null;
const safeDate=v=>{
  if(typeof v!=='string'||!(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/).test(v))return null;
  const d=new Date(v);
  return Number.isFinite(d.getTime())?d.toISOString():null;
};
const stable=x=>{
  if(x===null||typeof x!=='object')return JSON.stringify(x);
  if(Array.isArray(x))return '['+x.map(stable).join(',')+']';
  return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}';
};
function publicClosedSale(row,objectId){
  if(!row||typeof row!=='object'||row.objectId!==objectId)return null;
  const status=String(row.status||'').toUpperCase();
  const auctionId=String(row.auctionId||'');
  if(!FINAL_STATES.has(status)||!PUBLIC_ID.test(auctionId))return null;
  // The collector must never interpret a pending bid/settlement as an actual
  // realized sale. Both status and canonical finality must agree.
  if(row.final!==true||row.auctionState!=='CLOSED')return null;
  // A completed auction is NOT automatically public. A separately verified
  // sale-publication authority must approve disclosure of its result.
  if(row.publicDisclosureApproved!==true)return null;
  const sold=status==='SOLD';
  const realizedAmount=sold?safeNum(row.realizedAmountMinor):null;
  if(sold&&(row.realized!==true||realizedAmount===null))return null;
  const currency=String(row.currency||'').toUpperCase();
  return {
    auctionId,objectId,
    status,final:true,realized:sold,
    currency:ISO_CURRENCY.test(currency)?currency:null,
    endedAt:safeDate(row.endedAt),
    hammerAmountMinor:sold?safeNum(row.hammerAmountMinor):null,
    realizedAmountMinor:realizedAmount
  };
}

export function projectPublicArtworkResearchDossier(source){
  if(!source?.objectId||!source.provenancePassport?.work?.objectId)
    throw new Error('ANTIQUA_PUBLIC_DOSSIER: SOURCE_REQUIRED');
  const objectId=String(source.objectId);
  if(String(source.provenancePassport.work.objectId)!==objectId)
    throw new Error('ANTIQUA_PUBLIC_DOSSIER: ARTWORK_ID_MISMATCH');
  const passport=projectPublicProvenanceEvidencePassport(source.provenancePassport);
  const sales=Array.isArray(source.marketHistory)?source.marketHistory:[];
  const marketHistory=sales.map(row=>publicClosedSale(row,objectId)).filter(Boolean);
  const released={
    schemaVersion:PUBLIC_ARTWORK_DOSSIER_VERSION_V58,
    objectId,
    provenancePassport:passport,
    // Published contribution records can still contain private contributor
    // IDs, notes, media IDs and sensitive scholar credentials. Neither object
    // publication nor a CONTRIBUTION=PUBLISHED flag grants field-level rights.
    scholarlyContributions:[],
    marketHistory,
    boundaries:{
      readModelOnly:true,
      publicSourceFieldsOnly:true,
      credentialProvesRoleNotTruth:true,
      scholarlyDetailsRequireSeparatePublicationGrant:true,
      unpublishedScholarEvidenceIncluded:false,
      sourceAccountAndDocumentIdsIncluded:false,
      sourceUnredactedPassportHashIncluded:false,
      currentAskingPriceIncluded:false,
      auctionBuyerOrSettlementIdentityIncluded:false,
      supersededHistoricalValidityRequiresTimestamp:true,
      conflictsAndGapsPreserved:true,
      authenticityCertified:false,
      evidenceHashScope:'DISCLOSED_FIELDS_ONLY',
      publicationScope:'PUBLIC_REDACTED'
    }
  };
  return {...released,
    publicDossierSha256:createHash('sha256').update(stable(released)).digest('hex')};
}
