export const LIFECYCLE_CONTRACT_VERSION='v16';

const up=v=>String(v??'').trim().toUpperCase();
const arr=v=>Array.isArray(v)?v:[v];
const rule=(action,from,to,authorities,{preconditions=[],auditAction=null,outboxTopic=null}={})=>Object.freeze({
  action:up(action),from:Object.freeze(arr(from).map(up)),to:up(to),authorities:Object.freeze(arr(authorities).map(up)),preconditions:Object.freeze(preconditions.map(up)),auditAction:auditAction?up(auditAction):null,outboxTopic:outboxTopic?up(outboxTopic):null
});

const DEFINITIONS=Object.freeze({
  ORDER:Object.freeze({
    initial:'AWAITING_PAYMENT_CONNECTOR',terminal:Object.freeze(['PAID','CANCELLED']),transitions:Object.freeze([
      rule('CREATE',['NONE','NEW'],'AWAITING_PAYMENT_CONNECTOR',['BUYER','SYSTEM'],{auditAction:'ORDER_CREATED',outboxTopic:'ORDER.CREATED'}),
      rule('CAPTURE_PAYMENT','AWAITING_PAYMENT_CONNECTOR','PAID',['PROVIDER','SYSTEM','BUYER'],{preconditions:['PAYMENT_EFFECT_RECORDED'],auditAction:'ORDER_PAID',outboxTopic:'ORDER.PAID'}),
      rule('CANCEL','AWAITING_PAYMENT_CONNECTOR','CANCELLED',['BUYER','OPERATOR'],{auditAction:'ORDER_CANCELLED',outboxTopic:'ORDER.CANCELLED'})
    ])
  }),
  SETTLEMENT:Object.freeze({
    initial:'PAYMENT_DUE',terminal:Object.freeze(['COMPLETED','REOFFERED','VOID']),transitions:Object.freeze([
      rule('START_PAYMENT','PAYMENT_DUE','PAYMENT_PROCESSING',['BUYER','SYSTEM']),
      rule('CAPTURE_PAYMENT',['PAYMENT_DUE','PAYMENT_PROCESSING'],'PAID',['PROVIDER','SYSTEM','BUYER'],{preconditions:['PAYMENT_EFFECT_RECORDED'],outboxTopic:'SETTLEMENT.PAID'}),
      rule('RESET_PAYMENT','PAYMENT_PROCESSING','PAYMENT_DUE',['PROVIDER','SYSTEM','OPERATOR']),
      rule('MARK_NONPAYMENT','PAYMENT_DUE','NONPAYMENT',['SYSTEM','OPERATOR'],{outboxTopic:'SETTLEMENT.NONPAYMENT'}),
      rule('START_FULFILLMENT','PAID','FULFILLMENT',['SELLER','SYSTEM','OPERATOR']),
      rule('OPEN_DISPUTE',['PAID','FULFILLMENT'],'DISPUTED',['BUYER','SELLER','SYSTEM','OPERATOR'],{outboxTopic:'SETTLEMENT.DISPUTED'}),
      rule('COMPLETE',['FULFILLMENT','DISPUTED'],'COMPLETED',['SYSTEM','OPERATOR'],{outboxTopic:'SETTLEMENT.COMPLETED'}),
      rule('REOFFER','NONPAYMENT','REOFFERED',['SYSTEM','OPERATOR']),
      rule('VOID',['PAYMENT_DUE','PAYMENT_PROCESSING','NONPAYMENT','DISPUTED'],'VOID',['SYSTEM','OPERATOR'])
    ])
  }),
  SHIPMENT:Object.freeze({
    initial:'QUOTE_REQUIRED',terminal:Object.freeze(['DELIVERED','CANCELLED']),transitions:Object.freeze([
      rule('QUOTE','QUOTE_REQUIRED','QUOTED',['SELLER','OPERATOR','SYSTEM'],{preconditions:['QUOTE_AVAILABLE'],outboxTopic:'SHIPMENT.QUOTED'}),
      rule('BOOK','QUOTED','BOOKED',['SELLER','OPERATOR','PROVIDER','SYSTEM']),
      rule('PACK','BOOKED','PACKING',['SELLER','OPERATOR','SYSTEM']),
      rule('DISPATCH',['PACKING','DELIVERY_FAILED'],'IN_TRANSIT',['PROVIDER','OPERATOR','SYSTEM'],{preconditions:['PROVIDER_EVENT_OR_PREVIEW'],outboxTopic:'SHIPMENT.IN_TRANSIT'}),
      rule('MARK_COLLECTION_READY','PACKING','COLLECTION_READY',['SELLER','OPERATOR','SYSTEM']),
      rule('DELIVER',['IN_TRANSIT','COLLECTION_READY','DAMAGE_REPORTED'],'DELIVERED',['PROVIDER','OPERATOR','SYSTEM'],{preconditions:['PROVIDER_EVENT_OR_PREVIEW'],outboxTopic:'SHIPMENT.DELIVERED'}),
      rule('DELIVERY_FAILED','IN_TRANSIT','DELIVERY_FAILED',['PROVIDER','OPERATOR','SYSTEM'],{preconditions:['PROVIDER_EVENT_OR_PREVIEW']}),
      rule('REPORT_DAMAGE','IN_TRANSIT','DAMAGE_REPORTED',['PROVIDER','OPERATOR','SYSTEM'],{preconditions:['PROVIDER_EVENT_OR_PREVIEW'],outboxTopic:'SHIPMENT.DAMAGE_REPORTED'}),
      rule('CANCEL',['QUOTE_REQUIRED','QUOTED','BOOKED','PACKING','COLLECTION_READY','DELIVERY_FAILED'],'CANCELLED',['SELLER','OPERATOR','SYSTEM'])
    ])
  }),
  PAYOUT:Object.freeze({
    initial:'ON_HOLD',terminal:Object.freeze(['PAID','REVERSED']),transitions:Object.freeze([
      rule('RELEASE_HOLD','ON_HOLD','READY',['OPERATOR','SYSTEM']),
      rule('SUBMIT','READY','SUBMITTED',['PROVIDER','SYSTEM'],{preconditions:['PROVIDER_EVENT_OR_PREVIEW'],outboxTopic:'PAYOUT.SUBMITTED'}),
      rule('MARK_PAID','SUBMITTED','PAID',['PROVIDER','SYSTEM'],{preconditions:['PROVIDER_EVENT_OR_PREVIEW'],outboxTopic:'PAYOUT.PAID'}),
      rule('MARK_FAILED','SUBMITTED','FAILED',['PROVIDER','SYSTEM'],{preconditions:['PROVIDER_EVENT_OR_PREVIEW'],outboxTopic:'PAYOUT.FAILED'}),
      rule('RETRY','FAILED','READY',['OPERATOR','SYSTEM']),
      rule('REVERSE',['ON_HOLD','READY','FAILED'],'REVERSED',['OPERATOR','SYSTEM'],{outboxTopic:'PAYOUT.REVERSED'})
    ])
  }),
  DISPUTE:Object.freeze({
    initial:'OPEN',terminal:Object.freeze(['RESOLVED_BUYER','RESOLVED_SELLER','PARTIAL_REFUND','FULL_REFUND','CLOSED']),transitions:Object.freeze([
      rule('OPEN',['NONE','NEW'],'OPEN',['BUYER','SELLER','SYSTEM'],{outboxTopic:'DISPUTE.OPENED'}),
      rule('ADD_EVIDENCE','OPEN','UNDER_REVIEW',['BUYER','SELLER','OPERATOR','SYSTEM']),
      rule('REQUEST_EVIDENCE',['OPEN','UNDER_REVIEW'],'EVIDENCE_REQUIRED',['OPERATOR','SYSTEM']),
      rule('RESUME_REVIEW','EVIDENCE_REQUIRED','UNDER_REVIEW',['OPERATOR','SYSTEM']),
      rule('RESOLVE_BUYER',['OPEN','UNDER_REVIEW','EVIDENCE_REQUIRED'],'RESOLVED_BUYER',['OPERATOR','SYSTEM'],{outboxTopic:'DISPUTE.RESOLVED_BUYER'}),
      rule('RESOLVE_SELLER',['OPEN','UNDER_REVIEW','EVIDENCE_REQUIRED'],'RESOLVED_SELLER',['OPERATOR','SYSTEM'],{outboxTopic:'DISPUTE.RESOLVED_SELLER'}),
      rule('PARTIAL_REFUND',['OPEN','UNDER_REVIEW','EVIDENCE_REQUIRED'],'PARTIAL_REFUND',['OPERATOR','SYSTEM'],{preconditions:['REFUND_EFFECT_RECORDED'],outboxTopic:'DISPUTE.PARTIAL_REFUND'}),
      rule('FULL_REFUND',['OPEN','UNDER_REVIEW','EVIDENCE_REQUIRED'],'FULL_REFUND',['OPERATOR','SYSTEM'],{preconditions:['REFUND_EFFECT_RECORDED'],outboxTopic:'DISPUTE.FULL_REFUND'}),
      rule('CLOSE',['OPEN','UNDER_REVIEW','EVIDENCE_REQUIRED'],'CLOSED',['OPERATOR','SYSTEM'])
    ])
  }),
  VERIFICATION:Object.freeze({
    initial:'PENDING',terminal:Object.freeze(['REJECTED','EXPIRED']),transitions:Object.freeze([
      rule('START',['NONE','NOT_STARTED'],'PENDING',['BUYER','SELLER','SYSTEM'],{outboxTopic:'VERIFICATION.PENDING'}),
      rule('BEGIN_REVIEW',['PENDING','MORE_INFO_REQUIRED'],'IN_PROGRESS',['PROVIDER','OPERATOR','SYSTEM'],{preconditions:['DECISION_SOURCE_VERIFIED']}),
      rule('REQUEST_MORE_INFO',['PENDING','IN_PROGRESS'],'MORE_INFO_REQUIRED',['PROVIDER','OPERATOR','SYSTEM'],{preconditions:['DECISION_SOURCE_VERIFIED'],outboxTopic:'VERIFICATION.MORE_INFO_REQUIRED'}),
      rule('RETURN_PENDING',['IN_PROGRESS','MORE_INFO_REQUIRED'],'PENDING',['PROVIDER','OPERATOR','SYSTEM'],{preconditions:['DECISION_SOURCE_VERIFIED']}),
      rule('VERIFY',['PENDING','IN_PROGRESS','MORE_INFO_REQUIRED'],'VERIFIED',['PROVIDER','OPERATOR','SYSTEM'],{preconditions:['DECISION_SOURCE_VERIFIED'],outboxTopic:'VERIFICATION.VERIFIED'}),
      rule('REJECT',['PENDING','IN_PROGRESS','MORE_INFO_REQUIRED'],'REJECTED',['PROVIDER','OPERATOR','SYSTEM'],{preconditions:['DECISION_SOURCE_VERIFIED'],outboxTopic:'VERIFICATION.REJECTED'}),
      rule('EXPIRE',['PENDING','IN_PROGRESS','MORE_INFO_REQUIRED','VERIFIED'],'EXPIRED',['PROVIDER','OPERATOR','SYSTEM'],{preconditions:['DECISION_SOURCE_VERIFIED'],outboxTopic:'VERIFICATION.EXPIRED'})
    ])
  }),
  PUBLICATION:Object.freeze({
    initial:'DRAFT',terminal:Object.freeze(['PUBLISHED']),transitions:Object.freeze([
      rule('SUBMIT','DRAFT','CATALOGUE_REVIEW',['SELLER'],{preconditions:['CHECKLIST_READY'],outboxTopic:'PUBLICATION.CATALOGUE_REVIEW'}),
      rule('RESUBMIT','CHANGES_REQUESTED','DRAFT',['SELLER']),
      rule('REQUEST_CHANGES','CATALOGUE_REVIEW','CHANGES_REQUESTED',['OPERATOR'],{outboxTopic:'PUBLICATION.CHANGES_REQUESTED'}),
      rule('APPROVE','CATALOGUE_REVIEW','APPROVED',['OPERATOR'],{preconditions:['CHECKLIST_READY'],outboxTopic:'PUBLICATION.APPROVED'}),
      rule('PUBLISH','APPROVED','PUBLISHED',['OPERATOR'],{preconditions:['CHECKLIST_READY','CATALOGUE_APPROVED','TRUST_ALLOWED','SELLER_VERIFIED'],outboxTopic:'PUBLICATION.PUBLISHED'})
    ])
  }),
  MEDIA:Object.freeze({
    initial:'UPLOADING',terminal:Object.freeze(['READY','REJECTED','ARCHIVED']),transitions:Object.freeze([
      rule('BEGIN_VERIFY','UPLOADING','VERIFYING',['SELLER','OPERATOR','SYSTEM']),
      rule('MARK_READY','VERIFYING','READY',['SYSTEM','SELLER','OPERATOR'],{preconditions:['STORAGE_VERIFIED'],outboxTopic:'MEDIA.READY'}),
      rule('REJECT',['UPLOADING','VERIFYING'],'REJECTED',['SYSTEM','SELLER','OPERATOR'],{preconditions:['STORAGE_VERIFICATION_FAILED'],outboxTopic:'MEDIA.REJECTED'}),
      rule('ARCHIVE','READY','ARCHIVED',['SELLER','OPERATOR','SYSTEM'])
    ])
  })
});

const error=(message,{status=409,code='LIFECYCLE_TRANSITION_INVALID',details={}}={})=>Object.assign(new Error(message),{status,code,lifecycle:details});

export function inferLifecycleAuthority({account=null,resource=null,source='USER'}={}){
  const s=up(source);
  if(s==='PROVIDER')return'PROVIDER';
  if(s==='SYSTEM')return'SYSTEM';
  if(account?.roles?.some(r=>['ADMIN','TRUST_REVIEWER','CATALOGUER'].includes(up(r))))return'OPERATOR';
  if(resource&&account?.id&&String(resource.buyerAccountId||resource.buyerClientId||resource.openedByAccountId||'')===String(account.id))return'BUYER';
  if(resource&&account?.sellerId&&String(resource.sellerId||'')===String(account.sellerId))return'SELLER';
  if(account?.roles?.some(r=>up(r)==='SELLER'))return'SELLER';
  if(account?.roles?.some(r=>up(r)==='BUYER'))return'BUYER';
  return'ANONYMOUS';
}

export function lifecycleDefinition(domain){
  const d=DEFINITIONS[up(domain)];
  if(!d)throw error(`Unknown lifecycle domain ${domain}`,{status:400,code:'LIFECYCLE_DOMAIN_UNKNOWN',details:{domain:up(domain)}});
  return d;
}

export function planLifecycleTransition({domain,from,to,action=null,authority,facts={}}){
  domain=up(domain);from=up(from||'NONE');to=up(to);action=action?up(action):null;authority=up(authority);
  const d=lifecycleDefinition(domain),matches=d.transitions.filter(r=>r.from.includes(from)&&r.to===to&&(!action||r.action===action));
  if(!matches.length)throw error(`Invalid ${domain} transition ${from} -> ${to}`,{details:{domain,from,to,action,authority}});
  if(matches.length>1&&!action)throw error(`Ambiguous ${domain} transition ${from} -> ${to}`,{status:400,code:'LIFECYCLE_ACTION_REQUIRED',details:{domain,from,to,authority,actions:matches.map(r=>r.action)}});
  const r=matches[0];
  if(!r.authorities.includes(authority))throw error(`${authority||'ANONYMOUS'} cannot perform ${domain}.${r.action}`,{status:403,code:'LIFECYCLE_AUTHORITY_DENIED',details:{domain,from,to,action:r.action,authority,allowed:r.authorities}});
  const missing=r.preconditions.filter(k=>facts[k]!==true);
  if(missing.length)throw error(`Lifecycle preconditions failed for ${domain}.${r.action}`,{code:'LIFECYCLE_PRECONDITION_FAILED',details:{domain,from,to,action:r.action,authority,missing}});
  return Object.freeze({contractVersion:LIFECYCLE_CONTRACT_VERSION,domain,action:r.action,from,to,authority,preconditions:r.preconditions,auditAction:r.auditAction||`${domain}_${r.action}`,outboxTopic:r.outboxTopic||`${domain}.${r.action}`,terminal:d.terminal.includes(to)});
}

export function canLifecycleTransition(input){try{return{allowed:true,plan:planLifecycleTransition(input)}}catch(e){return{allowed:false,error:{status:e.status||409,code:e.code||'LIFECYCLE_TRANSITION_INVALID',message:e.message,details:e.lifecycle||{}}}}}

export function lifecycleCapabilities(){return Object.fromEntries(Object.entries(DEFINITIONS).map(([domain,d])=>[domain,{initial:d.initial,terminal:[...d.terminal],transitions:d.transitions.map(r=>({action:r.action,from:[...r.from],to:r.to,authorities:[...r.authorities],preconditions:[...r.preconditions],auditAction:r.auditAction||`${domain}_${r.action}`,outboxTopic:r.outboxTopic||`${domain}.${r.action}`}))}]))}
