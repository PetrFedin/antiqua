import crypto from 'node:crypto';
import {db,lots,now} from './runtime-v09.mjs';
import {enqueueOutboxTx} from './outbox-v15.mjs';

const clone=x=>x==null?x:structuredClone(x);
const id=()=>`opr-${crypto.randomUUID().replaceAll('-','').slice(0,24)}`;
const up=v=>String(v??'').trim().toUpperCase();
const iso=v=>v?.toISOString?.()||v||null;
const err=(message,{status=409,code='PASSPORT_REVISION_INVALID',details=null}={})=>Object.assign(new Error(message),{status,code,details});
const jsonStable=value=>{
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(jsonStable).join(',')+']';
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+jsonStable(value[k])).join(',')+'}';
};
const sha=value=>crypto.createHash('sha256').update(typeof value==='string'?value:jsonStable(value)).digest('hex');
const summary=v=>({en:String(v?.en||''),ru:String(v?.ru||'')});
const plain=v=>Boolean(v&&typeof v==='object'&&!Array.isArray(v));
const EVIDENCE_TYPES=new Set(['MEDIA','PROVENANCE','CATALOGUE_REVIEW']);
const CHANGE_KINDS=new Set(['CATALOGUE_CORRECTION','ATTRIBUTION_UPDATE','PROVENANCE_UPDATE','CONDITION_UPDATE','EVIDENCE_UPDATE','ADMINISTRATIVE_CORRECTION']);
const ALLOWED_FIELDS=new Set(['department','maker','title','period','origin','currency','estimateLow','estimateHigh','image','materials','dimensions','attributionStatus','marks','cataloguing','provenance','provenanceTimeline','condition','conditionGrade','restoration','literature','exhibitions','documents','media','location','exportStatus','culturalPropertyStatus']);
const SENSITIVE_FIELDS=new Set(['maker','period','origin','attributionStatus','provenance','provenanceTimeline','condition','conditionGrade','restoration','exportStatus','culturalPropertyStatus']);

export function canonicalPassportHash(passport){
  const p=clone(passport)||{};delete p.passportHash;delete p.passportRevision;
  return sha(p);
}
function withHash(passport){const p=clone(passport)||{};p.passportHash=canonicalPassportHash(p);return p}
function actorAuthority(actor){if(actor?.roles?.includes('TRUST_REVIEWER')&&!actor?.roles?.includes('CATALOGUER')&&!actor?.roles?.includes('ADMIN'))return'TRUST_REVIEWER';if(actor?.roles?.includes('CATALOGUER')||actor?.roles?.includes('ADMIN'))return'CATALOGUER';return'SYSTEM'}
function normalizeEvidence(refs=[]){
  if(!Array.isArray(refs))throw err('Passport evidence must be an array',{status:400,code:'PASSPORT_EVIDENCE_INVALID'});
  const seen=new Set(),out=[];
  for(const raw of refs){const type=up(raw?.type),evidenceId=String(raw?.id||'').trim();if(!EVIDENCE_TYPES.has(type)||!evidenceId)throw err('Unsupported passport evidence reference',{status:400,code:'PASSPORT_EVIDENCE_INVALID'});const key=`${type}:${evidenceId}`;if(seen.has(key))continue;seen.add(key);out.push({type,id:evidenceId})}
  return out.sort((a,b)=>a.type.localeCompare(b.type)||a.id.localeCompare(b.id));
}
function mergePatch(current,patch){
  if(!plain(patch))throw err('Passport patch must be an object',{status:400,code:'PASSPORT_PATCH_INVALID'});
  const out=clone(current)||{};
  for(const [key,value] of Object.entries(patch)){
    if(!ALLOWED_FIELDS.has(key))throw err(`Passport field cannot be revised: ${key}`,{status:400,code:'PASSPORT_FIELD_PROTECTED',details:{field:key}});
    if(plain(value)&&plain(out[key])&&('en' in value||'ru' in value))out[key]={...out[key],...clone(value)};
    else out[key]=clone(value);
  }
  return withHash(out);
}
function inferKind(keys,requested){
  const k=up(requested);if(k){if(!CHANGE_KINDS.has(k))throw err('Unsupported passport change kind',{status:400,code:'PASSPORT_CHANGE_KIND_INVALID'});return k}
  if(keys.some(x=>['provenance','provenanceTimeline'].includes(x)))return'PROVENANCE_UPDATE';
  if(keys.some(x=>['condition','conditionGrade','restoration'].includes(x)))return'CONDITION_UPDATE';
  if(keys.some(x=>['maker','period','origin','attributionStatus'].includes(x)))return'ATTRIBUTION_UPDATE';
  return'CATALOGUE_CORRECTION';
}
function mapRevision(row,evidence=[],includePrivate=true){
  if(!row)return null;
  const base={id:row.id,objectId:row.object_id,revisionNo:Number(row.revision_no),hash:row.passport_hash,previousHash:row.previous_hash,changeKind:row.change_kind,publicSummary:row.public_summary||{},createdAt:iso(row.created_at)};
  if(includePrivate)return{...base,reason:row.change_reason,actorAccountId:row.actor_account_id,authority:row.authority,sourceKey:row.source_key,evidence:evidence.map(e=>({type:e.evidence_type,id:e.evidence_id,visibility:e.visibility,status:e.evidence_status,metadata:e.metadata||{}}))};
  const visible=evidence.filter(e=>e.visibility==='PUBLIC');
  return{...base,evidence:{count:visible.length,types:[...new Set(visible.map(e=>e.evidence_type))].sort()}};
}
async function evidenceRowsTx(cx,revisionId){return(await cx.query('SELECT * FROM object_passport_revision_evidence WHERE revision_id=$1 ORDER BY evidence_type,evidence_id',[revisionId])).rows}
async function revisionBySourceTx(cx,objectId,sourceKey){if(!sourceKey)return null;return(await cx.query('SELECT * FROM object_passport_revisions WHERE object_id=$1 AND source_key=$2',[objectId,String(sourceKey)])).rows[0]||null}
async function latestRevisionTx(cx,objectId){return(await cx.query('SELECT * FROM object_passport_revisions WHERE object_id=$1 ORDER BY revision_no DESC LIMIT 1',[objectId])).rows[0]||null}

async function validateEvidenceTx(cx,objectId,passport,refs,{existingPassport=null,allowCurrentPassportMedia=false}={}){
  const out=[],passportMediaIds=new Set((Array.isArray((existingPassport||passport)?.media)?(existingPassport||passport).media:[]).map(x=>String(x?.id||'')).filter(Boolean));
  for(const ref of refs){
    if(ref.type==='MEDIA'){
      const row=(await cx.query('SELECT id,entity_type,entity_id,role,visibility,status,content_type FROM media_assets WHERE id=$1',[ref.id])).rows[0];
      if(!row)throw err('Media evidence not found',{status:404,code:'PASSPORT_EVIDENCE_NOT_FOUND',details:ref});
      if(row.status!=='READY')throw err('Media evidence is not READY',{code:'PASSPORT_EVIDENCE_NOT_READY',details:ref});
      const objectOwned=row.entity_type==='OBJECT'&&row.entity_id===objectId,draftCarried=row.entity_type==='DRAFT'&&allowCurrentPassportMedia&&passportMediaIds.has(ref.id);if(!objectOwned&&!draftCarried)throw err('Media evidence does not belong to this object',{status:403,code:'PASSPORT_EVIDENCE_SCOPE_MISMATCH',details:ref});
      out.push({...ref,visibility:row.visibility==='PUBLIC'?'PUBLIC':'PRIVATE',status:row.status,metadata:{role:row.role,contentType:row.content_type,entityType:row.entity_type}});
    }else if(ref.type==='PROVENANCE'){
      const row=(await cx.query('SELECT id,evidence_status FROM provenance_entries WHERE id=$1 AND object_id=$2',[ref.id,objectId])).rows[0];
      if(!row)throw err('Provenance evidence does not belong to this object',{status:403,code:'PASSPORT_EVIDENCE_SCOPE_MISMATCH',details:ref});
      out.push({...ref,visibility:'PUBLIC',status:row.evidence_status,metadata:{}});
    }else if(ref.type==='CATALOGUE_REVIEW'){
      const row=(await cx.query('SELECT id,catalogue_status,trust_status FROM catalogue_reviews WHERE id=$1 AND object_id=$2',[ref.id,objectId])).rows[0];
      if(!row)throw err('Catalogue review evidence does not belong to this object',{status:403,code:'PASSPORT_EVIDENCE_SCOPE_MISMATCH',details:ref});
      out.push({...ref,visibility:'INTERNAL',status:row.catalogue_status,metadata:{trustStatus:row.trust_status}});
    }
  }
  return out;
}
async function insertEvidenceTx(cx,revisionId,refs){
  for(const e of refs)await cx.query(`INSERT INTO object_passport_revision_evidence(revision_id,evidence_type,evidence_id,visibility,evidence_status,metadata)
    VALUES($1,$2,$3,$4,$5,$6)`,[revisionId,e.type,e.id,e.visibility,e.status||null,e.metadata||{}]);
}
async function baselineTx(cx,row,{actorAccountId=null,authority='MIGRATION',sourceKey=null,reason='Baseline imported from current object passport',publicSummary={en:'Baseline passport snapshot',ru:'Исходная версия паспорта'}}={}){
  const existing=await latestRevisionTx(cx,row.id);if(existing)return existing;
  const passport=withHash(row.passport),revisionId=id(),requestHash=sha({kind:'INITIAL',hash:passport.passportHash});
  await cx.query('UPDATE objects SET passport=$2,passport_hash=$3,updated_at=updated_at WHERE id=$1',[row.id,passport,passport.passportHash]);
  const inserted=(await cx.query(`INSERT INTO object_passport_revisions(id,object_id,revision_no,passport,passport_hash,previous_hash,change_kind,change_reason,public_summary,actor_account_id,authority,source_key,request_hash)
    VALUES($1,$2,1,$3,$4,NULL,'INITIAL',$5,$6,$7,$8,$9,$10) RETURNING *`,[revisionId,row.id,passport,passport.passportHash,reason,summary(publicSummary),actorAccountId,authority,sourceKey,requestHash])).rows[0];
  const prov=(await cx.query('SELECT id,evidence_status FROM provenance_entries WHERE object_id=$1 ORDER BY sequence_no',[row.id])).rows;
  await insertEvidenceTx(cx,revisionId,prov.map(p=>({type:'PROVENANCE',id:p.id,visibility:'PUBLIC',status:p.evidence_status,metadata:{}})));
  return inserted;
}

export async function recordInitialPassportRevisionTx(cx,{objectId,passport,actorAccountId=null,sourceKey=null,reason='Initial publication',publicSummary={en:'Initial published passport',ru:'Первая опубликованная версия паспорта'},evidence=[]}={}){
  if(!cx?.query)throw new Error('PostgreSQL transaction client required');
  const row=(await cx.query('SELECT id,passport FROM objects WHERE id=$1 FOR UPDATE',[objectId])).rows[0];if(!row)throw err('Object not found',{status:404,code:'OBJECT_NOT_FOUND'});
  const existing=await latestRevisionTx(cx,objectId);if(existing)return existing;
  const normalized=withHash(passport||row.passport),revisionId=id(),requestHash=sha({kind:'INITIAL',hash:normalized.passportHash,sourceKey});
  await cx.query('UPDATE objects SET passport=$2,passport_hash=$3 WHERE id=$1',[objectId,normalized,normalized.passportHash]);
  const inserted=(await cx.query(`INSERT INTO object_passport_revisions(id,object_id,revision_no,passport,passport_hash,previous_hash,change_kind,change_reason,public_summary,actor_account_id,authority,source_key,request_hash)
    VALUES($1,$2,1,$3,$4,NULL,'INITIAL',$5,$6,$7,'CATALOGUER',$8,$9) RETURNING *`,[revisionId,objectId,normalized,normalized.passportHash,reason,summary(publicSummary),actorAccountId,sourceKey,requestHash])).rows[0];
  const validated=await validateEvidenceTx(cx,objectId,normalized,normalizeEvidence(evidence),{existingPassport:normalized,allowCurrentPassportMedia:true});await insertEvidenceTx(cx,revisionId,validated);
  await enqueueOutboxTx(cx,{topic:'OBJECT.PASSPORT_CREATED',aggregateType:'OBJECT',aggregateId:objectId,payload:{kind:'OBJECT_PASSPORT_REVISION',objectId,revisionId,revisionNo:1,passportHash:normalized.passportHash,previousHash:null},idempotencyKey:sourceKey?`passport:${objectId}:${sourceKey}`:`passport:${objectId}:initial`});
  return inserted;
}

export async function ensurePassportBaseline(objectId){
  if(db.kind!=='POSTGRES'){
    const p=lots.find(x=>x.id===objectId);if(!p)return null;const passport=withHash(p);return{revision:mapRevision({id:`memory-${objectId}-1`,object_id:objectId,revision_no:1,passport_hash:passport.passportHash,previous_hash:null,change_kind:'INITIAL',public_summary:{en:'Current preview passport',ru:'Текущая демонстрационная версия'},created_at:null},[],false),passport};
  }
  const cx=await db.pool.connect();try{await cx.query('BEGIN');const row=(await cx.query('SELECT id,passport FROM objects WHERE id=$1 FOR UPDATE',[objectId])).rows[0];if(!row){await cx.query('ROLLBACK');return null}const revision=await baselineTx(cx,row);await cx.query('COMMIT');const passport=withHash(row.passport);return{revision:mapRevision(revision,await db.pool.query('SELECT * FROM object_passport_revision_evidence WHERE revision_id=$1',[revision.id]).then(r=>r.rows),false),passport}}catch(e){try{await cx.query('ROLLBACK')}catch{}throw e}finally{cx.release()}
}

export async function reviseObjectPassport(actor,objectId,{patch={},changeKind=null,reason='',publicSummary={},evidence=[],sourceKey=null}={}){
  if(db.kind!=='POSTGRES')throw err('Durable passport revisions require PostgreSQL',{status:503,code:'PASSPORT_DATABASE_REQUIRED'});
  sourceKey=String(sourceKey||'').trim();if(!sourceKey)throw err('Idempotency key is required',{status:400,code:'IDEMPOTENCY_KEY_REQUIRED'});
  reason=String(reason||'').trim();if(!reason)throw err('Revision reason is required',{status:400,code:'PASSPORT_REASON_REQUIRED'});
  const keys=Object.keys(patch||{}),kind=inferKind(keys,changeKind),refs=normalizeEvidence(evidence),pub=summary(publicSummary),requestHash=sha({patch,changeKind:kind,reason,publicSummary:pub,evidence:refs});
  if((keys.some(k=>SENSITIVE_FIELDS.has(k))||['ATTRIBUTION_UPDATE','PROVENANCE_UPDATE','CONDITION_UPDATE'].includes(kind))&&!refs.length)throw err('Evidence is required for material passport claims',{code:'PASSPORT_EVIDENCE_REQUIRED'});
  if(!keys.length&&kind!=='EVIDENCE_UPDATE')throw err('Passport revision has no content change',{status:400,code:'PASSPORT_PATCH_EMPTY'});
  if(kind==='EVIDENCE_UPDATE'&&!refs.length)throw err('Evidence update requires at least one evidence reference',{status:400,code:'PASSPORT_EVIDENCE_REQUIRED'});

  const cx=await db.pool.connect();let next,inserted,validated;
  try{
    await cx.query('BEGIN');const row=(await cx.query('SELECT id,passport FROM objects WHERE id=$1 FOR UPDATE',[objectId])).rows[0];if(!row)throw err('Object not found',{status:404,code:'OBJECT_NOT_FOUND'});
    await baselineTx(cx,row);
    const replay=await revisionBySourceTx(cx,objectId,sourceKey);
    if(replay){
      if(replay.request_hash!==requestHash)throw err('Passport revision idempotency key belongs to a different request',{code:'PASSPORT_REVISION_IDEMPOTENCY_CONFLICT'});
      const ev=await evidenceRowsTx(cx,replay.id);await cx.query('COMMIT');return{revision:mapRevision(replay,ev,true),passport:clone(replay.passport),idempotent:true};
    }
    const current=(await cx.query('SELECT passport FROM objects WHERE id=$1',[objectId])).rows[0].passport,nextPassport=mergePatch(current,patch),latest=await latestRevisionTx(cx,objectId);
    if(nextPassport.passportHash===latest.passport_hash&&kind!=='EVIDENCE_UPDATE')throw err('Passport content did not change',{code:'PASSPORT_NO_CHANGE'});
    validated=await validateEvidenceTx(cx,objectId,nextPassport,refs,{existingPassport:current,allowCurrentPassportMedia:true});
    const revisionId=id(),revisionNo=Number(latest.revision_no)+1;
    inserted=(await cx.query(`INSERT INTO object_passport_revisions(id,object_id,revision_no,passport,passport_hash,previous_hash,change_kind,change_reason,public_summary,actor_account_id,authority,source_key,request_hash)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,[revisionId,objectId,revisionNo,nextPassport,nextPassport.passportHash,latest.passport_hash,kind,reason,pub,actor?.id||null,actorAuthority(actor),sourceKey,requestHash])).rows[0];
    await insertEvidenceTx(cx,revisionId,validated);
    await cx.query('UPDATE objects SET passport=$2,passport_hash=$3,updated_at=now() WHERE id=$1',[objectId,nextPassport,nextPassport.passportHash]);
    await enqueueOutboxTx(cx,{topic:'OBJECT.PASSPORT_REVISED',aggregateType:'OBJECT',aggregateId:objectId,payload:{kind:'OBJECT_PASSPORT_REVISION',objectId,revisionId,revisionNo,passportHash:nextPassport.passportHash,previousHash:latest.passport_hash,changeKind:kind},idempotencyKey:`passport:${objectId}:${sourceKey}`});
    await cx.query('COMMIT');next=nextPassport;
  }catch(e){try{await cx.query('ROLLBACK')}catch{}throw e}finally{cx.release()}
  const i=lots.findIndex(x=>x.id===objectId);if(i>=0)lots[i]=clone(next);
  return{revision:mapRevision(inserted,validated.map(e=>({evidence_type:e.type,evidence_id:e.id,visibility:e.visibility,evidence_status:e.status,metadata:e.metadata})),true),passport:clone(next),idempotent:false};
}

export async function passportRevisionHistory(objectId,{includePrivate=false,limit=50}={}){
  limit=Math.max(1,Math.min(200,Math.trunc(Number(limit)||50)));
  if(db.kind!=='POSTGRES'){
    const p=lots.find(x=>x.id===objectId);if(!p)return null;const passport=withHash(p),row={id:`memory-${objectId}-1`,object_id:objectId,revision_no:1,passport_hash:passport.passportHash,previous_hash:null,change_kind:'INITIAL',change_reason:'Preview current state',public_summary:{en:'Current preview passport',ru:'Текущая демонстрационная версия'},actor_account_id:null,authority:'SYSTEM',source_key:null,created_at:null},ev=(p.provenanceTimeline||[]).map((x,i)=>({evidence_type:'PROVENANCE',evidence_id:`preview-${i+1}`,visibility:'PUBLIC',evidence_status:x.evidenceStatus,metadata:{}}));return{objectId,currentRevisionNo:1,currentHash:passport.passportHash,revisions:[mapRevision(row,ev,includePrivate)]};
  }
  await ensurePassportBaseline(objectId);
  const rows=(await db.pool.query('SELECT * FROM object_passport_revisions WHERE object_id=$1 ORDER BY revision_no DESC LIMIT $2',[objectId,limit])).rows;if(!rows.length)return null;
  const revisions=[];for(const row of rows){const ev=await db.pool.query('SELECT * FROM object_passport_revision_evidence WHERE revision_id=$1 ORDER BY evidence_type,evidence_id',[row.id]);revisions.push(mapRevision(row,ev.rows,includePrivate))}
  return{objectId,currentRevisionNo:Number(rows[0].revision_no),currentHash:rows[0].passport_hash,revisions};
}

export function passportRevisionCapabilities(){return{postgresAuthority:db.kind==='POSTGRES',appendOnly:true,rowLock:true,hashChain:'SHA256',sourceIdempotency:true,transactionalOutbox:true,evidenceTypes:[...EVIDENCE_TYPES],sensitiveFieldsRequireEvidence:[...SENSITIVE_FIELDS],publicHistorySanitized:true,lazyLegacyBaseline:true}}
