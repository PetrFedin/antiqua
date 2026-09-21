import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {send,authContext,db} from './runtime-v09.mjs';
import {migrateV10} from './migration-v10.mjs';
import {migrateV14} from './migration-v14.mjs';
import {prepareProviderWebhookRequest} from './provider-webhook-security-v15.mjs';
import {routeOrderVerificationPublicV16,routeOrderVerificationV16} from './routes-order-verification-v16.mjs';
import {routeDisputeV16} from './routes-dispute-v16.mjs';
import {routePassportPublicV16,routePassportV16} from './routes-passport-v16.mjs';
import {routePublicationV16} from './routes-publication-v16.mjs';
import {routeInvariantPublicV14,routeInvariantsV14} from './routes-invariants-v14.mjs';
import {routeE2EPublicV14,routeE2EV14} from './routes-e2e-v14.mjs';
import {routeOwnershipV14} from './routes-ownership-v14.mjs';
import {routeOrganizationsV15} from './routes-organizations-v15.mjs';
import {routePreferencesV14} from './routes-preferences-v14.mjs';
import {routeMediaV14} from './routes-media-v14.mjs';
import {routeOperatorHooksV14} from './routes-operator-hooks-v14.mjs';
import {routeProductPublicV13} from './routes-product-v13.mjs';
import {routeSimilarityPublicV18} from './routes-similarity-v18.mjs';
import {routeAuctionResultsPublicV20} from './routes-auction-results-v20.mjs';
import {routeExperiencePublicV12,routeExperienceMutationsV12} from './routes-experience-v12.mjs';
import {routeFoundationPublicV10,routeCollectionMutationsV10} from './routes-foundation-v10.mjs';
import {routeAuctionIntegrityV10} from './auction-integrity-v10.mjs';
import {routeOperationsV10} from './routes-operations-v10.mjs';
import {routeOperatorCockpitV16} from './routes-operator-cockpit-v16.mjs';
import {routeAuthPublic} from './routes-auth-v09.mjs';
import {routeMarket} from './routes-market-v09.mjs';
import {routeSellerAnalyticsV17} from './routes-seller-analytics-v17.mjs';
import {routeEngagementV17} from './routes-engagement-v17.mjs';
import {routeInquiryV21} from './routes-inquiry-v21.mjs';
import {routeOperator} from './routes-operator-v09.mjs';

await migrateV10(db);
await migrateV14(db);

const ROOT=fileURLToPath(new URL('.',import.meta.url));
const PUBLIC=join(ROOT,'public');
const PORT=Number(process.env.PORT||10000);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
async function serve(req,res,url){let p=url.pathname==='/'?'/index.html':url.pathname;if(p.includes('..'))return send(res,400,{error:'Invalid path'});try{const d=await readFile(join(PUBLIC,p));res.writeHead(200,{'content-type':mime[extname(p)]||'application/octet-stream','cache-control':p==='/index.html'?'no-store':'public, max-age=300','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'strict-origin-when-cross-origin','content-security-policy':"default-src 'self'; img-src 'self' https: data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'"});res.end(d)}catch{const d=await readFile(join(PUBLIC,'index.html'));res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY'});res.end(d)}}

http.createServer(async(req,res)=>{try{const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);if(!url.pathname.startsWith('/api/'))return serve(req,res,url);await prepareProviderWebhookRequest(req,url);if(await routeOrderVerificationPublicV16(req,res,url)!==false)return;if(await routePassportPublicV16(req,res,url)!==false)return;if(await routeInvariantPublicV14(req,res,url)!==false)return;if(await routeE2EPublicV14(req,res,url)!==false)return;if(await routeAuctionResultsPublicV20(req,res,url)!==false)return;if(await routeSimilarityPublicV18(req,res,url)!==false)return;if(await routeProductPublicV13(req,res,url)!==false)return;if(await routeExperiencePublicV12(req,res,url)!==false)return;if(await routeFoundationPublicV10(req,res,url)!==false)return;if(await routeAuthPublic(req,res,url)!==false)return;const ctx=await authContext(req);if(await routeOrderVerificationV16(req,res,url,ctx)!==false)return;if(await routePassportV16(req,res,url,ctx)!==false)return;if(await routeDisputeV16(req,res,url,ctx)!==false)return;if(await routePublicationV16(req,res,url,ctx)!==false)return;if(await routeInvariantsV14(req,res,url,ctx)!==false)return;if(await routeOwnershipV14(req,res,url,ctx)!==false)return;if(await routeOrganizationsV15(req,res,url,ctx)!==false)return;if(await routeInquiryV21(req,res,url,ctx)!==false)return;if(await routeE2EV14(req,res,url,ctx)!==false)return;if(await routePreferencesV14(req,res,url,ctx)!==false)return;if(await routeMediaV14(req,res,url,ctx)!==false)return;if(await routeExperienceMutationsV12(req,res,url,ctx)!==false)return;if(await routeCollectionMutationsV10(req,res,url,ctx)!==false)return;if(await routeAuctionIntegrityV10(req,res,url,ctx)!==false)return;if(await routeOperatorCockpitV16(req,res,url,ctx)!==false)return;if(await routeOperationsV10(req,res,url,ctx)!==false)return;if(await routeSellerAnalyticsV17(req,res,url,ctx)!==false)return;if(await routeEngagementV17(req,res,url,ctx)!==false)return;if(await routeMarket(req,res,url,ctx)!==false)return;if(await routeOperatorHooksV14(req,res,url,ctx)!==false)return;if(await routeOperator(req,res,url,ctx)!==false)return;return send(res,ctx?404:401,{error:ctx?'Not found':'Authentication required',code:ctx?undefined:'AUTH_REQUIRED'})}catch(e){console.error(e);return send(res,e.status||500,{error:e.message||'Unexpected server error',code:e.code,minimum:e.minimum,missing:e.missing})}}).listen(PORT,'0.0.0.0',()=>console.log(`ANTIQUA 0.14 listening on ${PORT}; persistence=${db.kind}; runtime=WEB_API`));
