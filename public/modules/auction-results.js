import {safe,copy,esc,moneyMinor,date} from './core.js';

let passportSeq=0;
const labels={
 SCHEDULED:['Запланирован','Scheduled'],
 LIVE:['Торги идут','Live'],
 PENDING:['Результат обрабатывается','Result pending'],
 HAMMERED:['Цена молотка','Hammered'],
 SALE_IN_PROGRESS:['Сделка исполняется','Sale in progress'],
 SOLD:['Продано','Sold'],
 UNSOLD:['Не продано','Unsold'],
 UNDER_REVIEW:['Результат на проверке','Result under review'],
 NOT_COMPLETED:['Сделка не завершена','Sale not completed'],
 REOFFERED:['Повторно выставлено','Reoffered'],
 VOID:['Результат аннулирован','Result void']
};
const label=s=>copy(...(labels[String(s||'').toUpperCase()]||[String(s||''),String(s||'')]));
const isClosed=r=>r&&r.auctionState==='CLOSED';
function money(v,c){return v==null?'—':moneyMinor(v,c)}
function resultCopy(r){
 if(r.status==='SOLD')return copy('Продажа завершена; реализованная цена подтверждена после завершения расчёта и исполнения.','Sale completed; realized price is confirmed only after settlement and fulfillment completed.');
 if(r.status==='HAMMERED')return copy('Торги завершены. Это цена молотка, а не подтверждение завершённой продажи.','Bidding ended. This is the hammer amount, not confirmation of a completed sale.');
 if(r.status==='SALE_IN_PROGRESS')return copy('Цена молотка зафиксирована; расчёт или исполнение сделки ещё продолжаются.','Hammer amount is fixed; payment or fulfillment is still in progress.');
 if(r.status==='UNSOLD')return copy('Торги завершены без состоявшейся продажи.','Auction ended without a completed sale.');
 if(r.status==='NOT_COMPLETED')return copy('Сделка после торгов не была завершена.','The post-auction transaction was not completed.');
 if(r.status==='REOFFERED')return copy('Предыдущая сделка не завершена; предмет повторно предложен рынку.','The previous transaction did not complete; the object has been reoffered.');
 if(r.status==='VOID')return copy('Результат торгов аннулирован.','The auction result was voided.');
 if(r.status==='UNDER_REVIEW')return copy('Результат временно не финализирован до завершения проверки.','The result is not final while review is ongoing.');
 return copy('Финальный статус сделки ещё не подтверждён.','Final sale status is not yet confirmed.');
}
function cardMarkup(r){
 const amount=r.status==='SOLD'?r.realizedAmountMinor:r.hammerAmountMinor;
 const amountLabel=r.status==='SOLD'?copy('Реализованная цена','Realized price'):copy('Цена молотка','Hammer amount');
 return `<div class="auction-result-card-v20" data-auction-result="${esc(r.auctionId)}">
  <div><span>${esc(label(r.status))}</span>${amount!=null?`<strong>${money(amount,r.currency)}</strong><small>${amountLabel}</small>`:''}</div>
 </div>`;
}
function dossierMarkup(r){
 return `<aside id="dossierAuctionResultV20" class="dossier-auction-result-v20">
  <div class="eyebrow">AUCTION RESULT</div>
  <div class="auction-result-head"><div><span>${esc(label(r.status))}</span><h3>${r.status==='SOLD'?money(r.realizedAmountMinor,r.currency):r.hammerAmountMinor!=null?money(r.hammerAmountMinor,r.currency):'—'}</h3></div><small>${r.status==='SOLD'?copy('Реализованная цена','Realized price'):r.hammerAmountMinor!=null?copy('Цена молотка','Hammer amount'):copy('Итог без цены продажи','No sale price')}</small></div>
  <p>${esc(resultCopy(r))}</p>
  <div class="auction-result-meta"><span>${copy('Ставок','Bids')}: ${Number(r.bidCount||0)}</span><span>${copy('Завершение торгов','Auction ended')}: ${date(r.endedAt)}</span><span>${copy('Финальный статус','Final')}: ${r.final?copy('да','yes'):copy('нет','no')}</span></div>
 </aside>`;
}
async function hydrateCard(node){
 if(node.dataset.auctionResultLoaded==='1')return;
 node.dataset.auctionResultLoaded='1';
 const id=node.dataset.auctionId;if(!id)return;
 const d=await safe(`/api/auctions/${encodeURIComponent(id)}/result`);const r=d?.result;
 if(!isClosed(r))return;
 const host=node.querySelector('.card-commercial');if(!host)return;
 host.innerHTML=cardMarkup(r);
 const tag=node.querySelector('.commerce-tag');if(tag)tag.textContent=label(r.status);
}
async function hydrateCards(){
 const nodes=[...document.querySelectorAll('[data-auction-id]')];
 await Promise.all(nodes.map(n=>hydrateCard(n).catch(()=>{n.dataset.auctionResultLoaded=''})));
}
window.addEventListener('antiqua:passport',async e=>{
 const auctionId=String(e.detail?.auctionId||'');const seq=++passportSeq;
 document.querySelector('#dossierAuctionResultV20')?.remove();
 if(!auctionId)return;
 const d=await safe(`/api/auctions/${encodeURIComponent(auctionId)}/result`),r=d?.result;
 if(seq!==passportSeq||!isClosed(r))return;
 const body=document.querySelector('#dialog[open] .dossier-body');if(!body)return;
 const box=document.createElement('div');box.innerHTML=dossierMarkup(r);
 const tabs=body.querySelector('.dossier-tabs');if(tabs)tabs.before(box.firstElementChild);else body.prepend(box.firstElementChild);
});
const observer=new MutationObserver(()=>hydrateCards());
observer.observe(document.querySelector('#app'),{childList:true,subtree:true});
window.addEventListener('hashchange',()=>setTimeout(hydrateCards,20));
setTimeout(hydrateCards,40);
