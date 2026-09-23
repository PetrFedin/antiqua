import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {db,now} from '../runtime-v09.mjs';
import {createConditionReportRequest,getConditionReportRequest,publishConditionReportVersion,cancelConditionReportRequest,conditionReportCapabilities} from '../condition-report-v23.mjs';
import {createViewingRequest,getViewingRequest,proposeViewingSlots,confirmViewingSlot,requestViewingReschedule,cancelViewingRequest,viewingCalendarIcs,viewingCapabilities} from '../viewing-v23.mjs';

assert.notEqual(db.kind,'POSTGRES','memory v0.23 proof must use preview store');
const buyer=await db.findAccountByEmail('buyer@demo.antiqua'),seller=await db.findAccountByEmail('seller@demo.antiqua');
assert.ok(buyer?.id&&seller?.sellerId);
const key=p=>p+'-'+crypto.randomUUID(),future=h=>new Date(Date.now()+h*3600000).toISOString();

const ckey=key('condition-create');
let c=await createConditionReportRequest(buyer,'lst-110',{note:'Please document restoration around the bases.',clientActionId:ckey});
assert.equal(c.idempotent,false);assert.equal(c.request.status,'REQUESTED');assert.equal(c.request.version,1);assert.equal(c.request.participantRole,'BUYER');
let replay=await createConditionReportRequest(buyer,'lst-110',{note:'duplicate retry',clientActionId:ckey});
assert.equal(replay.idempotent,true);assert.equal(replay.request.id,c.request.id);
const conditionId=c.request.id;

const media1={id:'media-v23-'+crypto.randomUUID(),entityType:'OBJECT',entityId:'lot-110',storageKey:'proof/condition-1.pdf',contentType:'application/pdf',bytes:100,sha256:'a'.repeat(64),role:'CONDITION',visibility:'PRIVATE',status:'READY',uploadedAt:now(),createdAt:now()};
const media2={...media1,id:'media-v23-'+crypto.randomUUID(),storageKey:'proof/condition-2.pdf',sha256:'b'.repeat(64)};
await db.createMedia(media1);await db.createMedia(media2);

c=await publishConditionReportVersion(seller,conditionId,{mediaId:media1.id,summary:'Surface wear and historic solder repair.',conditionGrade:'B+',restorationNotes:'Historic solder repair on base.',expectedVersion:1,clientActionId:key('condition-publish-1')});
assert.equal(c.request.status,'FULFILLED');assert.equal(c.request.version,2);assert.equal(c.version.versionNo,1);assert.equal(c.request.currentReportVersion,1);
c=await publishConditionReportVersion(seller,conditionId,{mediaId:media2.id,summary:'Updated after secondary inspection.',conditionGrade:'B+',restorationNotes:'Repair mapped in detail image.',expectedVersion:2,clientActionId:key('condition-publish-2')});
assert.equal(c.request.version,3);assert.equal(c.version.versionNo,2);assert.equal(c.request.currentReportVersion,2);
const buyerCondition=await getConditionReportRequest(buyer,conditionId);assert.equal(buyerCondition.versions.length,2);assert.deepEqual(buyerCondition.versions.map(x=>x.versionNo),[1,2]);
await assert.rejects(()=>cancelConditionReportRequest(buyer,conditionId,{expectedVersion:3,clientActionId:key('condition-cancel-late')}),e=>e.code==='CONDITION_CANCEL_INVALID');
await assert.rejects(()=>publishConditionReportVersion(seller,conditionId,{mediaId:'missing',expectedVersion:3,clientActionId:key('condition-bad-media')}),e=>e.code==='CONDITION_MEDIA_NOT_FOUND');

const c2=await createConditionReportRequest(buyer,'lst-109',{note:'Second request for cancellation proof.',clientActionId:key('condition-create-2')});
const cancelled=await cancelConditionReportRequest(buyer,c2.request.id,{expectedVersion:1,clientActionId:key('condition-cancel')});
assert.equal(cancelled.request.status,'CANCELLED');assert.equal(cancelled.request.version,2);

let v=await createViewingRequest(buyer,'lst-110',{note:'Weekday afternoon preferred.',clientActionId:key('view-create')});
assert.equal(v.request.status,'REQUESTED');assert.equal(v.request.version,1);const viewingId=v.request.id;
const slots1=[
 {startsAt:future(24),endsAt:future(25),timezone:'Europe/Amsterdam'},
 {startsAt:future(48),endsAt:future(49),timezone:'Europe/Amsterdam'},
 {startsAt:future(72),endsAt:future(73),timezone:'Europe/Amsterdam'}
];
v=await proposeViewingSlots(seller,viewingId,{slots:slots1,expectedVersion:1,clientActionId:key('view-slots-1')});
assert.equal(v.request.status,'SLOTS_PROPOSED');assert.equal(v.request.version,2);assert.equal(v.request.proposalVersion,1);assert.equal(v.request.slots.filter(x=>x.proposalVersion===1).length,3);
const chosen1=v.request.slots.find(x=>x.proposalVersion===1);
const confirmKey=key('view-confirm-1');
v=await confirmViewingSlot(buyer,viewingId,{slotId:chosen1.id,expectedVersion:2,clientActionId:confirmKey});
assert.equal(v.request.status,'CONFIRMED');assert.equal(v.request.version,3);assert.equal(v.request.calendarEvent.sequence,0);assert.equal(v.request.calendarEvent.status,'CONFIRMED');
replay=await confirmViewingSlot(buyer,viewingId,{slotId:chosen1.id,expectedVersion:2,clientActionId:confirmKey});
assert.equal(replay.idempotent,true);assert.equal(replay.request.calendarEvent.sequence,0);
await assert.rejects(()=>requestViewingReschedule(buyer,viewingId,{expectedVersion:2,reason:'stale',clientActionId:key('view-stale')}),e=>e.code==='SERVICE_VERSION_CONFLICT');

v=await requestViewingReschedule(buyer,viewingId,{expectedVersion:3,reason:'Travel schedule changed.',clientActionId:key('view-reschedule')});
assert.equal(v.request.status,'RESCHEDULE_REQUESTED');assert.equal(v.request.version,4);assert.equal(v.request.calendarEvent.sequence,0);
const slots2=[
 {startsAt:future(96),endsAt:future(97),timezone:'Europe/Amsterdam'},
 {startsAt:future(120),endsAt:future(121),timezone:'Europe/Amsterdam'}
];
v=await proposeViewingSlots(seller,viewingId,{slots:slots2,expectedVersion:4,clientActionId:key('view-slots-2')});
assert.equal(v.request.status,'SLOTS_PROPOSED');assert.equal(v.request.version,5);assert.equal(v.request.proposalVersion,2);
const chosen2=v.request.slots.find(x=>x.proposalVersion===2);
v=await confirmViewingSlot(buyer,viewingId,{slotId:chosen2.id,expectedVersion:5,clientActionId:key('view-confirm-2')});
assert.equal(v.request.status,'CONFIRMED');assert.equal(v.request.version,6);assert.equal(v.request.calendarEvent.sequence,1);assert.equal(v.request.calendarEvent.startsAt,chosen2.startsAt);
v=await cancelViewingRequest(seller,viewingId,{expectedVersion:6,reason:'Object temporarily unavailable.',clientActionId:key('view-cancel')});
assert.equal(v.request.status,'CANCELLED');assert.equal(v.request.version,7);assert.equal(v.request.calendarEvent.status,'CANCELLED');assert.equal(v.request.calendarEvent.sequence,2);
const ics=await viewingCalendarIcs(buyer,viewingId);assert.match(ics.ics,/STATUS:CANCELLED/);assert.match(ics.ics,/SEQUENCE:2/);assert.match(ics.ics,/UID:antiqua-viewing-/);

const cc=conditionReportCapabilities(),vc=viewingCapabilities();
assert.equal(cc.immutableVersions,true);assert.equal(cc.buyerReadAfterPublish,true);assert.equal(vc.calendarProjection,true);assert.equal(vc.immutableHistory,true);assert.equal(vc.ics,true);

console.log('ANTIQUA v23 commercial services: versioned condition reports + viewing slots + confirm/reschedule/cancel + calendar sequence + idempotency passed');
