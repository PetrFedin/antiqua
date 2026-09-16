import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {send,authContext,db} from './runtime-v09.mjs';
import {migrateV10} from './migration-v10.mjs';
import {migrateV14} from './migration-v14.mjs';
import {routeInvariantPublicV14,routeInvariantsV14} from './routes-invariants-v14.mjs';
import {routeE2EPublicV14,routeE2EV14} from './routes-e2e-v14.mjs';
import {routePreferencesV14} from './routes-preferences-v14.mjs';
import {routeMediaV14} from './routes-media-v14.mjs';
import {settleDueAuctions} from './domain-e2e-v14.mjs';
import {routeProductPublicV13} from './routes-product-v13.mjs';
import {routeExperiencePublicV12,routeExperienceMutationsV12} from './routes-experience-v12.mjs';
import {routeFoundationPublicV10,routeCollectionMutationsV10} from './routes-foundation-v10.mjs';
import {routeAuctionIntegrityV10} from './auction-integrity-v10.mjs';
import {routeOperationsV10} from './routes-operations-v10.mjs';
import {routeAuthPublic} from './routes-auth-v09.mjs';
import {routeMarket} from './routes-market-v09.mjs';
import {routeOperator} from './routes-operator-v09.mjs';

await migrateV10(db);
await migrateV14(db);
await settleDueAuctions().catch(e=>console.error('initial settlement sweep',e));
const sweep=setInterval(()=>settleDueAuctions().catch(e=>console.error('settlement sweep',e)),30000);sweep.unref?.();

const ROOT=fileURLToPath(new URL('.',import.meta.url));
const PUBLIC=join(ROOT,'public');
const PORT=Number(process.env.PORT||10000);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
async function serve(req,res,url){let p=url.pathname==='/'?'/index.html':url.pathname;if(p.includes('..'))return send(res,400,{error:'Invalid path'});try{const d=await readFile(join(PUBLIC,p));res.writeHead(200,{'content-type':mime[extname(p)]||'application/octet-stream','cache-control':p==='/index.html'?'no-store':'public, max-age=300','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'strict-origin-when-cross-origin','content-security-policy':"default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'"});res.end(d)}catch{const d=await readFile(join(PUBLIC,'index.html'));res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY'});res.end(d)}}

http.createServer(async(req,res)=>{try{const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);if(!url.pathname.startsWith('/api/'))return serve(req,res,url);if(await routeInvariantPublicV14(req,res,url)!==false)return;if(await routeE2EPublicV14(req,res,url)!==false)return;if(await routeProductPublicV13(req,res,url)!==false)return;if(await routeExperiencePublicV12(req,res,url)!==false)return;if(await routeFoundationPublicV10(req,res,url)!==false)return;if(await routeAuthPublic(req,res,url)!==false)return;const ctx=await authContext(req);if(await routeInvariantsV14(req,res,url,ctx)!==false)return;if(await routeE2EV14(req,res,url,ctx)!==false)return;if(await routePreferencesV14(req,res,url,ctx)!==false)return;if(await routeMediaV14(req,res,url,ctx)!==false)return;if(await routeExperienceMutationsV12(req,res,url,ctx)!==false)return;if(await routeCollectionMutationsV10(req,res,url,ctx)!==false)return;if(await routeAuctionIntegrityV10(req,res,url,ctx)!==false)return;if(await routeOperationsV10(req,res,url,ctx)!==false)return;if(await routeMarket(req,res,url,ctx)!==false)return;if(await routeOperator(req,res,url,ctx)!==false)return;return send(res,ctx?404:401,{error:ctx?'Not found':'Authentication required',code:ctx?undefined:'AUTH_REQUIRED'})}catch(e){console.error(e);return send(res,e.status||500,{error:e.message||'Unexpected server error',code:e.code,minimum:e.minimum,missing:e.missing})}}).listen(PORT,'0.0.0.0',()=>console.log(`ANTIQUA 0.14 listening on ${PORT}; persistence=${db.kind}`));
