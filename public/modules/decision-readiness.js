import {toast} from './core.js';
// ANTIQUA v87 — collector evidence checklist, presentation only.
// Publication and evidence permissions are resolved by server-side PostgreSQL.
const lang=()=>document.documentElement.lang==='en'?'en':'ru';
const labels={
 ARTWORK_IDENTITY:['Данные произведения','Artwork identity'],
 ATTRIBUTION:['Авторство и атрибуция','Attribution'],
 PROVENANCE:['История происхождения','Provenance'],
 CONDITION:['Состояние','Condition'],
 SCHOLARSHIP:['Исследования и литература','Scholarship'],
 SALE_HISTORY:['История продаж','Market record'],
 LEGAL_TITLE:['Законность владения','Legal title'],
 IMAGE_RIGHTS:['Права на изображение','Image rights']
};
const destinations={
 ARTWORK_IDENTITY:'#dossier-overview',ATTRIBUTION:'#dossier-overview',
 PROVENANCE:'#dossier-provenance',CONDITION:'#dossier-condition',
 SCHOLARSHIP:'#dossier-scholarly',SALE_HISTORY:'#dossier-market-history',
 LEGAL_TITLE:'#dossier-evidence',IMAGE_RIGHTS:'#dossier-evidence'
};
const statuses={
 RECORDED:['Записано, не удостоверено','Recorded, not certified'],
 INCOMPLETE:['Данных недостаточно','Information missing'],
 DISPUTED:['Атрибуция оспаривается','Attribution disputed'],
 UNRESOLVED:['Требуется проверка','Unresolved'],
 RECORDED_UNCERTIFIED:['Атрибуция указана','Attribution recorded'],
 CONFLICTED:['Есть противоречия','Conflicting evidence'],
 INDEXED_UNCERTIFIED:['Сведения проиндексированы','Evidence indexed'],
 NO_PUBLIC_RECORDS:['Нет опубликованных источников','No public records'],
 NOT_ASSESSED:['Не оценивалось специалистом','Not assessed'],
 HUMAN_ASSESSMENT_REQUIRED:['Необходимо заключение специалиста','Human assessment required'],
 NOT_PUBLICLY_RELEASED:['Публикация не разрешена','Not publicly released'],
 REQUIRES_REVIEW:['Необходима проверка','Review required'],
 PUBLIC_RESULT_RECORDED:['Есть публичный результат','Public result recorded'],
 NO_PUBLIC_RESULTS:['Нет публичных результатов','No public results'],
 NOT_VERIFIED:['Не подтверждено','Not verified'],
 NOT_INDEPENDENTLY_VERIFIED:['Не подтверждено независимо','Not independently verified']
};
// These CTAs call the existing, server-authorized pre-sale workflows.
// They NEVER write, certify, issue a private-room grant or send automatically.
const requestTypes={
 PROVENANCE:{selector:'[data-object-inquiry]',ru:'Запросить документы',en:'Request source documents'},
 CONDITION:{selector:'[data-v23-service="condition"]',ru:'Запросить отчёт о состоянии',en:'Request a condition report'}
};
const validListingId=x=>typeof x==='string'&&/^[A-Za-z0-9._:-]{1,120}$/.test(x);
const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[ch]));
const local=(ru,en)=>lang()==='en'?en:ru;
// v90 — buyer-only service progress, separate from public research status.
// Every displayed status derives from a permitted existing workflow read.
const progressStates={
 NOT_REQUESTED:['Не запрашивалось','Not requested'],
 SENT:['Запрос направлен','Request sent'],
 SELLER_REPLIED:['Получен ответ продавца','Dealer replied'],
 REQUESTED:['Отчёт запрошен','Report requested'],
 REPORT_PUBLISHED:['Опубликована версия отчёта','Report version available'],
 CANCELLED:['Запрос отменён','Request cancelled']
};
const progressCalls=new WeakMap();
function validProgress(payload,id,listingId){
 const p=payload?.progress;
 if(p?.schemaVersion!=='antiqua-buyer-diligence-v1'||
  p?.objectId!==id||p?.listingId!==listingId||
  p?.scope!=='CURRENT_BUYER_ONLY'||
  p?.authority!=='BUYER_SCOPED_WORKFLOW_EVENTS'||
  !Array.isArray(p.tracks)||p.tracks.length!==2||
  p.tracks[0]?.code!=='PROVENANCE'||p.tracks[1]?.code!=='CONDITION'||
  !p.tracks.every(t=>Boolean(progressStates[t.state])&&
    (t.updatedAt==null||typeof t.updatedAt==='string'&&
     Number.isFinite(Date.parse(t.updatedAt))))||
  p.limitations?.authenticityCertified!==false||
  p.limitations?.legalTitleVerified!==false||
  p.limitations?.sourceDocumentsDelivered!==false||
  p.limitations?.conditionProfessionallyCertified!==false||
  p.limitations?.privateDocumentAccessGranted!==false||
  p.limitations?.transactionCompleted!==false)return false;
 const sent=new Set(['SENT','SELLER_REPLIED','REQUESTED','REPORT_PUBLISHED']);
 const answered=new Set(['SELLER_REPLIED','REPORT_PUBLISHED']);
 return p.summary?.tracks===2&&
  p.summary.initiated===p.tracks.filter(t=>sent.has(t.state)).length&&
  p.summary.repliedOrPublished===p.tracks.filter(t=>answered.has(t.state)).length;
}
function progressMarkup(p){
 const ix=lang()==='en'?1:0;
 const date=t=>{
  if(!t.updatedAt)return '';
  const d=new Date(t.updatedAt);
  return '<time datetime="'+esc(t.updatedAt)+'">'+
    esc(new Intl.DateTimeFormat(lang()==='en'?'en-GB':'ru-RU',{
      day:'numeric',month:'short',year:'numeric'
    }).format(d))+'</time>';
 };
 return '<div class="buyer-progress-heading"><h4>'+
  local('После обращения','After your enquiry')+'</h4><span>'+
  local('Ваши обращения по этой картине','Your requests for this painting')+'</span></div>'+
  '<ol class="buyer-progress-list">'+p.tracks.map(t=>
   '<li data-progress-track="'+t.code+'" data-progress-state="'+t.state+'">'+
    '<span class="buyer-progress-label">'+esc(labels[t.code][ix])+'</span>'+
    '<strong>'+esc(progressStates[t.state][ix])+'</strong>'+date(t)+'</li>'
  ).join('')+'</ol><p class="buyer-progress-note">'+
  local('Статусы показывают ход переписки и получения отчётов — они не подтверждают подлинность картины или законность владения.',
   'Statuses track correspondence and reports. They do not certify authenticity or legal title.')+'</p>';
}
async function loadBuyerProgress(section,dialog,id,listingId){
 const host=dialog.querySelector('.dossier-body');
 const output=section.querySelector('[data-buyer-progress]');
 if(!output||!validListingId(listingId)||!host)return;
 const stamp={section,id,listingId};
 progressCalls.set(section,stamp);
 output.dataset.progressState='loading';
 output.textContent=local('Проверяем статус ваших обращений…','Checking your request progress…');
 let result;
 try{
  const response=await fetch('/api/listings/'+encodeURIComponent(listingId)+'/diligence-progress',{
   headers:{accept:'application/json'},cache:'no-store'
  });
  result={status:response.status,data:response.ok?await response.json():null};
 }catch{result={status:0,data:null}}
 if(!dialog.open||!section.isConnected||!host.isConnected||
  dialog.querySelector('.dossier-body')!==host||
  section.dataset.readinessState!=='ready'||
  section.dataset.readinessObjectId!==id||
  section.dataset.readinessListingId!==listingId||
  progressCalls.get(section)!==stamp)return;
 if(result.status===200&&validProgress(result.data,id,listingId)){
  output.dataset.progressState='ready';
  output.innerHTML=progressMarkup(result.data.progress);
 }else{
  output.dataset.progressState=result.status===401?'sign-in':
   result.status===403?'buyer-only':'unavailable';
  output.textContent=result.status===401?
   local('Войдите как покупатель, чтобы видеть ответы и отчёты по этой картине.',
    'Sign in as a buyer to view replies and reports for this painting.'):
   result.status===403?
   local('История запросов доступна покупателю.','Request history is available to the buyer.'):
   local('Состояние обращений сейчас недоступно. Данные не считаются подтверждёнными.',
    'Request progress is currently unavailable; no status is assumed.');
 }
}
const requests=new WeakMap();
let actionObserver=null;
function resetActionObserver(){actionObserver?.disconnect();actionObserver=null}
function synchronizeActions(section,dialog){
 resetActionObserver();
 if(!section.isConnected||section.dataset.readinessState!=='ready')return;
 const refresh=()=>{
  if(!dialog.open||!section.isConnected||section.dataset.readinessState!=='ready'){
   resetActionObserver();return;
  }
  // Reacquire the canonical dock on every mutation, including when the
  // listing or seller authority removes/replaces its entire subtree.
  const dock=dialog.querySelector('.dossier-commerce-dock .dock-actions');
  for(const button of section.querySelectorAll('[data-readiness-request]')){
   const descriptor=requestTypes[button.dataset.readinessRequest];
   const match=descriptor&&dock?.querySelector(descriptor.selector);
   const current=button.dataset.readinessRequest==='PROVENANCE'?
     match?.dataset.objectInquiry:match?.dataset.listing;
   const available=Boolean(match?.isConnected&&!match.disabled&&
      validListingId(button.dataset.readinessListing)&&
      current===button.dataset.readinessListing);
   button.disabled=!available;
   button.setAttribute('aria-disabled',String(!available));
   button.title=available?'':local('Нет доступного запроса продавцу','No seller request currently available');
  }
 };
 refresh();
 actionObserver=new MutationObserver(refresh);
 actionObserver.observe(dialog,{childList:true,subtree:true});
}

function validReport(payload,id){
 const d=payload?.dossier,r=payload?.readiness;
 if(d?.objectId!==id||r?.objectId!==id||
  r?.schemaVersion!=='antiqua-decision-readiness-v1'||
  r?.decisionState!=='HUMAN_REVIEW_REQUIRED'||
  !/^[a-f0-9]{64}$/.test(r?.reportSha256||'')||
  !/^[a-f0-9]{64}$/.test(d?.projectionSha256||'')||
  r?.sourceProjectionSha256!==d?.projectionSha256||
  r?.boundaries?.proofOfAuthenticity!==false||
  r?.boundaries?.proofOfLegalTitle!==false||
  r?.boundaries?.priceOrReturnRecommendation!==false||
  r?.boundaries?.privateRoomCreated!==false||
  !Array.isArray(r?.checks)||r.checks.length!==8)return false;
 const expected=Object.keys(labels);
 return r.checks.every((x,index)=>x?.code===expected[index]&&Boolean(statuses[x.status]));
}
function reportMarkup(readiness,listingId){
 const loc=lang()==='en'?1:0;
 const items=readiness.checks.map(x=>{
  const code=x.code;
  const unresolved=!['RECORDED','RECORDED_UNCERTIFIED','INDEXED_UNCERTIFIED','PUBLIC_RESULT_RECORDED'].includes(x.status);
  const request=validListingId(listingId)?requestTypes[code]:null;
  const action=request?'<button type="button" class="readiness-request" data-readiness-request="'+code+
    '" data-readiness-listing="'+esc(listingId)+'" disabled aria-disabled="true">'+
    esc(loc?request.en:request.ru)+'</button>':'';
  return '<li class="readiness-check" data-readiness-code="'+code+
   '" data-readiness-attention="'+unresolved+'">'+
    '<div class="readiness-check-row"><strong>'+esc(labels[code][loc])+'</strong>'+
    '<span class="readiness-status">'+esc(statuses[x.status][loc])+'</span></div>'+
    '<div class="readiness-actions"><a href="'+destinations[code]+'" class="readiness-source">'+
     local('Посмотреть связанные сведения','Review related information')+' →</a>'+action+'</div></li>';
 }).join('');
 return '<div class="readiness-intro"><p>'+
    local('Документы и сведения, которые стоит запросить до решения о покупке.',
      'Evidence and questions to resolve before considering a purchase.')+
    '</p><strong>'+local('Решение требует участия человека','Human review is required')+
    '</strong></div><ol class="readiness-checks">'+items+'</ol>'+
  '<p class="readiness-limit">'+local(
   'Это список вопросов, а не оценка подлинности, подтверждение права собственности или инвестиционная рекомендация.',
   'This is an evidence checklist, not an authenticity certificate, proof of title or investment advice.')+
  '</p><small class="readiness-receipt">'+
   local('Отпечаток опубликованной проекции','Public projection receipt')+': '+
   esc(readiness.sourceProjectionSha256.slice(0,12))+'…</small>';
}
function unavailableMarkup(status){
 if(status===503)return '<p>'+local(
   'Расширенный список вопросов появится только после допуска проверенной базы и публичного досье. Демонстрационная запись не является подтверждённой.',
   'The detailed checklist requires an admitted database and approved public dossier. Demo records are not verified.')+'</p>';
 if(status===404)return '<p>'+local(
   'Публичное исследовательское досье недоступно или не согласовано.',
   'The public research dossier is unavailable or not approved.')+'</p>';
 return '<p>'+local(
   'Не удалось получить подтверждённый список. Никакие сведения не считаются автоматически проверенными.',
   'The verified checklist could not be loaded. No evidence is automatically certified.')+'</p>';
}
function mount(host,id,listingId){
 let section=host.querySelector('#dossier-readiness');
 if(!section){
  section=document.createElement('section');
  section.className='artwork-readiness';
  section.id='dossier-readiness';
  const heading=document.createElement('h3');
  heading.textContent=local('Проверка перед решением','Before you decide');
  const content=document.createElement('div');
  content.className='readiness-body';
  content.setAttribute('aria-live','polite');
  section.append(heading,content);
  const evidence=host.querySelector('#dossier-evidence');
  if(evidence)evidence.after(section);else host.append(section);
 }
 section.dataset.readinessObjectId=id;
 section.dataset.readinessListingId=listingId||'';
 // Canonical tab navigation may be a sibling of .dossier-body in
 // some responsive dialog layouts. Keep a working anchor in both layouts.
 const tabs=host.querySelector('.dossier-tabs')||
  host.closest('#dialog')?.querySelector('.dossier-tabs');
 const target=tabs||host;
 if(!target.querySelector('a[href="#dossier-readiness"]')){
  const link=document.createElement('a');
  link.href='#dossier-readiness';
  link.textContent=local('Что проверить','Evidence checklist');
  if(tabs)tabs.append(link);
  else{
   link.className='readiness-entry-link';
   host.prepend(link);
  }
 }
 return section;
}
async function update(event){
 resetActionObserver();
 const id=String(event.detail?.id||'');
 const dialog=document.querySelector('#dialog[open]');
 const host=dialog?.querySelector('.dossier-body');
 if(!id||!host)return;
 const listingId=validListingId(event.detail?.listing?.id)?event.detail.listing.id:null;
 const section=mount(host,id,listingId);
 const output=section.querySelector('.readiness-body');
 const stamp={host,id};
 requests.set(host,stamp);
 section.dataset.readinessState='loading';
 output.textContent=local('Проверяем доступность досье…','Checking dossier availability…');
 let result;
 try{
  const response=await fetch('/api/lots/'+encodeURIComponent(id)+'/decision-dossier',{
   headers:{accept:'application/json'},cache:'no-store'
  });
  result={status:response.status,data:response.ok?await response.json():null};
 }catch{result={status:0,data:null}}
 if(!host.isConnected||!dialog.open||
    dialog.querySelector('.dossier-body')!==host||
    requests.get(host)!==stamp||
    section.dataset.readinessObjectId!==id)return;
 if(result.status===200&&validReport(result.data,id)){
  section.dataset.readinessState='ready';
  output.innerHTML=reportMarkup(result.data.readiness,listingId);
  if(validListingId(listingId)){
   const followup=document.createElement('section');
   followup.className='buyer-progress';
   followup.dataset.buyerProgress='';
   followup.setAttribute('aria-live','polite');
   output.append(followup);
  }
  synchronizeActions(section,dialog);
  loadBuyerProgress(section,dialog,id,listingId).catch(error=>
   console.error('Buyer progress:',error?.name||'UNKNOWN'));
 }else{
  section.dataset.readinessState='unavailable';
  output.innerHTML=unavailableMarkup(result.status);
 }
}
window.addEventListener('antiqua:passport',event=>{
 update(event).catch(error=>console.error('Decision readiness display:',error?.name||'UNKNOWN'));
});

window.addEventListener('antiqua:diligence-updated',event=>{
 const listingId=event.detail?.listingId;
 if(!validListingId(listingId))return;
 const dialog=document.querySelector('#dialog[open]');
 const section=dialog?.querySelector('#dossier-readiness[data-readiness-state="ready"]');
 if(!section||section.dataset.readinessListingId!==listingId)return;
 loadBuyerProgress(section,dialog,section.dataset.readinessObjectId,listingId).catch(
  error=>console.error('Buyer progress refresh:',error?.name||'UNKNOWN')
 );
});
document.addEventListener('close',event=>{
 if(event.target?.id==='dialog')resetActionObserver();
},true);
document.addEventListener('click',event=>{
 const button=event.target.closest?.('[data-readiness-request]');
 if(!button)return;
 event.preventDefault();
 const section=button.closest('#dossier-readiness');
 const dialog=button.closest('#dialog[open]');
 const code=button.dataset.readinessRequest;
 const listingId=button.dataset.readinessListing;
 const descriptor=requestTypes[code];
 // The source listing must still belong to the currently rendered, admitted
 // painting dossier. No cross-object fallback, speculative login or write.
 if(!descriptor||!dialog||!section||button.disabled||section.dataset.readinessState!=='ready'||
    !validListingId(listingId)||section.dataset.readinessListingId!==listingId||
    !section.dataset.readinessObjectId){
  toast(local('Запрос недоступен для этого произведения','Request unavailable for this artwork'));
  return;
 }
 const existing=dialog.querySelector('.dossier-commerce-dock '+descriptor.selector);
 const actualListing=code==='PROVENANCE'?existing?.dataset.objectInquiry:existing?.dataset.listing;
 if(!existing?.isConnected||existing.disabled||actualListing!==listingId){
  toast(local('Для этого произведения нет доступного запроса продавцу','No seller request is currently available for this artwork'));
  return;
 }
 // Delegates into v21 Inquiry or v23 Condition Service: both do an
 // independent buyer authentication/ownership check and require submit.
 existing.click();
});
