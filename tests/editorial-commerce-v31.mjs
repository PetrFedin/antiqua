import assert from 'node:assert/strict';
import {listEditorial,getEditorialStory,recordEditorialEvent,editorialCapabilities,createEditorialStory,publishEditorialStory,linkEditorialTarget,editorialAnalytics} from '../editorial-commerce-v31.mjs';

const buyer={id:'editorial-buyer-memory',roles:['BUYER']},admin={id:'editorial-admin-memory',displayName:'Editorial Admin',roles:['ADMIN']};
const req={headers:{'user-agent':'ANTIQUA editorial memory test','x-forwarded-for':'127.0.0.10'},socket:{remoteAddress:'127.0.0.10'}};
const seeded=await listEditorial({limit:10});assert.ok(seeded.items.length>=3);assert.ok(seeded.items.some(x=>x.slug==='how-to-start-a-collection'));
const guide=await getEditorialStory(buyer,'how-to-start-a-collection');assert.ok(guide?.story);assert.ok(guide.links.some(x=>x.linkType==='OBJECT'&&x.object?.id==='lot-103'));
const first=await recordEditorialEvent(req,buyer,guide.story.id,{eventType:'STORY_OPEN'});assert.equal(first.deduplicated,false);
const replay=await recordEditorialEvent(req,buyer,guide.story.id,{eventType:'STORY_OPEN'});assert.equal(replay.deduplicated,true);
const object=await recordEditorialEvent(req,buyer,guide.story.id,{eventType:'OBJECT_OPEN',objectId:'lot-103'});assert.equal(object.recorded,true);
await assert.rejects(()=>recordEditorialEvent(req,buyer,guide.story.id,{eventType:'OBJECT_OPEN',objectId:'lot-112'}),e=>e?.code==='EDITORIAL_TARGET_NOT_LINKED');
const draft=await createEditorialStory(admin,{titleEn:'Memory Editorial Proof',titleRu:'Тест редакционного материала',storyType:'GUIDE',body:[{type:'PARAGRAPH',text:{en:'Structured editorial content.',ru:'Структурированный редакционный материал.'}}]});assert.equal(draft.status,'DRAFT');
const link=await linkEditorialTarget(admin,draft.id,{linkType:'OBJECT',targetId:'lot-109'});assert.equal(link.idempotent,false);
const linkReplay=await linkEditorialTarget(admin,draft.id,{linkType:'OBJECT',targetId:'lot-109'});assert.equal(linkReplay.idempotent,true);
await publishEditorialStory(admin,draft.id);const publicStory=await getEditorialStory(buyer,draft.slug);assert.equal(publicStory.story.status,'PUBLISHED');assert.equal(publicStory.links[0].object.id,'lot-109');
const analytics=await editorialAnalytics(admin,guide.story.id);assert.ok(analytics.rows.some(x=>x.eventType==='STORY_OPEN'&&x.uniqueViewers===1));
assert.equal(editorialCapabilities().anonymousRawIdentifiersStored,false);assert.equal(editorialCapabilities().contentToCommerceMeasured,true);
console.log('ANTIQUA v31 Editorial Commerce: structured publication + linked targets + deduplicated attribution passed');
