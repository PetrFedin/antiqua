import assert from 'node:assert/strict';
import {canLifecycleTransition,inferLifecycleAuthority,lifecycleCapabilities,planLifecycleTransition} from '../lifecycle-authority-v16.mjs';

const ok=input=>planLifecycleTransition(input);
const denied=(input,code)=>{const x=canLifecycleTransition(input);assert.equal(x.allowed,false,JSON.stringify(input));assert.equal(x.error.code,code);return x.error};

{
  const x=ok({domain:'ORDER',from:'AWAITING_PAYMENT_CONNECTOR',to:'PAID',action:'CAPTURE_PAYMENT',authority:'PROVIDER',facts:{PAYMENT_EFFECT_RECORDED:true}});
  assert.equal(x.outboxTopic,'ORDER.PAID');
  denied({domain:'ORDER',from:'AWAITING_PAYMENT_CONNECTOR',to:'PAID',action:'CAPTURE_PAYMENT',authority:'PROVIDER'},'LIFECYCLE_PRECONDITION_FAILED');
  denied({domain:'ORDER',from:'AWAITING_PAYMENT_CONNECTOR',to:'CANCELLED',action:'CANCEL',authority:'SELLER'},'LIFECYCLE_AUTHORITY_DENIED');
}

{
  ok({domain:'SETTLEMENT',from:'PAYMENT_DUE',to:'PAID',action:'CAPTURE_PAYMENT',authority:'PROVIDER',facts:{PAYMENT_EFFECT_RECORDED:true}});
  denied({domain:'SETTLEMENT',from:'PAID',to:'NONPAYMENT',action:'MARK_NONPAYMENT',authority:'OPERATOR'},'LIFECYCLE_TRANSITION_INVALID');
  assert.equal(ok({domain:'SETTLEMENT',from:'NONPAYMENT',to:'REOFFERED',action:'REOFFER',authority:'OPERATOR'}).terminal,true);
}

{
  denied({domain:'SHIPMENT',from:'PACKING',to:'IN_TRANSIT',action:'DISPATCH',authority:'SELLER'},'LIFECYCLE_PRECONDITION_FAILED');
  ok({domain:'SHIPMENT',from:'PACKING',to:'IN_TRANSIT',action:'DISPATCH',authority:'SELLER',facts:{PROVIDER_EVENT_OR_PREVIEW:true}});
  denied({domain:'SHIPMENT',from:'PACKING',to:'IN_TRANSIT',action:'DISPATCH',authority:'PROVIDER'},'LIFECYCLE_PRECONDITION_FAILED');
  ok({domain:'SHIPMENT',from:'PACKING',to:'IN_TRANSIT',action:'DISPATCH',authority:'PROVIDER',facts:{PROVIDER_EVENT_OR_PREVIEW:true}});
  ok({domain:'SHIPMENT',from:'QUOTE_REQUIRED',to:'QUOTED',action:'QUOTE',authority:'BUYER',facts:{QUOTE_AVAILABLE:true}});
  denied({domain:'SHIPMENT',from:'IN_TRANSIT',to:'DELIVERED',action:'DELIVER',authority:'BUYER',facts:{PROVIDER_EVENT_OR_PREVIEW:true}},'LIFECYCLE_AUTHORITY_DENIED');
}

{
  denied({domain:'PAYOUT',from:'SUBMITTED',to:'PAID',action:'MARK_PAID',authority:'OPERATOR'},'LIFECYCLE_PRECONDITION_FAILED');
  ok({domain:'PAYOUT',from:'SUBMITTED',to:'PAID',action:'MARK_PAID',authority:'OPERATOR',facts:{PROVIDER_EVENT_OR_PREVIEW:true}});
  ok({domain:'PAYOUT',from:'SUBMITTED',to:'PAID',action:'MARK_PAID',authority:'PROVIDER',facts:{PROVIDER_EVENT_OR_PREVIEW:true}});
  ok({domain:'PAYOUT',from:'FAILED',to:'READY',action:'RETRY',authority:'OPERATOR'});
}

{
  denied({domain:'DISPUTE',from:'UNDER_REVIEW',to:'PARTIAL_REFUND',action:'PARTIAL_REFUND',authority:'OPERATOR'},'LIFECYCLE_PRECONDITION_FAILED');
  ok({domain:'DISPUTE',from:'UNDER_REVIEW',to:'PARTIAL_REFUND',action:'PARTIAL_REFUND',authority:'OPERATOR',facts:{REFUND_EFFECT_RECORDED:true}});
  ok({domain:'DISPUTE',from:'UNDER_REVIEW',to:'UNDER_REVIEW',action:'CONTINUE_REVIEW',authority:'OPERATOR'});
  denied({domain:'DISPUTE',from:'FULL_REFUND',to:'CLOSED',action:'CLOSE',authority:'OPERATOR'},'LIFECYCLE_TRANSITION_INVALID');
}

{
  denied({domain:'VERIFICATION',from:'IN_PROGRESS',to:'MORE_INFO_REQUIRED',action:'REQUEST_MORE_INFO',authority:'PROVIDER'},'LIFECYCLE_PRECONDITION_FAILED');
  ok({domain:'VERIFICATION',from:'IN_PROGRESS',to:'MORE_INFO_REQUIRED',action:'REQUEST_MORE_INFO',authority:'PROVIDER',facts:{DECISION_SOURCE_VERIFIED:true}});
  ok({domain:'VERIFICATION',from:'IN_PROGRESS',to:'IN_PROGRESS',action:'REFRESH_REVIEW',authority:'PROVIDER',facts:{DECISION_SOURCE_VERIFIED:true}});
  assert.equal(ok({domain:'VERIFICATION',from:'VERIFIED',to:'EXPIRED',action:'EXPIRE',authority:'OPERATOR',facts:{DECISION_SOURCE_VERIFIED:true}}).terminal,true);
}

{
  const all={CHECKLIST_READY:true,CATALOGUE_APPROVED:true,TRUST_ALLOWED:true,SELLER_VERIFIED:true,NO_BLOCKING_RISK:true};
  denied({domain:'PUBLICATION',from:'APPROVED',to:'PUBLISHED',action:'PUBLISH',authority:'SELLER',facts:all},'LIFECYCLE_AUTHORITY_DENIED');
  denied({domain:'PUBLICATION',from:'APPROVED',to:'PUBLISHED',action:'PUBLISH',authority:'OPERATOR',facts:{CHECKLIST_READY:true,CATALOGUE_APPROVED:true,TRUST_ALLOWED:true,SELLER_VERIFIED:true}},'LIFECYCLE_PRECONDITION_FAILED');
  const x=ok({domain:'PUBLICATION',from:'APPROVED',to:'PUBLISHED',action:'PUBLISH',authority:'OPERATOR',facts:all});
  assert.equal(x.terminal,true);
}

{
  denied({domain:'MEDIA',from:'VERIFYING',to:'READY',action:'MARK_READY',authority:'SYSTEM'},'LIFECYCLE_PRECONDITION_FAILED');
  ok({domain:'MEDIA',from:'UPLOADING',to:'VERIFYING',action:'BEGIN_VERIFY',authority:'SELLER'});
  ok({domain:'MEDIA',from:'VERIFYING',to:'VERIFYING',action:'RETRY_VERIFY',authority:'SELLER'});
  ok({domain:'MEDIA',from:'VERIFYING',to:'READY',action:'MARK_READY',authority:'SYSTEM',facts:{STORAGE_VERIFIED:true}});
  ok({domain:'MEDIA',from:'VERIFYING',to:'REJECTED',action:'REJECT',authority:'SYSTEM',facts:{STORAGE_VERIFICATION_FAILED:true}});
  denied({domain:'MEDIA',from:'READY',to:'REJECTED',action:'REJECT',authority:'SYSTEM',facts:{STORAGE_VERIFICATION_FAILED:true}},'LIFECYCLE_TRANSITION_INVALID');
}

{
  assert.equal(inferLifecycleAuthority({source:'PROVIDER'}),'PROVIDER');
  assert.equal(inferLifecycleAuthority({source:'SYSTEM'}),'SYSTEM');
  assert.equal(inferLifecycleAuthority({account:{id:'op',roles:['TRUST_REVIEWER']}}),'OPERATOR');
  assert.equal(inferLifecycleAuthority({account:{id:'buyer',roles:['BUYER']},resource:{buyerAccountId:'buyer'}}),'BUYER');
  assert.equal(inferLifecycleAuthority({account:{id:'seller-account',sellerId:'seller-1',roles:['SELLER']},resource:{sellerId:'seller-1'}}),'SELLER');
}

const capabilities=lifecycleCapabilities();
assert.deepEqual(Object.keys(capabilities).sort(),['DISPUTE','MEDIA','ORDER','PAYOUT','PUBLICATION','SETTLEMENT','SHIPMENT','VERIFICATION']);
for(const [domain,d] of Object.entries(capabilities)){assert.ok(d.initial,domain);assert.ok(d.transitions.length>0,domain);for(const t of d.transitions){assert.ok(t.action);assert.ok(t.from.length);assert.ok(t.to);assert.ok(t.authorities.length);assert.ok(t.auditAction);assert.ok(t.outboxTopic)}}

console.log('ANTIQUA lifecycle authority v16: 8 domains + authority + preconditions + retry/preview + terminal/negative contracts passed');
