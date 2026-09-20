import {send} from './runtime-v09.mjs';
import {similarObjectsFor,similarityCapabilities} from './similarity-v18.mjs';

export async function routeSimilarityPublicV18(req,res,url){
 const m=url.pathname.match(/^\/api\/lots\/([^/]+)\/similar$/);
 if(!m||req.method!=='GET')return false;
 const limit=Number(url.searchParams.get('limit')||4);
 const result=await similarObjectsFor(m[1],{limit});
 if(!result)return send(res,404,{error:'Object not found',code:'OBJECT_NOT_FOUND'});
 return send(res,200,result);
}

export function similarityHealthV18(){return similarityCapabilities()}
