import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
const port=11996,base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['server-v12.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),PREVIEW_MODE:'true',APP_SECRET:crypto.randomBytes(32).toString('hex'),NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const cookiesFrom=r=>{const xs=r.headers.getSetCookie?.()||[];return xs.map(x=>x.split(';')[0]).join('; ')};
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break}}catch{}await sleep(100)}assert.equal(ready,true);
 const hr=await fetch(base+'/api/health'),h=await hr.json();assert.equal(h.uiVersion,'0.12.0');for(const k of ['bilingual','alignedCards','fullscreenGallery','pinchZoom','dossierNeighbors','mobileFilterSheet','accountActivityFeed','orderTimeline','dealerStorefront','collectionBuilder','exhibitionBuilder','ensembleMap'])assert.equal(h.interaction[k],true,k);
 const homeR=await fetch(base),home=await homeR.text();assert.match(home,/styles-v12\.css/);assert.match(home,/experience-v12\.js/);assert.match(home,/Interaction 0\.12/);assert.match(homeR.headers.get('content-security-policy')||'',/style-src[^;]*unsafe-inline/);
 for(const [f,mime] of [['styles-v12.css','text/css'],['experience-v12.js','javascript']]){const r=await fetch(`${base}/${f}`);assert.equal(r.status,200);assert.match(r.headers.get('content-type')||'',new RegExp(mime));const text=await r.text();assert.ok(text.length>1000);if(f.endsWith('.css')){assert.match(text,/v12-card-copy/);assert.match(text,/media-viewer/);assert.match(text,/account-v12/);assert.match(text,/ensemble-map/)}else{assert.match(text,/data-v12-lang/);assert.match(text,/openMediaViewer/);assert.match(text,/renderAccountV12/);assert.match(text,/persistExhibitionOrder/);assert.match(text,/upgradeCommerceCards/)}}
 const publicEx=await(await fetch(base+'/api/exhibitions/ex-objects-in-dialogue')).json();assert.equal(publicEx.editable,false);assert.ok(publicEx.exhibition.sections.length>=2);
 const login=await fetch(base+'/api/auth/demo-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona:'BUYER'})});assert.equal(login.status,200);const loginData=await login.json(),cookie=cookiesFrom(login);assert.ok(cookie.includes('antiqua_session='));const csrf=loginData.csrf;assert.ok(csrf);
 const owned=await(await fetch(base+'/api/exhibitions/ex-objects-in-dialogue',{headers:{cookie}})).json();assert.equal(owned.editable,true);const first=owned.exhibition.sections[0],before=first.items.map(x=>x.objectId?`o:${x.objectId}`:`e:${x.ensembleId}`);assert.ok(before.length>=2);const sections=owned.exhibition.sections.map((s,i)=>({sectionId:s.id,items:(i===0?[...s.items].reverse():s.items).map(x=>x.objectId?{objectId:x.objectId}:{ensembleId:x.ensembleId})}));
 const patch=await fetch(base+'/api/exhibitions/ex-objects-in-dialogue/layout',{method:'PATCH',headers:{'content-type':'application/json',cookie,'x-csrf-token':csrf},body:JSON.stringify({sections})});assert.equal(patch.status,200);const patched=await patch.json(),after=patched.exhibition.sections[0].items.map(x=>x.objectId?`o:${x.objectId}`:`e:${x.ensembleId}`);assert.deepEqual(after,[...before].reverse());
 console.log('ANTIQUA 0.12 smoke: bilingual aligned UX + editable exhibition layout passed');
}finally{child.kill('SIGTERM')}
