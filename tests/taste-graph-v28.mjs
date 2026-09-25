import assert from 'node:assert/strict';
import {db} from '../runtime-v09.mjs';
import {setObjectFlag} from '../preferences-v14.mjs';
import {createSubscription} from '../domain-e2e-v14.mjs';
import {recordTasteSignal,buildTasteProfile,tasteRecommendations,tasteGraphCapabilities,SIGNAL_WEIGHTS} from '../taste-graph-v28.mjs';

const account={id:'taste-v28-memory',sellerId:null,roles:['BUYER']};
await setObjectFlag(db,account.id,'lot-101','SAVED',true);
await createSubscription(account,{subscriptionType:'FOLLOW_CATEGORY',label:'Sculpture',category:'Sculpture'});

await assert.rejects(()=>recordTasteSignal(account,{signalType:'ENGAGED_VIEW',objectId:'lot-102',sourceKey:'too-shallow',metadata:{depth:.2,dwellSeconds:20}}),e=>e?.code==='ENGAGEMENT_THRESHOLD_NOT_MET');
const first=await recordTasteSignal(account,{signalType:'ENGAGED_VIEW',objectId:'lot-102',sourceKey:'engaged-lot-102',metadata:{depth:.6,dwellSeconds:12}});assert.equal(first.idempotent,false);
const replay=await recordTasteSignal(account,{signalType:'ENGAGED_VIEW',objectId:'lot-102',sourceKey:'engaged-lot-102',metadata:{depth:.6,dwellSeconds:12}});assert.equal(replay.idempotent,true);
await recordTasteSignal(account,{signalType:'DISMISSED',objectId:'lot-103',sourceKey:'dismiss-lot-103',metadata:{reason:'NOT_FOR_ME'}});

const built=await buildTasteProfile(account);
assert.equal(built.profile.signalCounts.SAVED,1);
assert.equal(built.profile.signalCounts.FOLLOW_CATEGORY,1);
assert.equal(built.profile.signalCounts.ENGAGED_VIEW,1);
assert.equal(built.profile.signalCounts.DISMISSED,1);
assert.ok(built.profile.dimensions.department.some(x=>x.key==='sculpture'&&x.points>=SIGNAL_WEIGHTS.FOLLOW_CATEGORY+SIGNAL_WEIGHTS.DISMISSED));

const recs=await tasteRecommendations(account,{limit:8});
assert.equal(recs.recommendations.some(x=>x.object.id==='lot-101'),false,'saved object must not be rediscovered as a new recommendation');
assert.equal(recs.recommendations.some(x=>x.object.id==='lot-103'),false,'latest dismiss must exclude the object');
const sculpture=recs.recommendations.find(x=>x.object.id==='lot-112');assert.ok(sculpture,'category follow should surface another sculpture');
assert.ok(sculpture.reasons.some(x=>x.dimension==='department'&&x.signals.some(s=>s.type==='FOLLOW_CATEGORY')));
assert.equal(recs.capabilities.aiUsed,false);assert.equal(recs.capabilities.priceUsedForMatching,false);assert.equal(recs.capabilities.explainable,true);
assert.equal(tasteGraphCapabilities().engagedViewThreshold.minimumDepth,.35);
console.log('ANTIQUA v28 Taste Graph: explicit signals + dedupe + negative feedback + explainable recommendation passed');
