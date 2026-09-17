import assert from 'node:assert/strict';
import crypto from 'node:crypto';

if(!process.env.DATABASE_URL){console.log('ANTIQUA v16 publication lifecycle: skipped (DATABASE_URL not set)');process.exit(0)}

const {db}=await import('../runtime-v09.mjs');
const {editDraftPublication,submitDraftPublication,requestPublicationChanges,approvePublication,publishPublication}=await import('../publication-lifecycle-v16.mjs');
const {processOutboxBatch}=await import('../worker-runtime-v15.mjs');
const token=crypto.randomUUID();

const completeDraft=(id,sellerId)=>({
 id,sellerId,status:'DRAFT',saleRoute:'SHOP',
 title:{en:'Lifecycle publication object',ru:'Предмет для проверки публикации'},category:{en:'Decorative Arts',ru:'Декоративное искусство'},maker:{en:'English',ru:'Англия'},period:{en:'19th century',ru:'XIX век'},origin:{en:'United Kingdom',ru:'Великобритания'},materials:{en:'Walnut, brass',ru:'Орех, латунь'},dimensions:{en:'12 x 42 x 28 cm',ru:'12 x 42 x 28 см'},description:{en:'Complete catalogue description',ru:'Полное каталожное описание'},provenance:{en:'Private collection before 2010',ru:'Частная коллекция до 2010 года'},condition:{en:'Minor surface wear',ru:'Незначительные следы бытования'},price:2400,estimateLow:1800,estimateHigh:2600,shippingFrom:'Amsterdam',media:[{id:`m-${id}-1`,role:'HERO',status:'READY'},{id:`m-${id}-2`,role:'DETAIL',status:'READY'},{id:`m-${id}-3`,role:'CONDITION',status:'READY'}],documents:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()
});
async function insertDraft(d){await db.pool.query('INSERT INTO seller_drafts(id,seller_id,status,payload,created_at,updated_at) VALUES($1,$2,$3,$4,now(),now())',[d.id,d.sellerId,d.status,d])}

try{
 assert.equal(db.kind,'POSTGRES');
 const seller=await db.findAccountByEmail('seller@demo.antiqua'),operator=await db.findAccountByEmail('operator@demo.antiqua');assert.ok(seller?.sellerId);assert.ok(operator?.roles?.includes('ADMIN'));
 await db.pool.query(`INSERT INTO verification_cases(id,account_id,subject_type,case_type,status,provider,provider_reference,risk_level,decision_reason,submitted_at,decided_at,created_at,updated_at)
  VALUES($1,$2,'ORGANIZATION','KYB','VERIFIED','TEST_KYB',$3,'LOW','publication lifecycle proof',now(),now(),now(),now())`,[`ver-pub-${token}`,seller.id,`kyb-${token}`]);

 const draftId=`draft-pub-${token}`,draft=completeDraft(draftId,seller.sellerId);await insertDraft(draft);
 let x=await submitDraftPublication(seller,draftId,{sourceKey:`submit-1-${token}`});assert.equal(x.draft.status,'CATALOGUE_REVIEW');assert.equal(x.lifecycle.action,'SUBMIT');
 x=await requestPublicationChanges(operator,draftId,{note:'Add final detail',sourceKey:`changes-${token}`});assert.equal(x.draft.status,'CHANGES_REQUESTED');assert.equal(x.review.catalogueStatus,'CHANGES_REQUESTED');
 x=await editDraftPublication(seller,draftId,{description:{en:'Complete catalogue description, revised',ru:'Полное каталожное описание, исправлено'}},{sourceKey:`resubmit-${token}`});assert.equal(x.draft.status,'DRAFT');assert.equal(x.lifecycle.action,'RESUBMIT');
 x=await submitDraftPublication(seller,draftId,{sourceKey:`submit-2-${token}`});assert.equal(x.draft.status,'CATALOGUE_REVIEW');
 x=await approvePublication(operator,draftId,{sourceKey:`approve-${token}`});assert.equal(x.draft.status,'APPROVED');assert.equal(x.review.catalogueStatus,'APPROVED');assert.equal(x.review.riskFlags.length,0);
 await db.pool.query("UPDATE catalogue_reviews SET trust_status='CLEARED',decision_note='Cleared in lifecycle proof',updated_at=now() WHERE draft_id=$1",[draftId]);

 const publishKey=`publish-${token}`,published=await Promise.all([publishPublication(operator,draftId,{sourceKey:publishKey}),publishPublication(operator,draftId,{sourceKey:publishKey})]);assert.equal(published.filter(v=>v.idempotentTransition===false).length,1);assert.equal(published.filter(v=>v.idempotentTransition===true).length,1);
 const review=(await db.pool.query('SELECT * FROM catalogue_reviews WHERE draft_id=$1 ORDER BY updated_at DESC LIMIT 1',[draftId])).rows[0];assert.ok(review.object_id);assert.equal((await db.pool.query('SELECT status FROM seller_drafts WHERE id=$1',[draftId])).rows[0].status,'PUBLISHED');assert.equal(Number((await db.pool.query('SELECT count(*)::int AS n FROM objects WHERE id=$1',[review.object_id])).rows[0].n),1);assert.equal(Number((await db.pool.query('SELECT count(*)::int AS n FROM listings WHERE object_id=$1',[review.object_id])).rows[0].n),1);
 const listing=(await db.pool.query('SELECT status,payload FROM listings WHERE object_id=$1',[review.object_id])).rows[0];assert.equal(listing.status,'ACTIVE');assert.equal(listing.payload.lotId,review.object_id);
 let events=(await db.pool.query("SELECT action,from_state,to_state,authority,source_key FROM lifecycle_events WHERE domain='PUBLICATION' AND aggregate_id=$1 ORDER BY created_at,id",[draftId])).rows;assert.deepEqual(events.map(e=>[e.action,e.from_state,e.to_state]),[['SUBMIT','DRAFT','CATALOGUE_REVIEW'],['REQUEST_CHANGES','CATALOGUE_REVIEW','CHANGES_REQUESTED'],['RESUBMIT','CHANGES_REQUESTED','DRAFT'],['SUBMIT','DRAFT','CATALOGUE_REVIEW'],['APPROVE','CATALOGUE_REVIEW','APPROVED'],['PUBLISH','APPROVED','PUBLISHED']]);assert.deepEqual(events.map(e=>e.authority),['SELLER','OPERATOR','SELLER','SELLER','OPERATOR','OPERATOR']);

 const blockedId=`draft-pub-blocked-${token}`,blocked=completeDraft(blockedId,seller.sellerId);await insertDraft(blocked);await submitDraftPublication(seller,blockedId,{sourceKey:`blocked-submit-${token}`});await approvePublication(operator,blockedId,{sourceKey:`blocked-approve-${token}`});await db.pool.query("UPDATE catalogue_reviews SET trust_status='BLOCKED',risk_flags=$2,updated_at=now() WHERE draft_id=$1",[blockedId,[{code:'MANUAL_BLOCK',severity:'BLOCK'}]]);const objectsBefore=Number((await db.pool.query('SELECT count(*)::int AS n FROM objects')).rows[0].n);await assert.rejects(()=>publishPublication(operator,blockedId,{sourceKey:`blocked-publish-${token}`}),e=>e.code==='PUBLICATION_BLOCKED');assert.equal((await db.pool.query('SELECT status FROM seller_drafts WHERE id=$1',[blockedId])).rows[0].status,'APPROVED');assert.equal(Number((await db.pool.query('SELECT count(*)::int AS n FROM objects')).rows[0].n),objectsBefore);assert.equal(Number((await db.pool.query("SELECT count(*)::int AS n FROM lifecycle_events WHERE domain='PUBLICATION' AND aggregate_id=$1 AND action='PUBLISH'",[blockedId])).rows[0].n),0);

 let pending=Number((await db.pool.query("SELECT count(*)::int AS n FROM outbox_events WHERE aggregate_id=ANY($1::text[]) AND status='PENDING' AND payload->>'kind'='LIFECYCLE_TRANSITION'",[[draftId,blockedId]])).rows[0].n);assert.ok(pending>=8);for(let i=0;i<5&&pending;i++){await processOutboxBatch({workerId:`publication-life-${token}-${i}`,limit:100,leaseMs:5000});pending=Number((await db.pool.query("SELECT count(*)::int AS n FROM outbox_events WHERE aggregate_id=ANY($1::text[]) AND status='PENDING' AND payload->>'kind'='LIFECYCLE_TRANSITION'",[[draftId,blockedId]])).rows[0].n)}assert.equal(pending,0);

 console.log('ANTIQUA v16 publication lifecycle: review/resubmit + serialized atomic publish + idempotent replay + blocked rollback + worker delivery passed');
}finally{await db.pool.end()}
