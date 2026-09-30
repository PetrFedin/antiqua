import assert from 'node:assert/strict';
import {dealerPilotAuthorityCapabilities} from '../dealer-pilot-authority-v37.mjs';
const c=dealerPilotAuthorityCapabilities();
assert.equal(c.contractVersion,'v37');assert.equal(c.durableWhenPostgres,true);assert.equal(c.signedEvents,true);assert.equal(c.weeklyCheckpoints,true);assert.equal(c.dealerAcknowledgement,true);assert.equal(c.finalEvidencePack,true);assert.deepEqual(c.states,['DRAFT','ACTIVE','COMPLETED','CANCELLED']);assert.ok(c.immutableAfterFreeze.includes('baseline'));assert.ok(c.immutableAfterFreeze.includes('inventoryScope'));assert.ok(c.immutableAfterFreeze.includes('kpiContract'));
console.log('ANTIQUA v37 Real Dealer Pilot Authority contract passed');
