import {api,safe,copy,esc,moneyMinor,toast} from './core.js';

let loading=false,lastData=null;
const moneyMap=m=>Object.keys(m||{}).length?Object.entries(m).map(([c,v])=>moneyMinor(v,c)).join(' · '):'—';
const option=(v,ru,en)=>'<option value="'+esc(v)+'">'+esc(copy(ru,en))+'</option>';
const stateLabel=v=>{const k=String(v||'');const ru={ACTIVE:'Активно',COMPLETED:'Завершено',PREPARING:'Подготовка',INTERNAL_HYPOTHESIS:'Внутренняя гипотеза',WRITTEN_ACCEPTANCE:'Письменное согласование',INVOICED:'Счёт выставлен',VERIFIED_CASH:'Оплата подтверждена',RENEWAL:'Продление',HIGH:'Высокая',MEDIUM:'Средняя',LOW:'Низкая',UNPROVEN:'Не доказано',POSTGRES:'Постоянное хранилище',MEMORY_FALLBACK:'Временная память'};const en={ACTIVE:'Active',COMPLETED:'Completed',PREPARING:'Preparing',INTERNAL_HYPOTHESIS:'Internal hypothesis',WRITTEN_ACCEPTANCE:'Written acceptance',INVOICED:'Invoiced',VERIFIED_CASH:'Verified cash',RENEWAL:'Renewal',HIGH:'High',MEDIUM:'Medium',LOW:'Low',UNPROVEN:'Unproven',POSTGRES:'PostgreSQL',MEMORY_FALLBACK:'Memory fallback'};return copy(ru[k]||k.replaceAll('_',' '),en[k]||k.replaceAll('_',' '))};

function pilotCard(p){
 const s=p.summary||{},price=s.pricingEvidence||{};
 return '<article class="commercial-evidence-pilot" data-commercial-pilot="'+esc(p.id)+'">'+
  '<div class="commercial-evidence-pilot-head">'+
   '<div><span>'+esc(stateLabel(p.status))+' · '+esc(p.sellerId)+'</span><h3>'+esc(p.name)+'</h3><small>'+esc((p.startsAt||'').slice(0,10))+' → '+esc((p.endsAt||'').slice(0,10))+'</small></div>'+
   '<div><b>'+esc(stateLabel(s.evidenceLevel||'INTERNAL_HYPOTHESIS'))+'</b><small>'+copy('Надёжность подтверждения цены','Pricing confidence')+': '+esc(stateLabel(price.confidence||'UNPROVEN'))+'</small></div>'+
  '</div>'+
  '<div class="commercial-evidence-summary">'+
   '<div><strong>'+moneyMap(s.quotedMinorByCurrency)+'</strong><span>'+copy('Предложено','Quoted')+'</span></div>'+
   '<div><strong>'+moneyMap(s.acceptedMinorByCurrency)+'</strong><span>'+copy('Принята цена','Accepted')+'</span></div>'+
   '<div><strong>'+moneyMap(s.cashReceivedMinorByCurrency)+'</strong><span>'+copy('Получено денег','Cash received')+'</span></div>'+
   '<div><strong>'+moneyMap(s.directCostMinorByCurrency)+'</strong><span>'+copy('Прямые затраты','Direct cost')+'</span></div>'+
   '<div><strong>'+moneyMap(s.grossContributionMinorByCurrency)+'</strong><span>'+copy('Валовой вклад','Gross contribution')+'</span></div>'+
  '</div>'+
  '<form class="commercial-evidence-form" data-commercial-evidence-form="'+esc(p.id)+'">'+
   '<div class="commercial-evidence-form-head"><strong>'+copy('Добавить подтверждённое событие','Append verified event')+'</strong><small>'+copy('История не переписывается. Ошибка исправляется отдельным аннулирующим событием через защищённый контур.','History is not rewritten. Corrections use a separate void event through the governed flow.')+'</small></div>'+
   '<label><span>'+copy('Событие','Event')+'</span><select name="eventType" required>'+
    option('QUOTE_ISSUED','Предложение цены отправлено','Quote issued')+
    option('PRICE_VERBAL_ACCEPTED','Цена устно согласована','Price verbally accepted')+
    option('PRICE_WRITTEN_ACCEPTED','Цена письменно согласована','Price written accepted')+
    option('INVOICE_ISSUED','Счёт выставлен','Invoice issued')+
    option('PAYMENT_RECEIVED','Оплата получена','Payment received')+
    option('REFUND_RECORDED','Возврат зафиксирован','Refund recorded')+
    option('DIRECT_COST_RECORDED','Прямые затраты зафиксированы','Direct cost recorded')+
    option('RENEWAL_PROPOSED','Продление предложено','Renewal proposed')+
    option('RENEWAL_ACCEPTED','Продление принято','Renewal accepted')+
    option('RENEWAL_REJECTED','Продление отклонено','Renewal rejected')+
    option('EXPANSION_ACCEPTED','Расширение принято','Expansion accepted')+
   '</select></label>'+
   '<label><span>'+copy('Источник выручки','Revenue stream')+'</span><select name="revenueStream">'+
    option('PROFESSIONAL_SAAS','Профессиональная подписка','Professional SaaS')+
    option('PARTNER_EDITION','Партнёрская версия','Partner Edition')+
    option('CULTURAL_PARTNERSHIP','Культурное партнёрство','Cultural Partnership')+
    option('ESTATE_ARCHIVE','Наследие / архив','Estate / Archive')+
    option('INSTITUTIONAL_RESEARCH','Институциональное исследование','Institutional Research')+
    option('TRANSACTION_REVENUE','Доход от сделки','Transaction Revenue')+
   '</select></label>'+
   '<label><span>'+copy('Класс выручки','Revenue class')+'</span><select name="revenueClass"><option value="">—</option>'+option('RECURRING','Регулярная','Recurring')+option('ONE_TIME','Разовая','One-time')+option('USAGE','По использованию','Usage')+option('TRANSACTION','За транзакцию','Transaction')+option('SPONSORSHIP','Спонсорская','Sponsorship')+option('PROJECT','Проектная','Project')+'</select></label>'+
   '<label><span>'+copy('Класс затрат','Cost class')+'</span><select name="costClass"><option value="">—</option>'+option('ACQUISITION','Привлечение','Acquisition')+option('ONBOARDING','Подключение','Onboarding')+option('SUPPORT','Поддержка','Support')+option('PROVIDER','Провайдер','Provider')+option('EVENT_DELIVERY','Проведение мероприятия','Event delivery')+option('RESEARCH_DELIVERY','Исследовательские работы','Research delivery')+option('OTHER','Прочее','Other')+'</select></label>'+
   '<label><span>'+copy('Сумма','Amount')+'</span><input name="amount" type="number" min="0" step="0.01" placeholder="0.00"></label>'+
   '<label><span>'+copy('Валюта','Currency')+'</span><input name="currency" value="EUR" maxlength="3" pattern="[A-Za-z]{3}"></label>'+
   '<label class="wide"><span>'+copy('Ссылка на подтверждение','Evidence reference')+'</span><input name="evidenceRef" placeholder="proposal:, invoice:, bank:, cost:"></label>'+
   '<label class="wide"><span>'+copy('Комментарий / источник','Comment / source note')+'</span><input name="note" maxlength="500" placeholder="'+copy('Без банковских секретов и персональных данных','No banking secrets or personal data')+'"></label>'+
   '<button class="primary-button" type="submit">'+copy('Зафиксировать событие','Append event')+'</button>'+
  '</form>'+
 '</article>';
}

function panel(data,{standalone=false}={}){
 const persistence=data?.persistence||'UNKNOWN',pilots=data?.pilots||[];
 const body=persistence!=='POSTGRES'
  ?'<div class="commercial-evidence-blocked"><strong>${copy('ТРЕБУЕТСЯ ПОСТОЯННОЕ ХРАНИЛИЩЕ POSTGRESQL','DURABLE POSTGRESQL REQUIRED')}</strong><p>'+copy('Запись коммерческих доказательств закрыта fail-closed: preview memory нельзя использовать как источник финансовой истины.','Commercial evidence writes are fail-closed: preview memory cannot be used as a financial source of truth.')+'</p></div>'
  :pilots.length?'<div class="commercial-evidence-pilots">'+pilots.map(pilotCard).join('')+'</div>'
  :'<div class="empty-state">'+copy('Реальных пилотных проектов пока нет. Сначала создайте пилот и зафиксируйте его объём.','No real pilot engagements yet. Create and freeze a pilot scope first.')+'</div>';
 const shell=standalone?'<section id="commercialEvidenceStandalone" class="account-block commercial-evidence-console">':'<div data-v14-panel="commercial-evidence" hidden class="v14-panel commercial-evidence-console">',close=standalone?'</section>':'</div>';return shell+
  '<div class="commercial-evidence-head"><div><div class="eyebrow">'+copy('КОНТУР КОММЕРЧЕСКИХ ДОКАЗАТЕЛЬСТВ · v0.46','COMMERCIAL EVIDENCE AUTHORITY · v0.46')+'</div><h3>'+copy('Доказательство денег','Proof of money')+'</h3><p>'+copy('Журнал ведёт только оператор: предложение цены → согласованная цена → счёт → оплата → прямые затраты → продление. Предложение, письмо о намерениях и счёт не считаются полученными деньгами.','Operator-only append ledger: quote → accepted price → invoice → cash → direct cost → renewal. Quote, LOI and invoice never become cash.')+'</p></div><span>'+esc(stateLabel(persistence))+'</span></div>'+
  body+close;
}

async function mount(){
 if(loading||document.querySelector('[data-v14-tab="commercial-evidence"]')||document.querySelector('#commercialEvidenceStandalone'))return;
 const host=document.querySelector('.account-v12');if(!host)return;
 loading=true;
 try{
  const d=await safe('/api/operator/commercial-evidence/pilots');if(!d?.commercial||!host.isConnected)return;
  lastData=d.commercial;
  const ops=document.querySelector('#v14Operations'),tabs=ops?.querySelector('.v14-tabs'),panels=ops?.querySelector('.v14-panels');
  const box=document.createElement('div');
  if(tabs&&panels){
   const btn=document.createElement('button');btn.dataset.v14Tab='commercial-evidence';btn.textContent=copy('Коммерческие доказательства','Commercial Evidence');tabs.append(btn);
   box.innerHTML=panel(lastData);panels.append(box.firstElementChild);
  }else{
   box.innerHTML=panel(lastData,{standalone:true});host.append(box.firstElementChild);
  }
 }catch(e){console.error(e)}finally{loading=false}
}

async function refresh(){
 const d=await safe('/api/operator/commercial-evidence/pilots');if(!d?.commercial)return;lastData=d.commercial;
 const old=document.querySelector('[data-v14-panel="commercial-evidence"],#commercialEvidenceStandalone');if(!old)return;
 const standalone=old.id==='commercialEvidenceStandalone',wasHidden=old.hidden;
 const box=document.createElement('div');box.innerHTML=panel(lastData,{standalone});const next=box.firstElementChild;if(!standalone)next.hidden=wasHidden;old.replaceWith(next);
}

document.addEventListener('submit',async e=>{
 const f=e.target.closest('[data-commercial-evidence-form]');if(!f)return;e.preventDefault();
 try{
  const d=Object.fromEntries(new FormData(f).entries()),amount=String(d.amount||'').trim();
  const key='commercial-ui-'+Date.now()+'-'+(crypto.randomUUID?crypto.randomUUID():Math.random().toString(16).slice(2));
  const payload={note:String(d.note||'').trim()};if(d.revenueClass)payload.revenueClass=d.revenueClass;if(d.costClass)payload.costClass=d.costClass;const body={eventType:d.eventType,revenueStream:d.revenueStream||null,currency:String(d.currency||'').toUpperCase()||null,evidenceRef:String(d.evidenceRef||'').trim()||null,clientActionId:key,payload};
  if(amount!=='')body.amountMinor=Math.round(Number(amount)*100);
  await api('/api/operator/pilots/'+encodeURIComponent(f.dataset.commercialEvidenceForm)+'/commercial-evidence/events',{method:'POST',body:JSON.stringify(body)});
  toast(copy('Коммерческое событие зафиксировано','Commercial event recorded'));await refresh();
 }catch(err){toast(err.message)}
});

const observer=new MutationObserver(()=>mount());observer.observe(document.querySelector('#app'),{childList:true,subtree:true});
window.addEventListener('hashchange',()=>setTimeout(mount,50));setTimeout(mount,100);
