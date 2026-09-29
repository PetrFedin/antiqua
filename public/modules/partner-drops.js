import {api,safe,copy,local,toast,setPartnerAttribution,setPartnerExhibitionContext,partnerExhibitionContext,clearPartnerAttribution} from './core.js';

const q=(s,r=document)=>r?.querySelector?.(s)||null;
const qa=(s,r=document)=>[...(r?.querySelectorAll?.(s)||[])];
const routeId=()=>{const [root,id]=location.hash.slice(1).split('/');return root==='exhibition'?id:null};
const fmt=x=>({CURATED_DROP:copy('Кураторский выпуск','Curated drop'),PARTNER_FAIR:copy('Партнёрская ярмарка','Partner fair'),GALLERY_SHOW:copy('Галерейная выставка','Gallery show'),ARTIST_LAUNCH:copy('Новый автор','Artist launch'),EDITION:copy('Лимитированная серия','Edition')})[x]||String(x||'').replaceAll('_',' ');
const stage=x=>({PREVIEW:copy('Предпросмотр','Preview'),LIVE:copy('Сейчас','Live now'),ARCHIVED:copy('Архив','Archive')})[x]||x;
const humanDate=v=>v?new Intl.DateTimeFormat(document.documentElement.lang==='ru'?'ru-RU':'en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'';
let seq=0,timer=null;

function remaining(v){const ms=Date.parse(v||'')-Date.now();if(!Number.isFinite(ms)||ms<=0)return copy('Скоро','Soon');const total=Math.floor(ms/1000),d=Math.floor(total/86400),h=Math.floor(total%86400/3600),m=Math.floor(total%3600/60);return d>0?`${d}${copy(' д','d')} ${h}${copy(' ч','h')}`:`${h}${copy(' ч','h')} ${m}${copy(' мин','m')}`}

function renderPanel(data){
 const d=data.drop,e=data.exhibition,wrap=document.createElement('section');wrap.className='partner-drop-panel';wrap.dataset.partnerDropPanel='';
 const top=document.createElement('div');top.className='partner-drop-top';
 const identity=document.createElement('div');identity.className='partner-drop-identity';identity.innerHTML=`<span>${fmt(d.format)}</span><b>${stage(d.stage)}</b>`;top.append(identity);
 if(d.partner?.name){const partner=document.createElement('div');partner.className='partner-drop-partner';partner.innerHTML=`<small>${copy('Партнёр / куратор','Partner / curator')}</small><strong></strong>`;partner.querySelector('strong').textContent=d.partner.name;top.append(partner)}
 wrap.append(top);
 const grid=document.createElement('div');grid.className='partner-drop-grid';
 const meta=document.createElement('div');meta.className='partner-drop-meta';
 if(d.theme){const p=document.createElement('p');p.textContent=local(d.theme);meta.append(p)}
 if(d.curator?.name&&d.curator.name!==d.partner?.name){const p=document.createElement('p');p.innerHTML=`<small>${copy('Куратор','Curator')}</small> `;const b=document.createElement('b');b.textContent=d.curator.name;p.append(b);meta.append(p)}
 if(d.stage==='PREVIEW'&&d.releaseAt){const time=document.createElement('div');time.className='partner-drop-time';time.innerHTML=`<span>${copy('Открытие','Release')}</span><strong data-drop-countdown></strong><small></small>`;time.querySelector('strong').textContent=remaining(d.releaseAt);time.querySelector('small').textContent=humanDate(d.releaseAt);meta.append(time)}
 else if(d.stage==='LIVE'){const time=document.createElement('div');time.className='partner-drop-time live';time.innerHTML=`<span>${copy('Выпуск открыт','Edition is live')}</span><strong>${copy('Исследуйте сейчас','Explore now')}</strong>${d.salesCloseAt?`<small>${copy('До ','Until ')}${humanDate(d.salesCloseAt)}</small>`:''}`;meta.append(time)}
 else if(d.stage==='ARCHIVED'){const time=document.createElement('div');time.className='partner-drop-time archived';time.innerHTML=`<span>${copy('После события','After the event')}</span><strong>${copy('Архив остаётся в Antiqua','The archive stays in Antiqua')}</strong>`;meta.append(time)}
 grid.append(meta);
 const actions=document.createElement('div');actions.className='partner-drop-actions';
 const follow=document.createElement('button');follow.type='button';follow.className='primary-button';follow.dataset.dropFollow=e.id;follow.dataset.enabled=String(!d.follow.following);follow.textContent=d.follow.following?copy('✓ Слежу за выпуском','✓ Following'):copy('Следить за выпуском','Follow this edition');actions.append(follow);
 const note=document.createElement('small');note.textContent=copy('Цена и доступность определяются карточкой каждого предмета. Участие в выпуске не означает, что предмет продаётся.','Price and availability are determined by each object card. Inclusion in an edition does not imply that an object is for sale.');actions.append(note);
 grid.append(actions);wrap.append(grid);return wrap
}


function retentionCell(label,r){
 const rate=r?.rate==null?'—':Math.round(Number(r.rate)*100)+'%';
 return '<div><span>'+label+'</span><strong>'+rate+'</strong><small>'+copy('вернулись','returned')+' '+Number(r?.returned||0)+' / '+copy('созрело','matured')+' '+Number(r?.matured||0)+' · '+copy('ожидает окна','pending')+' '+Number(r?.pending||0)+'</small></div>'
}
function renderPilotAnalytics(a){
 const x=a.attributed||{},c=x.counts||{},wrap=document.createElement('section');wrap.className='partner-pilot-analytics';
 wrap.innerHTML='<div class="partner-pilot-analytics-head"><div><span>PARTNER PILOT ANALYTICS · v0.33</span><h3>'+copy('Что действительно пришло из этого выпуска','What actually came from this edition')+'</h3><p>'+copy('Только attributed path. Общие просмотры предметов из Shop, Journal или прямых ссылок сюда не засчитываются.','Attributed path only. Object-wide views from Shop, Journal or direct links are not credited here.')+'</p></div><b>'+Number(a.cohort?.objects||0)+' '+copy('предм.','objects')+'</b></div>'+
 '<div class="partner-pilot-kpis">'+
 '<div><span>'+copy('Открытия выпуска','Edition opens')+'</span><strong>'+Number(c.DROP_OPEN||0)+'</strong><small>'+Number(x.uniqueViewers?.DROP_OPEN||0)+' '+copy('deduped viewers','deduped viewers')+'</small></div>'+
 '<div><span>'+copy('Открытия предметов','Object opens')+'</span><strong>'+Number(c.OBJECT_OPEN||0)+'</strong><small>'+Number(x.uniqueViewers?.OBJECT_OPEN||0)+' '+copy('deduped viewers','deduped viewers')+'</small></div>'+
 '<div><span>'+copy('Сейчас следят','Current followers')+'</span><strong>'+Number(x.currentFollowers||0)+'</strong><small>'+Number(c.FOLLOW||0)+' '+copy('attributed follow events','attributed follow events')+'</small></div>'+
 '<div><span>'+copy('Явный intent','Explicit intent')+'</span><strong>'+Number(x.explicitIntent||0)+'</strong><small>'+Number(c.INQUIRY_CREATED||0)+' inquiry · '+Number(c.VIEWING_REQUESTED||0)+' viewing · '+Number(c.OFFER_CREATED||0)+' offer</small></div>'+
 '<div><span>'+copy('Заказы','Orders')+'</span><strong>'+Number(x.orders||0)+'</strong><small>'+copy('только подтверждённый order authority','confirmed order authority only')+'</small></div>'+
 '</div>'+
 '<div class="partner-pilot-retention">'+retentionCell('D7',a.retention?.d7)+retentionCell('D30',a.retention?.d30)+'</div>'+
 '<div class="partner-pilot-method"><strong>'+copy('Методология','Methodology')+'</strong><p>'+copy('D7/D30 считаются только для авторизованных пользователей после созревания окна. Анонимный cross-day retention не оценивается. Метрики разных типов не складываются в фиктивную “уникальную аудиторию”.','D7/D30 are measured only for authenticated users after the window matures. Anonymous cross-day retention is not estimated. Different signal types are not summed into a fictitious “unique audience”.')+'</p></div>';
 return wrap
}

function startCountdown(releaseAt){clearInterval(timer);if(!releaseAt)return;const tick=()=>qa('[data-drop-countdown]').forEach(el=>el.textContent=remaining(releaseAt));tick();timer=setInterval(tick,30000)}

async function decorateDetail(){
 const id=routeId(),hero=q('.exhibition-page .exhibition-hero');if(!id||!hero||q('[data-partner-drop-panel]',hero))return;const ticket=++seq,data=await safe('/api/exhibitions/'+encodeURIComponent(id)+'/drop');if(ticket!==seq||routeId()!==id||!data)return;
 await api('/api/exhibitions/'+encodeURIComponent(id)+'/pilot/events',{method:'POST',body:JSON.stringify({eventType:'DROP_OPEN',metadata:{surface:'PARTNER_DROP',stage:data.drop.stage}})}).catch(()=>null);
 const eyebrow=q('.eyebrow',hero);if(eyebrow)eyebrow.textContent=fmt(data.drop.format)+' · '+stage(data.drop.stage);const title=q('h1',hero);const panel=renderPanel(data);(q('.curatorial-statement',hero)||title)?.after(panel);startCountdown(data.drop.stage==='PREVIEW'?data.drop.releaseAt:null)
}

async function decorateCards(){
 const cards=qa('.exhibition-card');for(const card of cards){if(card.dataset.partnerDropDecorated)return;const id=String(card.getAttribute('href')||'').split('/')[1];if(!id)continue;card.dataset.partnerDropDecorated='1';const data=await safe('/api/exhibitions/'+encodeURIComponent(id)+'/drop');if(!data||!card.isConnected)continue;const micro=q('.micro',card),badge=q('.exhibition-image span',card);if(micro)micro.textContent=fmt(data.drop.format);if(badge)badge.textContent=stage(data.drop.stage);if(data.drop.partner?.name){const p=document.createElement('small');p.className='partner-drop-card-partner';p.textContent=data.drop.partner.name;q('.exhibition-copy',card)?.append(p)}}
}

async function refresh(){await Promise.all([decorateDetail(),decorateCards()])}
const observer=new MutationObserver(()=>queueMicrotask(()=>refresh().catch(console.error)));const app=q('#app');if(app)observer.observe(app,{childList:true,subtree:false});
window.addEventListener('hashchange',()=>{clearInterval(timer);const root=location.hash.slice(1).split('/')[0];if(!['exhibition','ensemble'].includes(root))clearPartnerAttribution();setTimeout(()=>refresh().catch(console.error),0)});
document.addEventListener('click',async e=>{const b=e.target.closest?.('[data-drop-follow]');if(!b)return;e.preventDefault();b.disabled=true;try{const enabled=b.dataset.enabled==='true';const result=await api('/api/exhibitions/'+encodeURIComponent(b.dataset.dropFollow)+'/follow',{method:'POST',body:JSON.stringify({enabled})});b.dataset.enabled=String(!result.enabled);b.textContent=result.enabled?copy('✓ Слежу за выпуском','✓ Following'):copy('Следить за выпуском','Follow this edition');toast(result.enabled?copy('Уведомим, когда выпуск откроется','We will notify you when the edition opens'):copy('Подписка на выпуск отключена','Edition follow removed'))}catch(err){toast(err.message)}finally{b.disabled=false}});
refresh().catch(console.error);

// partner path attribution: exhibition -> direct object or exhibition -> ensemble -> object.
function attributeObject(exhibitionId,objectId,surface){
 if(!exhibitionId||!objectId)return;setPartnerAttribution(exhibitionId,objectId);
 void api('/api/exhibitions/'+encodeURIComponent(exhibitionId)+'/pilot/events',{method:'POST',body:JSON.stringify({eventType:'OBJECT_OPEN',objectId,metadata:{surface}})}).catch(()=>null)
}
document.addEventListener('click',e=>{
 const direct=e.target.closest?.('.exhibition-page [data-passport]');
 if(direct){const id=routeId();return attributeObject(id,direct.dataset.passport,'EXHIBITION')}
 const ensemble=e.target.closest?.('.exhibition-page a[href^="#ensemble/"]');
 if(ensemble){const id=routeId();if(id)setPartnerExhibitionContext(id);return}
 const ensembleObject=e.target.closest?.('[class*="ensemble"] [data-passport]');
 if(ensembleObject&&location.hash.startsWith('#ensemble/')){const ctx=partnerExhibitionContext();if(ctx)attributeObject(ctx.exhibitionId,ensembleObject.dataset.passport,'EXHIBITION')}
},true);
