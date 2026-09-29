import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {db} from '../runtime-v09.mjs';
import {recordPartnerExposure,recordPartnerCommercialEvent,tryRecordPartnerOrderFromOffer,recordPartnerFollow,partnerPilotAnalytics} from '../partner-pilot-analytics-v33.mjs';
import {setExhibitionFollow} from '../partner-drops-v29.mjs';

if(!process.env.DATABASE_URL){console.log('ANTIQUA v33 PostgreSQL Partner Pilot Analytics: skipped (DATABASE_URL not set)');process.exit(0)}
assert.equal(db.kind,'POSTGRES');
const owner=await db.findAccountByEmail('buyer@demo.antiqua'),other=await db.findAccountByEmail('seller@demo.antiqua');assert.ok(owner?.id);assert.ok(other?.id);
const token=crypto.randomUUID().replaceAll('-','').slice(0,12),exhibitionId='ex-pilot-'+token,objectId='pilot-object-'+token,outsideId='pilot-outside-'+token,sectionId='pilot-section-'+token;
const req={headers:{host:'localhost','user-agent':'v33-postgres-proof','sec-fetch-site':'same-origin'},socket:{remoteAddress:'127.0.0.1'}};
try{
 await db.pool.query("INSERT INTO objects(id,object_code,passport,catalogue_status,trust_status,publication_status) VALUES($1,$2,$3,'APPROVED','CLEARED','PUBLIC'),($4,$5,$6,'APPROVED','CLEARED','PUBLIC')",[objectId,'PILOT-'+token,{objectId:'PILOT-'+token,title:{en:'Pilot cohort object',ru:'Предмет пилота'}},outsideId,'OUT-'+token,{objectId:'OUT-'+token,title:{en:'Outside object',ru:'Внешний предмет'}}]);
 await db.pool.query("INSERT INTO exhibitions(id,owner_account_id,title,subtitle,curatorial_statement,visibility,status,metadata) VALUES($1,$2,$3,$4,$5,'PUBLIC','LIVE',$6)",[exhibitionId,owner.id,{en:'Partner Pilot Proof',ru:'Тест партнёрского пилота'},{},{},{drop:{format:'PARTNER_FAIR',partner:{name:'Proof Fair',role:'FAIR'},access:'PUBLIC'}}]);
 await db.pool.query("INSERT INTO exhibition_sections(id,exhibition_id,title,narrative,sort_order) VALUES($1,$2,$3,$4,1)",[sectionId,exhibitionId,{en:'Section',ru:'Раздел'},{}]);
 await db.pool.query("INSERT INTO exhibition_items(id,exhibition_id,section_id,object_id,sort_order,caption,owner_consent_required,owner_consent_status) VALUES($1,$2,$3,$4,1,$5,false,'NOT_REQUIRED')",['pilot-item-'+token,exhibitionId,sectionId,objectId,{}]);

 let x=await recordPartnerExposure(req,owner,exhibitionId,{eventType:'DROP_OPEN',metadata:{surface:'PARTNER_DROP'}});assert.equal(x.deduplicated,false);
 x=await recordPartnerExposure(req,owner,exhibitionId,{eventType:'DROP_OPEN',metadata:{surface:'PARTNER_DROP'}});assert.equal(x.deduplicated,true);
 x=await recordPartnerExposure(req,owner,exhibitionId,{eventType:'OBJECT_OPEN',objectId,metadata:{surface:'EXHIBITION'}});assert.equal(x.deduplicated,false);
 await assert.rejects(()=>recordPartnerExposure(req,owner,exhibitionId,{eventType:'OBJECT_OPEN',objectId:outsideId}),e=>e?.code==='OBJECT_OUTSIDE_PARTNER_COHORT');

 let c=await recordPartnerCommercialEvent(req,owner,{exhibitionId},{eventType:'OFFER_CREATED',objectId,sourceEntityId:'offer-'+token,authority:'OFFER_V22'});assert.equal(c.recorded,true);assert.equal(c.deduplicated,false);
 c=await recordPartnerCommercialEvent(req,owner,{exhibitionId},{eventType:'OFFER_CREATED',objectId,sourceEntityId:'offer-'+token,authority:'OFFER_V22'});assert.equal(c.deduplicated,true);
 const order=await tryRecordPartnerOrderFromOffer(req,'offer-'+token,{id:'order-'+token,lotId:objectId});assert.equal(order.recorded,true);

 await setExhibitionFollow(owner,exhibitionId,true);const follow=await recordPartnerFollow(req,owner,exhibitionId);assert.equal(follow.recorded,true);

 const analytics=await partnerPilotAnalytics(owner,exhibitionId);assert.equal(analytics.cohort.objects,1);assert.equal(analytics.attributed.counts.DROP_OPEN,1);assert.equal(analytics.attributed.counts.OBJECT_OPEN,1);assert.equal(analytics.attributed.counts.OFFER_CREATED,1);assert.equal(analytics.attributed.counts.ORDER_CREATED,1);assert.equal(analytics.attributed.currentFollowers,1);assert.equal(analytics.retention.authenticatedExposed,1);assert.equal(analytics.methodology.objectWideDemandExcluded,true);assert.equal(analytics.methodology.crossSignalUniqueAudience,false);
 const rows=(await db.pool.query('SELECT viewer_key_hash,metadata FROM partner_attribution_events WHERE exhibition_id=$1',[exhibitionId])).rows;assert.ok(rows.length>=5);assert.ok(rows.every(r=>/^[0-9a-f]{64}$/.test(r.viewer_key_hash)));assert.equal(JSON.stringify(rows).includes('127.0.0.1'),false);assert.equal(JSON.stringify(rows).includes('v33-postgres-proof'),false);
 await assert.rejects(()=>partnerPilotAnalytics(other,exhibitionId),e=>e?.code==='PARTNER_ANALYTICS_FORBIDDEN');
 console.log('ANTIQUA v33 PostgreSQL Partner Pilot Analytics: dedupe + cohort guard + explicit attribution + owner privacy passed');
}finally{
 await db.pool.query('DELETE FROM exhibitions WHERE id=$1',[exhibitionId]).catch(()=>{});
 await db.pool.query('DELETE FROM objects WHERE id=ANY($1::text[])',[[objectId,outsideId]]).catch(()=>{});
 await db.pool.end();
}
