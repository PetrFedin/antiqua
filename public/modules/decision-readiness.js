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
  synchronizeActions(section,dialog);
 }else{
  section.dataset.readinessState='unavailable';
  output.innerHTML=unavailableMarkup(result.status);
 }
}
window.addEventListener('antiqua:passport',event=>{
 update(event).catch(error=>console.error('Decision readiness display:',error?.name||'UNKNOWN'));
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
