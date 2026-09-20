import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {db,lots,bi} from '../runtime-v09.mjs';
import {similarObjectsFor} from '../similarity-v18.mjs';

if(!process.env.DATABASE_URL){
 console.log('ANTIQUA v18 PostgreSQL similarity: skipped (DATABASE_URL not set)');
 process.exit(0);
}
assert.equal(db.kind,'POSTGRES');
const token=crypto.randomUUID().replaceAll('-','').slice(0,12);
const privateId='lot-private-sim-'+token,privateCode='AQ-PRIVATE-SIM-'+token;
const privateObject={id:privateId,objectId:privateCode,lotNumber:999001,department:bi('European Furniture','Европейская мебель'),maker:bi('Private maker','Частный мастер'),title:bi('Private unpublished furniture','Непубличный предмет мебели'),period:bi('18th century','XVIII век'),origin:bi('Italy','Италия'),currency:'EUR',estimateLow:7000,estimateHigh:9000,image:'',materials:bi('Walnut, brass','Орех, латунь'),conditionGrade:'A-',catalogueStatus:'APPROVED'};
lots.push(privateObject);
try{
 await db.pool.query("INSERT INTO objects(id,object_code,passport,catalogue_status,trust_status,publication_status) VALUES($1,$2,$3,'APPROVED','CLEARED','PRIVATE')",[privateId,privateCode,privateObject]);
 const result=await similarObjectsFor('lot-109',{limit:12});
 assert.ok(result);
 assert.equal(result.items.some(x=>x.id===privateId),false,'PRIVATE object must never appear in public similarity');
 const sourceResult=await similarObjectsFor(privateId,{limit:4});
 assert.equal(sourceResult,null,'PRIVATE source must not expose a similarity endpoint');
 console.log('ANTIQUA v18 PostgreSQL similarity: publication boundary prevents private source/candidate leakage passed');
}finally{
 const i=lots.findIndex(x=>x.id===privateId);if(i>=0)lots.splice(i,1);
 await db.pool.query('DELETE FROM objects WHERE id=$1',[privateId]).catch(()=>{});
 await db.pool.end();
}
