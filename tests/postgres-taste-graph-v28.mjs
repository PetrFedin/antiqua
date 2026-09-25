import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {db} from '../runtime-v09.mjs';
import {buildTasteProfile,tasteRecommendations} from '../taste-graph-v28.mjs';

if(!process.env.DATABASE_URL){console.log('ANTIQUA v28 PostgreSQL Taste Graph: skipped (DATABASE_URL not set)');process.exit(0)}
assert.equal(db.kind,'POSTGRES');
const buyer=await db.findAccountByEmail('buyer@demo.antiqua');assert.ok(buyer?.id);
const token=crypto.randomUUID().replaceAll('-','').slice(0,12),subId='taste-sub-'+token,eventId='taste-event-'+token,sourceKey='taste-source-'+token;
const hadFlag=(await db.pool.query("SELECT 1 FROM account_object_flags WHERE account_id=$1 AND object_id='lot-101' AND flag_type='SAVED'",[buyer.id])).rowCount>0;
try{
 await db.pool.query("INSERT INTO account_object_flags(account_id,object_id,flag_type) VALUES($1,'lot-101','SAVED') ON CONFLICT(account_id,object_id,flag_type) DO UPDATE SET updated_at=now()",[buyer.id]);
 await db.pool.query("INSERT INTO discovery_subscriptions(id,account_id,subscription_type,label,criteria,status) VALUES($1,$2,'FOLLOW_CATEGORY',$3,$4,'ACTIVE')",[subId,buyer.id,{en:'Sculpture',ru:'Скульптура'},{category:'Sculpture'}]);
 const profile=await buildTasteProfile(buyer);assert.ok(profile.profile.signalCounts.SAVED>=1);assert.ok(profile.profile.signalCounts.FOLLOW_CATEGORY>=1);assert.ok(profile.profile.dimensions.department.some(x=>x.key==='sculpture'&&x.signals.some(s=>s.type==='FOLLOW_CATEGORY')));
 const recs=await tasteRecommendations(buyer,{limit:50});assert.equal(recs.recommendations.some(x=>x.object.id==='lot-101'),false);assert.ok(recs.recommendations.some(x=>x.reasons.some(r=>r.signals.some(s=>s.type==='FOLLOW_CATEGORY'))));

 const cx=await db.pool.connect();try{
  await cx.query('BEGIN');
  await cx.query("INSERT INTO taste_signal_events(id,account_id,object_id,signal_type,source_key,metadata) VALUES($1,$2,'lot-102','ENGAGED_VIEW',$3,$4)",[eventId,buyer.id,sourceKey,{depth:.7,dwellSeconds:15}]);
  await cx.query('SAVEPOINT immutable_probe');let blocked=false;try{await cx.query("UPDATE taste_signal_events SET metadata=$2 WHERE id=$1",[eventId,{tampered:true}])}catch(e){blocked=e.code==='55000';await cx.query('ROLLBACK TO SAVEPOINT immutable_probe')}assert.equal(blocked,true,'taste signal history must be immutable');
  await cx.query('ROLLBACK');
 }finally{cx.release()}
 console.log('ANTIQUA v28 PostgreSQL Taste Graph: source authority + category follow + immutable explicit signals passed');
}finally{
 await db.pool.query('DELETE FROM discovery_subscriptions WHERE id=$1',[subId]).catch(()=>{});
 if(!hadFlag)await db.pool.query("DELETE FROM account_object_flags WHERE account_id=$1 AND object_id='lot-101' AND flag_type='SAVED'",[buyer.id]).catch(()=>{});
 await db.pool.end();
}
