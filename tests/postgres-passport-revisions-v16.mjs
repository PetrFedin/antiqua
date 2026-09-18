import assert from 'node:assert/strict';
import crypto from 'node:crypto';

if(!process.env.DATABASE_URL){console.log('ANTIQUA v16 passport revisions: skipped (DATABASE_URL not set)');process.exit(0)}

const {db}=await import('../runtime-v09.mjs');
const {ensurePassportBaseline,reviseObjectPassport,passportRevisionHistory,canonicalPassportHash}=await import('../passport-revisions-v16.mjs');
const {processOutboxBatch}=await import('../worker-runtime-v15.mjs');
const token=crypto.randomUUID().replaceAll('-',''),objectId=`lot-passport-${token}`,otherObjectId=`lot-passport-other-${token}`,mediaId=`media-passport-${token}`,provId=`prov-passport-${token}`,otherProvId=`prov-passport-other-${token}`;

const passport={
  id:objectId,objectId:`AQ-PASS-${token.slice(0,8)}`,lotNumber:990001,department:{en:'Decorative Arts',ru:'Декоративное искусство'},maker:{en:'Unknown workshop',ru:'Неизвестная мастерская'},
  title:{en:'Passport revision proof object',ru:'Предмет для проверки версий паспорта'},period:{en:'19th century',ru:'XIX век'},origin:{en:'Europe',ru:'Европа'},currency:'EUR',estimateLow:1000,estimateHigh:1500,image:'',
  materials:{en:'Wood',ru:'Дерево'},dimensions:{en:'10 x 10 cm',ru:'10 x 10 см'},attributionStatus:'CATALOGUED',marks:{en:'None recorded',ru:'Не зафиксированы'},cataloguing:{en:'Initial catalogue note',ru:'Исходное каталожное описание'},
  provenance:{en:['Private collection'],ru:['Частная коллекция']},provenanceTimeline:[{date:'2020',event:{en:'Private collection',ru:'Частная коллекция'},evidenceStatus:'USER_SUPPLIED'}],
  condition:{en:'Minor wear',ru:'Незначительные следы бытования'},conditionGrade:'A-',restoration:{en:'None recorded',ru:'Не зафиксирована'},literature:{en:[],ru:[]},exhibitions:{en:[],ru:[]},documents:[],media:[{id:mediaId,role:'CONDITION',status:'READY'}],
  location:'Amsterdam',exportStatus:'NO_FLAG',culturalPropertyStatus:'SCREENED',catalogueStatus:'PUBLISHED',trustStatus:'CLEARED',sellerId:'seller-preview',publicationStatus:'PUBLIC'
};

try{
  assert.equal(db.kind,'POSTGRES');
  const operator=await db.findAccountByEmail('operator@demo.antiqua');assert.ok(operator?.roles?.includes('ADMIN'));

  await db.pool.query(`INSERT INTO objects(id,object_code,seller_id,passport,catalogue_status,trust_status,publication_status,passport_hash,created_at,updated_at)
    VALUES($1,$2,'seller-preview',$3,'PUBLISHED','CLEARED','PUBLIC','legacy-preview-hash',now(),now())`,[objectId,passport.objectId,passport]);
  await db.pool.query(`INSERT INTO provenance_entries(id,object_id,sequence_no,event,evidence_status,evidence_ref,created_at)
    VALUES($1,$2,1,$3,'USER_SUPPLIED',NULL,now())`,[provId,objectId,passport.provenanceTimeline[0].event]);
  await db.pool.query(`INSERT INTO media_assets(id,entity_type,entity_id,storage_key,content_type,bytes,sha256,role,visibility,status,uploaded_at,created_at)
    VALUES($1,'OBJECT',$2,$3,'image/jpeg',128,$4,'CONDITION','PRIVATE','READY',now(),now())`,[mediaId,objectId,`passport/${token}.jpg`,'a'.repeat(64)]);

  const otherPassport={...passport,id:otherObjectId,objectId:`AQ-PASS-OTHER-${token.slice(0,8)}`,media:[]};
  await db.pool.query(`INSERT INTO objects(id,object_code,seller_id,passport,catalogue_status,trust_status,publication_status,passport_hash,created_at,updated_at)
    VALUES($1,$2,'seller-preview',$3,'PUBLISHED','CLEARED','PUBLIC',NULL,now(),now())`,[otherObjectId,otherPassport.objectId,otherPassport]);
  await db.pool.query(`INSERT INTO provenance_entries(id,object_id,sequence_no,event,evidence_status,evidence_ref,created_at)
    VALUES($1,$2,1,$3,'PLATFORM_RECORD',NULL,now())`,[otherProvId,otherObjectId,{en:'Other object provenance',ru:'Провенанс другого предмета'}]);

  const baseline=await ensurePassportBaseline(objectId);assert.equal(baseline.revision.revisionNo,1);assert.match(baseline.revision.hash,/^[0-9a-f]{64}$/);
  const baseRow=(await db.pool.query('SELECT passport,passport_hash FROM objects WHERE id=$1',[objectId])).rows[0];assert.equal(baseRow.passport_hash,canonicalPassportHash(baseRow.passport));assert.equal(baseRow.passport.passportHash,baseRow.passport_hash);
  assert.equal(Number((await db.pool.query('SELECT count(*)::int n FROM object_passport_revisions WHERE object_id=$1',[objectId])).rows[0].n),1);

  const titleKey=`title-${token}`,conditionKey=`condition-${token}`;
  const titleRevision=reviseObjectPassport(operator,objectId,{patch:{title:{en:'Passport proof object — corrected',ru:'Предмет проверки паспорта — исправлено'}},changeKind:'CATALOGUE_CORRECTION',reason:'Correct catalogue title after specialist review',publicSummary:{en:'Catalogue title corrected',ru:'Уточнено каталожное название'},sourceKey:titleKey});
  const conditionRevision=reviseObjectPassport(operator,objectId,{patch:{condition:{en:'Minor wear; restored corner documented',ru:'Незначительные следы бытования; зафиксирована реставрация угла'},conditionGrade:'B'},changeKind:'CONDITION_UPDATE',reason:'Condition review documented restoration',publicSummary:{en:'Condition report updated',ru:'Обновлён отчёт о состоянии'},evidence:[{type:'MEDIA',id:mediaId}],sourceKey:conditionKey});
  const results=await Promise.all([titleRevision,conditionRevision]);assert.deepEqual(results.map(x=>x.idempotent),[false,false]);

  let rows=(await db.pool.query('SELECT * FROM object_passport_revisions WHERE object_id=$1 ORDER BY revision_no',[objectId])).rows;assert.equal(rows.length,3);assert.deepEqual(rows.map(x=>Number(x.revision_no)),[1,2,3]);
  assert.equal(rows[0].previous_hash,null);assert.equal(rows[1].previous_hash,rows[0].passport_hash);assert.equal(rows[2].previous_hash,rows[1].passport_hash);
  const current=(await db.pool.query('SELECT passport,passport_hash FROM objects WHERE id=$1',[objectId])).rows[0];assert.equal(current.passport.title.en,'Passport proof object — corrected');assert.equal(current.passport.conditionGrade,'B');assert.match(current.passport_hash,/^[0-9a-f]{64}$/);assert.equal(current.passport_hash,rows[2].passport_hash);

  const replay=await reviseObjectPassport(operator,objectId,{patch:{title:{en:'Passport proof object — corrected',ru:'Предмет проверки паспорта — исправлено'}},changeKind:'CATALOGUE_CORRECTION',reason:'Correct catalogue title after specialist review',publicSummary:{en:'Catalogue title corrected',ru:'Уточнено каталожное название'},sourceKey:titleKey});assert.equal(replay.idempotent,true);assert.equal(Number((await db.pool.query('SELECT count(*)::int n FROM object_passport_revisions WHERE object_id=$1',[objectId])).rows[0].n),3);
  await assert.rejects(()=>reviseObjectPassport(operator,objectId,{patch:{title:{en:'Different retry',ru:'Другой повтор'}},changeKind:'CATALOGUE_CORRECTION',reason:'Different request',publicSummary:{en:'Different',ru:'Другое'},sourceKey:titleKey}),e=>e.code==='PASSPORT_REVISION_IDEMPOTENCY_CONFLICT');

  await assert.rejects(()=>reviseObjectPassport(operator,objectId,{patch:{conditionGrade:'C'},changeKind:'CONDITION_UPDATE',reason:'Unsupported condition downgrade',publicSummary:{en:'Condition changed',ru:'Изменено состояние'},sourceKey:`no-evidence-${token}`}),e=>e.code==='PASSPORT_EVIDENCE_REQUIRED');
  await assert.rejects(()=>reviseObjectPassport(operator,objectId,{patch:{provenance:{en:['Other claim'],ru:['Другое утверждение']}},changeKind:'PROVENANCE_UPDATE',reason:'Wrong evidence scope',publicSummary:{en:'Provenance changed',ru:'Изменён провенанс'},evidence:[{type:'PROVENANCE',id:otherProvId}],sourceKey:`wrong-scope-${token}`}),e=>e.code==='PASSPORT_EVIDENCE_SCOPE_MISMATCH');
  await assert.rejects(()=>reviseObjectPassport(operator,objectId,{patch:{sellerId:'attacker-seller'},changeKind:'ADMINISTRATIVE_CORRECTION',reason:'Protected field attempt',publicSummary:{en:'Protected',ru:'Защищено'},sourceKey:`protected-${token}`}),e=>e.code==='PASSPORT_FIELD_PROTECTED');

  const provenanceUpdate=await reviseObjectPassport(operator,objectId,{patch:{provenance:{en:['Private collection','Documented platform provenance'],ru:['Частная коллекция','Документированный провенанс платформы']}},changeKind:'PROVENANCE_UPDATE',reason:'Attach verified provenance record',publicSummary:{en:'Provenance evidence added',ru:'Добавлено подтверждение провенанса'},evidence:[{type:'PROVENANCE',id:provId}],sourceKey:`provenance-${token}`});assert.equal(provenanceUpdate.idempotent,false);
  rows=(await db.pool.query('SELECT * FROM object_passport_revisions WHERE object_id=$1 ORDER BY revision_no',[objectId])).rows;assert.equal(rows.length,4);assert.equal(rows[3].previous_hash,rows[2].passport_hash);

  const privateHistory=await passportRevisionHistory(objectId,{includePrivate:true,limit:20});assert.equal(privateHistory.currentRevisionNo,4);assert.equal(privateHistory.currentHash,rows[3].passport_hash);
  const privateCondition=privateHistory.revisions.find(x=>x.changeKind==='CONDITION_UPDATE');assert.equal(privateCondition.actorAccountId,operator.id);assert.equal(privateCondition.reason,'Condition review documented restoration');assert.ok(privateCondition.evidence.some(x=>x.type==='MEDIA'&&x.id===mediaId&&x.visibility==='PRIVATE'));
  const privateProv=privateHistory.revisions.find(x=>x.changeKind==='PROVENANCE_UPDATE');assert.ok(privateProv.evidence.some(x=>x.type==='PROVENANCE'&&x.id===provId&&x.visibility==='PUBLIC'));

  const publicHistory=await passportRevisionHistory(objectId,{includePrivate:false,limit:20});assert.equal(publicHistory.currentRevisionNo,4);
  for(const rev of publicHistory.revisions){assert.equal('reason' in rev,false);assert.equal('actorAccountId' in rev,false);assert.equal('sourceKey' in rev,false);assert.ok(rev.evidence&&Number.isInteger(rev.evidence.count));assert.equal(Array.isArray(rev.evidence.types),true);assert.equal(JSON.stringify(rev).includes(mediaId),false);assert.equal(JSON.stringify(rev).includes(provId),false)}
  const publicProv=publicHistory.revisions.find(x=>x.changeKind==='PROVENANCE_UPDATE');assert.equal(publicProv.evidence.count,1);assert.deepEqual(publicProv.evidence.types,['PROVENANCE']);
  const publicCondition=publicHistory.revisions.find(x=>x.changeKind==='CONDITION_UPDATE');assert.equal(publicCondition.evidence.count,0);

  await assert.rejects(()=>db.pool.query('UPDATE object_passport_revisions SET change_reason=$2 WHERE id=$1',[rows[1].id,'tampered']),e=>e.code==='55000');
  assert.equal((await db.pool.query('SELECT change_reason FROM object_passport_revisions WHERE id=$1',[rows[1].id])).rows[0].change_reason,rows[1].change_reason);

  let pending=Number((await db.pool.query("SELECT count(*)::int n FROM outbox_events WHERE aggregate_type='OBJECT' AND aggregate_id=$1 AND status='PENDING' AND payload->>'kind'='OBJECT_PASSPORT_REVISION'",[objectId])).rows[0].n);assert.equal(pending,3);
  for(let i=0;i<5&&pending;i++){await processOutboxBatch({workerId:`passport-proof-${token}-${i}`,limit:100,leaseMs:5000});pending=Number((await db.pool.query("SELECT count(*)::int n FROM outbox_events WHERE aggregate_type='OBJECT' AND aggregate_id=$1 AND status='PENDING' AND payload->>'kind'='OBJECT_PASSPORT_REVISION'",[objectId])).rows[0].n)}assert.equal(pending,0);
  assert.equal(Number((await db.pool.query("SELECT count(*)::int n FROM outbox_events WHERE aggregate_type='OBJECT' AND aggregate_id=$1 AND status='COMPLETED' AND payload->>'kind'='OBJECT_PASSPORT_REVISION'",[objectId])).rows[0].n),3);

  console.log('ANTIQUA v16 passport revisions: baseline + concurrent hash chain + no lost update + evidence scope/privacy + idempotency + immutability + worker delivery passed');
}finally{
  await db.pool.query('DELETE FROM media_assets WHERE id=$1',[mediaId]).catch(()=>{});
  await db.pool.query('DELETE FROM objects WHERE id=ANY($1::text[])',[[objectId,otherObjectId]]).catch(()=>{});
  await db.pool.end();
}
