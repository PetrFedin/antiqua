import assert from 'node:assert/strict';
import {buildPilotCommercialProof,pilotControlCapabilities,pilotCommercialReport,verifyPilotSnapshot} from '../pilot-control-v35.mjs';

process.env.APP_SECRET='01234567890123456789012345678901';
const account={id:'seller-1',sellerId:'seller-1'},now=Date.parse('2026-09-30T00:00:00Z');
const leads=[
 {id:'b1',objectId:'o0',stage:'LOST',firstBuyerActivityAt:'2026-08-20T00:00:00Z',firstDealerResponseAt:'2026-08-20T04:00:00Z',responseMinutes:240,responseStatus:'MET'},
 {id:'b2',objectId:'o1',stage:'VIEWING',firstBuyerActivityAt:'2026-08-25T00:00:00Z',firstDealerResponseAt:'2026-08-25T03:00:00Z',responseMinutes:180,responseStatus:'MET'},
 {id:'p1',objectId:'o2',stage:'WON',firstBuyerActivityAt:'2026-09-10T00:00:00Z',firstDealerResponseAt:'2026-09-10T00:30:00Z',responseMinutes:30,responseStatus:'MET'},
 {id:'p2',objectId:'o3',stage:'NEGOTIATING',firstBuyerActivityAt:'2026-09-20T00:00:00Z',firstDealerResponseAt:'2026-09-20T01:00:00Z',responseMinutes:60,responseStatus:'MET'}
];
const performance={objectOutcomes:[
 {objectId:'o2',stage:'TRANSACTING',commercialIntent:true,transacting:true},
 {objectId:'o3',stage:'NEGOTIATING',commercialIntent:true,transacting:false}
],attribution:{model:'TEMPORAL_OBJECT_LEVEL_EVIDENCE',rows:[{objectId:'o2'},{objectId:'o3'}]}};
const p=buildPilotCommercialProof({account,leads,performance,pilotStartAt:'2026-09-01T00:00:00Z',nowMs:now});
assert.equal(p.comparison.pilotStartExplicit,true);
assert.equal(p.comparison.baseline.leads,2);
assert.equal(p.comparison.pilot.leads,2);
assert.equal(p.comparison.uplift.medianResponseMinutesDelta,-165);
assert.equal(p.inventory.transacting,1);
assert.equal(p.inventory.withPriorExposureEvidence,2);
assert.equal(p.dealerOutcomeLedger.length,4);
assert.equal(verifyPilotSnapshot(p),true);
const tampered=structuredClone(p);tampered.comparison.pilot.won=99;assert.equal(verifyPilotSnapshot(tampered),false);
assert.match(pilotCommercialReport(p),/SHA-256 digest/);
assert.equal(pilotControlCapabilities().causalClaims,false);
const inferred=buildPilotCommercialProof({account,leads,performance,nowMs:now});
assert.equal(inferred.comparison.pilotStartExplicit,false);
console.log('ANTIQUA v35 Pilot Control: baseline + rolling uplift + ledger + signed snapshot passed');
