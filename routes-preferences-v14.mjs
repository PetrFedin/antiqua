import {db,send,readBody,requireCsrf,lot,audit} from './runtime-v09.mjs';
import {setObjectFlag} from './preferences-v14.mjs';
import {collectionSurface} from './collection-surfaces-v16.mjs';

const typeFor={save:'SAVED',collect:'COLLECTED',alert:'WATCH'};
export async function routePreferencesV14(req,res,url,ctx){
 if(!ctx)return false;
 const m=url.pathname.match(/^\/api\/lots\/([^/]+)\/(save|collect|alert)$/);
 if(!m||req.method!=='POST')return false;
 requireCsrf(req,ctx);if(!lot(m[1]))return send(res,404,{error:'Object not found'});
 const body=await readBody(req),enabled=m[2]==='collect'?body.enabled!==false:body.enabled!==false,flag=typeFor[m[2]],result=await setObjectFlag(db,ctx.account.id,m[1],flag,enabled);
 await audit(req,ctx.account,enabled?`OBJECT_${flag}_SET`:`OBJECT_${flag}_CLEARED`,'OBJECT',m[1],null,{flag});
 return send(res,200,{enabled:result.enabled,objectId:m[1],flag,...(m[2]==='collect'?{surface:collectionSurface('PERSONAL_LIST_MARKER')}:{})})
}
