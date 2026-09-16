import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
const port=11999,base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['server-v14.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),PREVIEW_MODE:'true',APP_SECRET:crypto.randomBytes(32).toString('hex'),NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break}}catch{}await sleep(100)}assert.equal(ready,true);const home=await(await fetch(base)).text();assert.match(home,/ANTIQUA · 0\.14/);assert.match(home,/styles-v14\.css/);assert.match(home,/operations-v14\.js/);for(const file of ['operations-v14.js','v14/core.js','v14/discovery.js','v14/collection.js','v14/transactions.js']){const r=await fetch(`${base}/${file}`);assert.equal(r.status,200,file);assert.match(r.headers.get('content-type')||'',/javascript/);assert.ok((await r.text()).length>500,file)}const css=await fetch(base+'/styles-v14.css');assert.equal(css.status,200);assert.match(css.headers.get('content-type')||'',/text\/css/);assert.match(await css.text(),/v14-operations/);console.log('ANTIQUA 0.14 UI smoke: operational workspace assets passed')}finally{child.kill('SIGTERM')}
