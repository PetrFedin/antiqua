import {api,safe,copy,esc,moneyMinor,toast} from './core.js';

let loading=false,lastData=null;
const moneyMap=m=>Object.keys(m||{}).length?Object.entries(m).map(([c,v])=>moneyMinor(v,c)).join(' · '):'—';
const option=(v,label)=>'<option value="'+esc(v)+'">'+esc(label)+'</option>';

function pilotCard(p){
 const s=p.summary||{},price=s.pricingEvidence||{};
 return '<article class="commercial-evidence-pilot" data-commercial-pilot="'+esc(p.id)+'">'+
  '<div class="commercial-evidence-pilot-head">'+
   '<div><span>'+esc(p.status)+' · '+esc(p.sellerId)+'</span><h3>'+esc(p.name)+'</h3><small>'+esc((p.startsAt||'').slice(0,10))+' → '+esc((p.endsAt||'').slice(0,10))+'</small></div>'+
   '<div><b>'+esc(s.evidenceLevel||'INTERNAL_HYPOTHESIS')+'</b><small>'+copy('Pricing confidence','Pricing confidence')+': '+esc(price.confidence||'UNPROVEN')+'</small></div>'+
  '</div>'+
  '<div class="commercial-evidence-summary">'+
   '<div><strong>'+moneyMap(s.quotedMinorByCurrency)+'</strong><span>'+copy('Предложено','Quoted')+'</span></div>'+
   '<div><strong>'+moneyMap(s.acceptedMinorByCurrency)+'</strong><span>'+copy('Принята цена','Accepted')+'</span></div>'+
   '<div><strong>'+moneyMap(s.cashReceivedMinorByCurrency)+'</strong><span>Cash</span></div>'+
   '<div><strong>'+moneyMap(s.directCostMinorByCurrency)+'</strong><span>'+copy('Прямые затраты','Direct cost')+'</span></div>'+
   '<div><strong>'+moneyMap(s.grossContributionMinorByCurrency)+'</strong><span>Gross contribution</span></div>'+
  '</div>'+
  '<form class="commercial-evidence-form" data-commercial-evidence-form="'+esc(p.id)+'">'+
   '<div class="commercial-evidence-form-head"><strong>'+copy('Добавить подтверждённое событие','Append verified event')+'</strong><small>'+copy('История не переписывается. Ошибка исправляется отдельным VOID-событием через API/governance.','History is not rewritten. Corrections use a separate VOID event through the governed flow.')+'</small></div>'+
   '<label><span>Event</span><select name="eventType" required>'+
    option('QUOTE_ISSUED','Quote issued')+
    option('PRICE_VERBAL_ACCEPTED','Price verbally accepted')+
    option('PRICE_WRITTEN_ACCEPTED','Price written accepted')+
    option('INVOICE_ISSUED','Invoice issued')+
    option('PAYMENT_RECEIVED','Payment received')+
    option('REFUND_RECORDED','Refund recorded')+
    option('DIRECT_COST_RECORDED','Direct cost recorded')+
    option('RENEWAL_PROPOSED','Renewal proposed')+
    option('RENEWAL_ACCEPTED','Renewal accepted')+
    option('RENEWAL_REJECTED','Renewal rejected')+
    option('EXPANSION_ACCEPTED','Expansion accepted')+
   '</select></label>'+
   '<label><span>Revenue stream</span><select name="revenueStream">'+
    option('PROFESSIONAL_SAAS','Professional SaaS')+
    option('PARTNER_EDITION','Partner Edition')+
    option('CULTURAL_PARTNERSHIP','Cultural Partnership')+
    option('ESTATE_ARCHIVE','Estate / Archive')+
    option('INSTITUTIONAL_RESEARCH','Institutional Research')+
    option('TRANSACTION_REVENUE','Transaction Revenue')+
   '</select></label>'+
   '<label><span>'+copy('Сумма','Amount')+'</span><input name="amount" type="number" min="0" step="0.01" placeholder="0.00"></label>'+
   '<label><span>'+copy('Валюта','Currency')+'</span><input name="currency" value="EUR" maxlength="3" pattern="[A-Za-z]{3}"></label>'+
   '<label class="wide"><span>Evidence reference</span><input name="evidenceRef" placeholder="proposal:, invoice:, bank:, cost:"></label>'+
   '<label class="wide"><span>'+copy('Комментарий / источник','Comment / source note')+'</span><input name="note" maxlength="500" placeholder="'+copy('Без банковских секретов и персональных данных','No banking secrets or personal data')+'"></label>'+
   '<button class="primary-button" type="submit">'+copy('Зафиксировать событие','Append event')+'</button>'+
  '</form>'+
 '</article>';
}

function panel(data){
 const persistence=data?.persistence||'UNKNOWN',pilots=data?.pilots||[];
 const body=persistence!=='POSTGRES'
  ?'<div class="commercial-evidence-blocked"><strong>DURABLE POSTGRESQL REQUIRED</strong><p>'+copy('Запись коммерческих доказательств закрыта fail-closed: preview memory нельзя использовать как источник финансовой истины.','Commercial evidence writes are fail-closed: preview memory cannot be used as a financial source of truth.')+'</p></div>'
  :pilots.length?'<div class="commercial-evidence-pilots">'+pilots.map(pilotCard).join('')+'</div>'
  :'<div class="empty-state">'+copy('Реальных pilot engagements пока нет. Сначала создайте и заморозьте scope пилота.','No real pilot engagements yet. Create and freeze a pilot scope first.')+'</div>';
 return '<div data-v14-panel="commercial-evidence" hidden class="v14-panel commercial-evidence-console">'+
  '<div class="commercial-evidence-head"><div><div class="eyebrow">COMMERCIAL EVIDENCE AUTHORITY · v0.46</div><h3>'+copy('Доказательство денег','Proof of money')+'</h3><p>'+copy('Operator-only append ledger: quote → accepted price → invoice → cash → direct cost → renewal. Quote, LOI и invoice не становятся cash.','Operator-only append ledger: quote → accepted price → invoice → cash → direct cost → renewal. Quote, LOI and invoice never become cash.')+'</p></div><span>'+esc(persistence)+'</span></div>'+
  body+'</div>';
}

async function mount(){
 if(loading||document.querySelector('[data-v14-tab="commercial-evidence"]'))return;
 const ops=document.querySelector('#v14Operations'),tabs=ops?.querySelector('.v14-tabs'),panels=ops?.querySelector('.v14-panels');if(!tabs||!panels)return;
 loading=true;
 try{
  const d=await safe('/api/operator/commercial-evidence/pilots');if(!d?.commercial||!ops.isConnected)return;
  lastData=d.commercial;
  const btn=document.createElement('button');btn.dataset.v14Tab='commercial-evidence';btn.textContent=copy('Коммерческие доказательства','Commercial Evidence');tabs.append(btn);
  const box=document.createElement('div');box.innerHTML=panel(lastData);panels.append(box.firstElementChild);
 }catch(e){console.error(e)}finally{loading=false}
}

async function refresh(){
 const d=await safe('/api/operator/commercial-evidence/pilots');if(!d?.commercial)return;lastData=d.commercial;
 const old=document.querySelector('[data-v14-panel="commercial-evidence"]');if(!old)return;
 const box=document.createElement('div');box.innerHTML=panel(lastData);const next=box.firstElementChild;next.hidden=false;old.replaceWith(next);
}

document.addEventListener('submit',async e=>{
 const f=e.target.closest('[data-commercial-evidence-form]');if(!f)return;e.preventDefault();
 try{
  const d=Object.fromEntries(new FormData(f).entries()),amount=String(d.amount||'').trim();
  const key='commercial-ui-'+Date.now()+'-'+(crypto.randomUUID?crypto.randomUUID():Math.random().toString(16).slice(2));
  const body={eventType:d.eventType,revenueStream:d.revenueStream||null,currency:String(d.currency||'').toUpperCase()||null,evidenceRef:String(d.evidenceRef||'').trim()||null,clientActionId:key,payload:{note:String(d.note||'').trim()}};
  if(amount!=='')body.amountMinor=Math.round(Number(amount)*100);
  await api('/api/operator/pilots/'+encodeURIComponent(f.dataset.commercialEvidenceForm)+'/commercial-evidence/events',{method:'POST',body:JSON.stringify(body)});
  toast(copy('Коммерческое событие зафиксировано','Commercial event recorded'));await refresh();
 }catch(err){toast(err.message)}
});

const observer=new MutationObserver(()=>mount());observer.observe(document.querySelector('#app'),{childList:true,subtree:true});
window.addEventListener('hashchange',()=>setTimeout(mount,50));setTimeout(mount,100);
