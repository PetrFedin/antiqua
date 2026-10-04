import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {db} from '../runtime-v09.mjs';
import {createArtEvent,submitArtEvent,reviewArtEvent,getPublicArtEvent,listArtCalendar,setCalendarParticipation,updateArtEvent} from '../art-calendar-v42.mjs';

if(!process.env.DATABASE_URL){console.log('ANTIQUA v42 PostgreSQL Art Calendar: skipped (DATABASE_URL not set)');process.exit(0)}
assert.equal(db.kind,'POSTGRES');
const buyer=await db.findAccountByEmail('buyer@demo.antiqua'),operator=await db.findAccountByEmail('operator@demo.antiqua');assert.ok(buyer);assert.ok(operator?.roles?.includes('ADMIN'));
const token=crypto.randomUUID().replaceAll('-','').slice(0,10),startsAt=new Date(Date.now()+48*3600000).toISOString(),endsAt=new Date(Date.now()+51*3600000).toISOString();
let eventId=null;
try{
 let event=await createArtEvent(buyer,{eventType:'LECTURE',title:{en:'Postgres Calendar '+token,ru:'Postgres календарь '+token},summary:{en:'Durable calendar proof',ru:'Проверка долговечного календаря'},visibility:'PUBLIC',attendanceMode:'HYBRID',startsAt,endsAt,timezone:'Europe/Amsterdam',venueName:{en:'Proof Venue',ru:'Тестовая площадка'},city:{en:'Amsterdam',ru:'Амстердам'},country:{en:'Netherlands',ru:'Нидерланды'},latitude:52.3676,longitude:4.9041,onlineUrl:'https://example.com/calendar-proof',metadata:{privateWorkflow:'do-not-publish'}});
 eventId=event.id;assert.equal(event.status,'DRAFT');
 await submitArtEvent(buyer,eventId);assert.equal((await db.pool.query('SELECT status FROM art_events WHERE id=$1',[eventId])).rows[0].status,'REVIEW_PENDING');assert.equal(await getPublicArtEvent(eventId),null);
 await reviewArtEvent(operator,eventId,{decision:'APPROVE',note:'postgres proof'});
 const pub=await getPublicArtEvent(eventId);assert.ok(pub);assert.equal(pub.latitude,52.3676);assert.equal('ownerAccountId' in pub,false);assert.equal('metadata' in pub,false);
 const calendar=await listArtCalendar();assert.ok(calendar.items.some(x=>x.sourceType==='EVENT'&&x.id===eventId));
 const participation=await setCalendarParticipation(buyer,'EVENT',eventId,{state:'PLANNED',plannedFor:startsAt});assert.equal(participation.participation.state,'PLANNED');
 const row=(await db.pool.query('SELECT state,planned_for FROM art_event_participation WHERE account_id=$1 AND event_id=$2',[buyer.id,eventId])).rows[0];assert.equal(row.state,'PLANNED');assert.equal(row.planned_for.toISOString(),startsAt);
 event=await updateArtEvent(buyer,eventId,{title:{en:'Edited '+token,ru:'Изменено '+token}});assert.equal(event.status,'DRAFT');assert.equal(await getPublicArtEvent(eventId),null);
 console.log('ANTIQUA v42 PostgreSQL Art Calendar: durable reviewed event + private participation + public projection passed');
}finally{
 if(eventId){await db.pool.query('DELETE FROM art_event_participation WHERE event_id=$1',[eventId]).catch(()=>{});await db.pool.query('DELETE FROM art_event_creators WHERE event_id=$1',[eventId]).catch(()=>{});await db.pool.query('DELETE FROM art_event_organizations WHERE event_id=$1',[eventId]).catch(()=>{});await db.pool.query('DELETE FROM art_events WHERE id=$1',[eventId]).catch(()=>{})}
 await db.pool.end();
}
