import {send,readBody,requireCsrf,requirePermission,audit} from './runtime-v09.mjs';
import {listPublicDrops,getPublicDrop,listDropsForOperator,getDropForOperator,createDrop,updateDrop,upsertDropItem,removeDropItem,transitionDrop,setDropFollow,dropsCapabilities} from './drops-v29.mjs';

export async function routeDropsPublicV29(req,res,url){
 if(url.pathname==='/api/drops'&&req.method==='GET')return send(res,200,{drops:await listPublicDrops(),capabilities:dropsCapabilities()});
 const one=url.pathname.match(/^\/api\/drops\/([^/]+)$/);
 if(one&&req.method==='GET'){const drop=await getPublicDrop(decodeURIComponent(one[1]));return drop?send(res,200,{drop,capabilities:dropsCapabilities()}):send(res,404,{error:'Drop not found',code:'DROP_NOT_FOUND'})}
 return false
}

export async function routeDropsV29(req,res,url,ctx){
 if(!ctx)return false;const a=ctx.account;
 const follow=url.pathname.match(/^\/api\/drops\/([^/]+)\/follow$/);
 if(follow&&req.method==='POST'){requireCsrf(req,ctx);const body=await readBody(req),x=await setDropFollow(a,decodeURIComponent(follow[1]),body.enabled!==false);await audit(req,a,x.followed?'DROP_FOLLOWED':'DROP_UNFOLLOWED','DROP',x.dropId);return send(res,200,x)}

 if(url.pathname==='/api/operator/drops'&&req.method==='GET'){requirePermission(a,'drop.manage');return send(res,200,{drops:await listDropsForOperator(),capabilities:dropsCapabilities()})}
 if(url.pathname==='/api/operator/drops'&&req.method==='POST'){requireCsrf(req,ctx);requirePermission(a,'drop.manage');const x=await createDrop(a,await readBody(req));await audit(req,a,x.idempotent?'DROP_CREATE_REPLAY':'DROP_CREATED','DROP',x.drop.id,null,null,{version:x.drop.version});return send(res,x.idempotent?200:201,x)}
 const one=url.pathname.match(/^\/api\/operator\/drops\/([^/]+)$/);
 if(one&&req.method==='GET'){requirePermission(a,'drop.manage');const drop=await getDropForOperator(decodeURIComponent(one[1]));return drop?send(res,200,{drop}):send(res,404,{error:'Drop not found',code:'DROP_NOT_FOUND'})}
 if(one&&req.method==='PATCH'){requireCsrf(req,ctx);requirePermission(a,'drop.manage');const x=await updateDrop(a,decodeURIComponent(one[1]),await readBody(req));await audit(req,a,x.idempotent?'DROP_UPDATE_REPLAY':'DROP_UPDATED','DROP',x.drop.id,null,null,{version:x.drop.version});return send(res,200,x)}
 const items=url.pathname.match(/^\/api\/operator\/drops\/([^/]+)\/items$/);
 if(items&&req.method==='POST'){requireCsrf(req,ctx);requirePermission(a,'drop.manage');const x=await upsertDropItem(a,decodeURIComponent(items[1]),await readBody(req));await audit(req,a,x.idempotent?'DROP_ITEM_REPLAY':'DROP_ITEM_UPSERTED','DROP',x.drop.id,null,null,{version:x.drop.version});return send(res,x.idempotent?200:201,x)}
 const item=url.pathname.match(/^\/api\/operator\/drops\/([^/]+)\/items\/([^/]+)$/);
 if(item&&req.method==='DELETE'){requireCsrf(req,ctx);requirePermission(a,'drop.manage');const x=await removeDropItem(a,decodeURIComponent(item[1]),decodeURIComponent(item[2]),await readBody(req));await audit(req,a,x.idempotent?'DROP_ITEM_REMOVE_REPLAY':'DROP_ITEM_REMOVED','DROP',x.drop.id,null,null,{version:x.drop.version,objectId:decodeURIComponent(item[2])});return send(res,200,x)}
 const transition=url.pathname.match(/^\/api\/operator\/drops\/([^/]+)\/transition$/);
 if(transition&&req.method==='POST'){requireCsrf(req,ctx);requirePermission(a,'drop.manage');const body=await readBody(req),target=String(body.status||body.targetStatus||'').toUpperCase();const x=await transitionDrop(a,decodeURIComponent(transition[1]),target,body);await audit(req,a,x.idempotent?'DROP_TRANSITION_REPLAY':'DROP_TRANSITIONED','DROP',x.drop.id,null,null,{status:x.drop.status,version:x.drop.version,notifications:x.notifications});return send(res,200,x)}
 return false
}
