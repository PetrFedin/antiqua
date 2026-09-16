import {db,notify,lot} from './runtime-v09.mjs';
import {evaluateCriteria} from './domain-e2e-v14.mjs';

export async function notifyDiscoveryForObject(objectId){
 if(db.kind!=='POSTGRES')return {checked:0,matched:0,notified:0,reason:'MEMORY_PREVIEW'};
 const object=lot(objectId);if(!object)return {checked:0,matched:0,notified:0,reason:'OBJECT_NOT_FOUND'};
 const rows=(await db.pool.query("SELECT id,account_id,subscription_type,label,criteria FROM discovery_subscriptions WHERE status='ACTIVE'")).rows;
 let matched=0,notified=0;
 for(const s of rows){const hit=evaluateCriteria(s.criteria||{}).some(x=>x.id===objectId);if(!hit)continue;matched++;const inserted=(await db.pool.query('INSERT INTO discovery_matches(subscription_id,object_id,notified_at) VALUES($1,$2,now()) ON CONFLICT(subscription_id,object_id) DO NOTHING RETURNING subscription_id',[s.id,objectId])).rowCount;if(!inserted)continue;await notify(s.account_id,'DISCOVERY_MATCH',{subscriptionId:s.id,subscriptionType:s.subscription_type,objectId,label:s.label});notified++}
 return {checked:rows.length,matched,notified}
}
