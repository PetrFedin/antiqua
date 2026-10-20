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
const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[ch]));
const local=(ru,en)=>lang()==='en'?en:ru;
const requests=new WeakMap();

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
function reportMarkup(readiness){
 const loc=lang()==='en'?1:0;
 const items=readiness.checks.map(x=>{
  const code=x.code;
  const unresolved=!['RECORDED','RECORDED_UNCERTIFIED','INDEXED_UNCERTIFIED','PUBLIC_RESULT_RECORDED'].includes(x.status);
  return '<li class="readiness-check" data-readiness-code="'+code+
   '" data-readiness-attention="'+unresolved+'">'+
    '<div class="readiness-check-row"><strong>'+esc(labels[code][loc])+'</strong>'+
    '<span class="readiness-status">'+esc(statuses[x.status][loc])+'</span></div>'+
    '<a href="'+destinations[code]+'" class="readiness-source">'+
     local('Посмотреть связанные сведения','Review related information')+' →</a></li>';
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
function mount(host,id){
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
 const tabs=host.querySelector('.dossier-tabs');
 if(tabs&&!tabs.querySelector('a[href="#dossier-readiness"]')){
  const link=document.createElement('a');
  link.href='#dossier-readiness';
  link.textContent=local('Что проверить','Evidence checklist');
  tabs.append(link);
 }
 return section;
}
async function update(event){
 const id=String(event.detail?.id||'');
 const dialog=document.querySelector('#dialog[open]');
 const host=dialog?.querySelector('.dossier-body');
 if(!id||!host)return;
 const section=mount(host,id);
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
  output.innerHTML=reportMarkup(result.data.readiness);
 }else{
  section.dataset.readinessState='unavailable';
  output.innerHTML=unavailableMarkup(result.status);
 }
}
window.addEventListener('antiqua:passport',event=>{
 update(event).catch(error=>console.error('Decision readiness display:',error?.name||'UNKNOWN'));
});
