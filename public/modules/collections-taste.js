import {api,safe,copy,esc,local,sheet,toast} from './core.js';

const q=s=>document.querySelector(s);
const artById=(catalog,id)=>(catalog?.lots||[]).find(x=>String(x.id)===String(id))||null;
const coverFor=c=>c?.items?.find(x=>x.objectId===c.coverObjectId)?.object||c?.items?.find(x=>x.object)?.object||null;
const visibility=v=>({PRIVATE:copy('Личная','Private'),UNLISTED:copy('По ссылке','Unlisted'),PUBLIC:copy('Публичная','Public')})[v]||String(v||'');
const dimensionLabel=d=>({maker:copy('Автор / атрибуция','Artist / attribution'),department:copy('Направление','Category'),period:copy('Период','Period'),origin:copy('Происхождение','Origin')})[d]||d;
const signalLabel=s=>({SAVED:copy('сохранения','saved works'),COLLECTED:copy('коллекции','collections'),FOLLOW_MAKER:copy('подписка на автора','artist follow'),FOLLOW_CATEGORY:copy('подписка на направление','category follow'),OFFER:copy('предложения цены','offers'),VIEWING:copy('просмотры','viewings'),PURCHASE:copy('приобретения','acquisitions'),ENGAGED_VIEW:copy('внимательное изучение','engaged viewing')})[s]||'';

function reasonsHtml(x){
 if(x.coldStart)return `<div class="taste-reasons"><span>${copy('Новое направление для исследования','A new area to explore')}</span></div>`;
 const rows=(x.reasons||[]).slice(0,3).map(r=>{
  const signals=(r.signals||[]).map(s=>signalLabel(s.type)).filter(Boolean).slice(0,2);
  return `<span><b>${esc(dimensionLabel(r.dimension))}</b> · ${esc(local(r.value))}${signals.length?`<small>${esc(signals.join(' · '))}</small>`:''}</span>`
 }).join('');
 return `<div class="taste-reasons">${rows||`<span>${copy('Связано с вашей картой вкуса','Related to your taste map')}</span>`}</div>`
}

function artworkCard(o,{recommendation=null,saved=false}={}){
 if(!o)return'';
 return `<article class="taste-art-card" data-direct-card data-open-passport="${esc(o.id)}" tabindex="0" role="button">
  <div class="taste-art-media">${o.image?`<img loading="lazy" decoding="async" src="${esc(o.image)}" alt="${esc(local(o.title))}">`:''}
   ${saved?'<span class="taste-saved-badge">♡ '+copy('Сохранено','Saved')+'</span>':''}
   ${recommendation&&!recommendation.coldStart?`<button type="button" class="taste-dismiss" data-taste-dismiss="${esc(o.id)}">${copy('Не моё','Not for me')}</button>`:''}
  </div>
  <div class="taste-art-copy"><small>${esc(local(o.department))}</small><h3>${esc(local(o.title))}</h3><p>${esc(local(o.maker))}${local(o.period)?' · '+esc(local(o.period)):''}</p>${recommendation?reasonsHtml(recommendation):''}</div>
 </article>`
}

function collectionCard(c,{mine=false}={}){
 const cover=coverFor(c);
 return `<a class="taste-collection-card" href="#collection/${esc(c.id)}">
  <div class="taste-collection-cover">${cover?.image?`<img loading="lazy" decoding="async" src="${esc(cover.image)}" alt="">`:''}</div>
  <div class="taste-collection-copy"><div class="micro">${mine?copy('МОЯ КОЛЛЕКЦИЯ','MY COLLECTION'):'ANTIQUA COLLECTION'} · ${esc(visibility(c.visibility))}</div><h3>${esc(local(c.title)||c.id)}</h3><p>${esc(local(c.summary)||copy('Кураторская подборка произведений','Curated grouping of works'))}</p><strong>${c.items?.length||0} ${copy('работ','works')}</strong></div>
 </a>`
}

async function load(){
 const [me,catalog,publicData,mineData,client,taste]=await Promise.all([
  safe('/api/auth/me'),safe('/api/catalog'),safe('/api/collections'),safe('/api/collections/mine'),safe('/api/client-state'),safe('/api/taste/recommendations?limit=12')
 ]);
 return{account:me?.account||null,catalog:catalog||{lots:[]},publicCollections:publicData?.collections||[],myCollections:mineData?.collections||[],client:client||null,taste:taste||null}
}

export async function collectionsTasteView(){
 const d=await load(),savedIds=new Set(d.client?.savedLots||[]),saved=[...savedIds].map(id=>artById(d.catalog,id)).filter(Boolean);
 const recommendations=(d.taste?.recommendations||[]).filter(x=>x.object&&!savedIds.has(x.object.id));
 return `<section class="page section collections-taste-page">
  <div class="collections-taste-hero"><div><div class="eyebrow">ANTIQUA · COLLECTIONS & TASTE</div><h1>${copy('Коллекции и ваш вкус','Collections & your taste')}</h1><p>${copy('Сохраняйте работы, собирайте собственные подборки и открывайте новые произведения по понятным причинам — без непрозрачного AI-скоринга и без смешивания с приватным учётом владения.','Save works, build your own collections and discover new art for understandable reasons — without opaque AI scoring and without mixing in private ownership operations.')}</p></div>${d.account?`<button class="primary-button" type="button" data-consumer-collection-create>${copy('Создать коллекцию','Create collection')}</button>`:`<a class="primary-button" href="#account">${copy('Войти для персонализации','Sign in to personalize')}</a>`}</div>

  <section class="collections-taste-section" data-saved-section><div class="section-head"><div><div class="eyebrow">${copy('СОХРАНЁННЫЕ РАБОТЫ','SAVED WORKS')}</div><h2>${copy('То, к чему хочется вернуться','Works worth returning to')}</h2><p class="muted">${copy('Сохранение — лёгкий сигнал интереса. Оно не означает покупку и не делает работу частью публичной коллекции.','Saving is a lightweight interest signal. It does not imply purchase or publish the work in a collection.')}</p></div><span class="taste-count">${saved.length}</span></div>
   ${saved.length?`<div class="taste-art-grid taste-art-grid-saved">${saved.map(o=>artworkCard(o,{saved:true})).join('')}</div>`:`<div class="creator-empty"><strong>${copy('Пока ничего не сохранено','Nothing saved yet')}</strong><p>${copy('Откройте работу в Галерее и нажмите ♡ — она появится здесь.','Open a work in the Gallery and tap ♡ — it will appear here.')}</p><a class="secondary-button" href="#gallery">${copy('Открыть Галерею','Open Gallery')}</a></div>`}
  </section>

  ${d.account?`<section class="collections-taste-section" data-my-collections><div class="section-head"><div><div class="eyebrow">${copy('МОИ КОЛЛЕКЦИИ','MY COLLECTIONS')}</div><h2>${copy('Личные подборки','Personal groupings')}</h2><p class="muted">${copy('PRIVATE остаётся только у вас. PUBLIC публикуется только по явному выбору. Хранение, страховка и стоимость остаются в приватном Collection Records.','PRIVATE stays with you. PUBLIC is published only by explicit choice. Storage, insurance and appraisal remain in private Collection Records.')}</p></div></div>
   ${d.myCollections.length?`<div class="taste-collection-grid">${d.myCollections.map(c=>collectionCard(c,{mine:true})).join('')}</div>`:`<div class="creator-empty"><strong>${copy('Создайте первую коллекцию','Create your first collection')}</strong><p>${copy('Начните с PRIVATE-подборки и решайте отдельно, что когда-либо публиковать.','Start with a PRIVATE grouping and decide separately what, if anything, to publish.')}</p><button class="secondary-button" type="button" data-consumer-collection-create>${copy('Создать коллекцию','Create collection')}</button></div>`}
  </section>`:''}

  <section class="collections-taste-section personalized-discovery" data-personalized-discovery><div class="section-head"><div><div class="eyebrow">TASTE GRAPH · EXPLAINABLE</div><h2>${copy('Для вас','For you')}</h2><p class="muted">${copy('Рекомендации строятся из явных действий и коммерческих фактов. Цена не участвует в подборе; сохранённые и уже собранные работы не выдаются как «новые находки».','Recommendations use explicit actions and commercial facts. Price is not used for matching; saved and collected works are not presented as “new discoveries”.')}</p></div>${d.account?'<button class="quiet-button" type="button" data-taste-explain>'+copy('Почему это показывается','Why am I seeing this')+'</button>':''}</div>
   ${recommendations.length?`<div class="taste-art-grid">${recommendations.map(x=>artworkCard(x.object,{recommendation:x})).join('')}</div>`:`<div class="creator-empty"><strong>${copy('Карта вкуса формируется','Your taste map is taking shape')}</strong><p>${copy('Сохраняйте и изучайте работы — персональная подборка станет точнее, но останется объяснимой.','Save and explore works — personalization will improve while remaining explainable.')}</p></div>`}
   <p class="taste-privacy-note">${copy('Приватные заметки, место хранения, страховка и личность владельца здесь не показываются и не превращаются в публичный профиль вкуса.','Private notes, storage, insurance and owner identity are not shown here and do not become a public taste profile.')}</p>
  </section>

  ${d.publicCollections.length?`<section class="collections-taste-section"><div class="section-head"><div><div class="eyebrow">${copy('ПУБЛИЧНЫЕ КОЛЛЕКЦИИ','PUBLIC COLLECTIONS')}</div><h2>${copy('Подборки Antiqua и сообщества','Curated collections')}</h2></div></div><div class="taste-collection-grid">${d.publicCollections.map(c=>collectionCard(c)).join('')}</div></section>`:''}
 </section>`
}

function openCreateCollection(){
 const body=sheet(`<div class="action-sheet-head"><div><div class="micro">COLLECTION GRAPH</div><h2>${copy('Новая коллекция','New collection')}</h2><p>${copy('По умолчанию коллекция создаётся PRIVATE. Публикация — отдельное осознанное решение.','Collections start PRIVATE by default. Publishing is a separate explicit decision.')}</p></div><button class="action-sheet-close" data-close-sheet>×</button></div><form id="consumerCollectionCreateForm" class="v14-stack-form"><label>${copy('Название','Title')}<input name="title" required maxlength="160"></label><label>${copy('Видимость','Visibility')}<select name="visibility"><option value="PRIVATE">${copy('PRIVATE · только я','PRIVATE · only me')}</option><option value="UNLISTED">${copy('UNLISTED · по ссылке','UNLISTED · link only')}</option><option value="PUBLIC">${copy('PUBLIC · публично','PUBLIC · public')}</option></select></label><button class="primary-button">${copy('Создать коллекцию','Create collection')}</button></form>`);
 body?.querySelector('input')?.focus()
}

async function rerender(){
 if((location.hash.slice(1).split('/')[0]||'gallery')!=='collections')return;
 const app=q('#app');if(app)app.innerHTML=await collectionsTasteView()
}

document.addEventListener('click',e=>{const b=e.target.closest?.('[data-consumer-collection-create]');if(!b)return;e.preventDefault();openCreateCollection()});
document.addEventListener('submit',async e=>{
 const f=e.target;if(f.id!=='consumerCollectionCreateForm')return;e.preventDefault();const b=f.querySelector('button');if(b)b.disabled=true;
 try{const fd=new FormData(f);await api('/api/collections',{method:'POST',body:JSON.stringify({title:String(fd.get('title')||'').trim(),collectionType:'PERSONAL',visibility:String(fd.get('visibility')||'PRIVATE')})});q('#actionSheet')?.close();toast(copy('Коллекция создана','Collection created'));await rerender()}catch(err){if(b)b.disabled=false;toast(err.message)}
});
window.addEventListener('antiqua:culture-refresh',()=>rerender().catch(console.error));
