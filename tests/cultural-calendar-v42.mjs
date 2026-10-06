import assert from 'node:assert/strict';
import {createCulturalEvent,submitCulturalEvent,reviewCulturalEvent,updateCulturalEvent,listPublicCalendar,setCalendarParticipation,getMyCulturalCalendar,entriesToIcs,culturalCalendarCapabilities} from '../cultural-calendar-v42.mjs';

const reviewer={id:'calendar-reviewer-memory',displayName:'Calendar Reviewer',roles:['ADMIN','CATALOGUER']};
const visitor={id:'calendar-visitor-memory',displayName:'Calendar Visitor',roles:['BUYER']};
const base=Date.now()+4*864e5,stamp=new Date(base).toISOString();
const make=(suffix,offset=0)=>({slug:'memory-calendar-'+suffix,title:{en:'Calendar '+suffix,ru:'Календарь '+suffix},summary:{en:'Reviewed cultural event',ru:'Проверенное культурное событие'},eventType:'CURATOR_TOUR',venueMode:'PHYSICAL',venueName:{en:'Test Gallery',ru:'Тестовая галерея'},city:{en:'Berlin',ru:'Берлин'},country:{en:'Germany',ru:'Германия'},timezone:'Europe/Berlin',startsAt:new Date(base+offset).toISOString(),endsAt:new Date(base+offset+90*60000).toISOString(),visibility:'PUBLIC',tags:['painting','tour'],objects:[{objectId:'lot-101',role:'FEATURED'}]});

const a=await createCulturalEvent(reviewer,make('a'));assert.equal(a.status,'DRAFT');
await submitCulturalEvent(reviewer,a.id);assert.equal((await listPublicCalendar()).entries.some(x=>x.id===a.id),false,'review-pending event must stay private');
await reviewCulturalEvent(reviewer,a.id,{decision:'APPROVE',note:'memory review'});
const b=await createCulturalEvent(reviewer,make('b',30*60000));await submitCulturalEvent(reviewer,b.id);await reviewCulturalEvent(reviewer,b.id,{decision:'APPROVE'});

let publicCalendar=await listPublicCalendar({city:'Berlin'});assert.ok(publicCalendar.entries.some(x=>x.id===a.id));assert.ok(publicCalendar.entries.some(x=>x.id===b.id));
await setCalendarParticipation(visitor,{entityType:'EVENT',entityId:a.id,state:'PLANNED'});
await setCalendarParticipation(visitor,{entityType:'EVENT',entityId:b.id,state:'PLANNED'});
let mine=await getMyCulturalCalendar(visitor);assert.equal(mine.entries.filter(x=>x.participation?.state==='PLANNED'&&[a.id,b.id].includes(x.id)).length,2);assert.ok(mine.conflicts.some(x=>new Set([x.a.id,x.b.id]).has(a.id)&&new Set([x.a.id,x.b.id]).has(b.id)),'overlapping planned events must be detected');
const ics=entriesToIcs(mine.entries.filter(x=>[a.id,b.id].includes(x.id)));assert.match(ics,/BEGIN:VCALENDAR/);assert.match(ics,/BEGIN:VEVENT/);assert.match(ics,/UID:EVENT-/);

await setCalendarParticipation(visitor,{entityType:'EVENT',entityId:a.id,state:'VISITED'});
mine=await getMyCulturalCalendar(visitor);assert.equal(mine.entries.find(x=>x.id===a.id).participation.state,'VISITED');

const edited=await updateCulturalEvent(reviewer,a.id,{...make('a'),summary:{en:'Changed after publication',ru:'Изменено после публикации'}});assert.equal(edited.status,'DRAFT','substantive edit must invalidate review');publicCalendar=await listPublicCalendar();assert.equal(publicCalendar.entries.some(x=>x.id===a.id),false);
await assert.rejects(()=>createCulturalEvent(reviewer,{...make('bad'),capacity:-5}),e=>e.code==='CALENDAR_CAPACITY_INVALID');
assert.equal(culturalCalendarCapabilities().locationTracking,false);assert.equal(culturalCalendarCapabilities().genericCheckInFeed,false);
console.log('ANTIQUA v42 Cultural Calendar: reviewed publishing + plan/visited state + conflict detection + ICS passed');
