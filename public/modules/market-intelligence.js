import {safe,copy,esc,local,moneyMinor,date} from './core.js';

let seq=0;
const statusLabel=s=>({
 SOLD:copy('Продано','Sold'),HAMMERED:copy('Цена молотка','Hammered'),SALE_IN_PROGRESS:copy('Сделка исполняется','Sale in progress'),
 UNSOLD:copy('Не продано','Unsold'),NOT_COMPLETED:copy('Не завершено','Not completed'),UNDER_REVIEW:copy('На проверке','Under review'),
 REOFFERED:copy('Повторно выставлено','Reoffered'),VOID:copy('Аннулировано','Void'),PENDING:copy('Ожидается','Pending')
}[s]||String(s||''));
const reason=x=>'<span class="v25-reason">'+esc(local(x.label))+(x.value?': '+esc(local(x.value)):'')+'</span>';
function range(summary){
 const entries=Object.entries(summary?.realizedByCurrency||{});
 if(!entries.length)return '<div class="v25-no-realized">'+copy('Подтверждённых реализованных цен среди выбранных аналогов пока нет.','No confirmed realized prices among the selected comparables yet.')+'</div>';
 return '<div class="v25-ranges">'+entries.map(([ccy,x])=>'<div><span>'+esc(ccy)+' · '+Number(x.count||0)+' '+copy('прод.','sold')+'</span><b>'+esc(moneyMinor(x.minMinor,ccy))+' — '+esc(moneyMinor(x.maxMinor,ccy))+'</b><small>'+copy('Медиана','Median')+': '+esc(moneyMinor(x.medianMinor,ccy))+'</small></div>').join('')+'</div>'
}
function resultValues(x){
 const hammer=x.hammerAmountMinor!=null?'<div><span>'+copy('Цена молотка','Hammer')+'</span><b>'+esc(moneyMinor(x.hammerAmountMinor,x.currency))+'</b></div>':'';
 const realized=x.realizedAmountMinor!=null?'<div><span>'+copy('Реализованная цена','Realized')+'</span><b>'+esc(moneyMinor(x.realizedAmountMinor,x.currency))+'</b></div>':'';
 return hammer+realized
}
function card(x){
 return '<article class="v25-comp" data-market-comparable="'+esc(x.objectId)+'">'+
  '<div class="v25-comp-head"><span>'+esc(statusLabel(x.status))+'</span><span>'+esc(x.strength)+'</span></div>'+
  '<h4>'+esc(local(x.title))+'</h4><p>'+esc(local(x.maker))+' · '+esc(local(x.period))+'</p>'+
  '<div class="v25-values">'+resultValues(x)+'</div>'+
  '<div class="v25-reasons">'+(x.reasons||[]).slice(0,5).map(reason).join('')+'</div>'+
  '<div class="v25-source"><span>'+esc(x.source?.name||'—')+(x.source?.saleId?' · '+esc(x.source.saleId):'')+'</span><span>'+esc(date(x.endedAt))+'</span></div>'+
  '<button class="quiet-button" data-passport="'+esc(x.objectId)+'">'+copy('Открыть аналог','Open comparable')+'</button>'+
 '</article>'
}
function markup(d){
 return '<section id="dossierMarketIntelligenceV25" class="dossier-market-v25">'+
  '<div class="v25-head"><div><div class="eyebrow">MARKET INTELLIGENCE · v0.25</div><h3>'+copy('Сопоставимые результаты торгов','Comparable sales')+'</h3><p>'+copy('Аналоги отбираются только по каталожным признакам. Цена не участвует в подборе. Статистика реализованных цен включает только завершённые продажи SOLD; цена молотка показывается отдельно.','Comparables are selected only from catalogue attributes. Price is not used for matching. Realized-price statistics include only completed SOLD transactions; hammer amounts are shown separately.')+'</p></div></div>'+
  range(d.summary)+
  '<div class="v25-grid">'+(d.items||[]).map(card).join('')+'</div>'+
 '</section>'
}
window.addEventListener('antiqua:passport',async e=>{
 const id=String(e.detail?.id||'');if(!id)return;const request=++seq;
 document.querySelector('#dossierMarketIntelligenceV25')?.remove();
 const d=await safe('/api/lots/'+encodeURIComponent(id)+'/comparables?limit=8');
 if(request!==seq||!d?.items?.length)return;
 const body=document.querySelector('#dialog[open] .dossier-body');if(!body)return;
 const box=document.createElement('div');box.innerHTML=markup(d);
 const similar=body.querySelector('#dossierSimilarV18'),disclaimer=body.querySelector('.dossier-disclaimer');
 if(similar)similar.before(box.firstElementChild);else if(disclaimer)disclaimer.before(box.firstElementChild);else body.append(box.firstElementChild)
});
