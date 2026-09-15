import {send,requirePermission} from './runtime-v09.mjs';
import {financeCapabilities,reconciliationSnapshot} from './finance-v10.mjs';

export function integrationCapabilities(){return{identity:{provider:process.env.KYC_PROVIDER||'NOT_CONFIGURED',configured:Boolean(process.env.KYC_PROVIDER&&process.env.KYC_PROVIDER!=='NOT_CONFIGURED'),mode:'ADAPTER'},payments:financeCapabilities(),storage:{provider:process.env.S3_ENDPOINT?'S3_COMPATIBLE':'NOT_CONFIGURED',configured:Boolean(process.env.S3_ENDPOINT)},database:{provider:process.env.DATABASE_URL?'POSTGRESQL':'MEMORY_FALLBACK',configured:Boolean(process.env.DATABASE_URL)}}}
export async function routeOperationsV10(req,res,url,ctx){if(!ctx)return false;if(url.pathname==='/api/operator/integrations'&&req.method==='GET'){requirePermission(ctx.account,'audit.read');return send(res,200,{integrations:integrationCapabilities(),reconciliation:await reconciliationSnapshot()})}return false}
