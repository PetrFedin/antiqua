import {api,safe,copy,local,esc,toast} from './core.js';

const q=(s,r=document)=>r?.querySelector?.(s)||null;
const route=()=>{const [root,id]=location.hash.slice(1).split('/');return{root:root||'shop',id:id?decodeURIComponent(id):null}};
const money=(v,c='EUR')=>new Intl.NumberFormat(document.documentElement.lang==='ru'?'ru-RU':'en-GB',{style:'currency',currency:c||'EUR',maximumFractionDigits:0}).format(Number(v)||0);
const dateTime=v=>v?new Intl.DateTimeFormat(document.documentElement.lang==='ru'?'ru-RU':'en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'—';
const remaining=v=>{const ms=Date.parse(v)-Date.now();if(ms<=0)return copy('Релиз наступил','Release time reached');const total=Math.ceil(ms/1000),d=Math.floor(total/86400),h=Math.floor(total%86400/3600),m=Math.floor(total%3600/60);return[d?d+'d':null,h+'h',m+'m'].filter(Boolean).join(' ')};

function commerce(item,status){
 const c=item.commerce||{};
 if(status==='PREVIEW')return`<div class="drop-commerce preview"><span>${copy('Релиз','Release')}</span><strong>${copy('После открытия выпуска','When the drop opens')}</strong><small>${copy('Лимит выпуска: ','Release limit: ')}${esc(item.releaseLimit||1)}</small></div>`;
 if(!c.available)return`<div class="drop-commerce unavailable"><span>${copy('Текущий статус','Current status')}</span><strong>${copy('Недоступно','Unavailable')}</strong><small>${copy('Drop не подменяет статус продажи','Drop does not override sale status')}</small></div>`;
 const label=c.authority==='AUCTION'?copy('Текущая ставка','Current bid'):copy('Текущая цена','Current price');
 return`<div class="drop-commerce"><span>${label}</span><strong>${money(c.price,c.currency)}</strong><small>${esc(c.authority||'')}</small></div>`
}

function itemCard(item,status){const o=item.object||{};return`<article class="drop-object-card" data-drop-object="${esc(o.id)}"><button type="button" class="drop-object-media" data-passport="${esc(o.id)}"><img src="${esc(o.image||'')}" alt="${esc(local(o.title))}" loading="lazy" decoding="async"></button><div class="drop-object-copy"><div class="micro">${esc(local(o.department))} · ${esc(o.objectId||o.id||'')}</div><h3>${esc(local(o.title))}</h3><p>${esc(local(o.maker))} · ${esc(local(o.period))}</p>${commerce(item,status)}<button type="button" class="quiet-button" data-passport="${esc(o.id)}">${copy('Открыть паспорт','Open Passport')}</button></div></article>`}

async function followSet(){const d=await safe('/api/drop-follows');return new Set((d?.follows||[]).map(x=>x.dropId))}
function followButton(drop,followed){if(!['PREVIEW','LIVE'].includes(drop.status))return'';const label=followed?copy('✓ Слежу за выпуском','✓ Following drop'):drop.status==='PREVIEW'?copy('Следить за релизом','Follow release'):copy('Следить за выпуском','Follow drop');return`<button type="button" class="${followed?'secondary-button active':'primary-button'}" data-drop-follow="${esc(drop.id)}" data-followed="${followed?'true':'false'}">${label}</button>`}

async function renderDropRoute(){
 const r=route();if(r.root!=='drop'||!r.id)return;const shell=q('[data-drop-route]');if(!shell||shell.dataset.dropLoading==='true')return;shell.dataset.dropLoading='true';
 const [data,follows]=await Promise.all([safe('/api/drops/'+encodeURIComponent(r.id)),followSet()]);
 if(!shell.isConnected)return;if(!data?.drop){shell.innerHTML=`<div class="empty-state"><h2>${copy('Выпуск не найден','Drop not found')}</h2><a href="#shop" class="secondary-button">${copy('Вернуться к предметам','Back to objects')}</a></div>`;return}
 const d=data.drop,cover=d.items?.find(x=>x.objectId===d.coverObjectId)?.object||d.items?.[0]?.object,followed=follows.has(d.id),live=d.status==='LIVE',preview=d.status==='PREVIEW';
 shell.innerHTML=`<article class="drop-page ${d.status.toLowerCase()}">
 <header class="drop-page-hero"><div class="drop-page-visual">${cover?.image?`<img src="${esc(cover.image)}" alt="${esc(local(d.title))}">`:''}</div><div class="drop-page-intro"><div class="eyebrow">ANTIQUA DROP · ${esc(d.status)}</div><h1>${esc(local(d.title))}</h1><p class="drop-subtitle">${esc(local(d.subtitle))}</p><div class="drop-meta"><span>${copy('Куратор','Curator')} · ${esc(local(d.curatorLabel)||'ANTIQUA')}</span><span>${copy('Предметов','Objects')} · ${d.items?.length||0}</span>${d.releaseAt?`<span>${copy('Релиз','Release')} · ${esc(dateTime(d.releaseAt))}</span>`:''}</div>${preview?`<div class="drop-countdown"><span>${copy('До релиза','Until release')}</span><strong data-drop-release="${esc(d.releaseAt)}">${esc(remaining(d.releaseAt))}</strong></div>`:''}<div class="drop-page-actions">${followButton(d,followed)}<a href="#shop" class="secondary-button">${copy('Все предметы','All objects')}</a></div></div></header>
 <section class="drop-statement"><div class="eyebrow">${copy('ИДЕЯ ВЫПУСКА','DROP STORY')}</div><p>${esc(local(d.statement))}</p></section>
 <section class="drop-items"><div class="culture-section-head"><div><div class="eyebrow">${live?copy('ДОСТУПНО СЕЙЧАС','AVAILABLE NOW'):d.status==='ARCHIVED'?copy('АРХИВ ВЫПУСКА','DROP ARCHIVE'):copy('ПРЕДПРОСМОТР','PREVIEW')}</div><h2>${copy('Предметы выпуска','Objects in the drop')}</h2><p>${preview?copy('Коммерческие действия откроются в выпуске; паспорт и история предмета доступны уже сейчас.','Commerce opens with the release; Passport and object history are already available.'):copy('Доступность каждого предмета берётся из его текущего listing или auction — не из самого Drop.','Each object’s availability comes from its current listing or auction — never from the Drop itself.')}</p></div></div><div class="drop-object-grid">${(d.items||[]).map(x=>itemCard(x,d.status)).join('')}</div></section>
 </article>`;
 shell.dataset.dropLoading='false';shell.dataset.dropRendered=d.id;
}

async function toggleFollow(btn){const id=btn.dataset.dropFollow,was=btn.dataset.followed==='true';btn.disabled=true;try{const x=await api('/api/drops/'+encodeURIComponent(id)+'/follow',{method:'POST',body:JSON.stringify({enabled:!was})});toast(x.followed?copy('Будем сообщать о выпуске','You are following this drop'):copy('Подписка на выпуск отключена','Drop follow removed'));window.dispatchEvent(new CustomEvent('antiqua:drops-refresh'));window.dispatchEvent(new CustomEvent('antiqua:culture-refresh'))}catch(e){toast(e.message);btn.disabled=false}}

document.addEventListener('click',e=>{const b=e.target.closest?.('[data-drop-follow]');if(!b)return;e.preventDefault();e.stopPropagation();toggleFollow(b)});
const observer=new MutationObserver(()=>queueMicrotask(()=>renderDropRoute().catch(console.error)));const app=q('#app');if(app)observer.observe(app,{childList:true,subtree:false});
window.addEventListener('hashchange',()=>setTimeout(()=>renderDropRoute().catch(console.error),0));
window.addEventListener('antiqua:drops-refresh',()=>{const shell=q('[data-drop-route]');if(shell){shell.dataset.dropLoading='false';renderDropRoute().catch(console.error)}});
setInterval(()=>document.querySelectorAll('[data-drop-release]').forEach(el=>{el.textContent=remaining(el.dataset.dropRelease)}),30000);
renderDropRoute().catch(console.error);
