// DD-02: publication-scoped, read-only Decision Dossier.
// Disabled unless explicitly admitted; preview memory is never a public authority.
import {db,send} from './runtime-v09.mjs';
import {verifyDatabaseTarget} from './db-identity-gate-v55.mjs';
import {productionAdmissionSnapshot} from './production-admission-v49.mjs';
import {artworkResearchDossierSnapshotV86} from './artwork-dossier-v51.mjs';
import {buildPublicDecisionDossierContract} from './decision-dossier-v56.mjs';
import {buildDecisionReadinessV87} from './decision-readiness-v87.mjs';
import {isPaintingCategory} from './art-domain-v50.mjs';

const hidden=Object.freeze({error:'Artwork not found',code:'ARTWORK_NOT_FOUND'});
const unavailable=Object.freeze({error:'Decision dossier is not admitted',code:'DECISION_DOSSIER_NOT_ADMITTED'});
const policyHeaders=Object.freeze({'x-robots-tag':'noindex'});
const legalObjectId=id=>typeof id==='string'&&/^[A-Za-z0-9._:-]{1,120}$/.test(id);

export async function decisionDossierAdmissionV86(env=process.env){
 if(env.ANTIQUA_DECISION_DOSSIER_HTTP!=='true'||db.kind!=='POSTGRES')return false;
 try{
  const target=verifyDatabaseTarget(env.DATABASE_URL,env);
  // A non-production exception is permitted only in a verified disposable
  // loopback database. Never permit it for a managed Supabase database.
  if(target.mode==='isolated-test')
   return env.NODE_ENV==='test'&&env.PREVIEW_MODE==='true'&&env.ANTIQUA_ISOLATED_TEST_DB==='true';
  if(target.mode!=='managed'||env.PREVIEW_MODE!=='false')return false;
  const admission=await productionAdmissionSnapshot();
  return admission.productionReady===true;
 }catch{return false}
}

export async function routePublicDecisionDossierV86(req,res,url){
 const match=url.pathname.match(/^\/api\/lots\/([^/]+)\/decision-dossier$/);
 if(!match||req.method!=='GET')return false;
 if(!await decisionDossierAdmissionV86())
  return send(res,503,unavailable,policyHeaders);
 let id;
 try{id=decodeURIComponent(match[1])}catch{return send(res,404,hidden,policyHeaders)}
 if(!legalObjectId(id))return send(res,404,hidden,policyHeaders);
 let client;
 try{
  client=await db.pool.connect();
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  // This query is the publication authority, not an input from the browser,
  // collection settings or the pure Decision Dossier projector.
  const visible=await client.query(
   "SELECT passport FROM objects WHERE id=$1 AND publication_status='PUBLIC' AND catalogue_status='APPROVED'",
   [id]
  );
  // Restrict the public decision workflow to the painting domain.
  if(visible.rowCount!==1||!isPaintingCategory(visible.rows[0]?.passport?.department)){
   await client.query('COMMIT');
   return send(res,404,hidden,policyHeaders);
  }
  const publicResearch=await artworkResearchDossierSnapshotV86(id,client);
  if(!publicResearch){
   await client.query('COMMIT');
   return send(res,404,hidden,policyHeaders);
  }
  const dossier=buildPublicDecisionDossierContract(publicResearch,{publicVisibilityConfirmed:true});
  const readiness=buildDecisionReadinessV87(dossier);
  await client.query('COMMIT');
  return send(res,200,{dossier,readiness,capabilities:{
   readModelOnly:true,documentsIncluded:false,privateRoomsEnabled:false,
   authenticityCertified:false,financialValuation:false,
   sourcePublicationRequired:true
  }},policyHeaders);
 }catch(error){
  if(client)await client.query('ROLLBACK').catch(()=>{});
  // The public endpoint must never serialize SQL errors or hidden row details.
  console.error('ANTIQUA Decision Dossier database read failed:',String(error?.code||error?.name||'UNKNOWN'));
  return send(res,503,{error:'Decision dossier temporarily unavailable',code:'DECISION_DOSSIER_UNAVAILABLE'},policyHeaders);
 }finally{client?.release()}
}
