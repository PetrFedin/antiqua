import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {db} from '../runtime-v09.mjs';
import {listOrganizationsForAccount} from '../organizations-v15.mjs';
import {createCulturalEvent,submitCulturalEvent,reviewCulturalEvent,setCalendarParticipation} from '../cultural-calendar-v42.mjs';
import {createProgramme,upsertProgrammeEntry,submitProgramme,reviewProgramme,getPublicProgramme,getMyProgramme,upsertProgrammeDayPlanItem} from '../art-week-programme-v43.mjs';

if(!process.env.DATABASE_URL){console.log('ANTIQUA v43 PostgreSQL Art Week Programme: skipped (DATABASE_URL not set)');process.exit(0)}
assert.equal(db.kind,'POSTGRES');
const buyer=await db.findAccountByEmail('buyer@demo.antiqua'),seller=await db.findAccountByEmail('seller@demo.antiqua'),operator=await db.findAccountByEmail('operator@demo.antiqua');assert.ok(buyer);assert.ok(seller);assert.ok(operator);
const org=(await listOrganizationsForAccount(seller))[0]?.organization;assert.ok(org?.id);
const token=crypto.randomUUID().replaceAll('-','').slice(0,10),base=Date.now()+8*864e5,eventIds=[],programmeIds=[];
const input=(suffix,offset=0)=>({slug:'pg-programme-event-'+suffix+'-'+token,title:{en:'PG Programme Event '+suffix+' '+token,ru:'PG событие программы '+suffix+' '+token},summary:{en:'Durable programme event',ru:'Долговечное событие программы'},eventType:'ARTIST_TALK',organizationId:org.id,venueMode:'PHYSICAL',venueName:{en:'Programme Gallery',ru:'Галерея программы'},city:{en:'Paris',ru:'Париж'},country:{en:'France',ru:'Франция'},timezone:'Europe/Paris',startsAt:new Date(base+offset).toISOString(),endsAt:new Date(base+offset+2*3600e3).toISOString(),visibility:'PUBLIC'});
try{
 const a=await createCulturalEvent(seller,input('a'));eventIds.push(a.id);await submitCulturalEvent(seller,a.id);await reviewCulturalEvent(operator,a.id,{decision:'APPROVE'});
 const draft=await createCulturalEvent(seller,input('draft',3*3600e3));eventIds.push(draft.id);
 let p=await createProgramme(seller,{slug:'pg-art-week-'+token,programmeType:'ART_WEEK',title:{en:'PG Art Week '+token,ru:'PG арт-неделя '+token},summary:{en:'Durable programme',ru:'Долговечная программа'},organizerOrganizationId:org.id,city:{en:'Paris',ru:'Париж'},country:{en:'France',ru:'Франция'},timezone:'Europe/Paris',startsAt:new Date(base-864e5).toISOString(),endsAt:new Date(base+4*864e5).toISOString(),visibility:'PUBLIC',officialSourceUrl:'https://example.com/programme/'+token});programmeIds.push(p.id);
 p=await upsertProgrammeEntry(seller,p.id,{entityType:'EVENT',entityId:a.id,neighbourhood:{en:'Marais',ru:'Маре'},featured:true,sortOrder:10});
 p=await upsertProgrammeEntry(seller,p.id,{entityType:'EVENT',entityId:draft.id,neighbourhood:{en:'Marais',ru:'Маре'},sortOrder:20});
 await submitProgramme(seller,p.id);await reviewProgramme(operator,p.id,{decision:'APPROVE',note:'programme pg review'});
 let pub=await getPublicProgramme(p.id);assert.ok(pub);assert.equal(pub.entries.length,1,'draft event must not leak through published programme');assert.equal(pub.entries[0].entityId,a.id);
 const row=(await db.pool.query('SELECT status,organizer_organization_id,timezone FROM cultural_programmes WHERE id=$1',[p.id])).rows[0];assert.deepEqual(row,{status:'PUBLISHED',organizer_organization_id:org.id,timezone:'Europe/Paris'});

 await setCalendarParticipation(buyer,{entityType:'EVENT',entityId:a.id,state:'PLANNED'});await upsertProgrammeDayPlanItem(buyer,p.id,{entityType:'EVENT',entityId:a.id,sortOrder:10,privateNote:'Start here'});
 let mine=await getMyProgramme(buyer,p.id);assert.equal(mine.myDay.length,1);assert.equal(mine.myDay[0].dayPlan.privateNote,'Start here');
 await assert.rejects(()=>db.pool.query('INSERT INTO cultural_programme_day_plan_items(account_id,programme_id,entity_type,entity_id,local_date,sort_order) VALUES($1,$2,\'EVENT\',$3,$4,0)',[buyer.id,p.id,draft.id,new Date(base).toISOString().slice(0,10)]),e=>e.code==='23514');
 await assert.rejects(()=>db.pool.query('INSERT INTO cultural_programme_entries(programme_id,entity_type,entity_id,sort_order) VALUES($1,\'EVENT\',$2,99)',[p.id,'missing-'+token]),e=>e.code==='23503');

 p=await upsertProgrammeEntry(seller,p.id,{entityType:'EVENT',entityId:a.id,neighbourhood:{en:'Saint-Germain',ru:'Сен-Жермен'},sortOrder:10});assert.equal(p.status,'DRAFT');assert.equal(await getPublicProgramme(p.id),null,'programme composition edit must invalidate review');
 await submitProgramme(seller,p.id);await reviewProgramme(operator,p.id,{decision:'APPROVE'});pub=await getPublicProgramme(p.id);assert.equal(pub.entries[0].neighbourhood.en,'Saint-Germain');
 console.log('ANTIQUA v43 PostgreSQL Art Week Programme: durable review + public-target filtering + PLANNED day-plan guard passed');
}finally{
 await db.pool.query('DELETE FROM cultural_calendar_participation WHERE account_id=$1',[buyer.id]).catch(()=>{});
 for(const id of programmeIds)await db.pool.query('DELETE FROM cultural_programmes WHERE id=$1',[id]).catch(()=>{});
 for(const id of eventIds)await db.pool.query('DELETE FROM cultural_events WHERE id=$1',[id]).catch(()=>{});
 await db.pool.end();
}
