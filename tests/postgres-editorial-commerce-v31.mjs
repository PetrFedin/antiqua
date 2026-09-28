import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {db} from '../runtime-v09.mjs';
import {createCreator,publishCreator} from '../creator-graph-v30.mjs';
import {createEditorialStory,publishEditorialStory,linkEditorialTarget,getEditorialStory,recordEditorialEvent,editorialAnalytics} from '../editorial-commerce-v31.mjs';

if(!process.env.DATABASE_URL){console.log('ANTIQUA v31 PostgreSQL Editorial Commerce: skipped (DATABASE_URL not set)');process.exit(0)}
assert.equal(db.kind,'POSTGRES');
const admin=await db.findAccountByEmail('operator@demo.antiqua'),buyer=await db.findAccountByEmail('buyer@demo.antiqua');assert.ok(admin?.roles?.includes('ADMIN'));assert.ok(buyer);
const token=crypto.randomUUID().replaceAll('-','').slice(0,10);let creator=null,story=null;
const req={headers:{'user-agent':'ANTIQUA editorial postgres test','x-forwarded-for':'127.0.0.11'},socket:{remoteAddress:'127.0.0.11'}};
try{
 creator=await createCreator(admin,{nameEn:'Editorial Artist '+token,nameRu:'Редакционный автор '+token,creatorType:'ARTIST',salesModel:'INDEPENDENT',slug:'editorial-artist-'+token});await publishCreator(admin,creator.id);
 story=await createEditorialStory(admin,{titleEn:'Editorial PostgreSQL Proof '+token,titleRu:'Редакционный PostgreSQL тест '+token,storyType:'NEW_NAMES',body:[{type:'PARAGRAPH',text:{en:'A structured story.',ru:'Структурированный материал.'}}],metadata:{test:true}});
 await linkEditorialTarget(admin,story.id,{linkType:'OBJECT',targetId:'lot-109'});
 await linkEditorialTarget(admin,story.id,{linkType:'CREATOR',targetId:creator.id});
 await publishEditorialStory(admin,story.id);
 const publicStory=await getEditorialStory(buyer,story.slug);assert.equal(publicStory.story.status,'PUBLISHED');assert.ok(publicStory.links.some(x=>x.linkType==='OBJECT'&&x.object.id==='lot-109'));assert.ok(publicStory.links.some(x=>x.linkType==='CREATOR'&&x.creator.id===creator.id));
 const open1=await recordEditorialEvent(req,buyer,story.id,{eventType:'STORY_OPEN',surface:'PG_TEST'});const open2=await recordEditorialEvent(req,buyer,story.id,{eventType:'STORY_OPEN',surface:'PG_TEST'});assert.equal(open1.deduplicated,false);assert.equal(open2.deduplicated,true);
 await recordEditorialEvent(req,buyer,story.id,{eventType:'OBJECT_OPEN',objectId:'lot-109',surface:'PG_TEST'});await recordEditorialEvent(req,buyer,story.id,{eventType:'CREATOR_OPEN',creatorId:creator.id,surface:'PG_TEST'});
 await assert.rejects(()=>recordEditorialEvent(req,buyer,story.id,{eventType:'OBJECT_OPEN',objectId:'lot-110'}),e=>e?.code==='EDITORIAL_TARGET_NOT_LINKED');
 const analytics=await editorialAnalytics(admin,story.id);const storyOpen=analytics.rows.find(x=>x.eventType==='STORY_OPEN');assert.equal(storyOpen.events,1);assert.equal(storyOpen.uniqueViewers,1);assert.ok(analytics.rows.some(x=>x.eventType==='OBJECT_OPEN'&&x.targetKey==='lot-109'));assert.ok(analytics.rows.some(x=>x.eventType==='CREATOR_OPEN'&&x.targetKey===creator.id));
 const rows=(await db.pool.query('SELECT event_type,target_key,viewer_key_hash FROM editorial_events WHERE story_id=$1 ORDER BY event_type',[story.id])).rows;assert.equal(rows.length,3);assert.ok(rows.every(x=>x.viewer_key_hash&&x.viewer_key_hash!=='127.0.0.11'));
 console.log('ANTIQUA v31 PostgreSQL Editorial Commerce: creator/object links + privacy-safe dedupe + analytics passed');
}finally{if(story)await db.pool.query('DELETE FROM editorial_stories WHERE id=$1',[story.id]).catch(()=>{});if(creator)await db.pool.query('DELETE FROM creators WHERE id=$1',[creator.id]).catch(()=>{});await db.pool.end()}
