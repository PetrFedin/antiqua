import {send,readBody,requireCsrf,audit} from './runtime-v09.mjs';
import {
  registerProvenanceIssuer,
  verifyProvenanceAttestationEnvelope,
  ingestProvenanceAttestation,
  revokeProvenanceAttestation,
  provenanceAttestationGraph
} from './provenance-attestations-v44.mjs';

export async function routeProvenanceAttestationPublicV44(req,res,url){
  let m=url.pathname.match(/^\/api\/lots\/([^/]+)\/provenance-attestations$/);
  if(m&&req.method==='GET'){
    const graph=await provenanceAttestationGraph(decodeURIComponent(m[1]));
    return send(res,200,{graph});
  }
  if(url.pathname==='/api/provenance-attestations/verify'&&req.method==='POST'){
    const body=await readBody(req);
    const verification=await verifyProvenanceAttestationEnvelope(body.envelope||body,{checkCurrent:true});
    return send(res,200,{verification});
  }
  return false;
}

export async function routeProvenanceAttestationV44(req,res,url,ctx){
  if(!ctx)return false;
  if(url.pathname==='/api/provenance-attestation-issuers'&&req.method==='POST'){
    requireCsrf(req,ctx);
    const issuer=await registerProvenanceIssuer(ctx.account,await readBody(req));
    await audit(req,ctx.account,'PROVENANCE_ATTESTATION_ISSUER_REGISTERED','PROVENANCE_ATTESTATION_ISSUER',issuer.id,null,{keyId:issuer.keyId,algorithm:issuer.algorithm,status:issuer.status});
    return send(res,201,{issuer});
  }
  let m=url.pathname.match(/^\/api\/lots\/([^/]+)\/provenance-attestations$/);
  if(m&&req.method==='POST'){
    requireCsrf(req,ctx);
    const body=await readBody(req);
    const envelope=body.envelope||body;
    if(String(envelope?.payload?.objectId||'')!==decodeURIComponent(m[1]))return send(res,422,{error:'Attestation subject does not match object route',code:'PROVENANCE_ATTESTATION_SUBJECT_MISMATCH'});
    const attestation=await ingestProvenanceAttestation(ctx.account,envelope);
    await audit(req,ctx.account,'PROVENANCE_ATTESTATION_INGESTED','PROVENANCE_ATTESTATION',attestation.id,null,{objectId:attestation.objectId,issuerId:attestation.issuerId,assertionType:attestation.assertionType,assertionScope:attestation.assertionScope,credentialSha256:attestation.credentialSha256});
    return send(res,201,{attestation});
  }
  m=url.pathname.match(/^\/api\/provenance-attestations\/([^/]+)\/revoke$/);
  if(m&&req.method==='POST'){
    requireCsrf(req,ctx);
    const body=await readBody(req);
    const result=await revokeProvenanceAttestation(ctx.account,decodeURIComponent(m[1]),body.reason);
    await audit(req,ctx.account,'PROVENANCE_ATTESTATION_REVOKED','PROVENANCE_ATTESTATION',decodeURIComponent(m[1]),null,{reason:body.reason});
    return send(res,200,{attestation:result});
  }
  return false;
}
