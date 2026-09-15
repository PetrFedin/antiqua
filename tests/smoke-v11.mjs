import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';

const port=11995,base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['server-v11.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),PREVIEW_MODE:'true',APP_SECRET:crypto.randomBytes(32).toString('hex'),NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
 let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break}}catch{}await sleep(100)}assert.equal(ready,true);
 const h=await(await fetch(base+'/api/health')).json();assert.equal(h.uiVersion,'0.11.0');assert.equal(h.interaction.touchFirst,true);assert.equal(h.interaction.directManipulation,true);assert.equal(h.interaction.bottomSheets,true);assert.equal(h.interaction.safeArea,true);assert.equal(h.interaction.reducedMotion,true);
 const home=await(await fetch(base)).text();assert.match(home,/styles-v07\.css/);assert.match(home,/styles-addon-v08\.css/);assert.match(home,/styles-addon-v09\.css/);assert.match(home,/styles-addon-v10\.css/);assert.match(home,/styles-v11\.css/);assert.match(home,/ux-v11\.js/);assert.match(home,/mobile-tabbar/);assert.match(home,/actionSheet/);assert.doesNotMatch(home,/href="\/styles-v08\.css"/);
 for(const f of ['styles-v07.css','styles-addon-v08.css','styles-addon-v09.css','styles-addon-v10.css','styles-v11.css']){const r=await fetch(`${base}/${f}`);assert.equal(r.status,200);assert.match(r.headers.get('content-type')||'',/text\/css/);const text=await r.text();assert.ok(text.length>100);if(f==='styles-v11.css')assert.match(text,/prefers-reduced-motion:reduce/)}
 const ux=await fetch(base+'/ux-v11.js');assert.equal(ux.status,200);assert.match(ux.headers.get('content-type')||'',/javascript/);const js=await ux.text();assert.match(js,/pointerdown/);assert.match(js,/data-bid/);assert.match(js,/sheet-grabber/);assert.match(js,/data-direct-card/);
 const catalog=await(await fetch(base+'/api/catalog')).json();assert.ok(catalog.listings.length>0);const collections=await(await fetch(base+'/api/collections')).json();assert.ok(collections.collections.length>0);
 console.log('ANTIQUA 0.11 smoke: interaction shell passed');
}finally{child.kill('SIGTERM')}
