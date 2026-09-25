import {api,copy,esc,local,status,date,sheet,toast} from './core.js';

const criteriaLabels={
 q:['Запрос','Query'],category:['Категория','Category'],era:['Период','Period'],country:['Страна','Country'],material:['Материал','Material'],
 technique:['Техника','Technique'],condition:['Состояние','Condition'],location:['Локация','Location'],purchaseMethod:['Способ покупки','Purchase method'],
 seller:['Продавец','Seller'],maker:['Мастер','Maker'],objectId:['Предмет','Object'],priceMin:['Цена от','Price from'],priceMax:['Цена до','Price to']
};
const deliveryLabel=s=>s.deliveryMode==='DAILY_DIGEST'?copy(`Ежедневно · ${String(s.digestHourUtc??8).padStart(2,'0')}:00 UTC`,`Daily · ${String(s.digestHourUtc??8).padStart(2,'0')}:00 UTC`):copy('Сразу','Immediate');
const hourOptions=current=>Array.from({length:24},(_,h)=>`<option value="${h}" ${Number(current)===h?'selected':''}>${String(h).padStart(2,'0')}:00 UTC</option>`).join('');
const criteriaChips=criteria=>{
 const entries=Object.entries(criteria||{});
 if(!entries.length)return `<span class="v26-criteria-empty">${copy('Весь каталог','Full catalogue')}</span>`;
 return entries.map(([k,v])=>`<span class="v26-criterion"><b>${esc(copy(...(criteriaLabels[k]||[k,k])))}</b>${esc(String(v))}</span>`).join('')
};

export function discoveryPanel(d){return`<div class="v14-panel v26-discovery-panel" data-v14-panel="discovery"><div class="v14-panel-head"><div><span>DISCOVERY · v0.26</span><h3>${copy('Сохранённые поиски и рыночные уведомления','Saved searches & market alerts')}</h3><p>${copy('Совпадения определяются теми же детерминированными фильтрами каталога. Можно получать уведомления сразу или одной ежедневной сводкой.','Matches use the same deterministic catalogue filters. Alerts can arrive immediately or as one daily digest.')}</p></div></div><form id="v14DiscoveryForm" class="v14-inline-form"><label>${copy('Тип','Type')}<select name="subscriptionType"><option>SAVED_SEARCH</option><option>FOLLOW_SELLER</option><option>FOLLOW_MAKER</option><option>WANTED</option></select></label><label>${copy('Название','Label')}<input name="label" required></label><label>${copy('Запрос / ID / продавец / автор','Query / ID / seller / maker')}<input name="target" required></label><label>${copy('Доставка','Delivery')}<select name="deliveryMode"><option value="IMMEDIATE">${copy('Сразу','Immediate')}</option><option value="DAILY_DIGEST">${copy('Ежедневная сводка','Daily digest')}</option></select></label><label>${copy('Час сводки','Digest hour')}<select name="digestHourUtc">${hourOptions(8)}</select></label><button class="primary-button">${copy('Создать','Create')}</button></form><div class="v14-grid v26-sub-grid">${d.subscriptions.length?d.subscriptions.map(subscriptionCard).join(''):`<div class="empty-state">${copy('Сохранённых поисков пока нет','No saved searches yet')}</div>`}</div></div>`}

function subscriptionCard(s){
 const archived=s.status==='ARCHIVED',paused=s.status==='PAUSED',openable=s.subscriptionType==='SAVED_SEARCH';
 return `<article class="v14-card v26-sub-card" data-v26-subscription="${esc(s.id)}"><div class="v14-card-head"><span class="status-pill">${esc(status(s.status))}</span><b>${Number(s.matchCount||0)}</b></div><h4>${esc(local(s.label)||s.subscriptionType)}</h4><div class="v26-criteria">${criteriaChips(s.criteria)}</div><div class="v26-delivery"><span>${copy('Уведомления','Alerts')}</span><b>${esc(deliveryLabel(s))}</b>${Number(s.pendingAlertCount||0)?`<small>${copy('Ожидают доставки','Pending')}: ${Number(s.pendingAlertCount)}</small>`:''}</div>${!archived?`<div class="v26-delivery-controls"><select data-v26-delivery="${esc(s.id)}" aria-label="${copy('Режим уведомлений','Alert delivery')}"><option value="IMMEDIATE" ${s.deliveryMode==='IMMEDIATE'?'selected':''}>${copy('Сразу','Immediate')}</option><option value="DAILY_DIGEST" ${s.deliveryMode==='DAILY_DIGEST'?'selected':''}>${copy('Ежедневная сводка','Daily digest')}</option></select>${s.deliveryMode==='DAILY_DIGEST'?`<select data-v26-digest-hour="${esc(s.id)}" aria-label="${copy('Час сводки UTC','Digest hour UTC')}">${hourOptions(s.digestHourUtc??8)}</select>`:''}</div>`:''}<div class="v14-actions">${openable?`<button class="quiet-button" data-v26-open-search="${esc(s.id)}">${copy('Открыть поиск','Open search')}</button>`:''}${archived?`<button class="quiet-button" data-v14-sub-toggle="${esc(s.id)}" data-next="ACTIVE">${copy('Подписаться снова','Subscribe again')}</button>`:`<button class="quiet-button" data-v14-sub-toggle="${esc(s.id)}" data-next="${paused?'ACTIVE':'PAUSED'}">${paused?copy('Возобновить','Resume'):copy('Пауза','Pause')}</button><button class="text-button" data-v14-sub-toggle="${esc(s.id)}" data-next="ARCHIVED">${copy('Отписаться','Unsubscribe')}</button>`}</div></article>`
}

export function messagesPanel(d){return`<div class="v14-panel" data-v14-panel="messages"><div class="v14-panel-head"><div><span>MESSAGES</span><h3>${copy('Переписка по предметам','Object conversations')}</h3></div></div><p class="v21-messages-intro">${copy('Новые диалоги начинаются из паспорта конкретного предмета через «Запросить информацию». Здесь хранится вся переписка и ответы дилеров.','New conversations start from an Object Passport via “Ask dealer”. All dealer replies and object threads remain here.')}</p><div class="v14-grid">${d.conversations.length?d.conversations.map(c=>`<article class="v14-card"><div class="v14-card-head"><span class="status-pill">${esc(status(c.status))}</span>${c.unreadCount?`<b>${c.unreadCount}</b>`:''}</div><h4>${esc(local(c.subject)||c.objectId)}</h4><small>${esc(c.objectId||'')} ${c.lastMessage?`· ${esc(c.lastMessage.body).slice(0,100)}`:''}</small><button class="quiet-button" data-v14-thread="${esc(c.id)}">${copy('Открыть диалог','Open thread')}</button></article>`).join(''):`<div class="empty-state">${copy('Диалогов пока нет','No conversations yet')}</div>`}</div></div>`}
const inquiryContext=m=>(m.attachments||[]).find(x=>x?.kind==='INQUIRY_CONTEXT');
export async function openThread(id){const d=await api(`/api/conversations/${encodeURIComponent(id)}`),c=d.conversation;sheet(`<div class="action-sheet-head"><div><div class="micro">${esc(c.objectId)}</div><h2>${esc(local(c.subject))}</h2></div><button class="action-sheet-close" data-close-sheet>×</button></div><div class="v14-thread">${(c.messages||[]).map(m=>{const ctx=inquiryContext(m);return`<article class="v14-message ${String(m.senderRole||'').toLowerCase()}"><b>${esc(m.senderRole)}</b>${ctx?`<span class="inquiry-context-v21">${esc(local(ctx.label)||ctx.inquiryType)}</span>`:''}<p>${esc(m.body)}</p><small>${date(m.createdAt)}</small></article>`}).join('')||`<div class="empty-state">${copy('Сообщений пока нет','No messages yet')}</div>`}</div><form id="v14MessageForm" data-id="${esc(id)}" class="v14-message-form"><input name="body" required placeholder="${copy('Напишите сообщение','Write a message')}"><button class="primary-button">${copy('Отправить','Send')}</button></form>`);await api(`/api/conversations/${id}/read`,{method:'POST',body:'{}'}).catch(()=>{})}
export function currentCriteria(){const criteria={},q=document.querySelector('#catalogSearch')?.value?.trim();if(q)criteria.q=q;document.querySelectorAll('[data-filter]').forEach(el=>{const v=el.value;if(!v||v==='ALL'||el.dataset.filter==='sort')return;criteria[el.dataset.filter]=v});return criteria}

async function openSavedSearch(id){
 const d=await api('/api/discovery/subscriptions'),s=(d.subscriptions||[]).find(x=>x.id===id);
 if(!s)throw new Error(copy('Сохранённый поиск не найден','Saved search not found'));
 window.dispatchEvent(new CustomEvent('antiqua:apply-saved-search',{detail:{subscriptionId:s.id,criteria:s.criteria||{}}}))
}
function saveSearchSheet(criteria){
 const defaultLabel=criteria.q||Object.values(criteria).slice(0,2).join(' · ')||copy('Весь каталог','Full catalogue');
 const dlg=sheet(`<form id="v26SaveSearchForm" class="action-sheet-body"><div class="action-sheet-head"><div><div class="micro">SAVED SEARCH · v0.26</div><h2>${copy('Сохранить текущий поиск','Save current search')}</h2></div><button type="button" class="action-sheet-close" data-close-sheet>×</button></div><div class="v26-criteria v26-sheet-criteria">${criteriaChips(criteria)}</div><label>${copy('Название','Label')}<input name="label" value="${esc(defaultLabel)}" required></label><label>${copy('Уведомления','Alerts')}<select name="deliveryMode"><option value="IMMEDIATE">${copy('Сразу при новом совпадении','Immediately on a new match')}</option><option value="DAILY_DIGEST">${copy('Одна ежедневная сводка','One daily digest')}</option></select></label><label>${copy('Час ежедневной сводки','Daily digest hour')}<select name="digestHourUtc">${hourOptions(8)}</select></label><button class="primary-button" type="submit">${copy('Сохранить и следить','Save & alert')}</button></form>`);
 const form=dlg?.querySelector?.('#v26SaveSearchForm')||document.querySelector('#v26SaveSearchForm');if(form)form._v26Criteria=criteria
}
export function injectSaveSearch(){const head=document.querySelector('.catalog-result-head');if(!head||document.querySelector('#v14SaveSearch'))return;const b=document.createElement('button');b.id='v14SaveSearch';b.type='button';b.className='quiet-button';b.textContent=copy('Сохранить поиск','Save search');b.onclick=()=>saveSearchSheet(currentCriteria());head.append(b)}

document.addEventListener('click',e=>{
 const b=e.target.closest?.('[data-v26-open-search]');if(!b)return;e.preventDefault();openSavedSearch(b.dataset.v26OpenSearch).catch(err=>toast(err.message))
});
document.addEventListener('change',async e=>{
 const delivery=e.target.closest?.('[data-v26-delivery]'),hour=e.target.closest?.('[data-v26-digest-hour]');if(!delivery&&!hour)return;
 try{
  const id=delivery?.dataset.v26Delivery||hour?.dataset.v26DigestHour,body=delivery?{deliveryMode:delivery.value}:{digestHourUtc:Number(hour.value)};
  await api(`/api/discovery/subscriptions/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(body)});
  toast(copy('Настройки уведомлений обновлены','Alert settings updated'));window.dispatchEvent(new CustomEvent('antiqua:operations-refresh'))
 }catch(err){toast(err.message)}
});
document.addEventListener('submit',async e=>{
 const form=e.target;if(form.id!=='v26SaveSearchForm')return;e.preventDefault();
 try{
  const d=Object.fromEntries(new FormData(form).entries()),x=await api('/api/discovery/subscriptions',{method:'POST',body:JSON.stringify({subscriptionType:'SAVED_SEARCH',label:d.label,criteria:form._v26Criteria||{},deliveryMode:d.deliveryMode,digestHourUtc:Number(d.digestHourUtc)})});
  document.querySelector('#actionSheet')?.close();toast(x.subscription?.idempotent?copy('Этот поиск уже сохранён','This search is already saved'):copy('Поиск сохранён','Search saved'))
 }catch(err){toast(err.message)}
});
