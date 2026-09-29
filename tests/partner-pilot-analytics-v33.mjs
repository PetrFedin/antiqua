import assert from 'node:assert/strict';
import {exhibitionCohortObjectIds,retentionProjection,partnerPilotCapabilities} from '../partner-pilot-analytics-v33.mjs';

const exhibition={sections:[
 {items:[
  {objectId:'lot-direct'},
  {ensemble:{slots:[{objectId:'lot-ensemble-1'},{objectId:'lot-ensemble-2'},{objectId:null}]}}
 ]},
 {items:[{objectId:'lot-direct'}]}
]};
assert.deepEqual(new Set(exhibitionCohortObjectIds(exhibition)),new Set(['lot-direct','lot-ensemble-1','lot-ensemble-2']));

const now=Date.UTC(2026,8,29,12,0,0),day=86400000;
const at=d=>new Date(now-d*day).toISOString();
const events=[
 {accountId:'a',eventType:'DROP_OPEN',occurredAt:at(40)},
 {accountId:'a',eventType:'OBJECT_OPEN',occurredAt:new Date(now-32*day).toISOString()},
 {accountId:'a',eventType:'OFFER_CREATED',occurredAt:new Date(now-9*day).toISOString()},
 {accountId:'b',eventType:'DROP_OPEN',occurredAt:at(20)},
 {accountId:'b',eventType:'INQUIRY_CREATED',occurredAt:new Date(now-2*day).toISOString()},
 {accountId:'c',eventType:'OBJECT_OPEN',occurredAt:at(5)},
 {accountId:null,eventType:'DROP_OPEN',occurredAt:at(60)}
];
const r=retentionProjection(events,now);
assert.equal(r.authenticatedExposed,3);
assert.deepEqual(r.d7,{eligible:3,matured:2,pending:1,returned:1,rate:0.5,startDay:7,endDayExclusive:14});
assert.deepEqual(r.d30,{eligible:3,matured:1,pending:2,returned:1,rate:1,startDay:30,endDayExclusive:37});
assert.equal(r.anonymousRetentionMeasured,false);

const caps=partnerPilotCapabilities();
assert.equal(caps.attribution,'PARTNER_PATH_ONLY');
assert.equal(caps.rawAnonymousIdentifiersStored,false);
assert.equal(caps.crossSignalUniqueAudience,false);
assert.equal(caps.anonymousLongTermRetention,false);
assert.equal(caps.objectWideDemandCreditedToPartner,false);
assert.equal(caps.commercialAuthoritiesUnchanged,true);

console.log('ANTIQUA v33 Partner Pilot Analytics: cohort expansion + matured retention methodology + privacy boundary passed');
