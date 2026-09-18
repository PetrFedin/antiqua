import {db,send,readBody,requireCsrf,requirePermission,audit,authContext} from './runtime-v09.mjs';
import {listCollections,getReadableCollection,listEnsembles,getEnsemble,listExhibitions,getExhibition,createCollection,addCollectionObject,submitEnsembleClaim,iiifManifest,linkedArtRecord} from './collection-graph-v10.mjs';
import {canReadExhibition} from './access-policy.mjs';
import {collectionSurface,collectionSurfaceCapabilities} from './collection-surfaces-v16.mjs';

export async function routeFoundationPublicV10(req,res,url){
  const origin=`${String(req.headers['x-forwarded-proto']||'https').split(',')[0]}://${req.headers.host||'antiqua-preview.onrender.com'}`;
  if(url.pathname==='/api/health'&&req.method==='GET')return send(res,200,{status:'ok',service:'antiqua-preview',version:'0.10.0',uiVersion:'0.11.1',preview:process.env.PREVIEW_MODE!=='false',persistence:await db.health(),auctionIntegrity:{engine:db.kind==='POSTGRES'?'POSTGRES_ROW_LOCK':'SERIALIZED_MEMORY_PREVIEW',serverClock:true,idempotencyRequired:true,proxyMaxPrivate:true},collectionGraph:{collections:true,distributedEnsembles:true,virtualExhibitions:true,iiif:true,linkedArt:true},interaction:{touchFirst:true,directManipulation:true,bottomSheets:true,safeArea:true,reducedMotion:true,dossierCommerce:true,swipeGallery:true},payments:{ledgerSchema:true,providerConfigured:false},verification:{providerAdapter:true,providerConfigured:false},time:new Date().toISOString()});
  if(url.pathname==='/api/collection-surfaces'&&req.method==='GET')return send(res,200,{collectionSurfaces:collectionSurfaceCapabilities()});
  if(url.pathname==='/api/collections'&&req.method==='GET')return send(res,200,{surface:collectionSurface('CURATED_COLLECTION'),collections:await listCollections()});
  const cm=url.pathname.match(/^\/api\/collections\/([^/]+)$/);if(cm&&req.method==='GET'){const ctx=await authContext(req),c=await getReadableCollection(cm[1],ctx?.account?.id||null);return c?send(res,200,{surface:collectionSurface('CURATED_COLLECTION'),collection:c}):send(res,404,{error:'Collection not found'});}
  if(url.pathname==='/api/ensembles'&&req.method==='GET')return send(res,200,{ensembles:await listEnsembles()});
  const em=url.pathname.match(/^\/api\/ensembles\/([^/]+)$/);if(em&&req.method==='GET'){const e=await getEnsemble(em[1]);return e?send(res,200,{ensemble:e}):send(res,404,{error:'Ensemble not found'});}
  if(url.pathname==='/api/exhibitions'&&req.method==='GET')return send(res,200,{exhibitions:await listExhibitions()});
  const xm=url.pathname.match(/^\/api\/exhibitions\/([^/]+)$/);if(xm&&req.method==='GET'){const e=await getExhibition(xm[1]);if(!e)return send(res,404,{error:'Exhibition not found'});const ctx=await authContext(req),accountId=ctx?.account?.id||null,owner=Boolean(accountId&&(e.ownerAccountId===accountId||(e.ownerAccountId==='acct-demo-buyer'&&accountId==='acct-buyer-demo')));return canReadExhibition(e,{owner})?send(res,200,{exhibition:e}):send(res,404,{error:'Exhibition not found'});}
  const iiif=url.pathname.match(/^\/api\/lots\/([^/]+)\/iiif\/manifest$/);if(iiif&&req.method==='GET'){const m=iiifManifest(iiif[1],origin);return m?send(res,200,m,{'content-type':'application/ld+json; charset=utf-8'}):send(res,404,{error:'Object not found'});}
  const la=url.pathname.match(/^\/api\/lots\/([^/]+)\/linked-art$/);if(la&&req.method==='GET'){const r=linkedArtRecord(la[1],origin);return r?send(res,200,r,{'content-type':'application/ld+json; charset=utf-8'}):send(res,404,{error:'Object not found'});}
  return false;
}

export async function routeCollectionMutationsV10(req,res,url,ctx){
  if(!ctx)return false;
  const create=url.pathname==='/api/collections'&&req.method==='POST';
  const add=url.pathname.match(/^\/api\/collections\/([^/]+)\/objects$/);
  const claim=url.pathname.match(/^\/api\/ensembles\/([^/]+)\/claims$/);
  if(!create&&!(add&&req.method==='POST')&&!(claim&&req.method==='POST'))return false;
  requireCsrf(req,ctx);const a=ctx.account;
  if(create){requirePermission(a,'collection.manage');const body=await readBody(req),c=await createCollection(a,body);await audit(req,a,'COLLECTION_CREATED','COLLECTION',c.id);return send(res,201,{surface:collectionSurface('CURATED_COLLECTION'),collection:c});}
  if(add&&req.method==='POST'){requirePermission(a,'collection.manage');const c=await addCollectionObject(a,add[1],await readBody(req));await audit(req,a,'COLLECTION_OBJECT_UPSERTED','COLLECTION',add[1]);return send(res,200,{surface:collectionSurface('CURATED_COLLECTION'),collection:c});}
  if(claim&&req.method==='POST'){requirePermission(a,'collection.manage');const c=await submitEnsembleClaim(a,claim[1],await readBody(req));await audit(req,a,'ENSEMBLE_CLAIM_SUBMITTED','ENSEMBLE',claim[1],null,{claimId:c.id});return send(res,201,{claim:c});}
  return false;
}