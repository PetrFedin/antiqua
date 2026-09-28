import assert from 'node:assert/strict';
import {createCollection} from '../collection-graph-v10.mjs';
import {upsertCollectorProfile,getCollectorProfile,listCollectors,setCollectorFollow,getMyCollectorProfile,collectorProfileCapabilities} from '../collector-profile-v32.mjs';

const owner={id:'collector-owner-memory',displayName:'Collector Memory',roles:['BUYER']},viewer={id:'collector-viewer-memory',displayName:'Viewer',roles:['BUYER']};
const pub=await createCollection(owner,{title:'Public proof collection',visibility:'PUBLIC'}),priv=await createCollection(owner,{title:'Private proof collection',visibility:'PRIVATE'});
let saved=await upsertCollectorProfile(owner,{displayName:'Collector Memory',slug:'collector-memory',bio:'A private-first collector profile.',interests:['Sculpture','Works on paper'],visibility:'PRIVATE'});assert.equal(saved.profile.visibility,'PRIVATE');
assert.equal(await getCollectorProfile(viewer,'collector-memory'),null,'PRIVATE collector profile must not be visible to another account');
assert.equal((await listCollectors(viewer)).items.some(x=>x.slug==='collector-memory'),false);
await assert.rejects(()=>upsertCollectorProfile(owner,{featuredCollectionId:priv.id}),e=>e?.code==='FEATURED_COLLECTION_NOT_PUBLIC');
saved=await upsertCollectorProfile(owner,{visibility:'UNLISTED',featuredCollectionId:pub.id});assert.equal(saved.profile.visibility,'UNLISTED');
assert.ok(await getCollectorProfile(viewer,'collector-memory'),'UNLISTED profile must be readable by direct link');assert.equal((await listCollectors(viewer)).items.some(x=>x.slug==='collector-memory'),false,'UNLISTED profile must stay out of directory');
saved=await upsertCollectorProfile(owner,{visibility:'PUBLIC'});const directory=await listCollectors(viewer),entry=directory.items.find(x=>x.slug==='collector-memory');assert.ok(entry);assert.equal(entry.collectionCount,1);assert.equal(entry.featuredCollection.id,pub.id);
const profile=await getCollectorProfile(viewer,'collector-memory');assert.equal(profile.collections.length,1);assert.equal(profile.collections[0].id,pub.id);const serialized=JSON.stringify(profile);assert.equal(/\"(?:savedLots|purchases|collectionRecords|taste)\"\s*:/.test(serialized),false,'private behavioral/ownership state must not leak');
let follow=await setCollectorFollow(viewer,'collector-memory',true);assert.equal(follow.enabled,true);assert.equal(follow.follow.count,1);follow=await setCollectorFollow(viewer,'collector-memory',true);assert.equal(follow.follow.count,1,'repeated follow must not duplicate');
await assert.rejects(()=>setCollectorFollow(owner,'collector-memory',true),e=>e?.code==='SELF_FOLLOW_FORBIDDEN');
const mine=await getMyCollectorProfile(owner);assert.ok(mine.collections.some(x=>x.id===priv.id&&x.visibility==='PRIVATE'),'owner settings may see private collection choices without publishing them');
const cap=collectorProfileCapabilities();assert.equal(cap.defaultVisibility,'PRIVATE');assert.equal(cap.savedObjectsExposed,false);assert.equal(cap.purchasesExposed,false);assert.equal(cap.inferredTasteExposed,false);
console.log('ANTIQUA v32 Collector Profile: opt-in visibility + public-collection boundary + follow + privacy passed');
