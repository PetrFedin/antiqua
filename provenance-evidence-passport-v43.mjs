import crypto from 'node:crypto';
import {db,lot,lots} from './runtime-v09.mjs';

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

export const EVIDENCE_GAP_CODES=Object.freeze([
  'NO_PROVENANCE_EVENTS',
  'MISSING_EVIDENCE_REFERENCE',
  'UNRESOLVED_EVIDENCE_STATUS',
  'UNCLASSIFIED_EVIDENCE',
  'CONFLICTING_ASSERTION'
]);

function eventGapCodes(entry){
  const gaps=[];
  const status=up(entry.evidenceStatus);
  if(!entry.evidenceRef)gaps.push('MISSING_EVIDENCE_REFERENCE');
  if(!status||['UNVERIFIED','UNKNOWN','PENDING','DISPUTED','UNRESOLVED','CANDIDATE'].includes(status))gaps.push('UNRESOLVED_EVIDENCE_STATUS');
  if(evidenceClass(entry.evidenceClass)==='UNSPECIFIED')gaps.push('UNCLASSIFIED_EVIDENCE');
  if(entry?.event?.conflict===true||up(entry?.event?.status)==='CONFLICT')gaps.push('CONFLICTING_ASSERTION');
  return gaps;
}

function summarizeGapIndex(rows){
  const eventGaps=rows.map(row=>({eventId:String(row.id),codes:eventGapCodes(row)})).filter(x=>x.codes.length);
  const byCode=Object.fromEntries(EVIDENCE_GAP_CODES.map(code=>[code,0]));
  if(rows.length===0)byCode.NO_PROVENANCE_EVENTS=1;
  for(const item of eventGaps)for(const code of item.codes)byCode[code]+=1;
  const totalGaps=Object.values(byCode).reduce((a,b)=>a+Number(b||0),0);
  return {totalGaps,byCode,eventGaps};
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
  const gapIndex=summarizeGapIndex(normalized);
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
      completeness:normalized.length===0?'EMPTY':conflicts.length?'CONFLICTED':unresolved.length?'INCOMPLETE':'EVIDENCED',
      gapIndex
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

export function buildProvenanceEvidenceOverview({objects=[],entries=[]}={}){
  const byObject=new Map(objects.map(object=>[String(object.id),[]]));
  for(const raw of entries){
    const objectId=String(raw.objectId??raw.object_id??'');
    if(!byObject.has(objectId))continue;
    byObject.get(objectId).push({
      id:String(raw.id),
      sequenceNo:Number(raw.sequenceNo??raw.sequence_no??0),
      event:clone(raw.event)||{},
      evidenceClass:evidenceClass(raw.evidenceClass??raw.evidence_class),
      evidenceStatus:String(raw.evidenceStatus??raw.evidence_status??'UNSPECIFIED'),
      evidenceRef:raw.evidenceRef??raw.evidence_ref??null,
      createdAt:raw.createdAt??raw.created_at??null
    });
  }
  const works=objects.map(object=>{
    const rows=byObject.get(String(object.id))||[];
    const unresolved=rows.filter(unresolvedEntry).length;
    const conflicts=rows.filter(row=>row?.event?.conflict===true||row?.event?.status==='CONFLICT').length;
    const completeness=rows.length===0?'EMPTY':conflicts?'CONFLICTED':unresolved?'INCOMPLETE':'EVIDENCED';
    const gapIndex=summarizeGapIndex(rows);
    return {
      objectId:String(object.id),
      eventCount:rows.length,
      unresolvedEvents:unresolved,
      conflictEvents:conflicts,
      gapCount:gapIndex.totalGaps,
      gapCodes:Object.entries(gapIndex.byCode).filter(([,count])=>count>0).map(([code])=>code),
      completeness
    };
  });
  const classCounts=Object.fromEntries(EVIDENCE_CLASSES.map(c=>[c,0]));
  for(const raw of entries){
    const objectId=String(raw.objectId??raw.object_id??'');
    if(!byObject.has(objectId))continue;
    classCounts[evidenceClass(raw.evidenceClass??raw.evidence_class)]+=1;
  }
  const canonical={
    schemaVersion:'antiqua-provenance-evidence-overview-v1',
    publicWorks:works.length,
    worksWithProvenance:works.filter(x=>x.eventCount>0).length,
    provenanceEvents:works.reduce((n,x)=>n+x.eventCount,0),
    resolvedEvents:works.reduce((n,x)=>n+Math.max(0,x.eventCount-x.unresolvedEvents-x.conflictEvents),0),
    unresolvedEvents:works.reduce((n,x)=>n+x.unresolvedEvents,0),
    conflictEvents:works.reduce((n,x)=>n+x.conflictEvents,0),
    completeWorks:works.filter(x=>x.completeness==='EVIDENCED').length,
    incompleteWorks:works.filter(x=>x.completeness==='INCOMPLETE').length,
    conflictedWorks:works.filter(x=>x.completeness==='CONFLICTED').length,
    emptyWorks:works.filter(x=>x.completeness==='EMPTY').length,
    evidenceClasses:classCounts,
    evidenceGaps:Object.fromEntries(EVIDENCE_GAP_CODES.map(code=>[code,works.reduce((sum,work)=>sum+(work.gapCodes.includes(code)?1:0),0)])),
    worksWithEvidenceGaps:works.filter(x=>x.gapCount>0).length,
    works,
    assertions:{
      authenticityCertified:false,
      universalScoreUsed:false
    },
    lineage:{
      objectAuthority:'objects',
      provenanceAuthority:'provenance_entries'
    }
  };
  return {...canonical,evidenceOverviewSha256:sha(canonical)};
}

export async function provenanceEvidenceOverview(){
  if(db.kind==='POSTGRES'){
    const objects=(await db.pool.query(
      "SELECT id FROM objects WHERE publication_status='PUBLIC' ORDER BY id"
    )).rows;
    const entries=(await db.pool.query(
      `SELECT pe.object_id,pe.id,pe.sequence_no,pe.event,pe.evidence_class,pe.evidence_status,pe.evidence_ref,pe.created_at
       FROM provenance_entries pe
       JOIN objects o ON o.id=pe.object_id
       WHERE o.publication_status='PUBLIC'
       ORDER BY pe.object_id,pe.sequence_no,pe.id`
    )).rows;
    return buildProvenanceEvidenceOverview({objects,entries});
  }
  const objects=lots.map(x=>({id:x.id}));
  const entries=[];
  for(const object of lots){
    const source=object.provenance?.en||object.provenance?.ru||[];
    const values=Array.isArray(source)?source:[source];
    values.filter(Boolean).forEach((text,index)=>entries.push({
      objectId:object.id,
      id:`preview-prov-${object.id}-${index+1}`,
      sequenceNo:index+1,
      event:{description:String(text),preview:true},
      evidenceClass:'UNSPECIFIED',
      evidenceStatus:'UNVERIFIED',
      evidenceRef:null
    }));
  }
  return buildProvenanceEvidenceOverview({objects,entries});
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

export function buildPortableProvenanceBundle(passport){
  if(!passport?.work?.objectId)throw Object.assign(new Error('Passport required'),{code:'PROVENANCE_BUNDLE_PASSPORT_REQUIRED'});
  // Portable bundles are always public/redacted projections, even when a
  // caller accidentally passes a privileged source passport.
  const released=projectPublicProvenanceEvidencePassport(passport);
  const canonical={
    schemaVersion:'antiqua-provenance-partner-bundle-v1',
    work:{
      objectId:released.work.objectId,
      objectCode:released.work.objectCode,
      title:released.work.title,
      maker:released.work.maker,
      attributionStatus:released.work.attributionStatus
    },
    passportRevision:released.passportRevision,
    evidenceSummary:released.evidenceSummary,
    provenanceEvents:released.provenanceEvents,
    lineage:released.lineage,
    // Compatibility alias: sourcePassportSha256 identifies PUBLIC projection
    // only, never the undisclosed canonical scholarly evidence package.
    sourcePassportSha256:released.evidencePackageSha256,
    sourcePublicProjectionSha256:released.evidencePackageSha256,
    disclosureBoundary:{
      ownerIdentityIncluded:false,
      accountDataIncluded:false,
      commercialTermsIncluded:false,
      authenticityCertified:false,
      attributionCertified:false,
      sourceHashScope:'DISCLOSED_FIELDS_ONLY',
      canonicalPrivatePassportHashIncluded:false
    },
    signature:{status:'unsigned',issuer:null}
  };
  return {...canonical,bundleSha256:sha(canonical)};
}

// v0.57 security boundary: PUBLIC object status does not automatically
// authorize the disclosure of arbitrary provenance event JSON or evidenceRef.
// A published painting can still contain private ownership and storage evidence.
// Preserve the canonical research assessment, but emit only whitelisted fields.
const PUBLIC_PROVENANCE_EVENT_KINDS=new Set([
  'EXHIBITION','PUBLICATION','OWNERSHIP','TRANSFER','SALE',
  'AUCTION','CONSERVATION','RESTORATION','ATTRIBUTION','OTHER'
]);
const PUBLIC_EVIDENCE_STATUSES=new Set([
  'VERIFIED','UNVERIFIED','PENDING','UNKNOWN','UNRESOLVED',
  'DISPUTED','CANDIDATE','REJECTED','UNSPECIFIED'
]);
// Internal event IDs may contain names, private file locators, or tokens even
// if they look like valid ordinary identifiers. Never echo them publicly.
const publicEventId=index=>'public-event-'+(index+1);
const safePublicStatus=(value,allowed,fallback)=>
  allowed.has(String(value??'').trim().toUpperCase())?String(value).trim().toUpperCase():fallback;
const PUBLIC_ATTRIBUTION_STATUSES=new Set([
  'UNSPECIFIED','UNKNOWN','ATTRIBUTED','CONFIRMED','DISPUTED','PENDING',
  'SIGNED','SCHOOL_OF','CIRCLE_OF','FOLLOWER_OF','AFTER','WORKSHOP_OF'
]);
const publicRevisionNo=value=>{
  const n=Number(value);
  return Number.isSafeInteger(n)&&n>0?n:null;
};
const publicDate=value=>{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value))return null;
  const d=new Date(value);
  return Number.isFinite(d.getTime())?d.toISOString():null;
};
const publicText=value=>{
  if(typeof value==='string')return value.slice(0,500);
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const translations={};
  for(const language of ['ru','en','it'])
    if(typeof value[language]==='string')
      translations[language]=value[language].slice(0,500);
  return Object.keys(translations).length?translations:null;
};
export function projectPublicProvenanceEvidencePassport(passport){
  if(!passport?.work?.objectId)
    throw new Error('PUBLIC_PROVENANCE_SOURCE_REQUIRED');
  const events=Array.isArray(passport.provenanceEvents)?passport.provenanceEvents:[];
  const normalized=events.map((entry,index)=>{
    const kind=String(entry.event?.kind||'').toUpperCase();
    const status=String(entry.evidenceStatus||'').toUpperCase();
    const seq=Number(entry.sequenceNo);
    return {
      id:publicEventId(index),
      sequenceNo:Number.isSafeInteger(seq)&&seq>0?seq:index+1,
      event:{kind:PUBLIC_PROVENANCE_EVENT_KINDS.has(kind)?kind:'OTHER'},
      evidenceClass:evidenceClass(entry.evidenceClass),
      evidenceStatus:PUBLIC_EVIDENCE_STATUSES.has(status)?status:'UNSPECIFIED',
      evidenceRef:null,
      evidenceReferenceRecorded:Boolean(entry.evidenceRef||entry.evidenceReferenceRecorded),
      unresolved:Boolean(entry.unresolved),
      conflict:Boolean(entry.conflict)
    };
  });
  const summary=passport.evidenceSummary||{};
  const allowedGapCodes=EVIDENCE_GAP_CODES;
  const eventGaps=Array.isArray(summary.gapIndex?.eventGaps)
    ?summary.gapIndex.eventGaps.map(x=>{
      const index=events.findIndex(e=>String(e.id)===String(x.eventId));
      if(index<0)return null;
      const codes=[...new Set(Array.isArray(x.codes)?x.codes.filter(code=>allowedGapCodes.includes(code)):[])];
      return codes.length?{eventId:normalized[index].id,codes}:null;
    }).filter(Boolean):[];
  const byCode=Object.fromEntries(allowedGapCodes.map(code=>[code,0]));
  if(!normalized.length)byCode.NO_PROVENANCE_EVENTS=1;
  for(const item of eventGaps)for(const code of item.codes)byCode[code]++;
  const safeSummary={
    totalEvents:normalized.length,
    byClass:Object.fromEntries(EVIDENCE_CLASSES.map(c=>[c,normalized.filter(x=>x.evidenceClass===c).length])),
    unresolvedEventIds:normalized.filter(x=>x.unresolved).map(x=>x.id),
    conflictEventIds:normalized.filter(x=>x.conflict).map(x=>x.id),
    completeness:!normalized.length?'EMPTY':normalized.some(x=>x.conflict)?'CONFLICTED':
      normalized.some(x=>x.unresolved)?'INCOMPLETE':'EVIDENCED',
    gapIndex:{
      totalGaps:Object.values(byCode).reduce((a,b)=>a+b,0),
      byCode,
      eventGaps
    }
  };
  const revision=passport.passportRevision;
  const released={
    schemaVersion:PROVENANCE_PASSPORT_VERSION,
    work:{
      objectId:String(passport.work.objectId),
      objectCode:publicText(passport.work.objectCode),
      title:publicText(passport.work.title),
      maker:publicText(passport.work.maker),
      attributionStatus:safePublicStatus(passport.work.attributionStatus,PUBLIC_ATTRIBUTION_STATUSES,'UNSPECIFIED')
    },
    passportRevision:revision?{
      revisionId:publicRevisionNo(revision.revisionNo)==null?null:'public-revision-'+publicRevisionNo(revision.revisionNo),
      revisionNo:publicRevisionNo(revision.revisionNo),
      createdAt:publicDate(revision.createdAt)
    }:null,
    provenanceEvents:normalized,
    evidenceSummary:safeSummary,
    assertions:{
      authenticityCertified:false,
      attributionCertified:false,
      provenanceComplete:Boolean(passport.assertions?.provenanceComplete)
    },
    lineage:{
      objectAuthority:'objects',
      provenanceAuthority:'provenance_entries',
      revisionAuthority:'object_passport_revisions'
    },
    disclosureBoundary:{
      scope:'PUBLIC_REDACTED',
      arbitraryEventJSONIncluded:false,
      ownerIdentityIncluded:false,
      exactStorageLocationIncluded:false,
      rawEvidenceReferenceIncluded:false,
      privateDocumentIncluded:false,
      evidenceHashScope:'DISCLOSED_FIELDS_ONLY',
      sourceEventIdsIncluded:false,
      sourceRevisionIdIncluded:false
    }
  };
  // This is a SHA-256 of released fields. It does NOT attest the unredacted
  // evidence package or the artwork's authenticity.
  return {...released,evidencePackageSha256:sha(released)};
}

export async function portableProvenanceBundle(objectId,{publicOnly=true}={}){
  const passport=await provenanceEvidencePassport(objectId,{publicOnly});
  return passport?buildPortableProvenanceBundle(passport):null;
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
    const source=buildProvenanceEvidencePassport({object:mapObject(objectRow),latestRevision:latest,entries});
    return publicOnly?projectPublicProvenanceEvidencePassport(source):source;
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
  const sourcePassport=buildProvenanceEvidencePassport({object:{id:object.id,objectCode:object.objectCode||object.id,passport:object},entries});
  return publicOnly?projectPublicProvenanceEvidencePassport(sourcePassport):sourcePassport;
}
