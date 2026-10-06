import {db,uid} from './runtime-v09.mjs';
import {requireOrganizationRole} from './organizations-v15.mjs';

const TYPES=new Set(['CATALOGUE_COMMITTEE_MEMBER','INSTITUTIONAL_CONTRIBUTOR','PROVENANCE_REVIEW_PARTICIPANT','CATALOGUE_RAISONNE_RESEARCHER','IIIF_LINKED_ART_INTEGRATION_PARTNER','OTHER']);
const fail=(status,code,message)=>{const e=new Error(message);e.status=status;e.code=code;throw e};
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};

export function scholarlyCredentialCapabilities(){
  return {
    contractVersion:'v45',
    model:'SCOPED_ROLE_ATTESTATION',
    provesScholarlyCorrectness:false,
    provesAuthenticity:false,
    supportsRevocation:true,
    supportsSupersession:true,
    credentialTypes:[...TYPES]
  };
}

export function publicCredentialProjection(row){
  if(!row)return null;
  return {
    id:row.id,
    issuerOrganizationId:row.issuer_organization_id??row.issuerOrganizationId,
    subjectAccountId:row.subject_account_id??row.subjectAccountId??null,
    subjectOrganizationId:row.subject_organization_id??row.subjectOrganizationId??null,
    credentialType:row.credential_type??row.credentialType,
    projectRef:row.project_ref??row.projectRef,
    roleLabel:row.role_label??row.roleLabel,
    scope:row.scope||{},
    status:row.status,
    validFrom:row.valid_from??row.validFrom??null,
    validUntil:row.valid_until??row.validUntil??null,
    supersedesCredentialId:row.supersedes_credential_id??row.supersedesCredentialId??null,
    issuedAt:row.issued_at??row.issuedAt??null,
    assertions:{roleScopeAttested:true,scholarlyConclusionCertified:false,authenticityCertified:false}
  };
}

export async function issueScholarlyCredential(account,input={}){
  const issuerOrganizationId=String(input.issuerOrganizationId||'').trim();
  if(!issuerOrganizationId)fail(400,'CREDENTIAL_ISSUER_REQUIRED','issuerOrganizationId required');
  await requireOrganizationRole(account.id,issuerOrganizationId,['OWNER','ADMIN']);
  const credentialType=String(input.credentialType||'').toUpperCase();
  if(!TYPES.has(credentialType))fail(400,'CREDENTIAL_TYPE_INVALID','Invalid credential type');
  const projectRef=String(input.projectRef||'').trim(),roleLabel=String(input.roleLabel||'').trim();
  if(!projectRef||!roleLabel)fail(400,'CREDENTIAL_SCOPE_REQUIRED','projectRef and roleLabel required');
  const subjectAccountId=input.subjectAccountId?String(input.subjectAccountId):null;
  const subjectOrganizationId=input.subjectOrganizationId?String(input.subjectOrganizationId):null;
  if(!subjectAccountId&&!subjectOrganizationId)fail(400,'CREDENTIAL_SUBJECT_REQUIRED','Credential subject required');
  const id=uid('scholarly-credential');
  const r=(await db.pool.query(`INSERT INTO scholarly_credentials
    (id,issuer_organization_id,subject_account_id,subject_organization_id,credential_type,project_ref,role_label,scope,evidence,status,valid_from,valid_until,issued_by_account_id,issued_at,created_at,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'ACTIVE',$10,$11,$12,now(),now(),now()) RETURNING *`,
    [id,issuerOrganizationId,subjectAccountId,subjectOrganizationId,credentialType,projectRef,roleLabel,obj(input.scope),obj(input.evidence),input.validFrom||null,input.validUntil||null,account.id])).rows[0];
  return publicCredentialProjection(r);
}

export async function revokeScholarlyCredential(account,id,{reason=''}={}){
  const row=(await db.pool.query('SELECT * FROM scholarly_credentials WHERE id=$1',[id])).rows[0];
  if(!row)fail(404,'CREDENTIAL_NOT_FOUND','Credential not found');
  await requireOrganizationRole(account.id,row.issuer_organization_id,['OWNER','ADMIN']);
  const r=(await db.pool.query("UPDATE scholarly_credentials SET status='REVOKED',revoked_at=now(),revocation_reason=$2,updated_at=now() WHERE id=$1 RETURNING *",[id,String(reason||'').slice(0,2000)])).rows[0];
  return publicCredentialProjection(r);
}

export async function publicCredentialsForSubject({accountId=null,organizationId=null}={}){
  if(!accountId&&!organizationId)return[];
  const rows=(await db.pool.query(`SELECT * FROM scholarly_credentials
    WHERE status='ACTIVE' AND (($1::text IS NOT NULL AND subject_account_id=$1) OR ($2::text IS NOT NULL AND subject_organization_id=$2))
    AND (valid_until IS NULL OR valid_until>now()) ORDER BY issued_at DESC,id`,[accountId,organizationId])).rows;
  return rows.map(publicCredentialProjection);
}
