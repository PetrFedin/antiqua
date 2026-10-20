// ANTIQUA v87: explanatory public-evidence checklist, never a score,
// authentication certificate, legal-title guarantee or automated valuation.
import {createHash} from 'node:crypto';
import {DECISION_DOSSIER_SCHEMA} from './decision-dossier-v56.mjs';

export const READINESS_SCHEMA_V87='antiqua-decision-readiness-v1';
const SHA=/^[0-9a-f]{64}$/;
const fail=()=>{throw Object.assign(new Error('Public Decision Dossier required'),{code:'PUBLIC_DECISION_SOURCE_REQUIRED'})};
const stable=v=>{
 if(v===null||typeof v!=='object')return JSON.stringify(v);
 if(Array.isArray(v))return '['+v.map(stable).join(',')+']';
 return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';
};
const step=(code,status,action)=>({code,status,action});
const publicStatus=new Set(['CONFLICTED','INCOMPLETE','NO_PROVENANCE_EVIDENCE','EVIDENCE_INDEXED']);
const hasText=v=>typeof v==='string'&&v.trim().length>0||
 Boolean(v&&typeof v==='object'&&['ru','en','it'].some(k=>typeof v[k]==='string'&&v[k].trim()));
export function buildDecisionReadinessV87(dossier){
 const disclosure=dossier?.disclosure,source=dossier?.source,provenance=dossier?.provenance;
 if(dossier?.schemaVersion!==DECISION_DOSSIER_SCHEMA||
    typeof dossier.objectId!=='string'||!dossier.objectId||
    !SHA.test(dossier.projectionSha256||'')||
    source?.evidenceHashScope!=='DISCLOSED_FIELDS_ONLY'||
    !SHA.test(source?.publicEvidenceProjectionSha256||'')||
    disclosure?.scope!=='PUBLIC_ONLY'||
    disclosure?.authenticityCertified!==false||
    disclosure?.attributionCertified!==false||
    disclosure?.privateOwnerIdentityIncluded!==false||
    disclosure?.privateDocumentsIncluded!==false||
    disclosure?.privateEventIdsIncluded!==false||
    disclosure?.privateSaleIdentityIncluded!==false||
    disclosure?.investmentReturnProjected!==false||
    !Array.isArray(provenance?.events)||
    !publicStatus.has(provenance?.status)||
    !Array.isArray(dossier.marketHistory))fail();

 const attribution=String(dossier.work?.attributionStatus||'UNSPECIFIED');
 const provenanceStatus=provenance.status==='CONFLICTED'?'CONFLICTED':
   provenance.status==='EVIDENCE_INDEXED'?'INDEXED_UNCERTIFIED':
   provenance.status==='NO_PROVENANCE_EVIDENCE'?'NO_PUBLIC_RECORDS':'INCOMPLETE';
 const checks=[
  step('ARTWORK_IDENTITY',hasText(dossier.work?.title)&&hasText(dossier.work?.artist)?
     'RECORDED':'INCOMPLETE','REVIEW_IDENTITY'),
  step('ATTRIBUTION',attribution==='DISPUTED'?'DISPUTED':
     ['UNKNOWN','UNSPECIFIED','PENDING'].includes(attribution)?'UNRESOLVED':'RECORDED_UNCERTIFIED','VERIFY_ATTRIBUTION'),
  step('PROVENANCE',provenanceStatus,'REVIEW_PROVENANCE'),
  step('CONDITION',dossier.condition?.status==='NOT_ASSESSED'?'NOT_ASSESSED':'HUMAN_ASSESSMENT_REQUIRED','REQUEST_CONDITION_REPORT'),
  step('SCHOLARSHIP',dossier.scholarlyDisclosureStatus==='REQUIRES_EXPLICIT_PUBLICATION_GRANT'?
     'NOT_PUBLICLY_RELEASED':'REQUIRES_REVIEW','REQUEST_SCHOLARLY_SOURCES'),
  step('SALE_HISTORY',dossier.marketHistory.some(x=>x.status==='SOLD'&&x.realizedAmountMinor!=null)?
     'PUBLIC_RESULT_RECORDED':'NO_PUBLIC_RESULTS','REVIEW_MARKET_RECORDS'),
  step('LEGAL_TITLE','NOT_VERIFIED','REQUEST_TITLE_EVIDENCE'),
  step('IMAGE_RIGHTS','NOT_INDEPENDENTLY_VERIFIED','REQUEST_RIGHTS_REVIEW')
 ];
 const report={
  schemaVersion:READINESS_SCHEMA_V87,objectId:dossier.objectId,
  sourceProjectionSha256:dossier.projectionSha256,
  decisionState:'HUMAN_REVIEW_REQUIRED',
  checks,
  boundaries:{
   proofOfAuthenticity:false,proofOfLegalTitle:false,
   conditionAssessed:false,priceOrReturnRecommendation:false,
   privateDataAccessGranted:false,privateRoomCreated:false
  }
 };
 return {...report,reportSha256:createHash('sha256').update(stable(report)).digest('hex')};
}
