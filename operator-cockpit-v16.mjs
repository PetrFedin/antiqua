import {db,PREVIEW,storageConfig} from './runtime-v09.mjs';
import {financeCapabilities,reconciliationSnapshot} from './finance-v10.mjs';

const SEVERITY_ORDER={CRITICAL:0,HIGH:1,MEDIUM:2,LOW:3,INFO:4};
const iso=v=>v?.toISOString?.()||v||null;
const ageMinutes=v=>v?Math.max(0,Math.floor((Date.now()-new Date(v).getTime())/60000)):0;
const byStatus=rows=>Object.fromEntries(rows.map(r=>[String(r.status),Number(r.count||0)]));
const q=async(sql,args=[])=>(await db.pool.query(sql,args)).rows;
const makeItem=(kind,row,{severity='MEDIUM',ownerRole='ADMIN',nextAction,reason,entityType=kind,entityId=row?.id||null,status=row?.status||null,link=null,metadata={}}={})=>({
  id:`${kind}:${entityId||'unknown'}`,kind,severity,ownerRole,nextAction,reason,entityType,entityId,status,
  ageMinutes:ageMinutes(row?.updated_at||row?.locked_at||row?.processing_started_at||row?.created_at),
  createdAt:iso(row?.created_at),updatedAt:iso(row?.updated_at||row?.created_at),link,metadata
});
const sortItems=rows=>rows.sort((a,b)=>(SEVERITY_ORDER[a.severity]??99)-(SEVERITY_ORDER[b.severity]??99)||b.ageMinutes-a.ageMinutes||a.id.localeCompare(b.id));

export function operatorCockpitCapabilities(){
  return{durableProjection:db.kind==='POSTGRES',readOnly:true,triageQueues:['PUBLICATION','VERIFICATION','DISPUTE','PAYOUT','SETTLEMENT','SHIPMENT','OUTBOX','PROVIDER_EVENT','MEDIA'],systemSignals:['OUTBOX_DEAD_OR_STALE','PROVIDER_EVENT_FAILURE_OR_STALE','MEDIA_VERIFY_STALE','RECONCILIATION'],recentLifecycle:true};
}

export async function operatorCockpitSnapshot({limit=100}={}){
  limit=Math.max(1,Math.min(250,Math.trunc(Number(limit)||100)));
  const finance=financeCapabilities(),storage=storageConfig(),reconciliation=await reconciliationSnapshot(),integrations={
    identity:{provider:process.env.KYC_PROVIDER||'NOT_CONFIGURED',configured:Boolean(process.env.KYC_PROVIDER&&process.env.KYC_PROVIDER!=='NOT_CONFIGURED')},
    payments:{provider:finance.paymentProvider,configured:finance.providerConfigured},
    storage:{provider:storage?.driver||'S3_COMPATIBLE',configured:Boolean(storage?.configured),bucket:storage?.bucket||null},
    database:{provider:db.kind,configured:db.kind==='POSTGRES'}
  };
  if(db.kind!=='POSTGRES')return{
    generatedAt:new Date().toISOString(),capabilities:operatorCockpitCapabilities(),persistence:{kind:db.kind,durable:false},integrations,reconciliation,
    summary:{actionable:0,critical:0,high:0,systemIncidents:0,domainQueues:{}},queues:[],
    system:{preview:PREVIEW,outbox:{},unprocessedProviderEvents:0,staleMediaVerifications:0},recentLifecycle:[]
  };

  const [drafts,verifications,disputes,payouts,settlements,shipments,outbox,providerEvents,media,lifecycle,outboxCounts,providerCount,staleMediaCount]=await Promise.all([
    q(`SELECT d.id,d.seller_id,d.status,d.updated_at,d.created_at,d.payload,r.catalogue_status,r.trust_status,r.risk_flags,r.assigned_to,
      v.status AS verification_status
      FROM seller_drafts d
      LEFT JOIN LATERAL (SELECT * FROM catalogue_reviews cr WHERE cr.draft_id=d.id ORDER BY cr.updated_at DESC LIMIT 1) r ON true
      LEFT JOIN LATERAL (
        SELECT vc.status FROM accounts a JOIN verification_cases vc ON vc.account_id=a.id AND vc.case_type='KYB'
        WHERE a.seller_id=d.seller_id AND a.status='ACTIVE' ORDER BY vc.updated_at DESC LIMIT 1
      ) v ON true
      WHERE d.status IN ('CATALOGUE_REVIEW','APPROVED') ORDER BY d.updated_at ASC LIMIT $1`,[limit]),
    q(`SELECT vc.id,vc.account_id,vc.case_type,vc.subject_type,vc.status,vc.provider,vc.risk_level,vc.decision_reason,vc.created_at,vc.updated_at,a.email,a.display_name
      FROM verification_cases vc JOIN accounts a ON a.id=vc.account_id
      WHERE vc.status IN ('PENDING','IN_PROGRESS','MORE_INFO_REQUIRED') ORDER BY vc.updated_at ASC LIMIT $1`,[limit]),
    q(`SELECT id,order_id,settlement_id,shipment_id,object_id,opened_by_account_id,buyer_account_id,seller_id,category,status,summary,created_at,updated_at
      FROM disputes WHERE status IN ('OPEN','UNDER_REVIEW','EVIDENCE_REQUIRED') ORDER BY updated_at ASC LIMIT $1`,[limit]),
    q(`SELECT id,order_id,seller_id,amount_minor,currency,status,hold_reason,source_type,source_id,provider,provider_reference,created_at,updated_at
      FROM payouts WHERE status IN ('ON_HOLD','READY','SUBMITTED','FAILED') ORDER BY updated_at ASC LIMIT $1`,[limit]),
    q(`SELECT id,auction_id,object_id,buyer_account_id,seller_id,winning_amount_minor,currency,status,payment_due_at,created_at,updated_at
      FROM auction_settlements WHERE status IN ('PAYMENT_DUE','PAYMENT_PROCESSING','NONPAYMENT','DISPUTED') ORDER BY updated_at ASC LIMIT $1`,[limit]),
    q(`SELECT id,order_id,settlement_id,object_id,buyer_account_id,seller_id,status,provider,tracking_reference,created_at,updated_at
      FROM shipments WHERE status IN ('DELIVERY_FAILED','DAMAGE_REPORTED') ORDER BY updated_at ASC LIMIT $1`,[limit]),
    q(`SELECT id,topic,aggregate_type,aggregate_id,status,attempt_count,max_attempts,last_error,available_at,locked_at,locked_by,created_at,processed_at
      FROM outbox_events WHERE status IN ('DEAD','PROCESSING','PENDING') ORDER BY created_at ASC LIMIT $1`,[limit]),
    q(`SELECT id,provider_type,provider,external_event_id,event_type,entity_type,entity_id,attempt_count,last_error,processing_started_at,processed_at,created_at
      FROM provider_events WHERE processed_at IS NULL ORDER BY created_at ASC LIMIT $1`,[limit]),
    q(`SELECT id,entity_type,entity_id,role,status,content_type,bytes,uploaded_at,created_at FROM media_assets
      WHERE status IN ('VERIFYING','REJECTED') ORDER BY created_at ASC LIMIT $1`,[limit]),
    q(`SELECT id,domain,aggregate_id,action,from_state,to_state,authority,outbox_topic,metadata,created_at
      FROM lifecycle_events ORDER BY created_at DESC LIMIT 40`),
    q(`SELECT status,count(*)::int AS count FROM outbox_events GROUP BY status`),
    q(`SELECT count(*)::int AS count FROM provider_events WHERE processed_at IS NULL`),
    q(`SELECT count(*)::int AS count FROM media_assets WHERE status='VERIFYING' AND created_at < now()-interval '30 minutes'`)
  ]);

  const queues=[];
  for(const d of drafts){
    const title=d.payload?.title?.en||d.payload?.title?.ru||d.id,flags=Array.isArray(d.risk_flags)?d.risk_flags:[],hasBlock=flags.some(x=>x?.severity==='BLOCK');
    if(d.status==='CATALOGUE_REVIEW')queues.push(makeItem('PUBLICATION',d,{severity:'MEDIUM',ownerRole:'CATALOGUER',nextAction:'REVIEW_CATALOGUE',reason:'Draft is waiting for catalogue review',entityType:'DRAFT',link:`#operator-publication-${d.id}`,metadata:{title,sellerId:d.seller_id,trustStatus:d.trust_status||'UNREVIEWED',verificationStatus:d.verification_status||'NOT_STARTED'}}));
    else{
      const trustOk=['CLEARED','CONDITIONAL'].includes(d.trust_status),kybOk=d.verification_status==='VERIFIED',ready=trustOk&&kybOk&&!hasBlock;
      queues.push(makeItem('PUBLICATION',d,{severity:hasBlock?'HIGH':'MEDIUM',ownerRole:ready?'CATALOGUER':'TRUST_REVIEWER',nextAction:ready?'PUBLISH':'CLEAR_PUBLICATION_BLOCKERS',reason:ready?'Approved draft is ready to publish':'Approved draft still has trust/KYB/risk blockers',entityType:'DRAFT',link:`#operator-publication-${d.id}`,metadata:{title,sellerId:d.seller_id,trustStatus:d.trust_status||'UNREVIEWED',verificationStatus:d.verification_status||'NOT_STARTED',riskFlags:flags}}));
    }
  }
  for(const v of verifications){
    const clientWait=v.status==='MORE_INFO_REQUIRED';
    queues.push(makeItem('VERIFICATION',v,{severity:clientWait?'LOW':'MEDIUM',ownerRole:clientWait?'CLIENT':'TRUST_REVIEWER',nextAction:clientWait?'AWAIT_CLIENT_INFORMATION':'REVIEW_VERIFICATION',reason:clientWait?'Verification is waiting for additional client information':'Verification is waiting for an operator/provider decision',entityType:'VERIFICATION',link:`#operator-verification-${v.id}`,metadata:{caseType:v.case_type,subjectType:v.subject_type,provider:v.provider,displayName:v.display_name,email:v.email,riskLevel:v.risk_level}}));
  }
  for(const d of disputes){
    const waiting=d.status==='EVIDENCE_REQUIRED';
    queues.push(makeItem('DISPUTE',d,{severity:waiting?'MEDIUM':'HIGH',ownerRole:waiting?'CLIENT':'TRUST_REVIEWER',nextAction:waiting?'AWAIT_EVIDENCE':'REVIEW_AND_RESOLVE',reason:waiting?'Dispute is waiting for participant evidence':'Open dispute requires operator review/resolution',entityType:'DISPUTE',link:`#operator-dispute-${d.id}`,metadata:{category:d.category,objectId:d.object_id,orderId:d.order_id,settlementId:d.settlement_id,summary:d.summary}}));
  }
  for(const p of payouts){
    const age=ageMinutes(p.updated_at||p.created_at),failed=p.status==='FAILED',ready=p.status==='READY',submittedStale=p.status==='SUBMITTED'&&age>=30,holdStale=p.status==='ON_HOLD'&&age>=7*24*60;
    if(!(failed||ready||submittedStale||holdStale))continue;
    queues.push(makeItem('PAYOUT',p,{severity:failed?'HIGH':submittedStale?'MEDIUM':'LOW',ownerRole:'ADMIN',nextAction:failed?'RETRY_PAYOUT':ready?'SUBMIT_PAYOUT':submittedStale?'CHECK_PROVIDER_CONFIRMATION':'REVIEW_HOLD_RELEASE',reason:failed?'Payout provider submission failed':ready?'Payout is ready for provider submission':submittedStale?'Payout has been submitted without provider confirmation for at least 30 minutes':'Payout has remained on hold for at least 7 days',entityType:'PAYOUT',link:`#operator-payout-${p.id}`,metadata:{sellerId:p.seller_id,amountMinor:Number(p.amount_minor||0),currency:p.currency,provider:p.provider,holdReason:p.hold_reason,sourceType:p.source_type,sourceId:p.source_id}}));
  }
  for(const s of settlements){
    if(s.status==='NONPAYMENT')queues.push(makeItem('SETTLEMENT',s,{severity:'HIGH',ownerRole:'ADMIN',nextAction:'REOFFER_OR_VOID',reason:'Auction settlement is in nonpayment',entityType:'SETTLEMENT',link:`#operator-settlement-${s.id}`,metadata:{auctionId:s.auction_id,objectId:s.object_id,buyerAccountId:s.buyer_account_id,sellerId:s.seller_id,amountMinor:Number(s.winning_amount_minor||0),currency:s.currency}}));
    else if(s.status==='PAYMENT_PROCESSING'&&ageMinutes(s.updated_at)>=30)queues.push(makeItem('SETTLEMENT',s,{severity:'MEDIUM',ownerRole:'ADMIN',nextAction:'CHECK_PAYMENT_PROVIDER',reason:'Settlement has remained in payment processing for at least 30 minutes',entityType:'SETTLEMENT',link:`#operator-settlement-${s.id}`,metadata:{auctionId:s.auction_id,objectId:s.object_id}}));
  }
  for(const s of shipments)queues.push(makeItem('SHIPMENT',s,{severity:s.status==='DAMAGE_REPORTED'?'HIGH':'MEDIUM',ownerRole:'ADMIN',nextAction:s.status==='DAMAGE_REPORTED'?'OPEN_OR_REVIEW_DISPUTE':'RECOVER_DELIVERY',reason:s.status==='DAMAGE_REPORTED'?'Shipment damage has been reported':'Shipment delivery failed',entityType:'SHIPMENT',link:`#operator-shipment-${s.id}`,metadata:{objectId:s.object_id,orderId:s.order_id,settlementId:s.settlement_id,provider:s.provider,trackingReference:s.tracking_reference}}));
  for(const o of outbox){
    const stale=o.status==='PROCESSING'&&ageMinutes(o.locked_at)>=10,pendingOld=o.status==='PENDING'&&new Date(o.available_at)<=new Date()&&ageMinutes(o.created_at)>=30;
    if(o.status==='DEAD'||stale||pendingOld)queues.push(makeItem('OUTBOX',o,{severity:o.status==='DEAD'?'CRITICAL':'HIGH',ownerRole:'ADMIN',nextAction:o.status==='DEAD'?'REVIEW_DEAD_EVENT':stale?'RECOVER_STALE_LEASE':'CHECK_WORKER_BACKLOG',reason:o.status==='DEAD'?'Outbox event exhausted retries':stale?'Outbox event has a stale processing lease':'Outbox event has been pending for at least 30 minutes',entityType:'OUTBOX_EVENT',link:'#operator-system-outbox',metadata:{topic:o.topic,aggregateType:o.aggregate_type,aggregateId:o.aggregate_id,attemptCount:o.attempt_count,maxAttempts:o.max_attempts,lastError:o.last_error,lockedBy:o.locked_by}}));
  }
  for(const p of providerEvents){
    const failed=Boolean(p.last_error),stale=Boolean(p.processing_started_at)&&ageMinutes(p.processing_started_at)>=10,old=ageMinutes(p.created_at)>=30;
    if(failed||stale||old)queues.push(makeItem('PROVIDER_EVENT',p,{severity:failed?'CRITICAL':'HIGH',ownerRole:'ADMIN',nextAction:failed?'RETRY_PROVIDER_EVENT':stale?'RECOVER_PROVIDER_CLAIM':'CHECK_PROVIDER_EVENT',reason:failed?'Provider event application failed':stale?'Provider event claim appears stale':'Provider event has remained unprocessed for at least 30 minutes',entityType:'PROVIDER_EVENT',link:'#operator-system-providers',metadata:{providerType:p.provider_type,provider:p.provider,externalEventId:p.external_event_id,eventType:p.event_type,targetType:p.entity_type,targetId:p.entity_id,attemptCount:p.attempt_count,lastError:p.last_error}}));
  }
  for(const m of media)if(m.status==='VERIFYING'&&ageMinutes(m.created_at)>=30)queues.push(makeItem('MEDIA',m,{severity:'MEDIUM',ownerRole:'ADMIN',nextAction:'RECOVER_MEDIA_VERIFICATION',reason:'Media has remained VERIFYING for at least 30 minutes',entityType:'MEDIA',link:`#operator-media-${m.id}`,metadata:{entityType:m.entity_type,entityId:m.entity_id,role:m.role,contentType:m.content_type}}));

  sortItems(queues);
  const visible=queues.slice(0,limit),truncated=queues.length>limit||[drafts,verifications,disputes,payouts,settlements,shipments,outbox,providerEvents,media].some(x=>x.length>=limit),domainQueues=visible.reduce((a,x)=>(a[x.kind]=(a[x.kind]||0)+1,a),{}),critical=visible.filter(x=>x.severity==='CRITICAL').length,high=visible.filter(x=>x.severity==='HIGH').length,systemIncidents=visible.filter(x=>['OUTBOX','PROVIDER_EVENT','MEDIA'].includes(x.kind)&&['CRITICAL','HIGH'].includes(x.severity)).length;
  return{
    generatedAt:new Date().toISOString(),capabilities:operatorCockpitCapabilities(),persistence:{kind:db.kind,durable:true},integrations,reconciliation,
    summary:{actionable:visible.length,critical,high,systemIncidents,domainQueues,truncated,limit},queues:visible,
    system:{preview:PREVIEW,outbox:byStatus(outboxCounts),unprocessedProviderEvents:Number(providerCount[0]?.count||0),staleMediaVerifications:Number(staleMediaCount[0]?.count||0)},
    recentLifecycle:lifecycle.map(x=>({id:x.id,domain:x.domain,aggregateId:x.aggregate_id,action:x.action,from:x.from_state,to:x.to_state,authority:x.authority,outboxTopic:x.outbox_topic,metadata:x.metadata||{},createdAt:iso(x.created_at)}))
  };
}
