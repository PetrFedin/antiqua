import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';

const port=12017,base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['server-v14.mjs'],{
  cwd:new URL('..',import.meta.url),
  env:{...process.env,PORT:String(port),PREVIEW_MODE:'true',APP_SECRET:crypto.randomBytes(32).toString('hex'),NODE_ENV:'test'},
  stdio:['ignore','pipe','pipe']
});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

class Client{
  constructor(){this.cookies=new Map()}
  header(){return[...this.cookies].map(([k,v])=>`${k}=${v}`).join('; ')}
  async call(path,opts={}){
    const headers={'content-type':'application/json',...(opts.headers||{})};
    if(this.cookies.size)headers.cookie=this.header();
    if(!['GET','HEAD'].includes((opts.method||'GET').toUpperCase())&&this.cookies.get('antiqua_csrf'))headers['x-csrf-token']=decodeURIComponent(this.cookies.get('antiqua_csrf'));
    const r=await fetch(base+path,{...opts,headers});
    for(const s of r.headers.getSetCookie?.()||[]){const[kv]=s.split(';'),i=kv.indexOf('=');if(i>0)this.cookies.set(kv.slice(0,i),kv.slice(i+1))}
    let body;try{body=await r.json()}catch{body=null}
    return{r,body};
  }
}

const login=async persona=>{const c=new Client(),x=await c.call('/api/auth/demo-login',{method:'POST',body:JSON.stringify({persona})});assert.equal(x.r.status,200);return c};
const createBuyer=async()=>{const c=new Client(),password='Aa1!'+crypto.randomBytes(16).toString('hex'),x=await c.call('/api/auth/register',{method:'POST',body:JSON.stringify({email:`authz-${crypto.randomUUID()}@example.test`,displayName:'Authorization Buyer',password,accountType:'BUYER'})});assert.equal(x.r.status,201);return c};

try{
  let ready=false;for(let i=0;i<120;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break}}catch{}await sleep(100)}assert.equal(ready,true);
  assert.equal((await fetch(base+'/api/conversations')).status,401);

  const buyer=await login('BUYER'),seller=await login('SELLER'),operator=await login('OPERATOR'),other=await createBuyer();

  let x=await buyer.call('/api/conversations',{method:'POST',body:JSON.stringify({listingId:'lst-109',subject:'Authorization matrix'})});
  assert.equal(x.r.status,201);const conversationId=x.body.conversation.id;
  assert.equal((await buyer.call(`/api/conversations/${conversationId}`)).r.status,200);
  assert.equal((await seller.call(`/api/conversations/${conversationId}`)).r.status,200);
  assert.equal((await other.call(`/api/conversations/${conversationId}`)).r.status,404);
  assert.equal((await other.call(`/api/conversations/${conversationId}/messages`,{method:'POST',body:JSON.stringify({body:'unauthorized',clientMessageId:crypto.randomUUID()})})).r.status,404);

  x=await buyer.call('/api/collection-records/lot-109',{method:'PUT',body:JSON.stringify({status:'OWNED',privateNotes:'buyer-only record'})});
  assert.equal(x.r.status,200);const recordId=x.body.record.id;
  x=await other.call('/api/collection-records');assert.equal(x.r.status,200);assert.equal(x.body.records.some(r=>r.id===recordId),false);
  assert.equal((await other.call('/api/collection-records/lot-109/movements',{method:'POST',body:JSON.stringify({movementType:'MOVED',note:'unauthorized'})})).r.status,404);

  x=await buyer.call('/api/listings/lst-109/buy',{method:'POST',body:'{}'});assert.equal(x.r.status,201);const orderId=x.body.order.id;
  assert.equal((await other.call(`/api/orders/${orderId}/payment-preview`,{method:'POST',body:'{}'})).r.status,404);
  x=await buyer.call(`/api/orders/${orderId}/payment-preview`,{method:'POST',body:'{}'});assert.equal(x.r.status,201);const shipmentId=x.body.shipment.id,payoutId=x.body.payout.id;

  assert.equal((await buyer.call(`/api/shipments/${shipmentId}`)).r.status,200);
  assert.equal((await seller.call(`/api/shipments/${shipmentId}`)).r.status,200);
  assert.equal((await other.call(`/api/shipments/${shipmentId}`)).r.status,404);
  assert.equal((await other.call(`/api/shipments/${shipmentId}/quote`,{method:'POST',body:JSON.stringify({origin:'A',destination:'B'})})).r.status,404);

  x=await seller.call(`/api/shipments/${shipmentId}/quote`,{method:'POST',body:JSON.stringify({origin:'Amsterdam',destination:'Utrecht'})});assert.equal(x.r.status,200);
  for(const status of ['BOOKED','PACKING','IN_TRANSIT','DELIVERED']){
    x=await seller.call(`/api/shipments/${shipmentId}/transition`,{method:'POST',body:JSON.stringify({status,trackingReference:'AUTHZ-001',deliveryProof:status==='DELIVERED'?{signedBy:'Buyer'}:{}})});
    assert.equal(x.r.status,200);
  }
  assert.equal((await other.call(`/api/shipments/${shipmentId}/transition`,{method:'POST',body:JSON.stringify({status:'DAMAGE_REPORTED'})})).r.status,404);

  x=await buyer.call('/api/disputes',{method:'POST',body:JSON.stringify({orderId,shipmentId,category:'MISMATCH',summary:'Authorization test dispute',requestedResolution:'Review'})});
  assert.equal(x.r.status,201);const disputeId=x.body.dispute.id;
  assert.equal((await buyer.call(`/api/disputes/${disputeId}`)).r.status,200);
  assert.equal((await seller.call(`/api/disputes/${disputeId}`)).r.status,200);
  assert.equal((await other.call(`/api/disputes/${disputeId}`)).r.status,404);
  assert.equal((await other.call(`/api/disputes/${disputeId}/evidence`,{method:'POST',body:JSON.stringify({evidenceType:'PHOTO_NOTE',note:'unauthorized',mediaIds:[]})})).r.status,404);

  x=await other.call('/api/payouts');assert.equal(x.r.status,200);assert.deepEqual(x.body.payouts,[]);
  x=await seller.call('/api/payouts');assert.equal(x.r.status,200);assert.ok(x.body.payouts.some(p=>p.id===payoutId));
  x=await operator.call('/api/payouts');assert.equal(x.r.status,200);assert.ok(x.body.payouts.some(p=>p.id===payoutId));

  console.log('ANTIQUA 0.15 authorization matrix: anonymous + owner + counterparty + unrelated buyer + operator isolation passed');
}finally{
  child.kill('SIGTERM');
}
