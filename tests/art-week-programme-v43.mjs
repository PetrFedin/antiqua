import assert from 'node:assert/strict';
import {createCulturalEvent,submitCulturalEvent,reviewCulturalEvent,setCalendarParticipation} from '../cultural-calendar-v42.mjs';
import {createProgramme,upsertProgrammeEntry,submitProgramme,reviewProgramme,getPublicProgramme,getMyProgramme,upsertProgrammeDayPlanItem,myProgrammeIcs,programmeCapabilities} from '../art-week-programme-v43.mjs';

const operator={id:'programme-operator-memory',displayName:'Programme Operator',roles:['ADMIN','CATALOGUER']};
const buyer={id:'programme-buyer-memory',displayName:'Programme Buyer',roles:['BUYER']};
const base=Date.now()+6*864e5,token=Date.now().toString();
async function event(suffix,offset){
 const e=await createCulturalEvent(operator,{slug:'programme-memory-event-'+suffix+'-'+token,title:{en:'Programme Event '+suffix,ru:'Событие программы '+suffix},summary:{en:'Reviewed programme event',ru:'Проверенное событие программы'},eventType:'ARTIST_TALK',venueMode:'PHYSICAL',venueName:{en:'Memory Gallery',ru:'Галерея Memory'},city:{en:'Amsterdam',ru:'Амстердам'},country:{en:'Netherlands',ru:'Нидерланды'},timezone:'Europe/Amsterdam',startsAt:new Date(base+offset).toISOString(),endsAt:new Date(base+offset+90*60000).toISOString(),visibility:'PUBLIC'});
 await submitCulturalEvent(operator,e.id);await reviewCulturalEvent(operator,e.id,{decision:'APPROVE'});return e
}
const a=await event('a',0),b=await event('b',30*60000);
let p=await createProgramme(operator,{slug:'programme-memory-'+token,programmeType:'ART_WEEK',title:{en:'Memory Art Week '+token,ru:'Memory арт-неделя '+token},summary:{en:'Reviewed multi-day grouping',ru:'Проверенная многодневная программа'},city:{en:'Amsterdam',ru:'Амстердам'},country:{en:'Netherlands',ru:'Нидерланды'},timezone:'Europe/Amsterdam',startsAt:new Date(base-864e5).toISOString(),endsAt:new Date(base+3*864e5).toISOString(),visibility:'PUBLIC'});
p=await upsertProgrammeEntry(operator,p.id,{entityType:'EVENT',entityId:a.id,neighbourhood:{en:'Jordaan',ru:'Йордан'},dayLabel:{en:'Day 1',ru:'День 1'},featured:true,sortOrder:20});
p=await upsertProgrammeEntry(operator,p.id,{entityType:'EVENT',entityId:b.id,neighbourhood:{en:'Jordaan',ru:'Йордан'},dayLabel:{en:'Day 1',ru:'День 1'},sortOrder:10});
await submitProgramme(operator,p.id);await reviewProgramme(operator,p.id,{decision:'APPROVE'});
let pub=await getPublicProgramme(p.id);assert.ok(pub);assert.equal(pub.entries.length,2);assert.equal(pub.entries[0].target.entryType,'EVENT');assert.equal(pub.days.length,1);

await setCalendarParticipation(buyer,{entityType:'EVENT',entityId:a.id,state:'PLANNED'});
await setCalendarParticipation(buyer,{entityType:'EVENT',entityId:b.id,state:'PLANNED'});
await upsertProgrammeDayPlanItem(buyer,p.id,{entityType:'EVENT',entityId:a.id,sortOrder:20});
await upsertProgrammeDayPlanItem(buyer,p.id,{entityType:'EVENT',entityId:b.id,sortOrder:10});
let mine=await getMyProgramme(buyer,p.id);assert.equal(mine.myDay.length,2);assert.equal(mine.myDay[0].entityId,b.id,'explicit My Day order must win');assert.ok(mine.conflicts.length>=1,'v43 must reuse v42 conflict detection');
const ics=await myProgrammeIcs(buyer,p.id);assert.match(ics,/BEGIN:VCALENDAR/);assert.match(ics,/Programme Event/);

p=await upsertProgrammeEntry(operator,p.id,{entityType:'EVENT',entityId:a.id,neighbourhood:{en:'Museum Quarter',ru:'Музейный квартал'},sortOrder:20});assert.equal(p.status,'DRAFT','programme composition edit must invalidate review');assert.equal(await getPublicProgramme(p.id),null);
await submitProgramme(operator,p.id);await reviewProgramme(operator,p.id,{decision:'APPROVE'});pub=await getPublicProgramme(p.id);assert.equal(pub.entries.find(x=>x.entityId===a.id).neighbourhood.en,'Museum Quarter');

const caps=programmeCapabilities();assert.equal(caps.reusesCalendarParticipation,true);assert.equal(caps.backgroundLocation,false);assert.equal(caps.travelTimeProvider,false);assert.equal(caps.opaqueAiRanking,false);
console.log('ANTIQUA v43 Art Week Programme: reviewed grouping + PLANNED reuse + My Day order + conflicts + ICS passed');
