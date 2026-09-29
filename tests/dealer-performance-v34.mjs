import assert from 'node:assert/strict';
import {buildDealerPerformanceEvidence,dealerPerformanceCapabilities,dealerPerformanceReport} from '../dealer-performance-v34.mjs';
const now=Date.parse('2026-09-30T00:00:00Z'),account={id:'s1',sellerId:'s1'};
const leads=[
 {id:'l1',objectId:'o1',stage:'WON',firstBuyerActivityAt:'2026-09-28T00:00:00Z',firstDealerResponseAt:'2026-09-28T00:30:00Z',responseMinutes:30,responseStatus:'MET'},
 {id:'l2',objectId:'o2',stage:'VIEWING',firstBuyerActivityAt:'2026-09-15T00:00:00Z',firstDealerResponseAt:'2026-09-15T02:00:00Z',responseMinutes:120,responseStatus:'MET',potentialCurrency:'EUR',potentialAmountMinor:250000},
 {id:'l3',objectId:'o3',stage:'LOST',firstBuyerActivityAt:'2026-07-15T00:00:00Z',responseStatus:'OVERDUE'}
];
const interestObjects=[{objectId:'o1',stage:'TRANSACTING'},{objectId:'o2',stage:'VIEWING'},{objectId:'o3',stage:'ENGAGED'}];
const editorialEvents=[{storyId:'story-1',objectId:'o1',occurredAt:'2026-09-20T00:00:00Z'},{storyId:'story-late',objectId:'o1',occurredAt:'2026-09-29T00:00:00Z'}];
const dropExposures=[{exhibitionId:'drop-1',startedAt:'2026-09-01T00:00:00Z',objectIds:['o1','o2']}];
const p=buildDealerPerformanceEvidence({account,leads,interestObjects,editorialEvents,dropExposures,nowMs:now});
assert.equal(p.windows.D7.leadCohort,1);
assert.equal(p.windows.D30.leadCohort,2);
assert.equal(p.windows.D90.leadCohort,3);
assert.equal(p.windows.D7.medianResponseMinutes,30);
assert.equal(p.attribution.rows.find(x=>x.leadId==='l1').evidence.editorial.length,1,'future editorial event must not be attributed');
assert.equal(p.attribution.rows.find(x=>x.leadId==='l1').evidence.partnerDrops.length,1);
assert.equal(p.capabilities.causalAttribution,false);
assert.match(dealerPerformanceReport(p),/does not claim causal attribution/);
assert.equal(dealerPerformanceCapabilities().personLevelAttribution,false);
console.log('ANTIQUA v34 Dealer Performance: D7/D30/D90 + temporal evidence + report boundaries passed');
