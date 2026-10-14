import crypto from 'node:crypto';
import {db} from './runtime-v09.mjs';
import {provenanceEvidencePassport} from './provenance-evidence-passport-v43.mjs';
import {projectPublicResearchInterchangeProfile} from './research-interchange-public-v58.mjs';

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
  const row=(await db.pool.query(
    "SELECT id FROM objects WHERE id=$1 AND publication_status='PUBLIC'",
    [objectId]
  )).rows[0];
  if(!row)return null;
  const passport=await provenanceEvidencePassport(objectId,{publicOnly:true});
  if(!passport)return null;
  // Public exchange must not query private scholar accounts, credential
  // scopes, full media, confidential catalogue notes or document locators.
  // Explicit per-record publication grants are a separate future authority.
  const source=buildResearchInterchangeProfile({passport});
  return projectPublicResearchInterchangeProfile(source);
}
