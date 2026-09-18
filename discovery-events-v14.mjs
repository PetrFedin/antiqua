import {db,notify,lot} from './runtime-v09.mjs';
import {evaluateCriteria} from './domain-e2e-v14.mjs';
import {notifyDiscoveryForObjectPostgres} from './discovery-matching-v16.mjs';

export async function notifyDiscoveryForObject(objectId){
 if(db.kind==='POSTGRES')return notifyDiscoveryForObjectPostgres(objectId);
 const object=lot(objectId);if(!object)return {checked:0,matched:0,notified:0,reason:'OBJECT_NOT_FOUND'};
 const hits=[];
 // Memory preview keeps the legacy deterministic evaluator; PostgreSQL never reads process-local lots.
 // There is no durable match journal in preview.
 return {checked:hits.length,matched:0,notified:0,reason:'MEMORY_PREVIEW'}
}
