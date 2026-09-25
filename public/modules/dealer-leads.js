import {copy,esc,local,moneyMinor,date,status} from './core.js';
import {openThread} from './discovery.js';

const fmtDateTime=v=>v?new Intl.DateTimeFormat(localStorage.getItem('antiqua_lang')==='en'?'en-GB':'ru-RU',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'—';
const stageLabel=s=>({
 NEW_LEAD:copy('Новый лид','New lead'),
 UNANSWERED:copy('Без ответа','Unanswered'),
 REPLIED:copy('Ответ дан','Replied'),
 VIEWING:copy('Просмотр','Viewing'),
 NEGOTIATING:copy('Переговоры','Negotiating'),
 WON:copy('Выигран','Won'),
 LOST:copy('Закрыт','Lost')
}[s]||status(s));
const actionLabel=a=>({
 REPLY_TO_BUYER:copy('Ответить покупателю','Reply to buyer'),
 RESPOND_TO_OFFER:copy('Ответить на предложение','Respond to offer'),
 PROPOSE_VIEWING_SLOTS:copy('Предложить время','Propose viewing times'),
 PUBLISH_CONDITION_REPORT:copy('Опубликовать Condition Report','Publish Condition Report'),
 PREPARE_VIEWING:copy('Подготовить просмотр','Prepare viewing'),
 WAIT_FOR_BUYER:copy('Ожидается покупатель','Waiting for buyer'),
 PROCEED_TRANSACTION:copy('Открыть сделку','Open transaction'),
 NONE:copy('Нет действия','No action')
}[a]||status(a));
const lastLabel=a=>({
 MESSAGE:copy('Сообщение','Message'),
 OFFER_CREATED:copy('Предложение создано','Offer created'),
 OFFER_COUNTERED:copy('Встречное предложение','Counteroffer'),
 OFFER_ACCEPTED:copy('Предложение принято','Offer accepted'),
 OFFER_REJECTED:copy('Предложение отклонено','Offer rejected'),
 OFFER_WITHDRAWN:copy('Предложение отозвано','Offer withdrawn'),
 OFFER_EXPIRED:copy('Предложение истекло','Offer expired'),
 CONDITION_REQUESTED:copy('Запрошен Condition Report','Condition Report requested'),
 CONDITION_PUBLISHED:copy('Condition Report опубликован','Condition Report published'),
 CONDITION_CANCELLED:copy('Запрос Condition Report отменён','Condition Report request cancelled'),
 VIEWING_REQUESTED:copy('Запрошен просмотр','Viewing requested'),
 VIEWING_SLOTS_PROPOSED:copy('Предложено время просмотра','Viewing times proposed'),
 VIEWING_CONFIRMED:copy('Просмотр подтверждён','Viewing confirmed'),
 VIEWING_RESCHEDULE_REQUESTED:copy('Запрошен перенос','Reschedule requested'),
 VIEWING_CANCELLED:copy('Просмотр отменён','Viewing cancelled')
}[a]||status(a));

function summary(c){
 const s=c.summary||{},m=s.stageCounts||{};
 return '<div class="v24-summary">'+
  '<div><span>'+copy('Всего лидов','Total leads')+'</span><b>'+Number(s.total||0)+'</b></div>'+
  '<div><span>'+copy('Без ответа','Unanswered')+'</span><b>'+Number(s.overdue||0)+'</b></div>'+
  '<div><span>'+copy('Нужен дилер','Dealer action')+'</span><b>'+Number(s.awaitingDealer||0)+'</b></div>'+
  '<div><span>'+copy('Медиана ответа','Median response')+'</span><b>'+(s.medianResponseMinutes==null?'—':Math.round(s.medianResponseMinutes)+' '+copy('мин','min'))+'</b></div>'+
  '<div><span>'+copy('В переговорах','Negotiating')+'</span><b>'+Number(m.NEGOTIATING||0)+'</b></div>'+
  '<div><span>'+copy('Просмотры','Viewings')+'</span><b>'+Number(m.VIEWING||0)+'</b></div>'+
 '</div>'
}
function potential(c){
 const entries=Object.entries(c.summary?.potentialByCurrency||{});
 return entries.length?'<div class="v24-potential">'+copy('Потенциальная сумма','Potential value')+': '+entries.map(([ccy,v])=>'<b>'+esc(moneyMinor(v,ccy))+'</b>').join(' · ')+'</div>':''
}
function leadCard(l){
 const potential=l.potentialCurrency&&l.potentialAmountMinor!=null?moneyMinor(l.potentialAmountMinor,l.potentialCurrency):'—';
 const overdue=l.responseStatus==='OVERDUE';
 const next=l.nextAction||{};
 const actionable=!['WAIT_FOR_BUYER','NONE'].includes(next.code);
 return '<article class="v14-card v24-lead-card" data-v24-lead data-stage="'+esc(l.stage)+'" data-listing="'+esc(l.listingId||'')+'" data-buyer="'+esc(l.buyerAccountId||'')+'">'+
  '<div class="v14-card-head"><span class="status-pill v24-stage-'+esc(l.stage.toLowerCase())+'">'+esc(stageLabel(l.stage))+'</span><b>'+esc(potential)+'</b></div>'+
  '<h4>'+esc(local(l.object?.title)||l.object?.objectCode||l.objectId)+'</h4>'+
  '<div class="v24-lead-meta">'+
   '<span>'+copy('Последнее действие','Last action')+': '+esc(lastLabel(l.lastAction?.type||'—'))+'</span>'+
   '<span>'+esc(l.lastAction?.at?fmtDateTime(l.lastAction.at):date(l.updatedAt))+'</span>'+
   (l.unreadCount?'<span class="v24-unread">'+copy('Непрочитано','Unread')+': '+Number(l.unreadCount)+'</span>':'')+
  '</div>'+
  '<div class="v24-sla '+(overdue?'is-overdue':'')+'"><span>SLA</span><b>'+(
    l.firstDealerResponseAt?copy('Ответ дан','Responded'):(overdue?copy('Просрочен','Overdue'):copy('В срок','On time'))
  )+'</b>'+(l.responseDueAt&&!l.firstDealerResponseAt?'<small>'+fmtDateTime(l.responseDueAt)+'</small>':'')+'</div>'+
  '<div class="v24-next"><span>'+copy('Следующее действие','Next action')+'</span><b>'+esc(actionLabel(next.code))+'</b></div>'+
  '<div class="v14-actions">'+
   (actionable?'<button class="primary-button" data-v24-route="'+esc(next.target||'')+'" data-id="'+esc(next.id||'')+'">'+esc(actionLabel(next.code))+'</button>':'')+
   (l.refs?.conversationId?'<button class="quiet-button" data-v24-route="CONVERSATION" data-id="'+esc(l.refs.conversationId)+'">'+copy('Переписка','Messages')+'</button>':'')+
  '</div></article>'
}
export function dealerLeadPanel(d){
 const c=d.dealerLeads;if(!c)return'';
 const stages=['ALL','NEW_LEAD','UNANSWERED','REPLIED','VIEWING','NEGOTIATING','WON','LOST'];
 return '<div class="v14-panel v24-dealer-panel" data-v14-panel="dealer">'+
  '<div class="v14-panel-head"><div><span>DEALER INBOX · v0.24</span><h3>'+copy('Лиды и следующие действия','Leads & next actions')+'</h3><p>'+copy('CRM-проекция существующих коммерческих процессов. Статус лида не редактируется вручную — он вычисляется из переписки, просмотров, Condition Reports и переговоров.','A CRM projection of existing commercial workflows. Lead status is not edited manually; it is derived from messages, viewings, Condition Reports and negotiations.')+'</p></div></div>'+
  summary(c)+potential(c)+
  '<div class="v24-filters">'+stages.map((s,i)=>'<button class="'+(i===0?'active':'')+'" data-v24-filter="'+s+'">'+esc(s==='ALL'?copy('Все','All'):stageLabel(s))+'</button>').join('')+'</div>'+
  '<div class="v24-lead-grid">'+(c.leads?.length?c.leads.map(leadCard).join(''):'<div class="empty-state">'+copy('Коммерческих лидов пока нет','No commercial leads yet')+'</div>')+'</div>'+
 '</div>'
}

const selectTab=name=>document.querySelector('[data-v14-tab="'+name+'"]')?.click();
function focusCard(selector){
 const el=document.querySelector(selector);if(!el)return;el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('v24-focus');setTimeout(()=>el.classList.remove('v24-focus'),1800)
}
document.addEventListener('click',async e=>{
 const filter=e.target.closest?.('[data-v24-filter]');
 if(filter){
  const panel=filter.closest('[data-v14-panel="dealer"]'),stage=filter.dataset.v24Filter;
  panel?.querySelectorAll('[data-v24-filter]').forEach(x=>x.classList.toggle('active',x===filter));
  panel?.querySelectorAll('[data-v24-lead]').forEach(x=>x.hidden=stage!=='ALL'&&x.dataset.stage!==stage);
  return
 }
 const route=e.target.closest?.('[data-v24-route]');if(!route)return;
 e.preventDefault();const target=route.dataset.v24Route,id=route.dataset.id;
 if(target==='CONVERSATION'&&id)return openThread(id);
 if(target==='OFFER'&&id){selectTab('offers');setTimeout(()=>document.querySelector('[data-v22-offer-open="'+CSS.escape(id)+'"]')?.click(),30);return}
 if(target==='VIEWING'&&id){selectTab('services');setTimeout(()=>focusCard('[data-v23-viewing-card="'+CSS.escape(id)+'"]'),30);return}
 if(target==='CONDITION'&&id){selectTab('services');setTimeout(()=>focusCard('[data-v23-condition-card="'+CSS.escape(id)+'"]'),30);return}
 if(target==='TRANSACTIONS'){selectTab('transactions');return}
})
