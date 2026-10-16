import {copy,esc,local,status,sheet} from './core.js';

function objectOptions(d){
  const lots=d.catalog?.lots||[];
  return lots.map(o=>`<option value="${esc(o.id)}">${esc(local(o.title)||o.objectId||o.id)} · ${esc(o.objectId||o.id)}</option>`).join('')
}

export function collectionRecordsPanel(d){
  const objects=objectOptions(d);
  return`<div class="v14-panel" data-v14-panel="records"><div class="v14-panel-head"><div><span>COLLECTION RECORDS · PRIVATE</span><h3>${copy('Учёт произведений: владение, хранение и страхование','Collection records: ownership, storage & insurance')}</h3><p class="muted">${copy('Приватный операционный контур. Эти данные не являются публичной коллекцией и не публикуются в разделе «Коллекции».','Private operational records. These data are not a curated Collection and are never published as one.')}</p></div></div><form id="v14RecordForm" class="v14-inline-form"><label>${copy('Произведение','Artwork')}<select name="objectId" required><option value="">${copy('Выберите предмет','Choose an object')}</option>${objects}</select></label><label>${copy('Стоимость оценки','Appraisal value')}<input name="appraisal" type="number" min="0"></label><label>${copy('Место хранения','Storage')}<input name="storage" placeholder="Amsterdam"></label><button class="primary-button">${copy('Сохранить запись','Save record')}</button></form><div class="v14-grid">${d.records.length?d.records.map(recordCard).join(''):`<div class="empty-state">${copy('Приватных учётных записей пока нет','No private artwork records yet')}</div>`}</div></div>`
}

export function curatedCollectionsPanel(d){
  const xs=d.myCollections||[],options=xs.map(c=>`<option value="${esc(c.id)}">${esc(local(c.title)||c.id)} · ${esc(status(c.visibility))}</option>`).join(''),objects=objectOptions(d);
  return`<div class="v14-panel collection-studio-v70" data-v14-panel="collections"><div class="v14-panel-head"><div><span>ANTIQUA / PERSONAL COLLECTION STUDIO</span><h3>${copy('Мои коллекции, витрины и исследовательские подборки','My collections, showcases & research groupings')}</h3><p class="muted">${copy('PRIVATE — доступ только владельцу. UNLISTED — доступ по ссылке с действующими серверными ограничениями. PUBLIC может открыть сведения другим людям: перед публикацией проверьте права на изображения и персональные данные. Учёт владения, хранения и страхования остаётся отдельно.','PRIVATE is owner-only. UNLISTED is accessible by link subject to server rules. PUBLIC may disclose information: check image rights and personal details before publishing. Ownership, storage and insurance records stay separate.')}</p></div></div>
  <div class="collection-studio-metrics">
   <div><strong>${xs.length}</strong><span>${copy('Всего','Total')}</span></div>
   <div><strong>${xs.filter(x=>x.visibility==='PRIVATE').length}</strong><span>${copy('Приватных','Private')}</span></div>
   <div><strong>${xs.filter(x=>x.visibility==='UNLISTED').length}</strong><span>${copy('По ссылке','Link only')}</span></div>
   <div><strong>${xs.filter(x=>x.visibility==='PUBLIC').length}</strong><span>${copy('Публичных','Public')}</span></div>
  </div>
  <form id="v14CollectionCreateForm" class="v14-inline-form collection-studio-create"><label>${copy('Название','Title')}<input name="title" required></label><label>${copy('Тип','Type')}<select name="collectionType"><option value="PERSONAL">PERSONAL</option><option value="CURATED">CURATED</option><option value="DISTRIBUTED">DISTRIBUTED</option><option value="INSTITUTIONAL">INSTITUTIONAL</option></select></label><label>${copy('Видимость','Visibility')}<select name="visibility"><option value="PRIVATE">PRIVATE · ${copy('личная','personal')}</option><option value="UNLISTED">UNLISTED · ${copy('по ссылке','link only')}</option><option value="PUBLIC">PUBLIC · ${copy('публичная витрина','public showcase')}</option></select></label><label class="collection-studio-consent" data-collection-publication-consent hidden><input type="checkbox" name="publicationConsent" disabled><span>${copy('Я проверил(а) права на изображения и отсутствие приватных сведений перед публичным показом.','I checked image rights and that no private details would be exposed before public sharing.')}</span></label><button class="primary-button">${copy('Создать коллекцию','Create collection')}</button></form>
  ${xs.length?`<form id="v14CollectionArtworkForm" class="v14-inline-form"><label>${copy('Коллекция / витрина','Collection / showcase')}<select name="collectionId" required>${options}</select></label><label>${copy('Произведение','Artwork')}<select name="objectId" required><option value="">${copy('Выберите предмет','Choose an object')}</option>${objects}</select></label><label>${copy('Раздел / тема','Section / theme')}<input name="section" placeholder="${copy('Например: Пейзажи','e.g. Landscapes')}"></label><button class="secondary-button">${copy('Добавить экспонат','Add exhibit')}</button></form>`:''}
  <div class="v14-grid collection-studio-grid">${xs.length?xs.map((c,i)=>collectionCard(c,i)).join(''):`<div class="empty-state">${copy('Создайте первую коллекцию. PUBLIC-коллекция работает как публичная витрина, PRIVATE остаётся только в кабинете.','Create your first Collection. A PUBLIC Collection acts as a public showcase; PRIVATE remains account-only.')}</div>`}</div></div>`
}
function collectionCard(c,index){
  const showcase=c.visibility==='PUBLIC';
  return`<article class="v14-card collection-studio-card"><div class="collection-studio-number" aria-hidden="true">${String(index+1).padStart(2,'0')}</div><div class="v14-card-head"><span class="status-pill">${showcase?copy('PUBLIC · ВИТРИНА','PUBLIC · SHOWCASE'):esc(status(c.visibility))}</span><b>${c.items?.length||0} ${copy('предм.','obj.')}</b></div><h4>${esc(local(c.title)||c.id)}</h4><small>${esc(status(c.collectionType))} · ${copy('Роль','Role')}: ${esc(c.accessRole||'OWNER')}</small><p class="muted">${esc(local(c.summary)||copy('Кураторское описание пока не добавлено','No curatorial summary yet'))}</p><div class="v14-actions"><a class="quiet-button" href="#collection/${esc(c.id)}">${showcase?copy('Открыть витрину','Open showcase'):copy('Открыть коллекцию','Open collection')}</a></div></article>`
}
function recordCard(r){const appraisal=r.appraisal?.value?`${new Intl.NumberFormat(document.documentElement.lang==='ru'?'ru-RU':'en-GB').format(r.appraisal.value)} ${esc(r.appraisal.currency||'EUR')}`:'—';return`<article class="v14-card"><div class="v14-card-head"><span class="status-pill">${esc(status(r.status))}</span><b>${r.policies?.length||0} ${copy('полис.','pol.')}</b></div><h4>${esc(local(r.object?.title)||r.objectId)}</h4><small>${esc(r.objectId)} · ${copy('Оценка','Appraisal')}: ${appraisal} · ${copy('События','Events')}: ${r.movements?.length||0}</small><div class="v14-actions"><button class="quiet-button" data-v14-movement="${esc(r.objectId)}">${copy('Движение','Movement')}</button><button class="quiet-button" data-v14-insurance="${esc(r.objectId)}">${copy('Страхование','Insurance')}</button></div></article>`}
export function movementSheet(objectId){sheet(`<div class="action-sheet-head"><h2>${copy('Новое движение','New movement')}</h2><button class="action-sheet-close" data-close-sheet>×</button></div><form id="v14MovementForm" data-object="${esc(objectId)}" class="v14-stack-form"><label>${copy('Тип','Type')}<select name="movementType"><option>MOVED</option><option>LOANED</option><option>RETURNED</option><option>CONSIGNED</option><option>RESTORED</option><option>APPRAISED</option><option>SOLD</option></select></label><label>${copy('Откуда','From')}<input name="from"></label><label>${copy('Куда','To')}<input name="to"></label><label>${copy('Комментарий','Note')}<textarea name="note"></textarea></label><button class="primary-button">${copy('Сохранить','Save')}</button></form>`)}
export function insuranceSheet(objectId){sheet(`<div class="action-sheet-head"><h2>${copy('Страховой полис','Insurance policy')}</h2><button class="action-sheet-close" data-close-sheet>×</button></div><form id="v14InsuranceForm" data-object="${esc(objectId)}" class="v14-stack-form"><label>${copy('Страховщик','Provider')}<input name="provider" required></label><label>${copy('Номер (маскированный)','Policy number (masked)')}<input name="policy"></label><label>${copy('Страховая стоимость','Insured value')}<input name="value" type="number" min="0" required></label><button class="primary-button">${copy('Добавить полис','Add policy')}</button></form>`)}


// A client-side disclosure reminder only. It does not grant publication rights.
document.addEventListener('change',event=>{
 const select=event.target;
 if(!select.matches?.('#v14CollectionCreateForm select[name="visibility"]'))return;
 const form=select.closest('form');
 const area=form?.querySelector('[data-collection-publication-consent]');
 const checkbox=area?.querySelector('input[name="publicationConsent"]');
 if(!area||!checkbox)return;
 const open=select.value==='PUBLIC';
 area.hidden=!open;
 checkbox.disabled=!open;
 checkbox.required=open;
 if(!open)checkbox.checked=false;
});
