import {createHash} from 'node:crypto';

// v0.58: independently reviewed, public-only exchange response. The original
// research authority and builder remain unchanged and can contain private
// notes/credentials; neither may be serialized by public routes.
export const PUBLIC_INTERCHANGE_VERSION_V58='antiqua-research-public-interchange-v58';
const EVENT_KINDS=new Set([
  'EXHIBITION','PUBLICATION','OWNERSHIP','TRANSFER','SALE','AUCTION',
  'CONSERVATION','RESTORATION','ATTRIBUTION','OTHER'
]);
const EVIDENCE_CLASSES=new Set([
  'PRIMARY_DOCUMENT','INSTITUTIONAL_RECORD','AUCTION_DEALER_RECORD',
  'SCHOLARLY_PUBLICATION','OWNER_DEALER_STATEMENT','EXPERT_INTERPRETATION',
  'MACHINE_CANDIDATE','UNSPECIFIED'
]);
const EVIDENCE_STATES=new Set([
  'VERIFIED','UNVERIFIED','PENDING','UNKNOWN','UNRESOLVED','DISPUTED',
  'CANDIDATE','REJECTED','UNSPECIFIED'
]);
const ATTRIBUTION_STATES=new Set([
  'ATTRIBUTED','CONFIRMED','DISPUTED','PENDING','UNSPECIFIED','UNKNOWN',
  'SIGNED','SCHOOL_OF','CIRCLE_OF','FOLLOWER_OF','AFTER','WORKSHOP_OF'
]);
const GAP_CODES=[
  'NO_PROVENANCE_EVENTS','MISSING_EVIDENCE_REFERENCE',
  'UNRESOLVED_EVIDENCE_STATUS','UNCLASSIFIED_EVIDENCE','CONFLICTING_ASSERTION'
];

const up=v=>String(v??'').trim().toUpperCase();
const chosen=(value,set)=>set.has(up(value))?up(value):'UNSPECIFIED';
const publicText=v=>{
  if(typeof v==='string')return v.slice(0,500);
  if(!v||typeof v!=='object'||Array.isArray(v))return null;
  const out={};
  for(const lang of ['ru','en','it'])if(typeof v[lang]==='string')out[lang]=v[lang].slice(0,500);
  return Object.keys(out).length?out:null;
};
const revisionNumber=v=>{
  const n=Number(v);
  return Number.isSafeInteger(n)&&n>0?n:null;
};
const safeDate=v=>{
  if(typeof v!=='string'||!(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/).test(v))return null;
  const n=new Date(v);
  return Number.isFinite(n.getTime())?n.toISOString():null;
};
const safeCount=(value,max)=>{
  const n=Number(value);
  return Number.isSafeInteger(n)&&n>=0?Math.min(n,max):0;
};
const stable=value=>{
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
};

export function projectPublicResearchInterchangeProfile(profile){
  if(!profile?.work?.canonicalId)
    throw new Error('ANTIQUA_PUBLIC_INTERCHANGE: SOURCE_REQUIRED');

  const raw=Array.isArray(profile.provenanceEvents)?profile.provenanceEvents:[];
  const provenanceEvents=raw.map((entry,index)=>{
    const seq=Number(entry.sequenceNo);
    return {
      id:'public-event-'+(index+1),
      sequenceNo:Number.isSafeInteger(seq)&&seq>0?seq:index+1,
      event:{kind:chosen(entry.event?.kind,EVENT_KINDS)},
      evidence:{
        class:chosen(entry.evidence?.class,EVIDENCE_CLASSES),
        status:chosen(entry.evidence?.status,EVIDENCE_STATES),
        reference:null
      },
      uncertainty:{
        unresolved:Boolean(entry.uncertainty?.unresolved),
        conflict:Boolean(entry.uncertainty?.conflict)
      }
    };
  });

  // The source's gapIndex can contain raw event IDs, document metadata,
  // arbitrary JSON or a forged total. Release only approved count codes.
  const sourceCodes=profile.evidenceState?.gaps?.byCode||{};
  const limit=provenanceEvents.length*4+1;
  const byCode=Object.fromEntries(GAP_CODES.map(code=>[
    code,safeCount(sourceCodes[code],limit)
  ]));
  if(!provenanceEvents.length)byCode.NO_PROVENANCE_EVENTS=1;
  const totalGaps=Object.values(byCode).reduce((a,b)=>a+b,0);
  const rev=revisionNumber(profile.revision?.number);
  const conflicted=provenanceEvents.some(x=>x.uncertainty.conflict);
  const unresolved=provenanceEvents.some(x=>x.uncertainty.unresolved);
  const completeness=provenanceEvents.length===0?'EMPTY':
    conflicted?'CONFLICTED':unresolved?'INCOMPLETE':'EVIDENCED';

  const canonical={
    profileVersion:PUBLIC_INTERCHANGE_VERSION_V58,
    work:{
      canonicalId:String(profile.work.canonicalId),
      objectCode:publicText(profile.work.objectCode),
      title:publicText(profile.work.title),
      maker:publicText(profile.work.maker)
    },
    attribution:{
      status:chosen(profile.attribution?.status,ATTRIBUTION_STATES),
      certified:false,
      conflictingAssertionsPreserved:true
    },
    provenanceEvents,
    evidenceState:{
      completeness,
      gaps:{totalGaps,byCode},
      unresolvedEventIds:provenanceEvents.filter(x=>x.uncertainty.unresolved).map(x=>x.id),
      conflictEventIds:provenanceEvents.filter(x=>x.uncertainty.conflict).map(x=>x.id)
    },
    revision:rev?{
      id:'public-revision-'+rev,
      number:rev,
      createdAt:safeDate(profile.revision?.createdAt),
      supersessionExplicit:Boolean(profile.revision?.supersessionExplicit)
    }:null,
    // Fields below require individual scholarly/publication/media grants.
    // Do not imply that publishing an artwork publishes all supporting docs.
    exhibitions:[],
    bibliography:[],
    institutionalIdentifiers:[],
    media:[],
    scholarlyContext:{contributions:[],credentials:[]},
    rights:{rightsIndependent:true},
    boundaries:{
      uncertaintyFlattened:false,
      conflictingAssertionsPreserved:true,
      privateOwnerIdentityIncluded:false,
      privateDealerDataIncluded:false,
      commercialTermsIncluded:false,
      privateDocumentsIncluded:false,
      rawEvidenceReferencesIncluded:false,
      contributorAccountIdsIncluded:false,
      rawMediaUrlsIncluded:false,
      authenticityCertified:false,
      disclosureScope:'PUBLIC_REDACTED',
      evidenceHashScope:'DISCLOSED_FIELDS_ONLY',
      furtherPermissionsRequired:true
    },
    lineage:{
      objectAuthority:'objects',
      provenanceAuthority:'provenance_entries',
      revisionAuthority:'object_passport_revisions'
    }
  };
  return {...canonical,
    interchangeSha256:createHash('sha256').update(stable(canonical)).digest('hex')};
}
