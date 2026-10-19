// ANTIQUA collection publication workspace v79.
// This UI never grants authority. All decisions are checked by PostgreSQL API.
import {api,copy,esc,local,toast} from './core.js';
const reviewRoles=new Set(['CATALOGUER','TRUST_REVIEWER','ADMIN']);
const waitingStates=new Set(['DRAFT','REVIEW_REQUIRED','CHANGES_REQUESTED','REVOKED']);
const actions=new Set(['approve','publish','request-changes','revoke']);
const idKey=()=>('web-'+Date.now()+'-'+Math.random().toString(36).slice(2));
// Retain the key after an ambiguous network failure. Never persist private
// review notes in browser storage or reuse a key for a changed payload.
const attempts=new WeakMap();
function retryPayload(host,path,payload){
 const signature=JSON.stringify({path,payload});
 let attempt=attempts.get(host);
 if(attempt?.signature!==signature){attempt={signature,key:idKey()};attempts.set(host,attempt)}
 return {...payload,idempotencyKey:attempt.key};
}
// Bind responses to the initiating workspace. A response from an unmounted
// account must never be written into a newly mounted account's review desk.
const reads=new WeakMap();
function startRead(out){
 if(!out?.isConnected)return null;
 const token={out};reads.set(out,token);return token;
}
const currentRead=token=>Boolean(token?.out.isConnected&&reads.get(token.out)===token);
const putResult=(token,html)=>{if(currentRead(token))token.out.innerHTML=html};
const title=v=>esc(local(v)||'—');
const ownerStage=c=>c?.metadata?.publicationState||'DRAFT';
export function canSeeReviewTab(d){return Boolean(d?.me?.roles?.some(r=>reviewRoles.has(r)))}
export function reviewerTab(d){
 return canSeeReviewTab(d)?'<button type="button" data-v14-tab="collection-review">'+copy('Экспертная проверка','Review desk')+'</button>':'';
}
export function reviewerPanel(d){
 if(!canSeeReviewTab(d))return '';
 return '<div class="v14-panel review-workspace-v79" data-v14-panel="collection-review">'+
  '<div class="review-workspace-head"><div class="micro">ANTIQUA / SCHOLARLY AUTHORITY</div>'+
  '<h3>'+copy('Кураторская проверка','Curatorial review')+'</h3>'+
  '<p>'+copy('Проверка состава, атрибуции и прав. Решения принимает сервер; доступ зависит от роли и этапа.','Review composition, attribution and rights. Decisions remain server-authorized and stage-specific.')+'</p></div>'+
  '<button class="secondary-button" type="button" data-review-queue-load>'+copy('Загрузить очередь','Load review queue')+'</button>'+
  '<div class="review-workspace-result" data-review-output role="status" aria-live="polite"></div>'+
  '</div>';
}
export function ownerPublicationAction(c){
 if(c?.visibility!=='PUBLIC')return '';
 const state=ownerStage(c);
 return '<button type="button" class="quiet-button" data-collection-history="'+esc(c.id)+'">'+
   copy('История публикации','Publication history')+'</button>'+
   (waitingStates.has(state)&&c.items?.length?
    '<button type="button" class="quiet-button" data-collection-submit="'+esc(c.id)+'">'+
    copy('Отправить куратору','Submit for review')+'</button>':'');
}
export function reviewQueueMarkup(data){
 const items=Array.isArray(data?.items)?data.items:[];
 if(!items.length)return '<div class="review-empty"><h4>'+copy('Нет заявок на вашем этапе','No cases at your stage')+'</h4>'+
  '<p>'+copy('Очередь фильтруется сервером с учётом полномочий.','The server filters by reviewer authority.')+'</p></div>';
 return '<div class="review-case-list">'+items.map((r,i)=>
  '<article class="review-case"><span class="review-case-index">'+String(i+1).padStart(2,'0')+'</span>'+
  '<div class="review-case-details"><span class="micro">'+esc(r.stage)+'</span>'+
  '<h4>'+title(r.title)+'</h4><p>'+esc(r.publicationState)+'</p></div>'+
  '<button type="button" class="quiet-button" data-review-open="'+esc(r.id)+'">'+
  copy('Изучить досье','Open dossier')+'</button></article>').join('')+'</div>';
}
const decisionOptions=stage=>{
 if(stage==='CATALOGUE')return '<option value="approve">'+copy('Принять каталогизацию','Approve catalogue')+'</option>'+
  '<option value="request-changes">'+copy('Вернуть на доработку','Request changes')+'</option>';
 if(stage==='RIGHTS')return '<option value="publish">'+copy('Одобрить публикацию','Approve publication')+'</option>'+
  '<option value="request-changes">'+copy('Вернуть на доработку','Request changes')+'</option>';
 if(stage==='POST_PUBLICATION')return '<option value="revoke">'+copy('Отозвать публикацию','Revoke publication')+'</option>';
 return '';
};
function evidenceFields(works){
 return '<div class="review-evidence-fields" data-review-rights-fields hidden>'+
  '<label class="review-attestation"><input type="checkbox" name="rightsAttested">'+
  copy('Я самостоятельно проверил(а) документы о правах на каждое изображение.','I independently verified the rights documents for every image.')+'</label>'+
  works.map((w,i)=>'<fieldset><legend>'+title(w.title||w.objectId)+'</legend>'+
   '<input type="hidden" name="objectId_'+i+'" value="'+esc(w.objectId)+'">'+
   '<label>'+copy('Идентификатор подтверждения','Evidence reference')+
   '<input name="evidenceRef_'+i+'" minlength="10" maxlength="220" placeholder="evidence/reference/..."></label>'+
   '<label>'+copy('Правовое основание','Rights basis')+
   '<select name="rightsBasis_'+i+'"><option value="DIRECT_LICENSE">'+copy('Лицензия','Direct licence')+'</option>'+
   '<option value="PUBLIC_DOMAIN">'+copy('Общественное достояние','Public domain')+'</option>'+
   '<option value="CC0">CC0</option></select></label></fieldset>').join('')+'</div>';
}
export function reviewDossierMarkup(d){
 const works=Array.isArray(d?.works)?d.works:[],stage=d.stage;
 if(!['CATALOGUE','RIGHTS','POST_PUBLICATION'].includes(stage))return '';
 const valid=works.length>0&&works.every(w=>w.painting===true&&w.privacyReady===true);
 const titleText=title(d.title);
 return '<section class="review-dossier-v79"><div class="review-dossier-heading">'+
  '<span class="micro">ANTIQUA / '+esc(stage)+'</span><h4>'+titleText+'</h4>'+
  '<p>'+copy('Предметов на проверке: ','Works to review: ')+works.length+'</p></div>'+
  '<div class="review-work-grid">'+works.map((w,i)=>
   '<article class="review-work"><div class="review-work-number">'+String(i+1).padStart(2,'0')+'</div>'+
   '<div class="review-work-image">'+(w.image?'<img loading="lazy" referrerpolicy="no-referrer" src="'+esc(w.image)+'" alt="'+title(w.title)+'">':'')+'</div>'+
   '<div><h5>'+title(w.title||w.objectId)+'</h5><p>'+title(w.maker)+' · '+title(w.medium)+'</p>'+
   '<small>'+((w.painting&&w.privacyReady)?copy('Категория и приватность допустимы','Category and privacy ready'):
     copy('Нужна доработка','Review required'))+'</small></div></article>').join('')+'</div>'+
  '<p class="review-external-warning">'+copy('Ссылки на лицензии не проверяются автоматически. Отметка проверяющего не является юридическим заключением.','Licence references are not verified automatically. Reviewer attestation is not a legal opinion.')+'</p>'+
  '<form id="collectionReviewDecisionForm" data-collection="'+esc(d.collectionId)+'" data-stage="'+esc(stage)+'" data-review-token="'+esc(d.reviewToken||'')+'">'+
  '<label>'+copy('Решение','Decision')+'<select name="action">'+decisionOptions(stage)+'</select></label>'+
  '<label>'+copy('Обоснование (от 12 символов)','Reason (at least 12 characters)')+
  '<textarea name="note" minlength="12" maxlength="1200" required rows="3"></textarea></label>'+
  (stage==='RIGHTS'?evidenceFields(works):'')+
  (!valid&&stage!=='POST_PUBLICATION'?'<p role="alert">'+copy('Произведение или настройки приватности не прошли проверку.','A work or privacy setting failed review.')+'</p>':'')+
  '<button type="submit" class="primary-button">'+copy('Зафиксировать решение','Record decision')+'</button>'+
  '</form></section>';
}
export function publicationHistoryMarkup(data){
 const events=Array.isArray(data?.events)?data.events:[];
 return '<div class="publication-history"><h5>'+copy('История решений','Decision history')+'</h5>'+
  '<strong>'+esc(data?.publicationState||'DRAFT')+'</strong>'+
  (events.length?'<ol>'+events.map(e=>'<li><span>'+esc(e.action)+'</span>'+
  '<small>#'+esc(e.sequenceNo)+' · '+esc(e.at||'')+'</small>'+
  (e.note?'<p>'+esc(e.note)+'</p>':'')+'</li>').join('')+'</ol>':
  '<p>'+copy('Решений пока нет','No decisions yet')+'</p>')+'</div>';
}
const pendingMessage=error=>error?.data?.code==='STALE_REVIEW'||error?.data?.code==='REVIEW_TOKEN_REQUIRED'?
 copy('Досье изменилось или устарело. Откройте актуальную версию и повторите проверку.','The dossier changed or expired. Open the current version and review it again.'):
 error?.status===503?
 copy('Приёмка недоступна: необходима выделенная PostgreSQL Antiqua. В preview публикация закрыта.','Review unavailable: dedicated Antiqua PostgreSQL is required. Preview approval is disabled.'):
 (error?.status===401||error?.status===403||error?.status===404?
 copy('Нет доступа к этому действию или заявке.','This case or action is not accessible.'):error?.message||copy('Ошибка операции','Operation failed'));
export async function loadReviewQueue(out=document.querySelector('[data-review-output]')){
 const token=startRead(out);if(!token)return;
 try{const data=await api('/api/collection-publication/queue');putResult(token,reviewQueueMarkup(data))}
 catch(error){putResult(token,'<p class="review-error" role="alert">'+esc(pendingMessage(error))+'</p>')}
}
function toggleRights(form){
 if(!form)return;
 const choice=form?.elements?.namedItem('action')?.value,yes=choice==='publish';
 const block=form.querySelector('[data-review-rights-fields]');
 if(!block)return;
 block.hidden=!yes;
 block.querySelectorAll('input[name^="evidenceRef_"],input[name="rightsAttested"]').forEach(input=>{input.required=yes});
}
document.addEventListener('change',e=>{
 const form=e.target.closest?.('#collectionReviewDecisionForm');
 if(form&&e.target.name==='action')toggleRights(form);
});
document.addEventListener('click',async e=>{
 const button=e.target.closest?.('[data-collection-submit],[data-collection-history],[data-review-open],[data-review-queue-load]');
 if(!button||button.disabled)return;
 const out=document.querySelector('[data-review-output]');
 const host=button.closest('.collection-studio-card');
 let token;
 button.disabled=true;
 try{
  if('reviewQueueLoad' in button.dataset)return await loadReviewQueue(out);
  if(button.dataset.reviewOpen){
   const id=encodeURIComponent(button.dataset.reviewOpen);
   token=startRead(out);if(!token)return;
   const dossier=await api('/api/collections/'+id+'/publication/review');
   putResult(token,reviewDossierMarkup(dossier));
   if(currentRead(token))toggleRights(out.querySelector('#collectionReviewDecisionForm'));
   return;
  }
  if(button.dataset.collectionHistory){
   const id=encodeURIComponent(button.dataset.collectionHistory);
   const history=await api('/api/collections/'+id+'/publication');
   if(!host?.isConnected)return;
   let slot=host?.querySelector('[data-collection-history-output]');
   if(!slot&&host){slot=document.createElement('div');slot.dataset.collectionHistoryOutput='';host.append(slot)}
   if(slot)slot.innerHTML=publicationHistoryMarkup(history);
   return;
  }
  if(button.dataset.collectionSubmit){
   const id=encodeURIComponent(button.dataset.collectionSubmit);
   const path='/api/collections/'+id+'/publication/submit';
   await api(path,{method:'POST',body:JSON.stringify(retryPayload(button,path,{}))});
   attempts.delete(button);
   if(!button.isConnected)return;
   toast(copy('Коллекция отправлена на проверку','Collection submitted for review'));
   window.dispatchEvent(new Event('antiqua:operations-refresh'));
   return;
  }
 }catch(error){if(button.isConnected)toast(pendingMessage(error));
  if('reviewOpen' in button.dataset)putResult(token,'<p role="alert">'+esc(pendingMessage(error))+'</p>');
 }finally{button.disabled=false}
});
document.addEventListener('submit',async e=>{
 const form=e.target;
 if(form.id!=='collectionReviewDecisionForm')return;
 e.preventDefault();
 const button=form.querySelector('button[type="submit"]');
 if(button?.disabled)return;
 const fd=new FormData(form),action=String(fd.get('action')||'');
 if(!actions.has(action))return toast(copy('Неизвестное решение','Unknown decision'));
 const note=String(fd.get('note')||'').trim();
 const payload={note,reviewToken:form.dataset.reviewToken||''};
 if(action==='publish'){
  const rights=fd.get('rightsAttested')==='on';
  const evidence=[...form.querySelectorAll('input[name^="objectId_"]')].map((field,i)=>({
   objectId:field.value,evidenceRef:String(fd.get('evidenceRef_'+i)||'').trim(),
   rightsBasis:String(fd.get('rightsBasis_'+i)||'')
  }));
  if(!rights||evidence.some(x=>x.evidenceRef.length<10)){
   return toast(copy('Проверьте права и заполните документы для каждой картины.','Verify rights and reference a document for every work.'));
  }
  payload.rightsAttested=true;payload.evidenceRefs=evidence;
 }
 const out=form.closest('[data-review-output]');
 const path='/api/collections/'+encodeURIComponent(form.dataset.collection)+'/publication/'+action;
 if(button)button.disabled=true;
 try{
  await api(path,{method:'POST',body:JSON.stringify(retryPayload(form,path,payload))});
  attempts.delete(form);
  if(!form.isConnected)return;
  toast(copy('Решение сохранено','Decision recorded'));
  await loadReviewQueue(out);
 }catch(error){if(form.isConnected)toast(pendingMessage(error))}
 finally{if(button)button.disabled=false}
});
