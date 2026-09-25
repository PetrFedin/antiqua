import assert from 'node:assert/strict';
import crypto from 'node:crypto';

if(!process.env.DATABASE_URL){console.log('ANTIQUA v23 PostgreSQL commercial services: skipped (DATABASE_URL not set)');process.exit(0)}

const {db}=await import('../runtime-v09.mjs');
const {createConditionReportRequest,getConditionReportRequest,publishConditionReportVersion}=await import('../condition-report-v23.mjs');
const {createViewingRequest,getViewingRequest,proposeViewingSlots,confirmViewingSlot,requestViewingReschedule,cancelViewingRequest,viewingCalendarIcs}=await import('../viewing-v23.mjs');
assert.equal(db.kind,'POSTGRES');

const token=crypto.randomUUID().replaceAll('-',''),key=p=>p+'-'+crypto.randomUUID(),future=h=>new Date(Date.now()+h*3600000).toISOString();
const buyer=await db.findAccountByEmail('buyer@demo.antiqua'),seller=await db.findAccountByEmail('seller@demo.antiqua');
assert.ok(buyer?.id&&seller?.sellerId);
const ids={
 objects:['obj-v23-cond-'+token,'obj-v23-view-'+token],
 listings:['lst-v23-cond-'+token,'lst-v23-view-'+token],
 media:[],condition:[],viewing:[]
};

async function fixture(objectId,listingId,price){
 await db.pool.query("INSERT INTO objects(id,object_code,seller_id,passport,catalogue_status,trust_status,publication_status,created_at,updated_at) VALUES($1,$2,$3,$4,'APPROVED','ALLOWED','PUBLIC',now(),now())",[objectId,'AQ-V23-'+objectId,seller.sellerId,{id:objectId,objectId:'AQ-V23-'+objectId,title:{en:'V23 proof object',ru:'Предмет V23'},sellerId:seller.sellerId,catalogueStatus:'APPROVED',trustStatus:'ALLOWED',publicationStatus:'PUBLIC'}]);
 const payload={id:listingId,lotId:objectId,sellerId:seller.sellerId,saleType:'MAKE_OFFER',price,currency:'EUR',negotiable:true,status:'ACTIVE',shippingFrom:'Amsterdam'};
 await db.pool.query("INSERT INTO listings(id,object_id,seller_id,status,payload,updated_at) VALUES($1,$2,$3,'ACTIVE',$4,now())",[listingId,objectId,seller.sellerId,payload])
}
async function readyMedia(objectId,suffix){
 const id='media-v23-'+suffix+'-'+token;ids.media.push(id);
 await db.pool.query("INSERT INTO media_assets(id,entity_type,entity_id,storage_key,content_type,bytes,sha256,etag,role,visibility,status,uploaded_at,created_at) VALUES($1,'OBJECT',$2,$3,'application/pdf',128,$4,'etag','CONDITION','PRIVATE','READY',now(),now())",[id,objectId,'proof/v23/'+id+'.pdf',suffix.repeat(64).slice(0,64)]);
 return id
}

try{
 await fixture(ids.objects[0],ids.listings[0],10000);await fixture(ids.objects[1],ids.listings[1],8000);

 const created=await createConditionReportRequest(buyer,ids.listings[0],{note:'Detailed condition proof requested.',clientActionId:key('condition-create')});ids.condition.push(created.request.id);
 assert.equal(created.request.status,'REQUESTED');assert.equal(created.request.version,1);
 const media1=await readyMedia(ids.objects[0],'a'),publishKey=key('condition-publish');
 const publications=await Promise.all(Array.from({length:6},()=>publishConditionReportVersion(seller,created.request.id,{mediaId:media1,summary:'Detailed inspection complete.',conditionGrade:'B+',restorationNotes:'Historic repair documented.',expectedVersion:1,clientActionId:publishKey})));
 assert.equal(publications.filter(x=>!x.idempotent).length,1);assert.equal(publications.filter(x=>x.idempotent).length,5);
 let condition=await getConditionReportRequest(buyer,created.request.id);assert.equal(condition.status,'FULFILLED');assert.equal(condition.version,2);assert.equal(condition.currentReportVersion,1);assert.equal(condition.versions.length,1);
 assert.equal((await db.pool.query('SELECT count(*)::int n FROM condition_report_versions WHERE request_id=$1',[created.request.id])).rows[0].n,1);
 assert.equal((await db.pool.query('SELECT count(*)::int n FROM condition_report_events WHERE request_id=$1 AND client_action_id=$2',[created.request.id,publishKey])).rows[0].n,1);

 await assert.rejects(()=>db.pool.query("UPDATE condition_report_versions SET summary='mutated' WHERE request_id=$1",[created.request.id]),e=>e.code==='55000');
 await assert.rejects(()=>db.pool.query("UPDATE condition_report_events SET metadata='{}'::jsonb WHERE request_id=$1",[created.request.id]),e=>e.code==='55000');

 const wrongMedia=await readyMedia(ids.objects[1],'b');
 await assert.rejects(()=>publishConditionReportVersion(seller,created.request.id,{mediaId:wrongMedia,summary:'wrong object',expectedVersion:2,clientActionId:key('condition-wrong-media')}),e=>e.code==='CONDITION_MEDIA_INVALID');
 condition=await getConditionReportRequest(buyer,created.request.id);assert.equal(condition.version,2);assert.equal(condition.versions.length,1);

 const viewing=await createViewingRequest(buyer,ids.listings[1],{note:'Afternoon visit.',clientActionId:key('viewing-create')});ids.viewing.push(viewing.request.id);assert.equal(viewing.request.status,'REQUESTED');
 const proposalKey=key('viewing-slots'),slots1=[
  {startsAt:future(24),endsAt:future(25),timezone:'Europe/Amsterdam'},
  {startsAt:future(48),endsAt:future(49),timezone:'Europe/Amsterdam'},
  {startsAt:future(72),endsAt:future(73),timezone:'Europe/Amsterdam'}
 ];
 const proposals=await Promise.all(Array.from({length:5},()=>proposeViewingSlots(seller,viewing.request.id,{slots:slots1,expectedVersion:1,clientActionId:proposalKey})));
 assert.equal(proposals.filter(x=>!x.idempotent).length,1);assert.equal(proposals.filter(x=>x.idempotent).length,4);
 let view=await getViewingRequest(buyer,viewing.request.id);assert.equal(view.status,'SLOTS_PROPOSED');assert.equal(view.version,2);assert.equal(view.proposalVersion,1);
 const slot=view.slots.find(x=>x.proposalVersion===1),confirmKey=key('viewing-confirm');
 const confirms=await Promise.all(Array.from({length:5},()=>confirmViewingSlot(buyer,viewing.request.id,{slotId:slot.id,expectedVersion:2,clientActionId:confirmKey})));
 assert.equal(confirms.filter(x=>!x.idempotent).length,1);assert.equal(confirms.filter(x=>x.idempotent).length,4);
 view=await getViewingRequest(buyer,viewing.request.id);assert.equal(view.status,'CONFIRMED');assert.equal(view.version,3);assert.equal(view.calendarEvent.sequence,0);assert.equal(view.calendarEvent.startsAt,slot.startsAt);
 assert.equal((await db.pool.query('SELECT count(*)::int n FROM viewing_calendar_events WHERE request_id=$1',[viewing.request.id])).rows[0].n,1);

 await assert.rejects(()=>requestViewingReschedule(buyer,viewing.request.id,{expectedVersion:2,reason:'stale',clientActionId:key('viewing-stale')}),e=>e.code==='SERVICE_VERSION_CONFLICT');
 view=(await requestViewingReschedule(buyer,viewing.request.id,{expectedVersion:3,reason:'Travel changed.',clientActionId:key('viewing-reschedule')})).request;assert.equal(view.status,'RESCHEDULE_REQUESTED');assert.equal(view.version,4);assert.equal(view.calendarEvent.sequence,0);
 const slots2=[{startsAt:future(96),endsAt:future(97),timezone:'Europe/Amsterdam'},{startsAt:future(120),endsAt:future(121),timezone:'Europe/Amsterdam'}];
 view=(await proposeViewingSlots(seller,viewing.request.id,{slots:slots2,expectedVersion:4,clientActionId:key('viewing-slots-2')})).request;assert.equal(view.version,5);assert.equal(view.proposalVersion,2);
 const slot2=view.slots.find(x=>x.proposalVersion===2);
 view=(await confirmViewingSlot(buyer,viewing.request.id,{slotId:slot2.id,expectedVersion:5,clientActionId:key('viewing-confirm-2')})).request;assert.equal(view.status,'CONFIRMED');assert.equal(view.version,6);assert.equal(view.calendarEvent.sequence,1);assert.equal(view.calendarEvent.startsAt,slot2.startsAt);
 view=(await cancelViewingRequest(seller,viewing.request.id,{expectedVersion:6,reason:'Object unavailable.',clientActionId:key('viewing-cancel')})).request;assert.equal(view.status,'CANCELLED');assert.equal(view.version,7);assert.equal(view.calendarEvent.status,'CANCELLED');assert.equal(view.calendarEvent.sequence,2);

 const ics=await viewingCalendarIcs(buyer,viewing.request.id);assert.match(ics.ics,/STATUS:CANCELLED/);assert.match(ics.ics,/SEQUENCE:2/);
 await assert.rejects(()=>db.pool.query("UPDATE viewing_slots SET timezone='UTC' WHERE request_id=$1",[viewing.request.id]),e=>e.code==='55000');
 await assert.rejects(()=>db.pool.query("UPDATE viewing_request_events SET metadata='{}'::jsonb WHERE request_id=$1",[viewing.request.id]),e=>e.code==='55000');

 console.log('ANTIQUA v23 PostgreSQL commercial services: concurrent replay + immutable condition versions + viewing slot history + reschedule calendar sequence + stale lock passed');
}finally{
 try{
  await db.pool.query('ALTER TABLE condition_report_versions DISABLE TRIGGER condition_report_versions_immutable_trg').catch(()=>{});
  await db.pool.query('ALTER TABLE condition_report_events DISABLE TRIGGER condition_report_events_immutable_trg').catch(()=>{});
  await db.pool.query('ALTER TABLE viewing_slots DISABLE TRIGGER viewing_slots_immutable_trg').catch(()=>{});
  await db.pool.query('ALTER TABLE viewing_request_events DISABLE TRIGGER viewing_events_immutable_trg').catch(()=>{});
  for(const id of ids.viewing){await db.pool.query('UPDATE viewing_requests SET selected_slot_id=NULL WHERE id=$1',[id]).catch(()=>{});await db.pool.query('DELETE FROM viewing_calendar_events WHERE request_id=$1',[id]).catch(()=>{});await db.pool.query('DELETE FROM viewing_request_events WHERE request_id=$1',[id]).catch(()=>{});await db.pool.query('DELETE FROM viewing_slots WHERE request_id=$1',[id]).catch(()=>{});await db.pool.query('DELETE FROM viewing_requests WHERE id=$1',[id]).catch(()=>{})}
  for(const id of ids.condition){await db.pool.query('DELETE FROM condition_report_events WHERE request_id=$1',[id]).catch(()=>{});await db.pool.query('DELETE FROM condition_report_versions WHERE request_id=$1',[id]).catch(()=>{});await db.pool.query('DELETE FROM condition_report_requests WHERE id=$1',[id]).catch(()=>{})}
  if(ids.media.length)await db.pool.query('DELETE FROM media_assets WHERE id=ANY($1::text[])',[ids.media]).catch(()=>{});
  await db.pool.query('DELETE FROM listings WHERE id=ANY($1::text[])',[ids.listings]).catch(()=>{});
  await db.pool.query('DELETE FROM objects WHERE id=ANY($1::text[])',[ids.objects]).catch(()=>{});
 }finally{
  await db.pool.query('ALTER TABLE condition_report_versions ENABLE TRIGGER condition_report_versions_immutable_trg').catch(()=>{});
  await db.pool.query('ALTER TABLE condition_report_events ENABLE TRIGGER condition_report_events_immutable_trg').catch(()=>{});
  await db.pool.query('ALTER TABLE viewing_slots ENABLE TRIGGER viewing_slots_immutable_trg').catch(()=>{});
  await db.pool.query('ALTER TABLE viewing_request_events ENABLE TRIGGER viewing_events_immutable_trg').catch(()=>{});
  await db.pool.end()
 }
}
