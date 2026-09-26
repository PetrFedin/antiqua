import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {db} from '../runtime-v09.mjs';
import {setExhibitionFollow,transitionPartnerDrop,getPartnerDrop} from '../partner-drops-v29.mjs';

if(!process.env.DATABASE_URL){console.log('ANTIQUA v29 PostgreSQL Partner Drops: skipped (DATABASE_URL not set)');process.exit(0)}
assert.equal(db.kind,'POSTGRES');const owner=await db.findAccountByEmail('buyer@demo.antiqua');assert.ok(owner?.id);
const token=crypto.randomUUID().replaceAll('-','').slice(0,12),id='ex-drop-'+token;
try{
 await db.pool.query("INSERT INTO exhibitions(id,owner_account_id,title,subtitle,curatorial_statement,visibility,status,metadata) VALUES($1,$2,$3,$4,$5,'PUBLIC','SCHEDULED',$6)",[id,owner.id,{en:'Partner Drop Proof',ru:'Тест партнёрского выпуска'},{},{}, {drop:{format:'PARTNER_FAIR',partner:{name:'Test Partner',role:'FAIR'},access:'PUBLIC',coBranded:true}}]);
 let projected=await getPartnerDrop(owner,id);assert.equal(projected.drop.stage,'PREVIEW');assert.equal(projected.drop.format,'PARTNER_FAIR');
 let follow=await setExhibitionFollow(owner,id,true);assert.equal(follow.enabled,true);assert.equal(follow.follow.count,1);
 const released=await transitionPartnerDrop(owner,id,'LIVE');assert.equal(released.changed,true);assert.equal(released.drop.stage,'LIVE');
 let outbox=(await db.pool.query("SELECT id,idempotency_key,payload FROM outbox_events WHERE idempotency_key=$1",[`notification:partner-drop-live:${id}:${owner.id}`])).rows;assert.equal(outbox.length,1);assert.equal(outbox[0].payload.type,'PARTNER_DROP_LIVE');
 const replay=await transitionPartnerDrop(owner,id,'LIVE');assert.equal(replay.changed,false);
 outbox=(await db.pool.query("SELECT id FROM outbox_events WHERE idempotency_key=$1",[`notification:partner-drop-live:${id}:${owner.id}`])).rows;assert.equal(outbox.length,1,'release replay must not duplicate notification effect');
 const archived=await transitionPartnerDrop(owner,id,'ARCHIVED');assert.equal(archived.changed,true);assert.equal(archived.drop.stage,'ARCHIVED');
 projected=await getPartnerDrop(owner,id);assert.equal(projected.drop.follow.following,true,'archive keeps its audience relationship');
 console.log('ANTIQUA v29 PostgreSQL Partner Drops: preview + durable follow + exactly-once release outbox + archive passed');
}finally{
 await db.pool.query("DELETE FROM outbox_events WHERE idempotency_key=$1",[`notification:partner-drop-live:${id}:${owner.id}`]).catch(()=>{});
 await db.pool.query('DELETE FROM exhibitions WHERE id=$1',[id]).catch(()=>{});
 await db.pool.end();
}
