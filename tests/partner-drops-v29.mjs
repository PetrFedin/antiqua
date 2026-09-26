import assert from 'node:assert/strict';
import {getPartnerDrop,setExhibitionFollow,dropStage,partnerDropCapabilities} from '../partner-drops-v29.mjs';

const account={id:'taste-partner-drop-memory',roles:['BUYER']};
const first=await getPartnerDrop(account,'ex-objects-in-dialogue');assert.ok(first);
assert.equal(first.drop.stage,'LIVE');assert.equal(first.drop.format,'CURATED_DROP');assert.equal(first.drop.partner?.name,'Antiqua Editorial');
assert.equal(partnerDropCapabilities().fakeScarcityAllowed,false);assert.equal(partnerDropCapabilities().archivePersists,true);
assert.equal(dropStage({status:'SCHEDULED'}),'PREVIEW');assert.equal(dropStage({status:'ARCHIVED'}),'ARCHIVED');
let follow=await setExhibitionFollow(account,'ex-objects-in-dialogue',true);assert.equal(follow.enabled,true);assert.equal(follow.follow.following,true);
follow=await setExhibitionFollow(account,'ex-objects-in-dialogue',true);assert.equal(follow.follow.count,1,'repeated follow must not duplicate audience');
const projected=await getPartnerDrop(account,'ex-objects-in-dialogue');assert.equal(projected.drop.follow.following,true);
follow=await setExhibitionFollow(account,'ex-objects-in-dialogue',false);assert.equal(follow.enabled,false);assert.equal(follow.follow.following,false);
console.log('ANTIQUA v29 Partner Drops: stage projection + explicit follow authority + no fake scarcity passed');
