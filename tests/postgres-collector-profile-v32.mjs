import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {db} from '../runtime-v09.mjs';
import {createCollection} from '../collection-graph-v10.mjs';
import {upsertCollectorProfile,getCollectorProfile,listCollectors,setCollectorFollow,collectorProfileCapabilities} from '../collector-profile-v32.mjs';

if(!process.env.DATABASE_URL){console.log('ANTIQUA v32 PostgreSQL Collector Profile: skipped (DATABASE_URL not set)');process.exit(0)}
assert.equal(db.kind,'POSTGRES');
const owner=await db.findAccountByEmail('buyer@demo.antiqua'),viewer=await db.findAccountByEmail('seller@demo.antiqua');assert.ok(owner);assert.ok(viewer);
const token=crypto.randomUUID().replaceAll('-','').slice(0,10),slug='collector-pg-'+token;let pub=null,priv=null;
try{
 pub=await createCollection(owner,{title:'Public collector proof '+token,visibility:'PUBLIC'});priv=await createCollection(owner,{title:'Private collector proof '+token,visibility:'PRIVATE'});
 await upsertCollectorProfile(owner,{displayName:'PostgreSQL Collector '+token,slug,bio:'Privacy proof',interests:['Design','Bronze'],visibility:'PRIVATE'});
 assert.equal(await getCollectorProfile(viewer,slug),null);
 await assert.rejects(()=>upsertCollectorProfile(owner,{featuredCollectionId:priv.id}),e=>e?.code==='FEATURED_COLLECTION_NOT_PUBLIC');
 await upsertCollectorProfile(owner,{visibility:'PUBLIC',featuredCollectionId:pub.id});
 const profile=await getCollectorProfile(viewer,slug);assert.ok(profile);assert.equal(profile.collections.length,1);assert.equal(profile.collections[0].id,pub.id);assert.equal(profile.profile.featuredCollectionId,pub.id);
 const directory=await listCollectors(viewer),entry=directory.items.find(x=>x.slug===slug);assert.ok(entry);assert.equal(entry.collectionCount,1);
 let follow=await setCollectorFollow(viewer,slug,true);assert.equal(follow.enabled,true);assert.equal(follow.follow.count,1);follow=await setCollectorFollow(viewer,slug,true);assert.equal(follow.follow.count,1);
 const row=(await db.pool.query('SELECT visibility,featured_collection_id,interests FROM collector_profiles WHERE account_id=$1',[owner.id])).rows[0];assert.equal(row.visibility,'PUBLIC');assert.equal(row.featured_collection_id,pub.id);assert.deepEqual(row.interests,[{en:'Design',ru:'Design'},{en:'Bronze',ru:'Bronze'}]);
 const f=(await db.pool.query("SELECT count(*)::int n FROM collector_follows WHERE collector_account_id=$1 AND follower_account_id=$2 AND status='ACTIVE'",[owner.id,viewer.id])).rows[0];assert.equal(Number(f.n),1);
 const serialized=JSON.stringify(profile);assert.equal(/savedLots|purchases|collectionRecords|taste/i.test(serialized),false);const cap=collectorProfileCapabilities();assert.equal(cap.collectionRecordsExposed,false);assert.equal(cap.manualInterestsOnly,true);
 console.log('ANTIQUA v32 PostgreSQL Collector Profile: visibility + public collection boundary + durable follow + privacy passed');
}finally{
 await db.pool.query('DELETE FROM collector_profiles WHERE account_id=$1',[owner.id]).catch(()=>{});
 if(pub)await db.pool.query('DELETE FROM collections WHERE id=$1',[pub.id]).catch(()=>{});if(priv)await db.pool.query('DELETE FROM collections WHERE id=$1',[priv.id]).catch(()=>{});
 await db.pool.end();
}
