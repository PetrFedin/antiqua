import {db} from './runtime-v09.mjs';
import {transitionSettlement} from './commerce-lifecycle-v16.mjs';
import {enqueueOutboxTx} from './outbox-v15.mjs';
const SYSTEM={id:'system',roles:['ADMIN'],sellerId:null};
export async function sweepOverdueSettlements(){if(db.kind!=='POSTGRES')return{changed:0,reason:'MEMORY_PREVIEW'};const rows=(await db.pool.query("SELECT id FROM auction_settlements WHERE status='PAYMENT_DUE' AND payment_due_at IS NOT NULL AND payment_due_at<=clock_timestamp() ORDER BY payment_due_at LIMIT 100")).rows;let changed=0;for(const r of rows){try{await transitionSettlement(SYSTEM,r.id,'NONPAYMENT',{reason:'PAYMENT_DUE_EXPIRED',automatic:true,sourceKey:`automatic-nonpayment:${r.id}`});changed++}catch(e){console.error('nonpayment sweep',r.id,e.message)}}return{changed}}
export async function sweepExpiredInsurance(){
 if(db.kind!=='POSTGRES')return{changed:0,reason:'MEMORY_PREVIEW'};
 const c=await db.pool.connect();try{
  await c.query('BEGIN');
  const rows=(await c.query("UPDATE insurance_policies SET status='EXPIRED',updated_at=now() WHERE status='ACTIVE' AND expires_at IS NOT NULL AND expires_at<=clock_timestamp() RETURNING id,record_id,provider,expires_at")).rows;
  let enqueued=0;
  for(const p of rows){
   const r=(await c.query('SELECT account_id,object_id FROM collection_records WHERE id=$1',[p.record_id])).rows[0];if(!r)continue;
   const event=await enqueueOutboxTx(c,{topic:'NOTIFICATION',aggregateType:'INSURANCE_POLICY',aggregateId:p.id,idempotencyKey:`notification:insurance-expired:${p.id}`,payload:{accountId:r.account_id,type:'INSURANCE_EXPIRED',data:{policyId:p.id,objectId:r.object_id,provider:p.provider,expiredAt:p.expires_at?.toISOString?.()||p.expires_at}}});if(!event.idempotent)enqueued++;
  }
  await c.query('COMMIT');return{changed:rows.length,enqueued};
 }catch(e){try{await c.query('ROLLBACK')}catch{}throw e}finally{c.release()}
}
export async function runOperationalSweeps(){const [settlements,insurance]=await Promise.all([sweepOverdueSettlements(),sweepExpiredInsurance()]);return{settlements,insurance}}
