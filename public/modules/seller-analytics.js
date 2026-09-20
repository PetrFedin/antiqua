import {safe,copy,esc,local,moneyMinor} from './core.js';

let loading=false;
const metric=(value,label)=>`<div class="kpi"><strong>${esc(value)}</strong><span>${label}</span></div>`;
const settledText=summary=>Object.entries(summary.settledByCurrency||{}).map(([currency,amount])=>moneyMinor(amount,currency)).join(' · ')||'—';

function rowCard(x){
 const demand=x.saved+x.watching+x.conversations+x.offers+x.bids+x.orders;
 return `<article class="account-card seller-analytics-object">
  <div class="account-card-head"><span class="status-pill">${esc(x.listingStatus||copy('без листинга','no listing'))}</span><strong>${esc(x.objectCode)}</strong></div>
  <h3>${esc(local(x.title))}</h3>
  <small>${copy('Спрос','Demand')}: ${demand} · ${copy('Просмотры','Views')}: ${x.views||0} · ${copy('Сохранения','Saves')}: ${x.saved} · ${copy('Наблюдение','Watch')}: ${x.watching}</small>
  <div class="draft-media-line">${copy('Диалоги','Threads')} ${x.conversations} · ${copy('Предложения','Offers')} ${x.offers} · ${copy('Ставки','Bids')} ${x.bids} · ${copy('Заказы','Orders')} ${x.orders}</div>
  ${x.settlements?`<div class="draft-media-line">${copy('Расчёты','Settlements')}: ${x.settlements} · ${moneyMinor(x.settledValueMinor,x.settlementCurrency||x.currency||'EUR')}</div>`:''}
  ${x.openDisputes?`<div class="draft-media-line">${copy('Открытые споры','Open disputes')}: ${x.openDisputes}</div>`:''}
 </article>`;
}

function markup(a){
 const s=a.summary||{},objects=a.objects||[];
 return `<section id="sellerAnalyticsV17" class="account-block seller-analytics-v17">
  <div class="block-head"><div><div class="eyebrow">DEALER ANALYTICS</div><h2>${copy('Спрос и коммерческая воронка','Demand & commercial funnel')}</h2><p>${copy('Только фактические действия внутри ANTIQUA. Просмотр — дедуплицированное открытие паспорта предмета в 30-минутном окне; личности посетителей продавцу не раскрываются.','Only measured ANTIQUA actions are shown. A view is a deduplicated object-passport session in a 30-minute window; visitor identities are not exposed to the seller.')}</p></div></div>
  <div class="v12-kpis">
   ${metric(s.objects||0,copy('Предметы','Objects'))}
   ${metric(s.views||0,copy('Просмотры','Views'))}
   ${metric(s.saved||0,copy('Сохранения','Saves'))}
   ${metric(s.conversations||0,copy('Диалоги','Threads'))}
   ${metric(s.offers||0,copy('Предложения','Offers'))}
   ${metric(s.orders||0,copy('Заказы','Orders'))}
   ${metric(s.bids||0,copy('Ставки','Bids'))}
   ${metric(settledText(s),copy('Закрытые расчёты','Settled value'))}
   ${metric(s.openDisputes||0,copy('Открытые споры','Open disputes'))}
  </div>
  <div class="block-head compact-head"><div><div class="eyebrow">OBJECT SIGNALS</div><h3>${copy('Предметы по силе измеримого спроса','Objects by measured demand')}</h3></div></div>
  <div class="account-card-grid compact">${objects.length?objects.map(rowCard).join(''):`<div class="empty-state">${copy('Измеримых действий пока нет','No measured actions yet')}</div>`}</div>
 </section>`;
}

async function mount(){
 if(document.querySelector('#sellerAnalyticsV17')||loading)return;
 const sellerForm=document.querySelector('.seller-workspace-form'),host=document.querySelector('.account-v12 .account-layout > div');
 if(!sellerForm||!host)return;
 loading=true;
 try{
  const d=await safe('/api/seller/analytics');if(!d?.analytics)return;
  const box=document.createElement('div');box.innerHTML=markup(d.analytics);host.prepend(box.firstElementChild);
 }catch(e){console.error(e)}finally{loading=false}
}

const observer=new MutationObserver(()=>mount());
observer.observe(document.querySelector('#app'),{childList:true,subtree:true});
window.addEventListener('hashchange',()=>setTimeout(mount,30));
setTimeout(mount,60);
