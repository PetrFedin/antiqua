const memory=new Map();
const key=(accountId,objectId,flag)=>`${accountId}|${objectId}|${flag}`;
const VALID=new Set(['SAVED','WATCH','COLLECTED']);
export async function setObjectFlag(db,accountId,objectId,flag,enabled=true){flag=String(flag||'').toUpperCase();if(!VALID.has(flag))throw Object.assign(new Error('Invalid object flag'),{status:400});if(db.kind==='POSTGRES'){if(enabled)await db.pool.query(`INSERT INTO account_object_flags(account_id,object_id,flag_type) VALUES($1,$2,$3) ON CONFLICT(account_id,object_id,flag_type) DO UPDATE SET updated_at=now()`,[accountId,objectId,flag]);else await db.pool.query('DELETE FROM account_object_flags WHERE account_id=$1 AND object_id=$2 AND flag_type=$3',[accountId,objectId,flag])}else{const k=key(accountId,objectId,flag);if(enabled)memory.set(k,{accountId,objectId,flagType:flag,createdAt:new Date().toISOString()});else memory.delete(k)}return{objectId,flag,enabled:Boolean(enabled)}}
export async function listObjectFlags(db,accountId){if(db.kind==='POSTGRES')return(await db.pool.query('SELECT object_id,flag_type,created_at,updated_at FROM account_object_flags WHERE account_id=$1 ORDER BY updated_at DESC',[accountId])).rows.map(r=>({objectId:r.object_id,flagType:r.flag_type,createdAt:r.created_at.toISOString(),updatedAt:r.updated_at.toISOString()}));return[...memory.values()].filter(x=>x.accountId===accountId)}
export async function listRegisteredSales(db,accountId){if(db.kind!=='POSTGRES')return[];return(await db.pool.query("SELECT sale_id FROM auction_registrations WHERE account_id=$1 AND status='APPROVED' ORDER BY updated_at DESC",[accountId])).rows.map(r=>r.sale_id)}
export async function augmentClientState(db,account,state){const flags=await listObjectFlags(db,account.id),saved=flags.filter(x=>x.flagType==='SAVED').map(x=>x.objectId),watch=flags.filter(x=>x.flagType==='WATCH').map(x=>x.objectId),collected=flags.filter(x=>x.flagType==='COLLECTED').map(x=>x.objectId),registered=await listRegisteredSales(db,account.id);return{...state,savedLots:[...new Set([...(state.savedLots||[]),...saved])],watchAlerts:[...new Set([...(state.watchAlerts||[]),...watch])],collection:[...new Set([...(state.collection||[]),...collected])],registeredSales:[...new Set([...(state.registeredSales||[]),...registered])]}}


export async function aggregateObjectFlags(db,objectIds,flagTypes=['SAVED','WATCH']){
 const ids=[...new Set((objectIds||[]).map(String).filter(Boolean))],types=[...new Set((flagTypes||[]).map(x=>String(x).toUpperCase()).filter(x=>VALID.has(x)))],out={};
 for(const id of ids)out[id]=Object.fromEntries(types.map(t=>[t,0]));
 if(!ids.length||!types.length)return out;
 if(db.kind==='POSTGRES'){
  const rows=(await db.pool.query('SELECT object_id,flag_type,count(*)::int AS count FROM account_object_flags WHERE object_id=ANY($1::text[]) AND flag_type=ANY($2::text[]) GROUP BY object_id,flag_type',[ids,types])).rows;
  for(const r of rows)if(out[r.object_id]&&r.flag_type in out[r.object_id])out[r.object_id][r.flag_type]=Number(r.count||0);
  return out
 }
 const wantedIds=new Set(ids),wantedTypes=new Set(types);
 for(const x of memory.values())if(wantedIds.has(String(x.objectId))&&wantedTypes.has(String(x.flagType)))out[String(x.objectId)][String(x.flagType)]++;
 return out
}


export async function listObjectFlagAccounts(db,objectId,flag='WATCH'){
 objectId=String(objectId||'');flag=String(flag||'').toUpperCase();
 if(!objectId||!VALID.has(flag))return[];
 if(db.kind==='POSTGRES'){
  return (await db.pool.query('SELECT account_id FROM account_object_flags WHERE object_id=$1 AND flag_type=$2 ORDER BY account_id',[objectId,flag])).rows.map(r=>String(r.account_id));
 }
 return [...new Set([...memory.values()].filter(x=>String(x.objectId)===objectId&&String(x.flagType)===flag).map(x=>String(x.accountId)))].sort();
}
