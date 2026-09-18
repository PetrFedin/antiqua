import assert from 'node:assert/strict';
import crypto from 'node:crypto';

if(!process.env.DATABASE_URL){console.log('ANTIQUA v16 operator cockpit: skipped (DATABASE_URL not set)');process.exit(0)}

const {db}=await import('../runtime-v09.mjs');
const {operatorCockpitSnapshot}=await import('../operator-cockpit-v16.mjs');
const token=crypto.randomUUID().replaceAll('-',''),old=new Date(Date.now()-2*3600_000).toISOString(),fresh=new Date().toISOString();
const ids={
 draft:`cockpit-draft-${token}`,dispute:`cockpit-dispute-${token}`,payout:`cockpit-payout-${token}`,
 dead:`cockpit-outbox-dead-${token}`,freshOutbox:`cockpit-outbox-fresh-${token}`,staleOutbox:`cockpit-outbox-stale-${token}`,
 failedProvider:`cockpit-provider-failed-${token}`,freshProvider:`cockpit-provider-fresh-${token}`,media:`cockpit-media-${token}`
};

try{
  assert.equal(db.kind,'POSTGRES');
  await db.pool.query(`INSERT INTO seller_drafts(id,seller_id,status,payload,created_at,updated_at)
    VALUES($1,'seller-preview','CATALOGUE_REVIEW',$2,$3,$3)`,[ids.draft,{id:ids.draft,sellerId:'seller-preview',status:'CATALOGUE_REVIEW',title:{en:'Cockpit proof object',ru:'Тест cockpit'},media:[]},old]);
  await db.pool.query(`INSERT INTO disputes(id,opened_by_account_id,buyer_account_id,seller_id,category,status,summary,created_at,updated_at)
    VALUES($1,'acct-buyer-demo','acct-buyer-demo','seller-preview','OTHER','OPEN','Cockpit proof dispute',$2,$2)`,[ids.dispute,old]);
  await db.pool.query(`INSERT INTO payouts(id,seller_id,amount_minor,currency,status,hold_reason,source_type,source_id,created_at,updated_at)
    VALUES($1,'seller-preview',42000,'EUR','FAILED','TRUST_AND_DELIVERY_HOLD','ORDER',$2,$3,$3)`,[ids.payout,`cockpit-source-${token}`,old]);

  await db.pool.query(`INSERT INTO outbox_events(id,topic,aggregate_type,aggregate_id,status,attempt_count,max_attempts,last_error,available_at,created_at)
    VALUES($1,'COCKPIT.DEAD','TEST',$2,'DEAD',12,12,'synthetic failure',$3,$3)`,[ids.dead,token,old]);
  await db.pool.query(`INSERT INTO outbox_events(id,topic,aggregate_type,aggregate_id,status,attempt_count,max_attempts,available_at,created_at)
    VALUES($1,'COCKPIT.FRESH','TEST',$2,'PENDING',0,12,now(),now())`,[ids.freshOutbox,token]);
  await db.pool.query(`INSERT INTO outbox_events(id,topic,aggregate_type,aggregate_id,status,attempt_count,max_attempts,available_at,locked_at,locked_by,created_at)
    VALUES($1,'COCKPIT.STALE','TEST',$2,'PROCESSING',1,12,$3,$3,'dead-worker',$3)`,[ids.staleOutbox,token,old]);

  await db.pool.query(`INSERT INTO provider_events(id,provider_type,provider,external_event_id,event_type,entity_type,entity_id,attempt_count,last_error,created_at)
    VALUES($1,'PAYMENT','COCKPIT_PSP',$2,'CAPTURED','ORDER',$3,3,'synthetic provider failure',$4)`,[ids.failedProvider,`failed-${token}`,token,old]);
  await db.pool.query(`INSERT INTO provider_events(id,provider_type,provider,external_event_id,event_type,entity_type,entity_id,attempt_count,created_at)
    VALUES($1,'PAYMENT','COCKPIT_PSP',$2,'CAPTURED','ORDER',$3,0,now())`,[ids.freshProvider,`fresh-${token}`,token]);

  await db.pool.query(`INSERT INTO media_assets(id,entity_type,entity_id,storage_key,content_type,bytes,role,visibility,status,created_at)
    VALUES($1,'DRAFT',$2,$3,'image/jpeg',100,'DETAIL','PRIVATE','VERIFYING',$4)`,[ids.media,ids.draft,`cockpit/${token}.jpg`,old]);

  const snap=await operatorCockpitSnapshot({limit:100});
  assert.equal(snap.persistence.durable,true);
  assert.equal(snap.capabilities.readOnly,true);
  assert.ok(snap.summary.actionable>=7);
  assert.ok(snap.summary.critical>=2);
  assert.ok(snap.summary.high>=3);
  assert.ok(snap.summary.systemIncidents>=3);

  const byId=new Map(snap.queues.map(x=>[x.entityId,x]));
  assert.equal(byId.get(ids.dead)?.severity,'CRITICAL');
  assert.equal(byId.get(ids.dead)?.nextAction,'REVIEW_DEAD_EVENT');
  assert.equal(byId.get(ids.failedProvider)?.severity,'CRITICAL');
  assert.equal(byId.get(ids.failedProvider)?.nextAction,'RETRY_PROVIDER_EVENT');
  assert.equal(byId.get(ids.staleOutbox)?.severity,'HIGH');
  assert.equal(byId.get(ids.dispute)?.severity,'HIGH');
  assert.equal(byId.get(ids.payout)?.severity,'HIGH');
  assert.equal(byId.get(ids.media)?.severity,'MEDIUM');
  assert.equal(byId.get(ids.draft)?.kind,'PUBLICATION');
  assert.equal(byId.has(ids.freshOutbox),false);
  assert.equal(byId.has(ids.freshProvider),false);

  const ranked=snap.queues.filter(x=>[ids.dead,ids.failedProvider,ids.staleOutbox,ids.dispute,ids.payout,ids.media,ids.draft].includes(x.entityId));
  const ranks={CRITICAL:0,HIGH:1,MEDIUM:2,LOW:3,INFO:4};
  for(let i=1;i<ranked.length;i++)assert.ok(ranks[ranked[i-1].severity]<=ranks[ranked[i].severity],'cockpit severity ordering regressed');
  assert.ok(Number(snap.system.outbox.DEAD||0)>=1);
  assert.ok(snap.system.unprocessedProviderEvents>=2);
  assert.ok(snap.system.staleMediaVerifications>=1);

  console.log('ANTIQUA v16 operator cockpit: durable triage + severity ordering + system incident detection + false-positive suppression passed');
}finally{
  await db.pool.query('DELETE FROM media_assets WHERE id=$1',[ids.media]).catch(()=>{});
  await db.pool.query('DELETE FROM provider_events WHERE id=ANY($1::text[])',[[ids.failedProvider,ids.freshProvider]]).catch(()=>{});
  await db.pool.query('DELETE FROM outbox_events WHERE id=ANY($1::text[])',[[ids.dead,ids.freshOutbox,ids.staleOutbox]]).catch(()=>{});
  await db.pool.query('DELETE FROM payouts WHERE id=$1',[ids.payout]).catch(()=>{});
  await db.pool.query('DELETE FROM disputes WHERE id=$1',[ids.dispute]).catch(()=>{});
  await db.pool.query('DELETE FROM seller_drafts WHERE id=$1',[ids.draft]).catch(()=>{});
  await db.pool.end();
}
