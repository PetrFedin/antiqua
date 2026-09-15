import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const port=11991;
const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
const base=`http://127.0.0.1:${port}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
  let ready=false;
  for(let i=0;i<40;i++){try{const r=await fetch(`${base}/api/health`);if(r.ok){ready=true;break}}catch{}await sleep(100)}
  assert.equal(ready,true,'server should become ready');
  const health=await (await fetch(`${base}/api/health`)).json();assert.equal(health.status,'ok');
  const catalog=await (await fetch(`${base}/api/catalog`)).json();assert.ok(catalog.lots.length>=8);assert.ok(catalog.auctions.length>=1);
  const home=await fetch(base);assert.equal(home.status,200);assert.match(await home.text(),/ANTIQUA/);
  const css=await fetch(`${base}/styles.css`);assert.equal(css.status,200);
  const js=await fetch(`${base}/app.js`);assert.equal(js.status,200);
  const a=catalog.auctions[0];
  const tooLow=await fetch(`${base}/api/auctions/${a.id}/bid`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({amount:a.currentBid})});assert.equal(tooLow.status,400);
  const bid=await fetch(`${base}/api/auctions/${a.id}/bid`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({amount:a.currentBid+a.increment})});assert.equal(bid.status,201);const bd=await bid.json();assert.equal(bd.preview,true);assert.equal(bd.auction.bidCount,a.bidCount+1);
  console.log('ANTIQUA smoke: 7/7 passed');
} finally {child.kill('SIGTERM')}
