import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {Pool} from 'pg';

if(!process.env.DATABASE_URL){console.log('ANTIQUA 0.15 PostgreSQL auction concurrency: skipped (DATABASE_URL not set)');process.exit(0)}

const ports=[12019,12020,12021],bases=ports.map(p=>`http://127.0.0.1:${p}`),appSecret=crypto.randomBytes(32).toString('hex');
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSL==='disable'?false:{rejectUnauthorized:false},max:8});
const children=new Map(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const step=n=>n<1000?50:n<5000?100:n<10000?250:n<20000?500:n<50000?1000:2500;

class Client{
  constructor(){this.cookies=new Map();this.account=null}
  header(){return[...this.cookies].map(([k,v])=>`${k}=${v}`).join('; ')}
  async call(base,path,opts={}){
    const headers={'content-type':'application/json',...(opts.headers||{})};
    if(this.cookies.size)headers.cookie=this.header();
    if(!['GET','HEAD'].includes((opts.method||'GET').toUpperCase())&&this.cookies.get('antiqua_csrf'))headers['x-csrf-token']=decodeURIComponent(this.cookies.get('antiqua_csrf'));
    const r=await fetch(base+path,{...opts,headers});
    for(const s of r.headers.getSetCookie?.()||[]){const[kv]=s.split(';'),i=kv.indexOf('=');if(i>0)this.cookies.set(kv.slice(0,i),kv.slice(i+1))}
    let body;try{body=await r.json()}catch{body=null}
    return{r,body};
  }
}

async function start(index){
  const port=ports[index],base=bases[index];
  const child=spawn(process.execPath,['server-v14.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),PREVIEW_MODE:'true',APP_SECRET:appSecret,NODE_ENV:'test',PGSSL:'disable'},stdio:['ignore','pipe','pipe']});
  let stderr='';child.stderr?.on('data',b=>stderr+=String(b));children.set(index,child);
  for(let i=0;i<180;i++){
    if(child.exitCode!=null)throw new Error(`Auction test server ${index} exited before readiness: ${stderr}`);
    try{const r=await fetch(base+'/api/health');if(r.ok){const h=await r.json();assert.equal(h.persistence.kind,'POSTGRES');return}}
    catch{}
    await sleep(100);
  }
  throw new Error(`Auction test server ${index} did not become ready: ${stderr}`);
}
async function stop(index){const p=children.get(index);if(!p)return;children.delete(index);if(p.exitCode==null)p.kill('SIGTERM');await Promise.race([new Promise(r=>p.once('exit',r)),sleep(5000)]);if(p.exitCode==null)p.kill('SIGKILL');await sleep(150)}
async function registerBuyer(i){
  const c=new Client(),base=bases[i%2],password=`Aa1!${crypto.randomBytes(18).toString('base64url')}`;
  let x=await c.call(base,'/api/auth/register',{method:'POST',body:JSON.stringify({email:`auction-${crypto.randomUUID()}@example.test`,displayName:`Concurrency Buyer ${i+1}`,password,accountType:'BUYER'})});
  assert.equal(x.r.status,201);c.account=x.body.account;
  return c;
}
async function registerSale(c,base,saleId){const x=await c.call(base,`/api/sales/${saleId}/register`,{method:'POST',body:JSON.stringify({acceptTerms:true,termsVersion:'ci-v15-concurrency'})});assert.equal(x.r.status,200)}
const auctionFrom=async(base,id)=>{const c=await(await fetch(base+'/api/catalog')).json();return c.auctions.find(a=>a.id===id)};

try{
  await start(0);await start(1);
  const catalog=await(await fetch(bases[0]+'/api/catalog')).json(),saleId=catalog.sale.id;
  const live=[...catalog.auctions].filter(a=>a.state==='LIVE').sort((a,b)=>Date.parse(b.endsAt)-Date.parse(a.endsAt));
  assert.ok(live.length>=3,'At least three live auctions are required for concurrency, anti-sniping and self-bid proof');
  const stress=live[0],anti=live[1],self=live[2];
  const initial=(await pool.query('SELECT current_bid,bid_count,version,leader_account_id FROM auctions WHERE id=$1',[stress.id])).rows[0];
  const initialBidRows=Number((await pool.query('SELECT count(*)::int AS n FROM auction_bids WHERE auction_id=$1',[stress.id])).rows[0].n);
  const initialEvent=Number((await pool.query('SELECT COALESCE(max(sequence_no),0)::bigint AS n FROM auction_events WHERE auction_id=$1',[stress.id])).rows[0].n);

  const clients=[];for(let i=0;i<50;i++){const c=await registerBuyer(i);await registerSale(c,bases[(i+1)%2],saleId);clients.push(c)}
  const attempts=[];let accepted=0;
  for(let wave=0;wave<5;wave++){
    const row=(await pool.query('SELECT current_bid FROM auctions WHERE id=$1',[stress.id])).rows[0],baseAmount=Number(row.current_bid)+200000;
    const batch=[];
    for(let j=0;j<10;j++){
      const i=wave*10+j,key=`stress-${crypto.randomUUID()}`,maxAmount=baseAmount+j*10000,base=bases[i%2];
      const rec={client:clients[i],accountId:clients[i].account.id,key,maxAmount,base};attempts.push(rec);
      batch.push(clients[i].call(base,`/api/auctions/${stress.id}/bid`,{method:'POST',headers:{'idempotency-key':key},body:JSON.stringify({maxAmount})}).then(x=>({rec,x})));
    }
    const results=await Promise.all(batch);
    for(const {rec,x} of results){rec.result=x;if(x.r.status===201){accepted++;rec.accepted=true}else{assert.equal(x.r.status,400);assert.equal(x.body.code,'BID_TOO_LOW')}}
  }
  assert.ok(accepted>=10,`Expected meaningful row-lock contention; only ${accepted} bids were accepted`);

  let row=(await pool.query('SELECT current_bid,increment,bid_count,version,leader_account_id,baseline_bid FROM auctions WHERE id=$1',[stress.id])).rows[0];
  const bidRows=Number((await pool.query('SELECT count(*)::int AS n FROM auction_bids WHERE auction_id=$1',[stress.id])).rows[0].n);
  assert.equal(bidRows-initialBidRows,accepted);
  assert.equal(Number(row.bid_count)-Number(initial.bid_count),accepted);
  assert.equal(Number(row.version)-Number(initial.version),accepted);
  const newEvents=(await pool.query('SELECT sequence_no FROM auction_events WHERE auction_id=$1 AND sequence_no>$2 ORDER BY sequence_no',[stress.id,initialEvent])).rows.map(x=>Number(x.sequence_no));
  assert.equal(newEvents.length,accepted);newEvents.forEach((n,i)=>assert.equal(n,initialEvent+i+1));

  const positions=(await pool.query('SELECT account_id,max_amount,accepted_at FROM auction_proxy_positions WHERE auction_id=$1 ORDER BY max_amount DESC,accepted_at ASC,account_id ASC',[stress.id])).rows.map(x=>({accountId:x.account_id,maxAmount:Number(x.max_amount),acceptedAt:x.accepted_at.toISOString()}));
  assert.ok(positions.length>=accepted);
  const first=positions[0],second=positions[1],baseline=Number(row.baseline_bid),floor=baseline+step(baseline),expectedCurrent=Math.max(baseline,second?Math.max(floor,Math.min(first.maxAmount,second.maxAmount+step(second.maxAmount))):Math.min(first.maxAmount,floor));
  assert.equal(row.leader_account_id,first.accountId);assert.equal(Number(row.current_bid),expectedCurrent);assert.equal(Number(row.increment),step(expectedCurrent));

  let a0=await auctionFrom(bases[0],stress.id),a1=await auctionFrom(bases[1],stress.id);
  assert.equal(a0.currentBid,Number(row.current_bid));assert.equal(a1.currentBid,Number(row.current_bid));assert.equal(a0.bidCount,Number(row.bid_count));assert.equal(a1.bidCount,Number(row.bid_count));
  let h0=await(await fetch(`${bases[0]}/api/auctions/${stress.id}/history`)).json(),h1=await(await fetch(`${bases[1]}/api/auctions/${stress.id}/history`)).json();assert.equal(h0.auction.currentBid,Number(row.current_bid));assert.equal(h1.auction.currentBid,Number(row.current_bid));

  const replay=attempts.find(x=>x.accepted);assert.ok(replay);const beforeReplay=Number(row.bid_count),replayBase=replay.base===bases[0]?bases[1]:bases[0];let x=await replay.client.call(replayBase,`/api/auctions/${stress.id}/bid`,{method:'POST',headers:{'idempotency-key':replay.key},body:JSON.stringify({maxAmount:replay.maxAmount})});assert.equal(x.r.status,200);assert.equal(x.body.idempotent,true);row=(await pool.query('SELECT bid_count FROM auctions WHERE id=$1',[stress.id])).rows[0];assert.equal(Number(row.bid_count),beforeReplay);

  const tie1=await registerBuyer(50),tie2=await registerBuyer(51);await registerSale(tie1,bases[0],saleId);await registerSale(tie2,bases[1],saleId);
  const maxExisting=Number((await pool.query('SELECT COALESCE(max(max_amount),0) AS n FROM auction_proxy_positions WHERE auction_id=$1',[stress.id])).rows[0].n),tieMax=maxExisting+500000;
  x=await tie1.call(bases[0],`/api/auctions/${stress.id}/bid`,{method:'POST',headers:{'idempotency-key':`tie-a-${crypto.randomUUID()}`},body:JSON.stringify({maxAmount:tieMax})});assert.equal(x.r.status,201);
  x=await tie2.call(bases[1],`/api/auctions/${stress.id}/bid`,{method:'POST',headers:{'idempotency-key':`tie-b-${crypto.randomUUID()}`},body:JSON.stringify({maxAmount:tieMax})});assert.equal(x.r.status,201);
  row=(await pool.query('SELECT leader_account_id,current_bid,bid_count,ends_at FROM auctions WHERE id=$1',[stress.id])).rows[0];assert.equal(row.leader_account_id,tie1.account.id);assert.equal(Number(row.current_bid),tieMax);

  const antiClient=clients[0];let antiRow=(await pool.query("UPDATE auctions SET ends_at=clock_timestamp()+interval '60 seconds',extension_window_seconds=180,extension_seconds=180 WHERE id=$1 RETURNING current_bid,increment,ends_at,extension_count",[anti.id])).rows[0];
  const antiBefore=new Date(antiRow.ends_at).getTime(),antiKey=`anti-${crypto.randomUUID()}`;x=await antiClient.call(bases[1],`/api/auctions/${anti.id}/bid`,{method:'POST',headers:{'idempotency-key':antiKey},body:JSON.stringify({maxAmount:Number(antiRow.current_bid)+Math.max(Number(antiRow.increment),2500)*20})});assert.equal(x.r.status,201);
  antiRow=(await pool.query('SELECT ends_at,extension_count,current_bid,bid_count FROM auctions WHERE id=$1',[anti.id])).rows[0];assert.ok(new Date(antiRow.ends_at).getTime()>antiBefore+100000);assert.ok(Number(antiRow.extension_count)>=1);
  const antiOther=await auctionFrom(bases[0],anti.id);assert.equal(antiOther.currentBid,Number(antiRow.current_bid));assert.equal(new Date(antiOther.endsAt).getTime(),new Date(antiRow.ends_at).getTime());

  const seller=new Client();x=await seller.call(bases[0],'/api/auth/demo-login',{method:'POST',body:JSON.stringify({persona:'SELLER'})});assert.equal(x.r.status,200);seller.account=x.body.account;await registerSale(seller,bases[1],saleId);
  const selfRow=(await pool.query('SELECT object_id,current_bid,increment FROM auctions WHERE id=$1',[self.id])).rows[0];await pool.query('UPDATE objects SET seller_id=$2 WHERE id=$1',[selfRow.object_id,seller.account.sellerId]);
  x=await seller.call(bases[1],`/api/auctions/${self.id}/bid`,{method:'POST',headers:{'idempotency-key':`self-${crypto.randomUUID()}`},body:JSON.stringify({maxAmount:Number(selfRow.current_bid)+Math.max(Number(selfRow.increment),2500)*10})});assert.equal(x.r.status,403);assert.equal(x.body.code,'SELF_BID_FORBIDDEN');

  const restartExpected=(await pool.query('SELECT current_bid,bid_count,ends_at FROM auctions WHERE id=$1',[stress.id])).rows[0];
  await stop(0);await stop(1);await start(2);
  const afterRestart=await auctionFrom(bases[2],stress.id);assert.equal(afterRestart.currentBid,Number(restartExpected.current_bid));assert.equal(afterRestart.bidCount,Number(restartExpected.bid_count));assert.equal(new Date(afterRestart.endsAt).getTime(),new Date(restartExpected.ends_at).getTime());
  x=await replay.client.call(bases[2],`/api/auctions/${stress.id}/bid`,{method:'POST',headers:{'idempotency-key':replay.key},body:JSON.stringify({maxAmount:replay.maxAmount})});assert.equal(x.r.status,200);assert.equal(x.body.idempotent,true);
  const afterReplay=Number((await pool.query('SELECT bid_count FROM auctions WHERE id=$1',[stress.id])).rows[0].bid_count);assert.equal(afterReplay,Number(restartExpected.bid_count));

  console.log(`ANTIQUA 0.15 auction proof: 2 instances + 50 contested requests (${accepted} accepted) + DB invariants + idempotent replay + deterministic tie + anti-sniping + self-bid block + restart passed`);
}finally{
  await stop(0);await stop(1);await stop(2);await pool.end();
}
