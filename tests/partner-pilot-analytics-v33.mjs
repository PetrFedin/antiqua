import assert from 'node:assert/strict';
import {buildPartnerPilotAnalytics,partnerPilotCapabilities} from '../partner-pilot-analytics-v33.mjs';

const account={id:'seller-1',sellerId:'seller-1'};
const interest={objects:[
 {objectId:'a',stage:'DISCOVERED'},
 {objectId:'b',stage:'ENGAGED'},
 {objectId:'c',stage:'INQUIRY'},
 {objectId:'d',stage:'VIEWING'},
 {objectId:'e',stage:'NEGOTIATING'},
 {objectId:'f',stage:'TRANSACTING'}
]};
const dealerLeads={summary:{overdue:1,awaitingDealer:2,medianResponseMinutes:42,potentialByCurrency:{EUR:300000,USD:100000}},leads:[
 {id:'1',objectId:'c',stage:'UNANSWERED',responseStatus:'OVERDUE',nextAction:{code:'REPLY_TO_BUYER'},potentialAmountMinor:100000,potentialCurrency:'EUR'},
 {id:'2',objectId:'d',stage:'VIEWING',firstDealerResponseAt:'2026-09-29T10:00:00Z',responseStatus:'MET',nextAction:{code:'PREPARE_VIEWING'},potentialAmountMinor:200000,potentialCurrency:'EUR'},
 {id:'3',objectId:'e',stage:'WON',firstDealerResponseAt:'2026-09-29T11:00:00Z',responseStatus:'MET',nextAction:{code:'PROCEED_TRANSACTION'},potentialAmountMinor:100000,potentialCurrency:'USD'},
 {id:'4',objectId:'x',stage:'LOST',firstDealerResponseAt:'2026-09-29T12:00:00Z',responseStatus:'MET',nextAction:{code:'NONE'}}
]};
const p=buildPartnerPilotAnalytics({account,interest,dealerLeads});
assert.equal(p.objectProgression.atLeast.DISCOVERED,6);
assert.equal(p.objectProgression.atLeast.TRANSACTING,1);
assert.equal(p.objectProgression.rates.engagedFromDiscovered,0.8333);
assert.equal(p.leadOperations.responseCoverage,0.75);
assert.equal(p.leadOperations.closedOutcomeRate,0.5);
assert.deepEqual(p.leadOperations.pipelineByCurrency,{EUR:300000,USD:100000});
assert.equal(p.privacy.personLevelFunnel,false);
assert.equal(partnerPilotCapabilities().snapshotOnly,true);
console.log('ANTIQUA v33 Partner Pilot Analytics: snapshot funnel + SLA + pipeline boundaries passed');
