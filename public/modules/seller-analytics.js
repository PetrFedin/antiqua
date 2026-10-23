import {safe,copy,esc,local} from './core.js';

let loading=false;
const metric=(value,label)=>`<div class="kpi"><strong>${esc(value)}</strong><span>${label}</span></div>`;
const exactGross=(amount,currency)=>new Intl.NumberFormat(
 document.documentElement.lang==='en'?'en-GB':'ru-RU',{
  style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2
 }).format(amount/100);
const moneyByCurrency=groups=>Object.entries(groups||{}).map(
 ([currency,amount])=>exactGross(amount,currency)).join(' · ')||'—';
const settledText=summary=>moneyByCurrency(summary.grossPaidByCurrency||summary.settledByCurrency);

function rowCard(x){
 return `<article class="account-card seller-analytics-object">
  <div class="account-card-head"><span class="status-pill">${esc(x.listingStatus||copy('без листинга','no listing'))}</span><strong>${esc(x.objectCode)}</strong></div>
  <h3>${esc(local(x.title))}</h3>
  <small>${copy('Просмотры','Views')}: ${x.views||0} · ${copy('Сохранения','Saves')}: ${x.saved} · ${copy('Наблюдение','Watch')}: ${x.watching}</small>
  <div class="draft-media-line">${copy('Диалоги','Threads')} ${x.conversations} · ${copy('Предложения','Offers')} ${x.offers} · ${copy('Ставки','Bids')} ${x.bids} · ${copy('Заказы','Orders')} ${x.orders}</div>
  ${x.settlements?`<div class="draft-media-line">${copy('Аукционные расчёты','Auction settlements')}: ${x.settlements} · ${copy('Оплачено по статусу','Paid by status')}: ${esc(moneyByCurrency(x.grossPaidByCurrency))}</div>`:''}
  ${x.openDisputes?`<div class="draft-media-line">${copy('Открытые споры','Open disputes')}: ${x.openDisputes}</div>`:''}
 </article>`;
}

function markup(a){
 const s=a.summary||{},objects=a.objects||[];
 return `<section id="sellerAnalyticsV17" class="account-block seller-analytics-v17">
  <div class="block-head"><div><div class="eyebrow">DEALER ANALYTICS</div><h2>${copy('Спрос и коммерческая воронка','Demand & commercial funnel')}</h2><p>${copy('Только фактические действия внутри ANTIQUA. Просмотр — дедуплицированное открытие паспорта произведения в 30-минутном окне; личности посетителей продавцу не раскрываются.','Only measured ANTIQUA actions are shown. A view is a deduplicated artwork-passport session in a 30-minute window; visitor identities are not exposed to the seller.')}</p></div></div>
  <div class="v12-kpis">
   ${metric(s.objects||0,copy('Произведения','Artworks'))}
   ${metric(s.views||0,copy('Просмотры','Views'))}
   ${metric(s.saved||0,copy('Сохранения','Saves'))}
   ${metric(s.conversations||0,copy('Диалоги','Threads'))}
   ${metric(s.offers||0,copy('Предложения','Offers'))}
   ${metric(s.orders||0,copy('Заказы (все статусы)','Orders (all states)'))}
   ${metric(s.bids||0,copy('Ставки','Bids'))}
   ${metric(settledText(s),copy('Оплачено по статусу, брутто','Paid status, gross'))}
   ${metric(s.awaitingSettlements||0,copy('Ожидают оплаты','Awaiting payment'))}
   ${metric(s.disputedSettlements||0,copy('Оспариваются','Disputed'))}
   ${metric(s.conversationsPer100ViewSessions==null?'—':s.conversationsPer100ViewSessions.toFixed(1),
    copy('Диалогов на 100 просмотров¹','Threads per 100 views¹'))}
   ${metric(s.openDisputes||0,copy('Открытые споры','Open disputes'))}
  </div>
  <p class="seller-analytics-method" role="note">${copy(
   '¹ Диалоги / дедуплицированные сеансы просмотра × 100; это интенсивность обращений, не конверсия покупателей. Финансовые суммы — по статусам PAID / FULFILLMENT / COMPLETED, без спорных записей и без конвертации валют. Это не банковская сверка, чистая выручка или подтверждение выплаты.',
   '¹ Threads / deduplicated viewing sessions × 100; an activity intensity measure, not buyer conversion. Gross amounts use PAID / FULFILLMENT / COMPLETED statuses, exclude disputed records and never convert currencies. No bank reconciliation, net proceeds or payout confirmation is implied.'
  )}</p>
  <div class="block-head compact-head"><div><div class="eyebrow">ARTWORK SIGNALS</div><h3>${copy('Произведения по фактическим сигналам спроса','Artworks by measured demand signals')}</h3></div></div>
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
