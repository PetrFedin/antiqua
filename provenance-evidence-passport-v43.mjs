import crypto from 'node:crypto';
import {db,lot} from './runtime-v09.mjs';

export const PROVENANCE_PASSPORT_VERSION='antiqua-provenance-evidence-passport-v1';
export const EVIDENCE_CLASSES=Object.freeze([
  'PRIMARY_DOCUMENT','INSTITUTIONAL_RECORD','AUCTION_DEALER_RECORD',
  'SCHOLARLY_PUBLICATION','OWNER_DEALER_STATEMENT','EXPERT_INTERPRETATION',
  'MACHINE_CANDIDATE','UNSPECIFIED'
]);

const clone=x=>x==null?x:structuredClone(x);
const stable=value=>{
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
};
const sha=value=>crypto.createHash('sha256').update(stable(value)).digest('hex');
const up=v=>String(v??'').trim().toUpperCase();
const evidenceClass=v=>EVIDENCE_CLASSES.includes(up(v))?up(v):'UNSPECIFIED';

function unresolvedEntry(entry){
  const status=up(entry.evidenceStatus);
  return !entry.evidenceRef || !status || ['UNVERIFIED','UNKNOWN','PENDING','DISPUTED','UNRESOLVED','CANDIDATE'].includes(status);
}

export function buildProvenanceEvidencePassport({object,latestRevision=null,entries=[]}={}){
  if(!object?.id)throw Object.assign(new Error('Object required'),{code:'PROVENANCE_PASSPORT_OBJECT_REQUIRED'});
  const normalized=[...entries].sort((a,b)=>Number(a.sequenceNo)-Number(b.sequenceNo)||String(a.id).localeCompare(String(b.id))).map(raw=>({
    id:String(raw.id),
    sequenceNo:Number(raw.sequenceNo),
    event:clone(raw.event)||{},
    evidenceClass:evidenceClass(raw.evidenceClass),
    evidenceStatus:String(raw.evidenceStatus||'UNSPECIFIED'),
    evidenceRef:raw.evidenceRef||null,
    createdAt:raw.createdAt||null,
    unresolved:unresolvedEntry(raw),
    conflict:Boolean(raw?.event?.conflict===true||raw?.event?.status==='CONFLICT')
  }));
  const unresolved=normalized.filter(x=>x.unresolved).map(x=>x.id);
  const conflicts=normalized.filter(x=>x.conflict).map(x=>x.id);
  const attributionStatus=String(object?.passport?.attributionStatus||object?.attributionStatus||'UNSPECIFIED');
  const canonical={
    schemaVersion:PROVENANCE_PASSPORT_VERSION,
    work:{
      objectId:object.id,
      objectCode:object.objectCode||object.object_code||null,
      title:clone(object?.passport?.title||object?.title||null),
      maker:clone(object?.passport?.maker||object?.maker||null),
      attributionStatus
    },
    passportRevision:latestRevision?{
      revisionId:latestRevision.id,
      revisionNo:Number(latestRevision.revisionNo??latestRevision.revision_no),
      passportHash:latestRevision.passportHash??latestRevision.passport_hash??null,
      previousHash:latestRevision.previousHash??latestRevision.previous_hash??null,
      changeKind:latestRevision.changeKind??latestRevision.change_kind??null,
      createdAt:latestRevision.createdAt??latestRevision.created_at??null
    }:null,
    provenanceEvents:normalized,
    evidenceSummary:{
      totalEvents:normalized.length,
      byClass:Object.fromEntries(EVIDENCE_CLASSES.map(c=>[c,normalized.filter(x=>x.evidenceClass===c).length])),
      unresolvedEventIds:unresolved,
      conflictEventIds:conflicts,
      completeness:normalized.length===0?'EMPTY':conflicts.length?'CONFLICTED':unresolved.length?'INCOMPLETE':'EVIDENCED'
    },
    assertions:{
      authenticityCertified:false,
      attributionCertified:false,
      provenanceComplete:normalized.length>0&&unresolved.length===0&&conflicts.length===0
    },
    lineage:{
      objectAuthority:'objects',
      provenanceAuthority:'provenance_entries',
      revisionAuthority:'object_passport_revisions'
    }
  };
  return {...canonical,evidencePackageSha256:sha(canonical)};
}

function mapObject(row){
  return {
    id:row.id,
    objectCode:row.object_code,
    passport:row.passport||{},
    publicationStatus:row.publication_status
  };
}
function mapEntry(row){
  return {
    id:row.id,sequenceNo:Number(row.sequence_no),event:row.event||{},
    evidenceClass:row.evidence_class,evidenceStatus:row.evidence_status,
    evidenceRef:row.evidence_ref,createdAt:row.created_at?.toISOString?.()||row.created_at||null
  };
}

export async function provenanceEvidencePassport(objectId,{publicOnly=true}={}){
  if(db.kind==='POSTGRES'){
    const objectRow=(await db.pool.query(
      `SELECT id,object_code,passport,publication_status FROM objects WHERE id=$1${publicOnly?" AND publication_status='PUBLIC'":''}`,
      [objectId]
    )).rows[0];
    if(!objectRow)return null;
    const entries=(await db.pool.query(
      'SELECT id,sequence_no,event,evidence_class,evidence_status,evidence_ref,created_at FROM provenance_entries WHERE object_id=$1 ORDER BY sequence_no,id',
      [objectId]
    )).rows.map(mapEntry);
    const latest=(await db.pool.query(
      'SELECT id,revision_no,passport_hash,previous_hash,change_kind,created_at FROM object_passport_revisions WHERE object_id=$1 ORDER BY revision_no DESC LIMIT 1',
      [objectId]
    )).rows[0]||null;
    return buildProvenanceEvidencePassport({object:mapObject(objectRow),latestRevision:latest,entries});
  }
  const object=lot(objectId);
  if(!object)return null;
  const source=object.provenance?.en||object.provenance?.ru||[];
  const values=Array.isArray(source)?source:[source];
  const entries=values.filter(Boolean).map((text,index)=>({
    id:`preview-prov-${objectId}-${index+1}`,
    sequenceNo:index+1,
    event:{description:String(text),preview:true},
    evidenceClass:'UNSPECIFIED',
    evidenceStatus:'UNVERIFIED',
    evidenceRef:null,
    createdAt:null
  }));
  return buildProvenanceEvidencePassport({object:{id:object.id,objectCode:object.objectCode||object.id,passport:object},entries});
}
