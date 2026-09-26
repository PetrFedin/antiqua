import assert from 'node:assert/strict';
import {db} from '../runtime-v09.mjs';
import {createDrop,updateDrop,upsertDropItem,transitionDrop,setDropFollow,listDropFollows,getPublicDrop,getDropForOperator,dropsCapabilities} from '../drops-v29.mjs';

assert.equal(db.kind,'MEMORY_FALLBACK');
const operator={id:'acct-drop-unit-operator',roles:['ADMIN']},buyer={id:'acct-drop-unit-buyer',roles:['BUYER']};
const created=await createDrop(operator,{slug:'v29-memory-release',titleEn:'The Cabinet Edit',titleRu:'Кабинетный выпуск',curatorLabelEn:'ANTIQUA Test Curator',clientActionId:'drop-create-memory'});
assert.equal(created.drop.status,'DRAFT');assert.equal(created.drop.version,1);
await assert.rejects(()=>transitionDrop(operator,created.drop.id,'SCHEDULED',{expectedVersion:1,previewAt:new Date(Date.now()-120000).toISOString(),releaseAt:new Date(Date.now()-60000).toISOString(),clientActionId:'drop-empty-schedule'}),e=>e?.code==='DROP_EMPTY');

let x=await upsertDropItem(operator,created.drop.id,{objectId:'lot-110',sortOrder:1,releaseLimit:1,expectedVersion:1,clientActionId:'drop-item-memory'});assert.equal(x.drop.version,2);
x=await updateDrop(operator,created.drop.id,{coverObjectId:'lot-110',expectedVersion:2,clientActionId:'drop-cover-memory'});assert.equal(x.drop.coverObjectId,'lot-110');assert.equal(x.drop.version,3);
const previewAt=new Date(Date.now()-120000).toISOString(),releaseAt=new Date(Date.now()-60000).toISOString(),archiveAt=new Date(Date.now()+86400000).toISOString();
x=await transitionDrop(operator,created.drop.id,'SCHEDULED',{expectedVersion:3,previewAt,releaseAt,archiveAt,clientActionId:'drop-schedule-memory'});assert.equal(x.drop.status,'SCHEDULED');assert.equal(x.drop.version,4);
x=await transitionDrop(operator,created.drop.id,'PREVIEW',{expectedVersion:4,clientActionId:'drop-preview-memory'});assert.equal(x.drop.status,'PREVIEW');assert.equal(x.drop.version,5);
await setDropFollow(buyer,created.drop.id,true);assert.equal((await listDropFollows(buyer)).some(f=>f.dropId===created.drop.id),true);
x=await transitionDrop(operator,created.drop.id,'LIVE',{expectedVersion:5,clientActionId:'drop-live-memory'});assert.equal(x.drop.status,'LIVE');assert.deepEqual(x.notifications,{followers:1,queued:1});
const replay=await transitionDrop(operator,created.drop.id,'LIVE',{expectedVersion:5,clientActionId:'drop-live-memory'});assert.equal(replay.idempotent,true);
const publicDrop=await getPublicDrop(created.drop.id,buyer);assert.ok(publicDrop);assert.equal(publicDrop.followed,true);assert.equal(publicDrop.items.length,1);assert.equal(publicDrop.items[0].releaseLimit,1);assert.equal(publicDrop.items[0].commerce.authority,'LISTING');assert.equal(publicDrop.items[0].commerce.listingId,'lst-110');assert.equal(publicDrop.items[0].commerce.available,true);
await assert.rejects(()=>upsertDropItem(operator,created.drop.id,{objectId:'lot-111',sortOrder:2,expectedVersion:6,clientActionId:'drop-late-item'}),e=>e?.code==='DROP_IMMUTABLE_PHASE');
const internal=await getDropForOperator(created.drop.id);assert.deepEqual(internal.events.map(e=>e.eventType),['CREATED','ITEM_UPSERTED','UPDATED','SCHEDULED','PREVIEWED','RELEASED']);
assert.equal(dropsCapabilities().saleAuthority,'LISTING_OR_AUCTION');assert.equal(dropsCapabilities().inventoryMeaning,'DROP_RELEASE_LIMIT_NOT_LIVE_AVAILABILITY');
console.log('ANTIQUA v29 Drops memory: bounded lifecycle + follow + release notification + listing authority passed');
