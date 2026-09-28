import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {db} from '../runtime-v09.mjs';
import {dealerInterestFor,dealerInterestCapabilities} from '../dealer-interest-v32.mjs';

if(!process.env.DATABASE_URL){console.log('ANTIQUA v32 PostgreSQL Dealer Interest: skipped (DATABASE_URL not set)');process.exit(0)}
assert.equal(db.kind,'POSTGRES');
const seller=await db.findAccountByEmail('seller@demo.antiqua'),buyer=await db.findAccountByEmail('buyer@demo.antiqua');assert.ok(seller?.sellerId);assert.ok(buyer?.id);
const token=crypto.randomUUID().replaceAll('-','').slice(0,12),objectId='interest-object-'+token,listingId='interest-listing-'+token,conversationId='interest-conv-'+token,viewId='interest-view-'+token;
const viewerHash=crypto.createHash('sha256').update('v32-'+token).digest('hex');
try{
 await db.pool.query(`INSERT INTO objects(id,object_code,seller_id,passport,catalogue_status,trust_status,publication_status) VALUES($1,$2,$3,$4,'APPROVED','CLEARED','PUBLIC')`,[objectId,'INT-'+token,seller.sellerId,{objectId:'INT-'+token,title:{en:'Dealer Interest PostgreSQL Proof',ru:'PostgreSQL тест интереса'},currency:'EUR'}]);
 await db.pool.query(`INSERT INTO listings(id,object_id,seller_id,status,payload) VALUES($1,$2,$3,'ACTIVE',$4)`,[listingId,objectId,seller.sellerId,{price:2500,currency:'EUR',saleType:'MAKE_OFFER'}]);
 await db.pool.query(`INSERT INTO object_view_events(id,object_id,account_id,viewer_key_hash,window_started_at,first_viewed_at,last_viewed_at,source) VALUES($1,$2,$3,$4,date_trunc('hour',now()),now(),now(),'PASSPORT')`,[viewId,objectId,buyer.id,viewerHash]);
 await db.pool.query(`INSERT INTO account_object_flags(account_id,object_id,flag_type) VALUES($1,$2,'SAVED') ON CONFLICT DO NOTHING`,[buyer.id,objectId]);
 let projection=await dealerInterestFor(seller),row=projection.objects.find(x=>x.objectId===objectId);assert.ok(row);assert.equal(row.stage,'ENGAGED');assert.equal(row.passive.views,1);assert.equal(row.passive.saved,1);assert.equal(row.privacy.passiveViewerIdentityExposed,false);assert.equal(JSON.stringify(row).includes(buyer.id),false,'passive seller projection must not expose buyer identity');
 await db.pool.query(`INSERT INTO conversations(id,object_id,listing_id,buyer_account_id,seller_id,status,subject) VALUES($1,$2,$3,$4,$5,'OPEN',$6)`,[conversationId,objectId,listingId,buyer.id,seller.sellerId,{en:'Availability',ru:'Наличие'}]);
 projection=await dealerInterestFor(seller);row=projection.objects.find(x=>x.objectId===objectId);assert.equal(row.stage,'INQUIRY');assert.equal(row.commercial.activeLeads,1);assert.equal(row.commercial.potentialByCurrency.EUR,250000);assert.equal(row.privacy.explicitLeadIdentityAvailableOnlyInLeadWorkflow,true);
 const caps=dealerInterestCapabilities();assert.equal(caps.projectionOnly,true);assert.equal(caps.opaqueScore,false);assert.equal(caps.passiveIdentityExposed,false);assert.equal(caps.crossSignalUniqueAudience,false);
 console.log('ANTIQUA v32 PostgreSQL Dealer Interest: passive aggregate → explicit inquiry + privacy boundary passed');
}finally{
 await db.pool.query('DELETE FROM conversations WHERE id=$1',[conversationId]).catch(()=>{});
 await db.pool.query('DELETE FROM account_object_flags WHERE object_id=$1',[objectId]).catch(()=>{});
 await db.pool.query('DELETE FROM object_view_events WHERE object_id=$1',[objectId]).catch(()=>{});
 await db.pool.query('DELETE FROM listings WHERE id=$1',[listingId]).catch(()=>{});
 await db.pool.query('DELETE FROM objects WHERE id=$1',[objectId]).catch(()=>{});
 await db.pool.end();
}
