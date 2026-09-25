import {api,safe,copy,local,esc,sheet,toast} from './core.js';

let active=null;
const q=(s,r=document)=>r?.querySelector?.(s)||null;
const key=(prefix,id)=>prefix+':'+id+':'+(crypto.randomUUID?.()||Date.now()+'-'+Math.random().toString(16).slice(2));

function stopTracking(){if(!active)return;for(const [el,fn] of active.listeners||[])el.removeEventListener('scroll',fn);active.observer?.disconnect();clearInterval(active.timer);active=null}
async function sendEngaged(s){if(!s||s.sent)return;const dwell=(Date.now()-s.startedAt)/1000;if(dwell<8||s.depth<.35)return;s.sent=true;try{await api('/api/taste/signals',{method:'POST',body:JSON.stringify({signalType:'ENGAGED_VIEW',objectId:s.objectId,sourceKey:s.sourceKey,metadata:{depth:s.depth,dwellSeconds:dwell}})})}catch(e){console.debug('Taste engaged view not recorded',e?.message||e)}}
function trackPassport(objectId){
 stopTracking();const dialog=q('#dialog[open]');if(!dialog)return;const body=q('.dossier-body',dialog),dossier=q('.dossier',dialog);const s={objectId,sourceKey:key('engaged',objectId),startedAt:Date.now(),depth:0,sent:false,listeners:[],observer:null,timer:null};active=s;
 const measure=el=>{if(!el)return;const max=Math.max(0,el.scrollHeight-el.clientHeight);if(max>0)s.depth=Math.max(s.depth,Math.min(1,el.scrollTop/max));sendEngaged(s)};
 for(const el of [body,dossier].filter(Boolean)){const fn=()=>measure(el);el.addEventListener('scroll',fn,{passive:true});s.listeners.push([el,fn])}
 if('IntersectionObserver' in window){s.observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){if(e.target.id==='dossier-provenance')s.depth=Math.max(s.depth,.4);if(e.target.id==='dossier-condition')s.depth=Math.max(s.depth,.6);sendEngaged(s)}},{root:dialog,threshold:.2});for(const id of ['dossier-provenance','dossier-condition']){const el=q('#'+id,dialog);if(el)s.observer.observe(el)}}
 s.timer=setInterval(()=>sendEngaged(s),1000)
}

function signalSummary(profile){const counts=profile?.signalCounts||{},order=['PURCHASE','VIEWING','OFFER','COLLECTED','SAVED','FOLLOW_MAKER','FOLLOW_CATEGORY','ENGAGED_VIEW','DISMISSED'];return order.filter(x=>counts[x]).map(x=>'<span><b>'+esc(counts[x])+'</b> '+esc(x.replaceAll('_',' '))+'</span>').join('')}
function dimensionRows(profile){const labels={maker:copy('Мастера / атрибуции','Makers / attributions'),department:copy('Категории','Categories'),period:copy('Эпохи','Periods'),origin:copy('Происхождение','Origins')};return Object.entries(profile?.dimensions||{}).map(([d,items])=>{const rows=(items||[]).slice(0,5).map(x=>'<div class="taste-explain-row"><span>'+esc(local(x.value))+'</span><b>'+esc(x.points>0?'+'+x.points:String(x.points))+'</b><small>'+esc((x.signals||[]).map(s=>s.type+' '+(s.points>0?'+':'')+s.points).join(' · '))+'</small></div>').join('');return rows?'<section><h4>'+esc(labels[d]||d)+'</h4>'+rows+'</section>':''}).join('')}
async function explainTaste(){const d=await safe('/api/taste/profile');if(!d?.profile)return toast(copy('Карта вкуса пока не сформирована','Taste map is not formed yet'));sheet('<div class="action-sheet-head"><div><div class="micro">TASTE GRAPH · v0.28</div><h2>'+copy('Почему Antiqua показывает это','Why Antiqua shows this')+'</h2><p>'+copy('Карта вкуса строится только из ваших явных действий и коммерческих фактов. Каждый вклад виден; цена не участвует в подборе.','Your taste map is built only from your explicit actions and commercial facts. Every contribution is visible; price is not used for matching.')+'</p></div><button class="action-sheet-close" data-close-sheet>×</button></div><div class="taste-signal-summary">'+signalSummary(d.profile)+'</div><div class="taste-explain-grid">'+dimensionRows(d.profile)+'</div>')}

async function followValue(type,value){
 value=String(value||'').trim();if(!value)return;const data=await safe('/api/discovery/subscriptions'),subs=data?.subscriptions||[],field=type==='FOLLOW_MAKER'?'maker':'category';const prior=subs.find(s=>s.status==='ACTIVE'&&s.subscriptionType===type&&String(s.criteria?.[field]||'').toLowerCase()===value.toLowerCase());if(prior)return toast(copy('Вы уже следите за этим','You already follow this'));
 const body={subscriptionType:type,label:value};body[field]=value;await api('/api/discovery/subscriptions',{method:'POST',body:JSON.stringify(body)});toast(type==='FOLLOW_MAKER'?copy('Мастер добавлен в карту вкуса','Maker added to your taste map'):copy('Категория добавлена в карту вкуса','Category added to your taste map'));window.dispatchEvent(new CustomEvent('antiqua:culture-refresh'))
}

async function addFollowControls(objectId){
 const dialog=q('#dialog[open]'),tools=q('.dossier-tools',dialog);if(!tools||tools.querySelector('[data-taste-follow]'))return;const d=await safe('/api/lots/'+encodeURIComponent(objectId)+'/passport');if(!d?.lot||!tools.isConnected)return;const maker=String(d.lot.maker?.en||local(d.lot.maker)||'').trim(),category=String(d.lot.department?.en||local(d.lot.department)||'').trim();
 if(maker){const b=document.createElement('button');b.type='button';b.className='quiet-button';b.dataset.tasteFollow='FOLLOW_MAKER';b.dataset.tasteValue=maker;b.textContent=copy('＋ Мастер','＋ Maker');tools.append(b)}
 if(category){const b=document.createElement('button');b.type='button';b.className='quiet-button';b.dataset.tasteFollow='FOLLOW_CATEGORY';b.dataset.tasteValue=category;b.textContent=copy('＋ Категория','＋ Category');tools.append(b)}
}

window.addEventListener('antiqua:passport',e=>{const id=String(e.detail?.id||'');if(!id)return;trackPassport(id);addFollowControls(id).catch(console.error)});
q('#dialog')?.addEventListener('close',stopTracking);
document.addEventListener('click',async e=>{
 const dismiss=e.target.closest?.('[data-taste-dismiss]');if(dismiss){e.preventDefault();e.stopPropagation();try{const id=dismiss.dataset.tasteDismiss;await api('/api/taste/signals',{method:'POST',body:JSON.stringify({signalType:'DISMISSED',objectId:id,sourceKey:key('dismiss',id),metadata:{reason:'NOT_FOR_ME'}})});toast(copy('Понял — такого будет меньше','Got it — you will see less like this'));window.dispatchEvent(new CustomEvent('antiqua:culture-refresh'))}catch(err){toast(err.message)}return}
 if(e.target.closest?.('[data-taste-explain]')){e.preventDefault();return explainTaste().catch(err=>toast(err.message))}
 const follow=e.target.closest?.('[data-taste-follow]');if(follow){e.preventDefault();return followValue(follow.dataset.tasteFollow,follow.dataset.tasteValue).catch(err=>toast(err.message))}
});
