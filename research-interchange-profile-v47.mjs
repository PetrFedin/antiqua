import crypto from 'node:crypto';
import {db} from './runtime-v09.mjs';
import {provenanceEvidencePassport} from './provenance-evidence-passport-v43.mjs';

export const ANTIQUA_RESEARCH_INTERCHANGE_PROFILE='antiqua-research-interchange-profile-v1';

const clone=x=>x==null?x:structuredClone(x);
const stable=value=>{
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
};
const sha=value=>crypto.createHash('sha256').update(stable(value)).digest('hex');
const arr=v=>Array.isArray(v)?v.filter(Boolean):[];
const publicIdentifier=x=>x&&typeof x==='object'?{
  scheme:String(x.scheme||x.type||'UNSPECIFIED'),
  value:String(x.value||x.id||''),
  institutionId:x.institutionId?String(x.institutionId):null,
  status:String(x.status||'UNREVIEWED'),
  sourceRef:x.sourceRef?String(x.sourceRef):null
}:null;

export function buildResearchInterchangeProfile({
  passport,
  objectMetadata={},
  exhibitions=[],
  bibliography=[],
  institutionalIdentifiers=[],
  media=[],
  scholarlyContributions=[],
  scopedCredentials=[]
}={}){
  if(!passport?.work?.objectId)throw Object.assign(new Error('Passport required'),{code:'INTERCHANGE_PASSPORT_REQUIRED'});
  const provenanceEvents=passport.provenanceEvents.map(x=>({
    id:x.id,
    sequenceNo:x.sequenceNo,
    event:clone(x.event),
    evidence:{class:x.evidenceClass,status:x.evidenceStatus,reference:x.evidenceRef},
    uncertainty:{unresolved:Boolean(x.unresolved),conflict:Boolean(x.conflict)}
  }));
  const canonical={
    profileVersion:ANTIQUA_RESEARCH_INTERCHANGE_PROFILE,
    work:{
      canonicalId:passport.work.objectId,
      objectCode:passport.work.objectCode||null,
      title:clone(passport.work.title),
      maker:clone(passport.work.maker)
    },
    attribution:{
      status:passport.work.attributionStatus,
      certified:false,
      conflictingAssertionsPreserved:true
    },
    provenanceEvents,
    exhibitions:arr(exhibitions).map(clone),
    bibliography:arr(bibliography).map(clone),
    institutionalIdentifiers:arr(institutionalIdentifiers).map(publicIdentifier).filter(x=>x?.value),
    media:arr(media).map(x=>({
      id:x.id||null,
      type:x.type||null,
      url:x.url||null,
      iiifManifest:x.iiifManifest||x.iiif_manifest||null,
      rights:clone(x.rights||null),
      publicationState:x.publicationState||x.publication_state||'UNSPECIFIED'
    })),
    rights:{
      metadata:clone(objectMetadata.metadataRights||objectMetadata.metadata_rights||null),
      media:clone(objectMetadata.mediaRights||objectMetadata.media_rights||null),
      rightsIndependent:true
    },
    revision:passport.passportRevision?{
      id:passport.passportRevision.revisionId,
      number:passport.passportRevision.revisionNo,
      passportHash:passport.passportRevision.passportHash,
      previousHash:passport.passportRevision.previousHash,
      changeKind:passport.passportRevision.changeKind,
      createdAt:passport.passportRevision.createdAt,
      supersessionExplicit:true
    }:null,
    evidenceState:{
      completeness:passport.evidenceSummary.completeness,
      gaps:clone(passport.evidenceSummary.gapIndex||null),
      unresolvedEventIds:clone(passport.evidenceSummary.unresolvedEventIds||[]),
      conflictEventIds:clone(passport.evidenceSummary.conflictEventIds||[])
    },
    scholarlyContext:{
      contributions:arr(scholarlyContributions).map(clone),
      credentials:arr(scopedCredentials).map(clone)
    },
    boundaries:{
      uncertaintyFlattened:false,
      conflictingAssertionsPreserved:true,
      privateOwnerIdentityIncluded:false,
      privateDealerDataIncluded:false,
      commercialTermsIncluded:false,
      authenticityCertified:false
    },
    lineage:clone(passport.lineage)
  };
  return {...canonical,interchangeSha256:sha(canonical)};
}

export async function researchInterchangeProfile(objectId){
  if(db.kind!=='POSTGRES')return null;
  const row=(await db.pool.query("SELECT id,passport FROM objects WHERE id=$1 AND publication_status='PUBLIC'",[objectId])).rows[0];
  if(!row)return null;
  const passport=await provenanceEvidencePassport(objectId,{publicOnly:true});
  if(!passport)return null;
  const p=row.passport||{};
  const exhibitions=arr(p.exhibitions);
  const bibliography=arr(p.bibliography||p.references);
  const institutionalIdentifiers=arr(p.institutionalIdentifiers||p.identifiers);
  const media=arr(p.media||p.images);
  const contributions=(await db.pool.query("SELECT id,contributor_account_id AS "contributorAccountId",contributor_organization_id AS "contributorOrganizationId",contribution_type AS "contributionType",subject_type AS "subjectType",subject_id AS "subjectId",summary,reviewed_at AS "reviewedAt",published_at AS "publishedAt" FROM scholarly_contributions WHERE status='PUBLISHED' AND ((subject_type='OBJECT' AND subject_id=$1) OR (subject_type='PROVENANCE_EVENT' AND subject_id IN (SELECT id FROM provenance_entries WHERE object_id=$1))) ORDER BY published_at,id",[objectId])).rows;
  const accountIds=[...new Set(contributions.map(x=>x.contributorAccountId).filter(Boolean))];
  let credentials=[];
  if(accountIds.length){
    credentials=(await db.pool.query("SELECT id,issuer_organization_id AS "issuerOrganizationId",subject_account_id AS "subjectAccountId",subject_organization_id AS "subjectOrganizationId",credential_type AS "credentialType",project_ref AS "projectRef",role_label AS "roleLabel",scope,status,valid_from AS "validFrom",valid_until AS "validUntil",issued_at AS "issuedAt" FROM scholarly_credentials WHERE status='ACTIVE' AND subject_account_id=ANY($1::text[]) ORDER BY issued_at,id",[accountIds])).rows;
  }
  return buildResearchInterchangeProfile({passport,objectMetadata:p,exhibitions,bibliography,institutionalIdentifiers,media,scholarlyContributions:contributions,scopedCredentials:credentials});
}
