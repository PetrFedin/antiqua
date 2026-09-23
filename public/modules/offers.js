import {api,copy,esc,local,moneyMinor,date,status,sheet,toast} from './core.js';

const TERMINAL=new Set(['ACCEPTED','REJECTED','WITHDRAWN','EXPIRED']);
const exponent=currency=>new Intl.NumberFormat('en',{style:'currency',currency}).resolvedOptions().maximumFractionDigits;
const objectFor=(d,id)=>d.catalog?.lots?.find(x=>x.id===id)||null;

function roleText(o){
 if(TERMINAL.has(o.status))return copy('Переговоры завершены','Negotiation closed');
 if(o.awaitingRole===o.participantRole)return copy('Ваш ход','Your action');
 return o.awaitingRole==='SELLER'?copy('Ожидается ответ дилера','Waiting for dealer'):copy('Ожидается ответ покупателя','Waiting for buyer')
}
function eventLabel(e){
 return({
  CREATED:copy('Предложение создано','Offer created'),
  COUNTERED:copy('Встречное предложение','Counteroffer'),
  ACCEPTED:copy('Предложение принято','Offer accepted'),
  REJECTED:copy('Предложение отклонено','Offer rejected'),
  WITHDRAWN:copy('Предложение отозвано','Offer withdrawn'),
  EXPIRED:copy('Срок истёк','Offer expired'),
  LEGACY_IMPORTED:copy('Импортировано из прежнего контура','Imported from legacy flow')
 }[e.eventType]||status(e.eventType))
}
function offerCard(d,o){
 const obj=objectFor(d,o.objectId),mine=o.awaitingRole===o.participantRole&&!TERMINAL.has(o.status);
 return '<article class="v14-card v22-offer-card" data-v22-offer-card="'+esc(o.id)+'">'+
  '<div class="v14-card-head"><span class="status-pill">'+esc(status(o.status))+'</span><b>'+moneyMinor(o.currentAmountMinor,o.currency)+'</b></div>'+
  '<h4>'+esc(local(obj?.title)||o.objectId)+'</h4>'+
  '<div class="v22-offer-meta"><span>v'+esc(o.version)+'</span><span>'+copy('до','until')+' '+date(o.expiresAt)+'</span><span class="'+(mine?'v22-your-turn':'')+'">'+esc(roleText(o))+'</span></div>'+
  '<div class="v14-actions"><button class="'+(mine?'primary-button':'quiet-button')+'" data-v22-offer-open="'+esc(o.id)+'">'+copy('Открыть переговоры','Open negotiation')+'</button></div></article>'
}
export function offersPanel(d){
 const items=d.offers||[];
 return '<div class="v14-panel v22-offers-panel" data-v14-panel="offers">'+
  '<div class="v14-panel-head"><div><span>OFFER & NEGOTIATION AUTHORITY</span><h3>'+copy('Предложения и переговоры','Offers & negotiation')+'</h3><p>'+copy('Каждое изменение версионируется. Принятие предложения резервирует предмет и создаёт одну сделку в платёжном контуре.','Every change is versioned. Accepting an offer reserves the object and creates one order in the payment flow.')+'</p></div></div>'+
  '<div class="v22-offer-grid">'+(items.length?items.map(o=>offerCard(d,o)).join(''):'<div class="empty-state">'+copy('Переговоров пока нет','No negotiations yet')+'</div>')+'</div></div>'
}
function timeline(o){
 return '<div class="v22-offer-timeline">'+(o.history||[]).map(e=>
  '<article class="v22-offer-event"><div><b>v'+esc(e.version)+' · '+esc(eventLabel(e))+'</b><span>'+moneyMinor(e.amountMinor,e.currency)+'</span></div>'+
  '<small>'+esc(e.actorRole)+' · '+date(e.createdAt)+'</small>'+(e.comment?'<p>'+esc(e.comment)+'</p>':'')+'</article>'
 ).join('')+'</div>'
}
function actions(o){
 if(TERMINAL.has(o.status)||!(o.allowedActions||[]).length)return '<div class="v22-negotiation-closed">'+copy('Доступных действий нет. История переговоров сохранена неизменяемо.','No actions are available. The negotiation history is preserved immutably.')+'</div>';
 const a=o.allowedActions||[];
 return '<div class="v22-offer-actions">'+
  (a.includes('COUNTER')?'<button class="secondary-button" data-v22-counter="'+esc(o.id)+'" data-version="'+esc(o.version)+'">'+copy('Встречное предложение','Counteroffer')+'</button>':'')+
  (a.includes('ACCEPT')?'<button class="primary-button" data-v22-offer-action="ACCEPT" data-offer="'+esc(o.id)+'" data-version="'+esc(o.version)+'">'+copy('Принять','Accept')+'</button>':'')+
  (a.includes('REJECT')?'<button class="quiet-button" data-v22-offer-action="REJECT" data-offer="'+esc(o.id)+'" data-version="'+esc(o.version)+'">'+copy('Отклонить','Reject')+'</button>':'')+
  (a.includes('WITHDRAW')?'<button class="quiet-button" data-v22-offer-action="WITHDRAW" data-offer="'+esc(o.id)+'" data-version="'+esc(o.version)+'">'+copy('Отозвать','Withdraw')+'</button>':'')+
  '</div>'
}
async function openOffer(id){
 const d=await api('/api/offers/'+encodeURIComponent(id)),o=d.offer;
 sheet('<div class="action-sheet-head"><div><div class="micro">NEGOTIATION · '+esc(o.id)+'</div><h2>'+moneyMinor(o.currentAmountMinor,o.currency)+'</h2><p>'+esc(roleText(o))+' · v'+esc(o.version)+' · '+copy('действует до','valid until')+' '+date(o.expiresAt)+'</p></div><button class="action-sheet-close" data-close-sheet>×</button></div>'+
  actions(o)+'<div class="v22-history-head"><span>IMMUTABLE HISTORY</span><b>'+(o.history||[]).length+'</b></div>'+timeline(o))
}
function counterSheet(id,version){
 return sheet('<div class="action-sheet-head"><div><div class="micro">COUNTEROFFER</div><h2>'+copy('Новое встречное предложение','New counteroffer')+'</h2><p>'+copy('Сумма и срок создадут новую версию переговоров.','Amount and expiry create a new negotiation version.')+'</p></div><button class="action-sheet-close" data-close-sheet>×</button></div>'+
  '<form id="v22CounterForm" data-offer="'+esc(id)+'" data-version="'+esc(version)+'" data-action-id="'+esc(crypto.randomUUID())+'" class="v14-stack-form">'+
  '<label>'+copy('Сумма','Amount')+'<input name="amount" type="number" min="0.01" step="0.01" required></label>'+
  '<label>'+copy('Срок действия','Valid for')+'<select name="ttl"><option value="24">24 '+copy('часа','hours')+'</option><option value="72" selected>72 '+copy('часа','hours')+'</option><option value="168">7 '+copy('дней','days')+'</option></select></label>'+
  '<label>'+copy('Комментарий','Comment')+'<textarea name="comment" maxlength="2000" rows="4"></textarea></label>'+
  '<button class="primary-button" type="submit">'+copy('Отправить встречное предложение','Send counteroffer')+'</button></form>')
}
async function mutateButton(b){
 const action=b.dataset.v22OfferAction,id=b.dataset.offer,expectedVersion=Number(b.dataset.version);
 b.dataset.actionId??=crypto.randomUUID();b.disabled=true;
 try{
  const result=await api('/api/offers/'+encodeURIComponent(id)+'/actions',{method:'POST',body:JSON.stringify({action,expectedVersion,clientActionId:b.dataset.actionId})});
  document.querySelector('#actionSheet')?.close();
  toast(action==='ACCEPT'&&result.order?copy('Предложение принято — сделка создана','Offer accepted — order created'):copy('Переговоры обновлены','Negotiation updated'));
  window.dispatchEvent(new CustomEvent('antiqua:operations-refresh',{detail:{offerId:id,action}}))
 }catch(e){
  b.disabled=false;
  toast(e.data?.code==='OFFER_VERSION_CONFLICT'?copy('Предложение уже изменилось. Откройте его снова.','The offer changed. Reopen it before acting.'):e.message)
 }
}

document.addEventListener('click',async e=>{
 const open=e.target.closest?.('[data-v22-offer-open]');
 if(open){e.preventDefault();try{return await openOffer(open.dataset.v22OfferOpen)}catch(err){return toast(err.message)}}
 const counter=e.target.closest?.('[data-v22-counter]');
 if(counter){e.preventDefault();return counterSheet(counter.dataset.v22Counter,counter.dataset.version)}
 const action=e.target.closest?.('[data-v22-offer-action]');
 if(action){e.preventDefault();return mutateButton(action)}
});

document.addEventListener('submit',async e=>{
 const f=e.target;if(f.id!=='v22CounterForm')return;e.preventDefault();
 const submit=f.querySelector('button[type="submit"]');submit.disabled=true;
 try{
  const d=Object.fromEntries(new FormData(f).entries()),ttl=Number(d.ttl),expiresAt=new Date(Date.now()+ttl*60*60*1000).toISOString();
  await api('/api/offers/'+encodeURIComponent(f.dataset.offer)+'/actions',{method:'POST',body:JSON.stringify({action:'COUNTER',amount:d.amount,comment:d.comment,expiresAt,expectedVersion:Number(f.dataset.version),clientActionId:f.dataset.actionId})});
  document.querySelector('#actionSheet')?.close();toast(copy('Встречное предложение отправлено','Counteroffer sent'));
  window.dispatchEvent(new CustomEvent('antiqua:operations-refresh',{detail:{offerId:f.dataset.offer,action:'COUNTER'}}))
 }catch(err){
  submit.disabled=false;
  toast(err.data?.code==='OFFER_VERSION_CONFLICT'?copy('Предложение уже изменилось. Откройте его снова.','The offer changed. Reopen it before acting.'):err.message)
 }
});
