import assert from 'node:assert/strict';
import {normalizeDiscoveryDeliveryMode,normalizeDiscoveryDigestHour,nextDiscoveryDigestAt,discoverySubscriptionCapabilities} from '../discovery-matching-v16.mjs';

assert.equal(normalizeDiscoveryDeliveryMode('immediate'),'IMMEDIATE');
assert.equal(normalizeDiscoveryDeliveryMode('DAILY_DIGEST'),'DAILY_DIGEST');
assert.throws(()=>normalizeDiscoveryDeliveryMode('hourly'),e=>e.code==='DISCOVERY_DELIVERY_MODE_INVALID');
assert.equal(normalizeDiscoveryDigestHour(0),0);
assert.equal(normalizeDiscoveryDigestHour('23'),23);
assert.throws(()=>normalizeDiscoveryDigestHour(24),e=>e.code==='DISCOVERY_DIGEST_HOUR_INVALID');

assert.equal(nextDiscoveryDigestAt(Date.parse('2026-09-26T07:30:00.000Z'),8),'2026-09-26T08:00:00.000Z');
assert.equal(nextDiscoveryDigestAt(Date.parse('2026-09-26T08:00:00.000Z'),8),'2026-09-27T08:00:00.000Z');
assert.equal(nextDiscoveryDigestAt(Date.parse('2026-09-26T22:30:00.000Z'),6),'2026-09-27T06:00:00.000Z');

const cap=discoverySubscriptionCapabilities();
assert.equal(cap.contractVersion,'v26');
assert.deepEqual(cap.deliveryModes,['IMMEDIATE','DAILY_DIGEST']);
assert.equal(cap.duplicatePolicy,'RETURN_EXISTING_ACTIVE_OR_PAUSED');
assert.equal(cap.unsubscribeStatus,'ARCHIVED');
assert.equal(cap.deterministicMatching,true);
assert.equal(cap.exactlyOnceOutbox,true);

console.log('ANTIQUA v26 saved-search alerts: delivery normalization + UTC digest schedule + lifecycle contract passed');
