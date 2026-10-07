import {db} from './runtime-v09.mjs';
import {provenanceEvidencePassport,buildPortableProvenanceBundle} from './provenance-evidence-passport-v43.mjs';

const iso=v=>v?.toISOString?.()||v||null;

export function buildIndependentVerification({objectId,requestedHash=null,passport=null,currentRevision=null,requestedRevision=null,contributions=[],credentials=[]}={}){
  if(!objectId)return {status:'NOT_FOUND',objectId:null};
  if(!passport)return {status:'NOT_FOUND',objectId:String(objectId)};
  const actual=passport.evidencePackageSha256;
  const hashMatches=!requestedHash||String(requestedHash)===actual;
  const superseded=Boolean(requestedRevision&&currentRevision&&String(requestedRevision.id)!==String(currentRevision.id));
  const status=!hashMatches?'MISMATCH':superseded?'SUPERSEDED':'MATCH';
  return {
    status,objectId:String(objectId),requestedHash:requestedHash||null,actualEvidencePackageSha256:actual,hashMatches,
    requestedRevision:requestedRevision?{id:requestedRevision.id,revisionNo:Number(requestedRevision.revision_no??requestedRevision.revisionNo),createdAt:iso(requestedRevision.created_at??requestedRevision.createdAt)}:null,
    currentRevision:currentRevision?{id:currentRevision.id,revisionNo:Number(currentRevision.revision_no??currentRevision.revisionNo),createdAt:iso(currentRevision.created_at??currentRevision.createdAt)}:null,
    superseded,
    provenanceEvents:passport.provenanceEvents.map(x=>({id:x.id,sequenceNo:x.sequenceNo,event:x.event,evidenceClass:x.evidenceClass,evidenceStatus:x.evidenceStatus,evidenceRef:x.evidenceRef,unresolved:x.unresolved,conflict:x.conflict})),
    evidenceSummary:passport.evidenceSummary,
    scholarlyContributions:contributions,
    scopedCredentials:credentials,
    disclosureBoundary:{publicEvidenceOnly:true,ownerIdentityIncluded:false,dealerPrivateDataIncluded:false,commercialTermsIncluded:false,authenticityCertified:false,attributionCertified:false}
  };
}

export async function independentPassportVerification(objectId,{requestedHash=null,revisionId=null}={}){
  if(db.kind!=='POSTGRES')return null;
  const object=(await db.pool.query("SELECT id FROM objects WHERE id=$1 AND publication_status='PUBLIC'",[objectId])).rows[0];
  if(!object)return null;
  const passport=await provenanceEvidencePassport(objectId,{publicOnly:true});
  if(!passport)return null;
  const currentRevision=(await db.pool.query('SELECT id,revision_no,created_at FROM object_passport_revisions WHERE object_id=$1 ORDER BY revision_no DESC LIMIT 1',[objectId])).rows[0]||null;
  const requestedRevision=revisionId?(await db.pool.query('SELECT id,revision_no,created_at FROM object_passport_revisions WHERE object_id=$1 AND id=$2',[objectId,revisionId])).rows[0]||null:null;
  const contributions=(await db.pool.query("SELECT id,contributor_account_id,contributor_organization_id,expertise_claim_id,contribution_type,subject_type,subject_id,summary,disclosure,reviewed_at,published_at FROM scholarly_contributions WHERE status='PUBLISHED' AND ((subject_type='OBJECT' AND subject_id=$1) OR (subject_type='PROVENANCE_EVENT' AND subject_id IN (SELECT id FROM provenance_entries WHERE object_id=$1))) ORDER BY published_at,id",[objectId])).rows.map(x=>({id:x.id,contributorAccountId:x.contributor_account_id,contributorOrganizationId:x.contributor_organization_id,expertiseClaimId:x.expertise_claim_id,contributionType:x.contribution_type,subjectType:x.subject_type,subjectId:x.subject_id,summary:x.summary,disclosureState:Object.keys(x.disclosure||{}).length?'DECLARED':'NOT_DECLARED',reviewedAt:iso(x.reviewed_at),publishedAt:iso(x.published_at)}));
  const credentialRows=(await db.pool.query("SELECT DISTINCT sc.* FROM scholarly_credentials sc JOIN scholarly_contributions c ON c.contributor_account_id=sc.subject_account_id WHERE c.status='PUBLISHED' AND ((c.subject_type='OBJECT' AND c.subject_id=$1) OR (c.subject_type='PROVENANCE_EVENT' AND c.subject_id IN (SELECT id FROM provenance_entries WHERE object_id=$1))) AND sc.status='ACTIVE' AND (sc.valid_from IS NULL OR sc.valid_from<=COALESCE(c.reviewed_at,c.published_at,now())) AND (sc.valid_until IS NULL OR sc.valid_until>=COALESCE(c.reviewed_at,c.published_at,now())) ORDER BY sc.issued_at,sc.id",[objectId])).rows;
  const credentials=credentialRows.map(x=>({id:x.id,issuerOrganizationId:x.issuer_organization_id,subjectAccountId:x.subject_account_id,subjectOrganizationId:x.subject_organization_id,credentialType:x.credential_type,projectRef:x.project_ref,roleLabel:x.role_label,scope:x.scope,status:x.status,validFrom:iso(x.valid_from),validUntil:iso(x.valid_until),issuedAt:iso(x.issued_at)}));
  const verification=buildIndependentVerification({objectId,requestedHash,passport,currentRevision,requestedRevision,contributions,credentials});
  const bundle=buildPortableProvenanceBundle(passport);
  return {...verification,bundleSha256:bundle.bundleSha256};
}
