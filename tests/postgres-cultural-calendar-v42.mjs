import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {db} from '../runtime-v09.mjs';
import {listOrganizationsForAccount} from '../organizations-v15.mjs';
import {createCulturalEvent,submitCulturalEvent,reviewCulturalEvent,setCalendarParticipation,getMyCulturalCalendar,listPublicCalendar,createCalendarExhibition,submitCalendarExhibition,reviewCalendarExhibition} from '../cultural-calendar-v42.mjs';

if(!process.env.DATABASE_URL){console.log('ANTIQUA v42 PostgreSQL Cultural Calendar: skipped (DATABASE_URL not set)');process.exit(0)}
assert.equal(db.kind,'POSTGRES');
const buyer=await db.findAccountByEmail('buyer@demo.antiqua'),seller=await db.findAccountByEmail('seller@demo.antiqua'),operator=await db.findAccountByEmail('operator@demo.antiqua');assert.ok(buyer);assert.ok(seller);assert.ok(operator);
const org=(await listOrganizationsForAccount(seller))[0]?.organization;assert.ok(org?.id);
const token=crypto.randomUUID().replaceAll('-','').slice(0,10),base=Date.now()+5*864e5,eventIds=[],exhibitionIds=[];
const eventInput=(suffix,offset=0)=>({slug:'pg-calendar-'+suffix+'-'+token,title:{en:'PG Calendar '+suffix+' '+token,ru:'PG календарь '+suffix+' '+token},summary:{en:'Durable event',ru:'Долговечное событие'},eventType:'ARTIST_TALK',organizationId:org.id,venueMode:'PHYSICAL',venueName:{en:'Gallery',ru:'Галерея'},city:{en:'Paris',ru:'Париж'},country:{en:'France',ru:'Франция'},timezone:'Europe/Paris',startsAt:new Date(base+offset).toISOString(),endsAt:new Date(base+offset+2*3600e3).toISOString(),visibility:'PUBLIC',publicSourceUrl:'https://example.com/event/'+token});
try{
 const a=await createCulturalEvent(seller,eventInput('a'));eventIds.push(a.id);await submitCulturalEvent(seller,a.id);await reviewCulturalEvent(operator,a.id,{decision:'APPROVE',note:'pg review'});
 const b=await createCulturalEvent(seller,eventInput('b',45*60000));eventIds.push(b.id);await submitCulturalEvent(seller,b.id);await reviewCulturalEvent(operator,b.id,{decision:'APPROVE'});
 const row=(await db.pool.query('SELECT status,organization_id,timezone FROM cultural_events WHERE id=$1',[a.id])).rows[0];assert.deepEqual(row,{status:'PUBLISHED',organization_id:org.id,timezone:'Europe/Paris'});
 await setCalendarParticipation(buyer,{entityType:'EVENT',entityId:a.id,state:'PLANNED'});await setCalendarParticipation(buyer,{entityType:'EVENT',entityId:b.id,state:'PLANNED'});
 const mine=await getMyCulturalCalendar(buyer);assert.ok(mine.conflicts.some(x=>[x.a.id,x.b.id].includes(a.id)&&[x.a.id,x.b.id].includes(b.id)));

 const ex=await createCalendarExhibition(seller,{title:{en:'PG Exhibition '+token,ru:'PG выставка '+token},subtitle:{en:'Calendar authority',ru:'Календарная модель'},curatorialStatement:{en:'Canonical exhibition extended for scheduling.',ru:'Каноническая выставка расширена календарными полями.'},organizationId:org.id,timezone:'Europe/Paris',startsAt:new Date(base-864e5).toISOString(),endsAt:new Date(base+10*864e5).toISOString(),visibility:'PUBLIC',publicSourceUrl:'https://example.com/exhibition/'+token});exhibitionIds.push(ex.id);await submitCalendarExhibition(seller,ex.id);const published=await reviewCalendarExhibition(operator,ex.id,{decision:'APPROVE',note:'pg exhibition review'});assert.equal(published.publicationStatus,'PUBLISHED');
 const calendar=await listPublicCalendar({organizationId:org.id});assert.ok(calendar.entries.some(x=>x.id===a.id&&x.entryType==='EVENT'));assert.ok(calendar.entries.some(x=>x.id===ex.id&&x.entryType==='EXHIBITION'));
 await assert.rejects(()=>db.pool.query("INSERT INTO cultural_calendar_participation(account_id,entity_type,entity_id,state) VALUES($1,'EVENT',$2,'SAVED')",[buyer.id,'missing-'+token]),e=>e.code==='23503');
 console.log('ANTIQUA v42 PostgreSQL Cultural Calendar: durable event/exhibition authority + participation FK guard + conflict detection passed');
}finally{
 await db.pool.query('DELETE FROM cultural_calendar_participation WHERE account_id=$1',[buyer.id]).catch(()=>{});
 for(const id of eventIds)await db.pool.query('DELETE FROM cultural_events WHERE id=$1',[id]).catch(()=>{});
 for(const id of exhibitionIds)await db.pool.query('DELETE FROM exhibitions WHERE id=$1',[id]).catch(()=>{});
 await db.pool.end();
}
