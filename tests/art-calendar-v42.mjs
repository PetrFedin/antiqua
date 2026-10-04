import assert from 'node:assert/strict';
import {createArtEvent,updateArtEvent,submitArtEvent,reviewArtEvent,listPublicArtEvents,getPublicArtEvent,listArtCalendar,setCalendarParticipation,getMyArtCalendar,calendarItemToIcs,artCalendarCapabilities} from '../art-calendar-v42.mjs';

const buyer={id:'calendar-memory-buyer',displayName:'Calendar Buyer',roles:['BUYER']};
const reviewer={id:'calendar-memory-reviewer',displayName:'Calendar Reviewer',roles:['ADMIN','CATALOGUER']};
const startsAt=new Date(Date.now()+36*3600000).toISOString(),endsAt=new Date(Date.now()+39*3600000).toISOString();

let event=await createArtEvent(buyer,{eventType:'ARTIST_TALK',title:{en:'Memory Art Talk',ru:'Тестовый разговор об искусстве'},summary:{en:'A reviewed calendar event.',ru:'Проверяемое событие календаря.'},visibility:'PUBLIC',attendanceMode:'IN_PERSON',startsAt,endsAt,timezone:'Europe/Amsterdam',city:{en:'Amsterdam',ru:'Амстердам'},country:{en:'Netherlands',ru:'Нидерланды'},metadata:{internalNote:'must stay private'}});
assert.equal(event.status,'DRAFT');
await submitArtEvent(buyer,event.id);
assert.equal((await listPublicArtEvents()).some(x=>x.id===event.id),false,'review pending event must not be public');
event=await reviewArtEvent(reviewer,event.id,{decision:'APPROVE',note:'memory proof'});
assert.equal(event.status,'PUBLISHED');

const pub=await getPublicArtEvent(event.id);
assert.ok(pub);assert.equal('ownerAccountId' in pub,false);assert.equal('reviewedByAccountId' in pub,false);assert.equal('metadata' in pub,false,'arbitrary internal metadata must not leak publicly');
const calendar=await listArtCalendar();assert.ok(calendar.items.some(x=>x.sourceType==='EVENT'&&x.id===event.id));const exhibition=calendar.items.find(x=>x.sourceType==='EXHIBITION');assert.ok(exhibition,'canonical exhibitions must appear through the unified read model');

let p=await setCalendarParticipation(buyer,'EVENT',event.id,{state:'PLANNED'});assert.equal(p.participation.state,'PLANNED');
p=await setCalendarParticipation(buyer,'EXHIBITION',exhibition.id,{state:'SAVED'});assert.equal(p.participation.state,'SAVED');
const mine=await getMyArtCalendar(buyer);assert.ok(mine.items.some(x=>x.id===event.id&&x.participation.state==='PLANNED'));assert.ok(mine.items.some(x=>x.id===exhibition.id&&x.participation.state==='SAVED'));
const ics=calendarItemToIcs(calendar.items.find(x=>x.id===event.id),'https://antiqua.example');assert.match(ics,/BEGIN:VEVENT/);assert.match(ics,/DTSTART:/);assert.doesNotMatch(ics,/calendar-memory-buyer/);

event=await updateArtEvent(buyer,event.id,{summary:{en:'Edited after publication',ru:'Изменено после публикации'}});assert.equal(event.status,'DRAFT','substantive edit must invalidate publication review');assert.equal(await getPublicArtEvent(event.id),null);
assert.equal(artCalendarCapabilities().calendarModel,'UNIFIED_READ_MODEL_NO_EXHIBITION_DUPLICATION');assert.equal(artCalendarCapabilities().participationPrivacy,'ACCOUNT_PRIVATE');
console.log('ANTIQUA v42 Art Calendar: review gate + exhibition reuse + private plan + ICS + privacy passed');
