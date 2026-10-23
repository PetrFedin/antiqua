import assert from 'node:assert/strict';
import {buildBuyerDiligenceV90,BUYER_DILIGENCE_SCHEMA_V90} from '../buyer-diligence-v90.mjs';
const buyer='buyer-01',objectId='lot-109',listingId='lst-109';
const at=(day)=>new Date(Date.UTC(2026,9,day)).toISOString();
const msg=(id,sender,day,{topic}={})=>({
 id,senderAccountId:sender,senderRole:sender===buyer?'BUYER':'SELLER',
 createdAt:at(day),
 body:'SECRET_CLIENT_MESSAGE_'+id,
 attachments:topic?[{kind:'INQUIRY_CONTEXT',inquiryType:topic,
  privateDocumentUrl:'s3://SECRET_V90'}]:[]
});
const make=(rest={})=>({
 buyerAccountId:buyer,objectId,listingId,conversations:[],conditionRequests:[],
 ...rest
});
const empty=buildBuyerDiligenceV90(make());
assert.equal(empty.schemaVersion,BUYER_DILIGENCE_SCHEMA_V90);
assert.equal(empty.scope,'CURRENT_BUYER_ONLY');
assert.equal(empty.authority,'BUYER_SCOPED_WORKFLOW_EVENTS');
assert.deepEqual(empty.tracks.map(x=>x.state),['NOT_REQUESTED','NOT_REQUESTED']);
assert.deepEqual(empty.summary,{tracks:2,initiated:0,repliedOrPublished:0});
assert.equal(empty.limitations.authenticityCertified,false);
assert.equal(empty.limitations.legalTitleVerified,false);
assert.equal(empty.limitations.sourceDocumentsDelivered,false);
assert.equal(empty.limitations.privateDocumentAccessGranted,false);
const conversation={
 id:'cv-1',buyerAccountId:buyer,objectId,listingId,
 messages:[
  msg('m1',buyer,10,{topic:'PROVENANCE'}),
  msg('m2','seller-1',11),
  msg('m3',buyer,12,{topic:'SHIPPING'}),
  msg('m4',buyer,13,{topic:'PROVENANCE'}),
  msg('m5','seller-1',14)
 ]
};
const condition={
 id:'cr-1',buyerAccountId:buyer,objectId,listingId,
 status:'REQUESTED',updatedAt:at(16),
 currentReportVersion:null,versions:[],
 privateFileUrl:'s3://SECRET_CONDITION_V90'
};
const unrelated={
 ...conversation,id:'cv-out',
 buyerAccountId:'buyer-other',messages:[msg('other',buyer,15,{topic:'PROVENANCE'})]
};
const crossLot={...condition,id:'cr-lot-110',objectId:'lot-110',status:'FULFILLED',
 currentReportVersion:1,versions:[{versionNo:1}]};
const source=make({
 conversations:[conversation,unrelated,{
  ...conversation,id:'cv-other-listing',listingId:'lst-110'
 }],
 conditionRequests:[condition,crossLot]
});
const snapshot=structuredClone(source);
const report=buildBuyerDiligenceV90(source);
assert.equal(report.tracks[0].state,'SELLER_REPLIED');
assert.equal(report.tracks[0].updatedAt,at(14));
assert.equal(report.tracks[1].state,'REQUESTED');
assert.deepEqual(report.summary,{tracks:2,initiated:2,repliedOrPublished:1});
assert.deepEqual(source,snapshot,'pure read model must not mutate authorized inputs');
for(const secret of ['SECRET_CLIENT_MESSAGE','SECRET_CONDITION','SECRET_V90',
 'cv-1','buyer-other','seller-1','cr-1']){
 assert.ok(!JSON.stringify(report).includes(secret),'source data leaked: '+secret);
}
const answered=buildBuyerDiligenceV90(make({
 conversations:[conversation],
 conditionRequests:[{...condition,status:'FULFILLED',currentReportVersion:2,
  updatedAt:at(20),versions:[{versionNo:1},{versionNo:2}]}]
}));
assert.deepEqual(answered.tracks.map(x=>x.state),['SELLER_REPLIED','REPORT_PUBLISHED']);
assert.deepEqual(answered.summary,{tracks:2,initiated:2,repliedOrPublished:2});
const unsigned=buildBuyerDiligenceV90(make({
 conditionRequests:[{...condition,status:'FULFILLED',currentReportVersion:2,
  versions:[{versionNo:1}]}]
}));
assert.equal(unsigned.tracks[1].state,'REQUESTED',
 'a missing current report version cannot count as published');
const cancelled=buildBuyerDiligenceV90(make({
 conditionRequests:[{...condition,status:'CANCELLED'}]
}));
assert.equal(cancelled.tracks[1].state,'CANCELLED');
assert.equal(cancelled.summary.initiated,0);
const followup=buildBuyerDiligenceV90(make({
 conversations:[{...conversation,messages:[
  msg('m1',buyer,10,{topic:'PROVENANCE'}),
  msg('m2','seller-1',11),
  msg('m3',buyer,12,{topic:'PROVENANCE'})
 ]}]
}));
assert.equal(followup.tracks[0].state,'SENT','older replies cannot resolve a newer request');
for(const candidate of [
 make({buyerAccountId:'!private'}),
 make({objectId:''}),
 make({listingId:'not/allowed'}),
 make({conversations:'not an array'})
]){
 assert.throws(()=>buildBuyerDiligenceV90(candidate),x=>x.code==='BUYER_SCOPE_REQUIRED');
}
console.log('ANTIQUA v90 buyer diligence — exact buyer/listing scope, last-request reply, report versions, privacy and no fabricated certification PASS');
