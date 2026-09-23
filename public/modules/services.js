import {api,safe,copy,esc,local,date,status,sheet,toast} from './core.js';

let passportSeq=0;
const fmtDateTime=v=>v?new Intl.DateTimeFormat(localStorage.getItem('antiqua_lang')==='en'?'en-GB':'ru-RU',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'—';
const objTitle=(d,id)=>local(d.catalog?.lots?.find(x=>x.id===id)?.title)||id;

function authSheet(){
 sheet('<div class="action-sheet-head"><div><div class="micro">COMMERCIAL SERVICES</div><h2>'+copy('Войдите в аккаунт покупателя','Sign in with a buyer account')+'</h2><p>'+copy('Запрос отчёта о состоянии и просмотр предмета ведутся как структурированные процессы, а не обычные сообщения.','Condition reports and viewings are handled as structured workflows rather than ordinary messages.')+'</p></div><button class="action-sheet-close" data-close-sheet>×</button></div>')
}
function requestSheet(kind,ctx){
 const isCondition=kind==='condition',title=isCondition?copy('Запросить Condition Report','Request Condition Report'):copy('Запросить просмотр','Request viewing');
 return sheet('<div class="action-sheet-head"><div><div class="micro">'+(isCondition?'CONDITION REPORT':'VIEWING')+'</div><h2>'+title+'</h2><p><strong>'+esc(local(ctx.title))+'</strong>'+(ctx.sellerName?' · '+esc(ctx.sellerName):'')+'</p></div><button class="action-sheet-close" data-close-sheet>×</button></div>'+
 '<form id="v23ServiceRequestForm" data-kind="'+kind+'" data-listing="'+esc(ctx.id)+'" data-action-id="'+esc(crypto.randomUUID())+'" class="v14-stack-form">'+
 '<label>'+copy('Комментарий','Note')+'<textarea name="note" maxlength="2000" rows="5" placeholder="'+(isCondition?copy('Например: особенно важны следы реставрации на основании и креплениях.','For example: please focus on restoration around the base and mounts.'):copy('Укажите предпочтительные дни или ограничения по времени.','Share preferred days or time constraints.'))+'"></textarea></label>'+
 '<div class="inquiry-note-v21">'+copy('Повторная отправка после сетевого сбоя не создаст второй запрос.','Retrying after a network interruption will not create a duplicate request.')+'</div>'+
 '<button class="primary-button" type="submit">'+title+'</button></form>')
}
function installPassportActions(ctx,me,seq){
 if(seq!==passportSeq||!ctx?.id)return;
 if(me?.account?.sellerId&&me.account.sellerId===ctx.sellerId)return;
 const dock=document.querySelector('#dialog[open] .dossier-commerce-dock .dock-actions');if(!dock)return;
 for(const [kind,label] of [['condition',copy('Condition Report','Condition Report')],['viewing',copy('Запросить просмотр','Request viewing')]]){
  if(dock.querySelector('[data-v23-service="'+kind+'"]'))continue;
  const b=document.createElement('button');b.type='button';b.className='secondary-button v23-service-cta';b.dataset.v23Service=kind;b.dataset.listing=ctx.id;b.dataset.sellerId=ctx.sellerId||'';b.textContent=label;b._serviceContext=ctx;dock.append(b)
 }
}
window.addEventListener('antiqua:passport',async e=>{
 const seq=++passportSeq,ctx=e.detail?.listing;document.querySelectorAll('[data-v23-service]').forEach(x=>x.remove());if(!ctx)return;
 const me=await safe('/api/auth/me');installPassportActions(ctx,me,seq)
});

function conditionCard(d,r){
 const latest=r.versions?.at(-1),seller=r.participantRole==='SELLER';
 return '<article class="v14-card v23-service-card" data-v23-condition-card="'+esc(r.id)+'">'+
  '<div class="v14-card-head"><span class="status-pill">'+esc(status(r.status))+'</span><b>v'+esc(r.version)+'</b></div>'+
  '<h4>'+esc(objTitle(d,r.objectId))+'</h4>'+
  '<small>'+copy('Condition Report','Condition Report')+(r.currentReportVersion?' · report v'+r.currentReportVersion:'')+'</small>'+
  (r.note?'<p>'+esc(r.note)+'</p>':'')+
  (latest?'<div class="v23-latest"><b>'+copy('Последняя версия','Latest version')+' '+latest.versionNo+'</b><span>'+date(latest.createdAt)+'</span>'+(latest.summary?'<p>'+esc(latest.summary)+'</p>':'')+'</div>':'')+
  '<div class="v14-actions">'+
  (latest?'<button class="quiet-button" data-v23-condition-read="'+esc(r.id)+'" data-version="'+esc(latest.versionNo)+'">'+copy('Открыть отчёт','Open report')+'</button>':'')+
  ((r.allowedActions||[]).includes('PUBLISH_VERSION')?'<button class="primary-button" data-v23-condition-publish="'+esc(r.id)+'">'+copy(latest?'Новая версия':'Загрузить отчёт',latest?'New version':'Upload report')+'</button>':'')+
  ((r.allowedActions||[]).includes('CANCEL')?'<button class="quiet-button" data-v23-condition-cancel="'+esc(r.id)+'" data-version="'+esc(r.version)+'">'+copy('Отменить запрос','Cancel request')+'</button>':'')+
  '</div></article>'
}
function currentProposal(r){return(r.slots||[]).filter(x=>x.proposalVersion===r.proposalVersion)}
function viewingCard(d,r){
 const slots=currentProposal(r),cal=r.calendarEvent;
 return '<article class="v14-card v23-service-card" data-v23-viewing-card="'+esc(r.id)+'">'+
 '<div class="v14-card-head"><span class="status-pill">'+esc(status(r.status))+'</span><b>v'+esc(r.version)+'</b></div>'+
 '<h4>'+esc(objTitle(d,r.objectId))+'</h4><small>'+copy('Просмотр предмета','Object viewing')+'</small>'+
 (r.note?'<p>'+esc(r.note)+'</p>':'')+
 (slots.length?'<div class="v23-slot-list">'+slots.map(s=>'<span>'+esc(fmtDateTime(s.startsAt))+'</span>').join('')+'</div>':'')+
 (cal?'<div class="v23-calendar-summary"><b>'+copy(cal.status==='CANCELLED'?'Календарь отменён':'В календаре',cal.status==='CANCELLED'?'Calendar cancelled':'Calendar confirmed')+'</b><span>'+fmtDateTime(cal.startsAt)+'</span></div>':'')+
 '<div class="v14-actions">'+
 ((r.allowedActions||[]).includes('PROPOSE_SLOTS')?'<button class="primary-button" data-v23-viewing-propose="'+esc(r.id)+'" data-version="'+esc(r.version)+'">'+copy('Предложить слоты','Propose slots')+'</button>':'')+
 ((r.allowedActions||[]).includes('CONFIRM')?'<button class="primary-button" data-v23-viewing-confirm-open="'+esc(r.id)+'">'+copy('Выбрать время','Choose time')+'</button>':'')+
 ((r.allowedActions||[]).includes('REQUEST_RESCHEDULE')?'<button class="secondary-button" data-v23-viewing-reschedule="'+esc(r.id)+'" data-version="'+esc(r.version)+'">'+copy('Перенести','Reschedule')+'</button>':'')+
 ((r.allowedActions||[]).includes('CANCEL')?'<button class="quiet-button" data-v23-viewing-cancel="'+esc(r.id)+'" data-version="'+esc(r.version)+'">'+copy('Отменить','Cancel')+'</button>':'')+
 (cal?'<a class="quiet-button" href="/api/viewing-requests/'+encodeURIComponent(r.id)+'/calendar.ics">'+copy('Добавить в календарь','Add to calendar')+'</a>':'')+
 '</div></article>'
}
export function servicesPanel(d){
 const c=d.conditionRequests||[],v=d.viewingRequests||[];
 return '<div class="v14-panel v23-services-panel" data-v14-panel="services">'+
 '<div class="v14-panel-head"><div><span>CONDITION & VIEWING</span><h3>'+copy('Сервисы до сделки','Pre-sale services')+'</h3><p>'+copy('Структурированные запросы с версией, ответственным следующим действием и неизменяемой историей.','Structured requests with versioned state, explicit next action and immutable history.')+'</p></div></div>'+
 '<div class="v23-service-section"><h4>Condition Reports</h4><div class="v23-service-grid">'+(c.length?c.map(r=>conditionCard(d,r)).join(''):'<div class="empty-state">'+copy('Запросов нет','No requests')+'</div>')+'</div></div>'+
 '<div class="v23-service-section"><h4>'+copy('Просмотры','Viewings')+'</h4><div class="v23-service-grid">'+(v.length?v.map(r=>viewingCard(d,r)).join(''):'<div class="empty-state">'+copy('Запросов нет','No requests')+'</div>')+'</div></div></div>'
}

function conditionPublishSheet(id){
 return sheet('<div class="action-sheet-head"><div><div class="micro">CONDITION REPORT</div><h2>'+copy('Опубликовать версию отчёта','Publish report version')+'</h2><p>'+copy('PDF или изображение проходит существующую проверку private object storage и затем фиксируется как неизменяемая версия.','The PDF or image uses the existing private object-storage verification flow and is then fixed as an immutable version.')+'</p></div><button class="action-sheet-close" data-close-sheet>×</button></div>'+
 '<form id="v23ConditionPublishForm" data-request="'+esc(id)+'" data-action-id="'+esc(crypto.randomUUID())+'" class="v14-stack-form">'+
 '<label>'+copy('Файл','File')+'<input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required></label>'+
 '<label>'+copy('Краткое резюме','Summary')+'<textarea name="summary" maxlength="4000" rows="3"></textarea></label>'+
 '<label>'+copy('Оценка состояния','Condition grade')+'<input name="conditionGrade" maxlength="80"></label>'+
 '<label>'+copy('Реставрации / замечания','Restoration / notes')+'<textarea name="restorationNotes" maxlength="4000" rows="4"></textarea></label>'+
 '<button class="primary-button" type="submit">'+copy('Загрузить и опубликовать','Upload & publish')+'</button></form>')
}
const sha256=async file=>{const b=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')};

async function viewingProposeSheet(id,version){
 const tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',row=i=>'<label>'+copy('Слот','Slot')+' '+i+'<input name="slot'+i+'" type="datetime-local" required></label>';
 return sheet('<div class="action-sheet-head"><div><div class="micro">VIEWING SLOTS</div><h2>'+copy('Предложить время просмотра','Propose viewing times')+'</h2><p>'+copy('Предложите несколько вариантов. Старые предложения останутся в истории.','Offer several options. Previous proposals remain in history.')+'</p></div><button class="action-sheet-close" data-close-sheet>×</button></div>'+
 '<form id="v23ViewingSlotsForm" data-request="'+esc(id)+'" data-version="'+esc(version)+'" data-action-id="'+esc(crypto.randomUUID())+'" class="v14-stack-form">'+row(1)+row(2)+row(3)+
 '<label>Timezone<input name="timezone" value="'+esc(tz)+'" required></label><button class="primary-button" type="submit">'+copy('Отправить варианты','Send options')+'</button></form>')
}
async function viewingConfirmSheet(id){
 const d=await api('/api/viewing-requests/'+encodeURIComponent(id)),r=d.request,slots=currentProposal(r);
 return sheet('<div class="action-sheet-head"><div><div class="micro">VIEWING</div><h2>'+copy('Выберите время','Choose a time')+'</h2><p>'+copy('Подтверждение создаст календарное событие.','Confirmation creates a calendar event.')+'</p></div><button class="action-sheet-close" data-close-sheet>×</button></div>'+
 '<div class="v23-confirm-slots">'+slots.map(s=>'<button class="secondary-button" data-v23-viewing-confirm="'+esc(id)+'" data-slot="'+esc(s.id)+'" data-version="'+esc(r.version)+'" data-action-id="'+esc(crypto.randomUUID())+'">'+esc(fmtDateTime(s.startsAt))+'</button>').join('')+'</div>')
}
function reasonSheet(action,id,version){
 const reschedule=action==='reschedule';
 return sheet('<div class="action-sheet-head"><div><div class="micro">VIEWING</div><h2>'+copy(reschedule?'Запросить перенос':'Отменить просмотр',reschedule?'Request reschedule':'Cancel viewing')+'</h2></div><button class="action-sheet-close" data-close-sheet>×</button></div>'+
 '<form id="v23ViewingReasonForm" data-action="'+action+'" data-request="'+esc(id)+'" data-version="'+esc(version)+'" data-action-id="'+esc(crypto.randomUUID())+'" class="v14-stack-form"><label>'+copy('Причина','Reason')+'<textarea name="reason" maxlength="2000" rows="4"></textarea></label><button class="primary-button" type="submit">'+copy('Подтвердить','Confirm')+'</button></form>')
}

document.addEventListener('click',async e=>{
 const service=e.target.closest?.('[data-v23-service]');if(service){e.preventDefault();const me=await safe('/api/auth/me');if(!me?.account)return authSheet();if(!(me.account.roles||[]).includes('BUYER'))return toast(copy('Нужен аккаунт покупателя','A buyer account is required'));return requestSheet(service.dataset.v23Service,service._serviceContext||{id:service.dataset.listing,sellerId:service.dataset.sellerId,title:{ru:'Предмет',en:'Object'}})}
 const pub=e.target.closest?.('[data-v23-condition-publish]');if(pub){e.preventDefault();return conditionPublishSheet(pub.dataset.v23ConditionPublish)}
 const read=e.target.closest?.('[data-v23-condition-read]');if(read){e.preventDefault();try{const d=await api('/api/condition-report-requests/'+encodeURIComponent(read.dataset.v23ConditionRead)+'/versions/'+read.dataset.version+'/read');window.open(d.read.signedUrl,'_blank','noopener')}catch(err){toast(err.message)}return}
 const cc=e.target.closest?.('[data-v23-condition-cancel]');if(cc){e.preventDefault();cc.dataset.actionId??=crypto.randomUUID();try{await api('/api/condition-report-requests/'+encodeURIComponent(cc.dataset.v23ConditionCancel)+'/cancel',{method:'POST',body:JSON.stringify({expectedVersion:Number(cc.dataset.version),clientActionId:cc.dataset.actionId})});window.dispatchEvent(new CustomEvent('antiqua:operations-refresh'))}catch(err){toast(err.message)}return}
 const prop=e.target.closest?.('[data-v23-viewing-propose]');if(prop){e.preventDefault();return viewingProposeSheet(prop.dataset.v23ViewingPropose,prop.dataset.version)}
 const choose=e.target.closest?.('[data-v23-viewing-confirm-open]');if(choose){e.preventDefault();try{return await viewingConfirmSheet(choose.dataset.v23ViewingConfirmOpen)}catch(err){return toast(err.message)}}
 const confirm=e.target.closest?.('[data-v23-viewing-confirm]');if(confirm){e.preventDefault();confirm.disabled=true;try{await api('/api/viewing-requests/'+encodeURIComponent(confirm.dataset.v23ViewingConfirm)+'/confirm',{method:'POST',body:JSON.stringify({slotId:confirm.dataset.slot,expectedVersion:Number(confirm.dataset.version),clientActionId:confirm.dataset.actionId})});document.querySelector('#actionSheet')?.close();window.dispatchEvent(new CustomEvent('antiqua:operations-refresh'));toast(copy('Просмотр подтверждён','Viewing confirmed'))}catch(err){confirm.disabled=false;toast(err.message)}return}
 const re=e.target.closest?.('[data-v23-viewing-reschedule]');if(re){e.preventDefault();return reasonSheet('reschedule',re.dataset.v23ViewingReschedule,re.dataset.version)}
 const vc=e.target.closest?.('[data-v23-viewing-cancel]');if(vc){e.preventDefault();return reasonSheet('cancel',vc.dataset.v23ViewingCancel,vc.dataset.version)}
});

document.addEventListener('submit',async e=>{
 const f=e.target;
 if(f.id==='v23ServiceRequestForm'){
  e.preventDefault();const b=f.querySelector('button[type="submit"]');b.disabled=true;try{const d=Object.fromEntries(new FormData(f).entries()),kind=f.dataset.kind,path=kind==='condition'?'/api/listings/'+encodeURIComponent(f.dataset.listing)+'/condition-report-requests':'/api/listings/'+encodeURIComponent(f.dataset.listing)+'/viewing-requests';await api(path,{method:'POST',body:JSON.stringify({note:d.note,clientActionId:f.dataset.actionId})});document.querySelector('#actionSheet')?.close();toast(kind==='condition'?copy('Condition Report запрошен','Condition Report requested'):copy('Просмотр запрошен','Viewing requested'));window.dispatchEvent(new CustomEvent('antiqua:operations-refresh'))}catch(err){b.disabled=false;toast(err.message)}return
 }
 if(f.id==='v23ConditionPublishForm'){
  e.preventDefault();const b=f.querySelector('button[type="submit"]');b.disabled=true;try{
   const request=(await api('/api/condition-report-requests/'+encodeURIComponent(f.dataset.request))).request,fd=new FormData(f),file=fd.get('file');if(!(file instanceof File)||!file.size)throw new Error(copy('Выберите файл','Choose a file'));
   const hash=await sha256(file),intent=await api('/api/media/upload-intent',{method:'POST',body:JSON.stringify({objectId:request.objectId,bytes:file.size,contentType:file.type,sha256:hash,role:'CONDITION'})});
   const put=await fetch(intent.uploadUrl,{method:'PUT',headers:{'content-type':file.type},body:file});if(!put.ok)throw new Error(copy('Не удалось загрузить файл','File upload failed'));
   const completeId='condition-complete-'+crypto.randomUUID();await api('/api/media/'+encodeURIComponent(intent.asset.id)+'/complete',{method:'POST',headers:{'idempotency-key':completeId},body:'{}'});
   await api('/api/condition-report-requests/'+encodeURIComponent(request.id)+'/versions',{method:'POST',body:JSON.stringify({mediaId:intent.asset.id,summary:fd.get('summary'),conditionGrade:fd.get('conditionGrade'),restorationNotes:fd.get('restorationNotes'),expectedVersion:request.version,clientActionId:f.dataset.actionId})});
   document.querySelector('#actionSheet')?.close();toast(copy('Версия отчёта опубликована','Report version published'));window.dispatchEvent(new CustomEvent('antiqua:operations-refresh'))
  }catch(err){b.disabled=false;toast(err.message)}return
 }
 if(f.id==='v23ViewingSlotsForm'){
  e.preventDefault();const b=f.querySelector('button[type="submit"]');b.disabled=true;try{const d=Object.fromEntries(new FormData(f).entries()),tz=d.timezone,slots=[d.slot1,d.slot2,d.slot3].filter(Boolean).map(x=>{const start=new Date(x),end=new Date(start.getTime()+60*60*1000);return{startsAt:start.toISOString(),endsAt:end.toISOString(),timezone:tz}});await api('/api/viewing-requests/'+encodeURIComponent(f.dataset.request)+'/slots',{method:'POST',body:JSON.stringify({slots,expectedVersion:Number(f.dataset.version),clientActionId:f.dataset.actionId})});document.querySelector('#actionSheet')?.close();toast(copy('Варианты отправлены','Viewing options sent'));window.dispatchEvent(new CustomEvent('antiqua:operations-refresh'))}catch(err){b.disabled=false;toast(err.message)}return
 }
 if(f.id==='v23ViewingReasonForm'){
  e.preventDefault();const b=f.querySelector('button[type="submit"]');b.disabled=true;try{const d=Object.fromEntries(new FormData(f).entries()),path=f.dataset.action==='reschedule'?'reschedule':'cancel';await api('/api/viewing-requests/'+encodeURIComponent(f.dataset.request)+'/'+path,{method:'POST',body:JSON.stringify({reason:d.reason,expectedVersion:Number(f.dataset.version),clientActionId:f.dataset.actionId})});document.querySelector('#actionSheet')?.close();toast(f.dataset.action==='reschedule'?copy('Запрошен перенос','Reschedule requested'):copy('Просмотр отменён','Viewing cancelled'));window.dispatchEvent(new CustomEvent('antiqua:operations-refresh'))}catch(err){b.disabled=false;toast(err.message)}return
 }
});
