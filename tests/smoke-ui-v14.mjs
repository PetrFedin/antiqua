import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
const port=11999,base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['server-v14.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),PREVIEW_MODE:'true',APP_SECRET:crypto.randomBytes(32).toString('hex'),NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break}}catch{}await sleep(100)}assert.equal(ready,true);
 const home=await(await fetch(base)).text();assert.match(home,/ANTIQUA · КУЛЬТУРА ВЕЩЕЙ/);assert.match(home,/id="brandPromise"/);assert.match(home,/href="\/styles\.css"/);assert.match(home,/src="\/main\.js"/);assert.doesNotMatch(home,/(?:styles|app|operations)(?:-addon)?-v\d+/);
 const assets=['main.js','app.js','operations.js','modules/core.js','modules/discovery.js','modules/collection.js','modules/transactions.js','modules/cockpit.js','modules/culture-discovery.js','modules/object-desire.js'];
 for(const file of assets){const r=await fetch(`${base}/${file}`);assert.equal(r.status,200,file);assert.match(r.headers.get('content-type')||'',/javascript/);const body=await r.text();assert.ok(body.length>(file==='main.js'?20:500),file)}
 const css=await fetch(base+'/styles.css');assert.equal(css.status,200);assert.match(css.headers.get('content-type')||'',/text\/css/);const body=await css.text();assert.ok(body.length>90000);assert.match(body,/v14-operations/);assert.match(body,/v16-cockpit/);
 console.log('ANTIQUA v27 UI smoke: canonical frontend graph assets passed');
}finally{child.kill('SIGTERM')}
