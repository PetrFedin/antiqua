import assert from 'node:assert/strict';
import {buildDealerLeadProjection,dealerLeadCapabilities} from '../dealer-leads-v24.mjs';

const now=Date.parse('2026-09-25T12:00:00.000Z');
const t=minutes=>new Date(now+minutes*60000).toISOString();
const account={id:'acct-seller',sellerId:'seller-1',roles:['SELLER']};
const obj=id=>({id:'obj-'+id,objectCode:'AQ-'+id,title:{en:'Object '+id,ru:'Предмет '+id}});
const listing=(id,objectId,price,currency='EUR')=>({id:'lst-'+id,objectId:'obj-'+objectId,lotId:'obj-'+objectId,status:'ACTIVE',price,currency});
const conversation=(id,buyer,listingId,objectId,messages,unreadCount=0)=>({
 id:'cnv-'+id,buyerAccountId:buyer,sellerId:'seller-1',listingId:'lst-'+listingId,objectId:'obj-'+objectId,status:'OPEN',
 createdAt:messages[0]?.createdAt,updatedAt:messages.at(-1)?.createdAt,lastMessage:messages.at(-1),unreadCount
});
const message=(id,role,at)=>({id:'msg-'+id,senderRole:role,senderAccountId:role==='BUYER'?'buyer-'+id:'acct-seller',body:id,createdAt:at});
const offer=(id,buyer,listingId,objectId,status,amount,currency,awaitingRole,history,acceptedOrderId=null)=>({
 id:'off-'+id,buyerAccountId:buyer,sellerId:'seller-1',listingId:'lst-'+listingId,objectId:'obj-'+objectId,status,
 currentAmountMinor:amount,currency,currentProposerRole:history.at(-1)?.actorRole||'BUYER',awaitingRole,version:history.length,
 acceptedOrderId,createdAt:history[0].createdAt,updatedAt:history.at(-1).createdAt,history
});
const event=(type,role,at)=>({eventType:type,actorRole:role,createdAt:at});

const threads=[],conversations=[];
function addConversation(id,buyer,listingId,objectId,msgs,unread=0){
 const c=conversation(id,buyer,listingId,objectId,msgs,unread);conversations.push(c);threads.push({...c,messages:msgs})
}

addConversation('unanswered','buyer-1','1','1',[message('u1','BUYER',t(-180))],1);
addConversation('replied','buyer-2','2','2',[message('r1','BUYER',t(-180)),message('r2','SELLER',t(-120))],0);

const viewingRequests=[{
 id:'vwq-3',buyerAccountId:'buyer-3',sellerId:'seller-1',listingId:'lst-3',objectId:'obj-3',
 status:'REQUESTED',version:1,createdAt:t(-120),updatedAt:t(-120),
 history:[event('REQUESTED','BUYER',t(-120))]
}];

const offers=[
 offer('4','buyer-4','4','4','OPEN',700000,'EUR','SELLER',[event('CREATED','BUYER',t(-30))]),
 offer('5','buyer-5','5','5','ACCEPTED',900000,'EUR',null,[event('CREATED','BUYER',t(-120)),event('ACCEPTED','SELLER',t(-60))],'ord-5'),
 offer('6','buyer-6','6','6','REJECTED',450000,'EUR',null,[event('CREATED','BUYER',t(-180)),event('REJECTED','SELLER',t(-120))])
];

const conditionRequests=[];
const listings=[
 listing('1','1',10000,'EUR'),listing('2','2',5000,'USD'),listing('3','3',12000,'EUR'),
 listing('4','4',10000,'EUR'),listing('5','5',11000,'EUR'),listing('6','6',6000,'EUR')
];
const objects=['1','2','3','4','5','6'].map(obj);

const cockpit=buildDealerLeadProjection({
 account,conversations,threads,offers,conditionRequests,viewingRequests,listings,objects,nowMs:now,slaMinutes:60
});

assert.equal(dealerLeadCapabilities().projectionOnly,true);
assert.equal(cockpit.leads.length,6);
const byBuyer=new Map(cockpit.leads.map(x=>[x.buyerAccountId,x]));

assert.equal(byBuyer.get('buyer-1').stage,'UNANSWERED');
assert.equal(byBuyer.get('buyer-1').responseStatus,'OVERDUE');
assert.equal(byBuyer.get('buyer-1').unreadCount,1);
assert.equal(byBuyer.get('buyer-1').nextAction.code,'REPLY_TO_BUYER');

assert.equal(byBuyer.get('buyer-2').stage,'REPLIED');
assert.equal(byBuyer.get('buyer-2').responseStatus,'MET');
assert.equal(byBuyer.get('buyer-2').responseMinutes,60);
assert.equal(byBuyer.get('buyer-2').potentialCurrency,'USD');

assert.equal(byBuyer.get('buyer-3').stage,'VIEWING');
assert.equal(byBuyer.get('buyer-3').nextAction.code,'PROPOSE_VIEWING_SLOTS');
assert.equal(byBuyer.get('buyer-3').refs.viewingRequestId,'vwq-3');

assert.equal(byBuyer.get('buyer-4').stage,'NEGOTIATING');
assert.equal(byBuyer.get('buyer-4').nextAction.code,'RESPOND_TO_OFFER');
assert.equal(byBuyer.get('buyer-4').potentialAmountMinor,700000);
assert.equal(byBuyer.get('buyer-4').potentialSource,'OFFER');

assert.equal(byBuyer.get('buyer-5').stage,'WON');
assert.equal(byBuyer.get('buyer-5').nextAction.code,'PROCEED_TRANSACTION');
assert.equal(byBuyer.get('buyer-5').potentialAmountMinor,900000);

assert.equal(byBuyer.get('buyer-6').stage,'LOST');
assert.equal(byBuyer.get('buyer-6').nextAction.code,'NONE');

assert.deepEqual(cockpit.summary.stageCounts,{NEW_LEAD:0,UNANSWERED:1,REPLIED:1,VIEWING:1,NEGOTIATING:1,WON:1,LOST:1});
assert.equal(cockpit.summary.overdue,2);
assert.equal(cockpit.summary.awaitingDealer,3);
assert.equal(cockpit.summary.medianResponseMinutes,60);
assert.deepEqual(cockpit.summary.potentialByCurrency,{EUR:3800000,USD:500000});
assert.equal('potentialTotalMinor' in cockpit.summary,false);

assert.throws(
 ()=>buildDealerLeadProjection({account:{id:'buyer-only',roles:['BUYER']},nowMs:now}),
 e=>e.code==='SELLER_REQUIRED'
);

console.log('ANTIQUA v24 dealer lead projection: stage precedence + SLA + next action + currency-safe potential summary passed');
