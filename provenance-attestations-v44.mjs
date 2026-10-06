import crypto from 'node:crypto';
import {db} from './runtime-v09.mjs';

export const PROVENANCE_ATTESTATION_VERSION='antiqua-provenance-attestation-v1';
const ASSERTION_TYPES=new Set(['SUPPORT','CONTRADICT','NOTE']);
const ASSERTION_SCOPES=new Set(['AUTHENTICITY','ATTRIBUTION','PROVENANCE','PROVENANCE_EVENT']);
const memoryIssuers=new Map();
const memoryAttestations=new Map();

const stable=value=>{
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
};
const canonicalBytes=value=>Buffer.from(stable(value),'utf8');
const sha=value=>crypto.createHash('sha256').update(canonicalBytes(value)).digest('hex');

function requireStaff(account){
  if(!account||!Array.isArray(account.roles)||!account.roles.some(role=>['ADMIN','TRUST_REVIEWER','CATALOGUER'].includes(role))){
    throw Object.assign(new Error('Trust reviewer permission required'),{status:403,code:'PROVENANCE_ATTESTATION_FORBIDDEN'});
  }
}
function normalizeIssuer(input={}){
  const id=String(input.id||'').trim();
  const displayName=String(input.displayName||'').trim();
  const keyId=String(input.keyId||'').trim();
  const algorithm=String(input.algorithm||'Ed25519').trim();
  const publicKeyPem=String(input.publicKeyPem||'').trim();
  if(!id||id.length>120)throw Object.assign(new Error('Issuer id required'),{status:422,code:'ATTESTATION_ISSUER_ID_INVALID'});
  if(displayName.length<2||displayName.length>240)throw Object.assign(new Error('Issuer display name invalid'),{status:422,code:'ATTESTATION_ISSUER_NAME_INVALID'});
  if(!keyId||keyId.length>160)throw Object.assign(new Error('Issuer key id required'),{status:422,code:'ATTESTATION_ISSUER_KEY_ID_INVALID'});
  if(algorithm!=='Ed25519')throw Object.assign(new Error('Only Ed25519 issuers are supported'),{status:422,code:'ATTESTATION_ISSUER_ALG_UNSUPPORTED'});
  try{
    const key=crypto.createPublicKey(publicKeyPem);
    if(key.asymmetricKeyType!=='ed25519')throw new Error('wrong_key_type');
  }catch{
    throw Object.assign(new Error('Issuer public key invalid'),{status:422,code:'ATTESTATION_ISSUER_PUBLIC_KEY_INVALID'});
  }
  return {id,displayName,keyId,algorithm,publicKeyPem,organizationId:input.organizationId?String(input.organizationId):null,metadata:input.metadata&&typeof input.metadata==='object'?input.metadata:{}};
}
export async function registerProvenanceIssuer(account,input){
  requireStaff(account);
  const x=normalizeIssuer(input);
  if(db.kind==='POSTGRES'){
    const r=await db.pool.query(`INSERT INTO provenance_attestation_issuers(id,display_name,key_id,algorithm,public_key_pem,status,organization_id,metadata)
      VALUES($1,$2,$3,$4,$5,'ACTIVE',$6,$7)
      ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name,key_id=excluded.key_id,algorithm=excluded.algorithm,
        public_key_pem=excluded.public_key_pem,organization_id=excluded.organization_id,metadata=excluded.metadata,updated_at=now()
      RETURNING id,display_name AS "displayName",key_id AS "keyId",algorithm,status,organization_id AS "organizationId",metadata,created_at AS "createdAt",updated_at AS "updatedAt"`,
      [x.id,x.displayName,x.keyId,x.algorithm,x.publicKeyPem,x.organizationId,x.metadata]);
    return r.rows[0];
  }
  const row={...x,status:'ACTIVE',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  memoryIssuers.set(x.id,row);return structuredClone(row);
}
async function issuerById(id,keyId){
  if(db.kind==='POSTGRES'){
    return (await db.pool.query(`SELECT id,display_name AS "displayName",key_id AS "keyId",algorithm,public_key_pem AS "publicKeyPem",status,
      organization_id AS "organizationId",metadata FROM provenance_attestation_issuers WHERE id=$1 AND key_id=$2`,[id,keyId])).rows[0]||null;
  }
  const row=memoryIssuers.get(String(id));return row&&row.keyId===keyId?structuredClone(row):null;
}
async function revisionById(objectId,revisionId){
  if(db.kind==='POSTGRES'){
    return (await db.pool.query(`SELECT id,object_id AS "objectId",revision_no AS "revisionNo",passport_hash AS "passportHash",
      previous_hash AS "previousHash",created_at AS "createdAt" FROM object_passport_revisions WHERE id=$1 AND object_id=$2`,
      [revisionId,objectId])).rows[0]||null;
  }
  return null;
}
async function latestRevision(objectId){
  if(db.kind==='POSTGRES'){
    return (await db.pool.query(`SELECT id,object_id AS "objectId",revision_no AS "revisionNo",passport_hash AS "passportHash",
      previous_hash AS "previousHash",created_at AS "createdAt" FROM object_passport_revisions WHERE object_id=$1 ORDER BY revision_no DESC LIMIT 1`,
      [objectId])).rows[0]||null;
  }
  return null;
}
export async function verifyProvenanceAttestationEnvelope(envelope,{checkCurrent=true}={}){
  try{
    if(!envelope||typeof envelope!=='object')return {status:'MALFORMED',signatureValid:false,current:false,revoked:false};
    const payload=envelope.payload,signatureB64=String(envelope.signature||''),credentialSha256=String(envelope.credentialSha256||'').toLowerCase();
    if(!payload||payload.attestationVersion!==PROVENANCE_ATTESTATION_VERSION)return {status:'UNSUPPORTED',signatureValid:false,current:false,revoked:false};
    if(payload.alg!=='Ed25519')return {status:'UNSUPPORTED',signatureValid:false,current:false,revoked:false,reason:'algorithm'};
    if(!ASSERTION_TYPES.has(String(payload.assertionType||''))||!ASSERTION_SCOPES.has(String(payload.assertionScope||'')))return {status:'MALFORMED',signatureValid:false,current:false,revoked:false,reason:'assertion_contract'};
    const issuer=await issuerById(String(payload.issuerId||''),String(payload.keyId||''));
    if(!issuer)return {status:'ISSUER_UNKNOWN',signatureValid:false,current:false,revoked:false};
    if(issuer.status!=='ACTIVE')return {status:'ISSUER_INACTIVE',signatureValid:false,current:false,revoked:false,issuerStatus:issuer.status};
    const expected=sha({payload,signature:signatureB64});
    if(expected!==credentialSha256)return {status:'INVALID_ENVELOPE_HASH',signatureValid:false,current:false,revoked:false};
    const signature=Buffer.from(signatureB64,'base64url');
    const valid=crypto.verify(null,canonicalBytes(payload),crypto.createPublicKey(issuer.publicKeyPem),signature);
    if(!valid)return {status:'INVALID_SIGNATURE',signatureValid:false,current:false,revoked:false};
    const revision=await revisionById(String(payload.objectId||''),String(payload.passportRevisionId||''));
    if(db.kind==='POSTGRES'&&!revision)return {status:'REVISION_UNKNOWN',signatureValid:true,current:false,revoked:false};
    if(revision&&payload.passportHash&&revision.passportHash!==payload.passportHash)return {status:'REVISION_HASH_MISMATCH',signatureValid:true,current:false,revoked:false};
    let revoked=false,stored=null;
    if(db.kind==='POSTGRES'){
      stored=(await db.pool.query(`SELECT id,status,revoked_at AS "revokedAt",revocation_reason AS "revocationReason"
        FROM provenance_attestations WHERE credential_sha256=$1`,[credentialSha256])).rows[0]||null;
      revoked=stored?.status==='REVOKED';
    }else{
      stored=[...memoryAttestations.values()].find(x=>x.credentialSha256===credentialSha256)||null;
      revoked=stored?.status==='REVOKED';
    }
    if(revoked)return {status:'REVOKED',signatureValid:true,current:false,revoked:true,credentialSha256,revocation:stored};
    if(checkCurrent&&revision){
      const latest=await latestRevision(payload.objectId);
      if(!latest||latest.id!==revision.id)return {status:'HISTORICAL',signatureValid:true,current:false,revoked:false,credentialSha256,revisionId:revision.id,currentRevisionId:latest?.id||null};
    }
    return {status:'VALID',signatureValid:true,current:true,revoked:false,credentialSha256,issuer:{id:issuer.id,displayName:issuer.displayName,keyId:issuer.keyId},assertionType:payload.assertionType,assertionScope:payload.assertionScope};
  }catch(error){
    return {status:'INVALID_SIGNATURE',signatureValid:false,current:false,revoked:false,reason:String(error?.message||error)};
  }
}
export async function ingestProvenanceAttestation(account,envelope){
  requireStaff(account);
  const verified=await verifyProvenanceAttestationEnvelope(envelope,{checkCurrent:false});
  if(!['VALID','HISTORICAL'].includes(verified.status))throw Object.assign(new Error('Attestation verification failed'),{status:422,code:'PROVENANCE_ATTESTATION_INVALID',verification:verified});
  const p=envelope.payload;
  const credentialSha256=String(envelope.credentialSha256).toLowerCase();
  const id='att-'+credentialSha256.slice(0,24);
  if(db.kind==='POSTGRES'){
    const r=await db.pool.query(`INSERT INTO provenance_attestations(
      id,object_id,passport_revision_id,issuer_id,key_id,assertion_type,assertion_scope,statement,evidence_ref,payload,signature_b64,credential_sha256,status,issued_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'ACTIVE',$13)
      ON CONFLICT(credential_sha256) DO UPDATE SET payload=excluded.payload,signature_b64=excluded.signature_b64
      RETURNING id,object_id AS "objectId",passport_revision_id AS "passportRevisionId",issuer_id AS "issuerId",key_id AS "keyId",
        assertion_type AS "assertionType",assertion_scope AS "assertionScope",statement,evidence_ref AS "evidenceRef",
        credential_sha256 AS "credentialSha256",status,issued_at AS "issuedAt",received_at AS "receivedAt"`,
      [id,p.objectId,p.passportRevisionId,p.issuerId,p.keyId,p.assertionType,p.assertionScope,String(p.statement||'').slice(0,4000),p.evidenceRef?String(p.evidenceRef).slice(0,1000):null,p,envelope.signature,credentialSha256,p.issuedAt]);
    return r.rows[0];
  }
  const row={id,objectId:p.objectId,passportRevisionId:p.passportRevisionId,issuerId:p.issuerId,keyId:p.keyId,assertionType:p.assertionType,assertionScope:p.assertionScope,statement:p.statement,evidenceRef:p.evidenceRef||null,credentialSha256,status:'ACTIVE',issuedAt:p.issuedAt,receivedAt:new Date().toISOString(),payload:structuredClone(p),signature:envelope.signature};
  memoryAttestations.set(id,row);return structuredClone(row);
}
export async function revokeProvenanceAttestation(account,id,reason){
  requireStaff(account);reason=String(reason||'').trim();
  if(reason.length<3||reason.length>1000)throw Object.assign(new Error('Revocation reason invalid'),{status:422,code:'ATTESTATION_REVOCATION_REASON_INVALID'});
  if(db.kind==='POSTGRES'){
    const r=await db.pool.query(`UPDATE provenance_attestations SET status='REVOKED',revoked_at=now(),revoked_by=$2,revocation_reason=$3
      WHERE id=$1 RETURNING id,status,revoked_at AS "revokedAt",revoked_by AS "revokedBy",revocation_reason AS "revocationReason"`,[id,account.id,reason]);
    if(!r.rowCount)throw Object.assign(new Error('Attestation not found'),{status:404,code:'PROVENANCE_ATTESTATION_NOT_FOUND'});
    return r.rows[0];
  }
  const row=memoryAttestations.get(String(id));if(!row)throw Object.assign(new Error('Attestation not found'),{status:404,code:'PROVENANCE_ATTESTATION_NOT_FOUND'});
  Object.assign(row,{status:'REVOKED',revokedAt:new Date().toISOString(),revokedBy:account.id,revocationReason:reason});return structuredClone(row);
}
export async function provenanceAttestationGraph(objectId){
  let rows=[];
  if(db.kind==='POSTGRES'){
    rows=(await db.pool.query(`SELECT a.id,a.object_id AS "objectId",a.passport_revision_id AS "passportRevisionId",a.issuer_id AS "issuerId",
      i.display_name AS "issuerName",a.key_id AS "keyId",a.assertion_type AS "assertionType",a.assertion_scope AS "assertionScope",
      a.statement,a.evidence_ref AS "evidenceRef",a.credential_sha256 AS "credentialSha256",a.status,a.issued_at AS "issuedAt",
      a.received_at AS "receivedAt",a.revoked_at AS "revokedAt",a.revocation_reason AS "revocationReason"
      FROM provenance_attestations a JOIN provenance_attestation_issuers i ON i.id=a.issuer_id
      WHERE a.object_id=$1 ORDER BY a.issued_at DESC,a.id`,[objectId])).rows;
  }else rows=[...memoryAttestations.values()].filter(x=>x.objectId===objectId).map(structuredClone);
  const latest=await latestRevision(objectId);
  const annotated=rows.map(row=>({...row,currentRevision:latest?row.passportRevisionId===latest.id:false}));
  const activeCurrent=annotated.filter(x=>x.status==='ACTIVE'&&x.currentRevision);
  const byType=type=>activeCurrent.filter(x=>x.assertionType===type).length;
  return {
    schemaVersion:'antiqua-provenance-attestation-graph-v1',
    objectId,
    currentRevisionId:latest?.id||null,
    summary:{activeCurrent:activeCurrent.length,support:byType('SUPPORT'),contradict:byType('CONTRADICT'),note:byType('NOTE'),historical:annotated.filter(x=>!x.currentRevision).length,revoked:annotated.filter(x=>x.status==='REVOKED').length},
    attestations:annotated,
    truthBoundary:{platformDeterminesTruth:false,competingAssertionsPreserved:true,authenticityCertified:false,attributionCertified:false}
  };
}
