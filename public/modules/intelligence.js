import {safe,copy,esc,local,moneyMinor} from './core.js';

let collectorLoading=false,professionalLoading=false,scholarlySeq=0;
const q=(s,r=document)=>r?.querySelector?.(s)||null;

const labelDimension=d=>({maker:copy('Художники / атрибуции','Artists / attributions'),department:copy('Направления','Departments'),period:copy('Периоды','Periods'),origin:copy('География','Origins')})[d]||d;
const stageLabel=s=>({NO_SIGNAL:copy('Нет сигнала','No signal'),DISCOVERED:copy('Просмотр','Discovered'),ENGAGED:copy('Интерес','Engaged'),INQUIRY:copy('Запрос','Inquiry'),VIEWING:copy('Просмотр работы','Viewing'),NEGOTIATING:copy('Переговоры','Negotiating'),TRANSACTING:copy('Сделка','Transacting')})[s]||String(s||'');

function collectorMarkup(d){
 const x=d.intelligence||{},directions=x.directions||[],recs=(x.recommendations||[]).slice(0,6),m=x.collector?.maturity||{},cs=x.collectionStrategy||{};
 return `<section id="collectorIntelligenceV44" class="account-block intelligence-v44 collector-intelligence-v44">
  <div class="block-head"><div><div class="eyebrow">COLLECTOR INTELLIGENCE · v0.44</div><h2>${copy('Карта коллекционного интереса','Collecting intelligence')}</h2><p>${copy('Объяснимая карта направления вашего интереса. Она строится из ваших действий, а не из скрытого профилирования; цена не используется для подбора.','An explainable map of your collecting direction. It is built from your actions rather than hidden profiling; price is not used for matching.')}</p></div><span class="intelligence-maturity">${esc(m.state||'COLD_START')} · ${Number(m.signalCount||0)} signals</span></div>
  <div class="intelligence-affinity-grid">${directions.length?directions.map(a=>`<article><span>${esc(labelDimension(a.dimension))}</span><strong>${esc(local(a.label))}</strong><b>+${Number(a.affinityPoints||0)}</b><small>${esc((a.evidence||[]).map(e=>e.type+' '+(e.points>0?'+':'')+e.points).join(' · '))}</small></article>`).join(''):`<div class="empty-state">${copy('Карта ещё формируется: открывайте работы, сохраняйте, следите за художниками и собирайте коллекции.','Your map is still forming: explore works, save, follow artists and build collections.')}</div>`}</div>
  <div class="intelligence-subhead"><div><span>COLLECTION STRATEGY</span><h3>${copy('Как устроено ваше собрание сегодня','How your collection is structured today')}</h3></div><small>${copy('Описание ≠ совет купить/продать','Description ≠ buy/sell advice')}</small></div>
  <div class="intelligence-strategy-grid"><article><strong>${Number(cs.uniqueArtworks||0)}</strong><span>${copy('уникальных работ','unique works')}</span></article><article><strong>${Number(cs.collections||0)}</strong><span>${copy('коллекций','collections')}</span></article><article><strong>${cs.concentration?.topArtistShare==null?'—':Math.round(cs.concentration.topArtistShare*100)+'%'}</strong><span>${copy('доля ведущего автора','top artist share')}</span></article><article><strong>${esc(cs.concentration?.dominantArtist||'—')}</strong><span>${copy('ведущий автор','dominant artist')}</span></article></div>
  <div class="intelligence-dimension-rail">${Object.entries(cs.dimensions||{}).map(([k,rows])=>`<div><span>${esc(labelDimension(k==='artists'?'maker':k==='departments'?'department':k==='periods'?'period':'origin'))}</span><p>${(rows||[]).slice(0,4).map(y=>esc(y.key)+' · '+Number(y.count||0)).join('<br>')||'—'}</p></div>`).join('')}</div>
  <div class="intelligence-subhead"><div><span>EXPLAINABLE DISCOVERY</span><h3>${copy('Почему эти работы могут быть вам интересны','Why these works may matter to you')}</h3></div><small>${copy('Affinity ≠ вероятность покупки','Affinity ≠ purchase probability')}</small></div>
  <div class="intelligence-art-grid">${recs.map(r=>`<button type="button" data-passport="${esc(r.object.id)}"><img src="${esc(r.object.image||'')}" alt=""><span>${esc(local(r.object.title))}</span><small>${r.coldStart?copy('Исследовать новое направление','Explore a new direction'):(r.reasons||[]).slice(0,2).map(y=>esc(local(y.value))).join(' · ')}</small></button>`).join('')}</div>
  <p class="intelligence-boundary">${copy('ANTIQUA не передаёт персональную карту вкуса продавцу и не трактует пассивный интерес как намерение купить.','ANTIQUA does not expose your personal taste map to sellers and does not treat passive interest as purchase intent.')}</p>
 </section>`
}

function professionalMarkup(d){
 const x=d.intelligence||{},s=x.summary||{},artists=(x.artists||[]).slice(0,8),objects=(x.topObjects||[]).slice(0,8),p=x.portfolio||{};
 const k=(v,l)=>`<div><strong>${v==null?'—':esc(v)}</strong><span>${esc(l)}</span></div>`;
 return `<section id="professionalIntelligenceV44" class="account-block intelligence-v44 professional-intelligence-v44">
  <div class="block-head"><div><div class="eyebrow">PROFESSIONAL INTELLIGENCE · v0.44</div><h2>${copy('Какие работы и художники создают качественный спрос','Which artworks and artists generate qualified demand')}</h2><p>${copy('Не скрытый lead score, а наблюдаемая цепочка: просмотр → save/editorial → inquiry → viewing → negotiation → transaction.','Not a hidden lead score, but an observed path: view → save/editorial → inquiry → viewing → negotiation → transaction.')}</p></div></div>
  <div class="intelligence-kpis">${k(s.artworksWithSignal,copy('работ с сигналом','works with signal'))}${k(s.explicitCommercialIntent,copy('commercial intent','commercial intent'))}${k(s.viewingOrHigher,copy('viewing+','viewing+'))}${k(s.activeLeads,copy('активных лидов','active leads'))}${k(s.medianResponseMinutes==null?'—':s.medianResponseMinutes+' min',copy('медиана ответа','median response'))}</div>
  <div class="intelligence-subhead"><div><span>PORTFOLIO INTELLIGENCE</span><h3>${copy('Структура спроса и операционные узкие места','Demand structure and operational bottlenecks')}</h3></div><small>${copy('Без demand forecast и скрытого score','No demand forecast or hidden score')}</small></div>
  <div class="intelligence-strategy-grid"><article><strong>${Number(p.artistCoverage||0)}</strong><span>${copy('художников с сигналом','artists with signal')}</span></article><article><strong>${Number(p.artworkCoverage||0)}</strong><span>${copy('работ в проекции','works in projection')}</span></article><article><strong>${p.topArtistShare==null?'—':Math.round(p.topArtistShare*100)+'%'}</strong><span>${copy('доля ведущего автора','top artist share')}</span></article><article><strong>${Number(p.responseBottleneck?.overdue||0)}</strong><span>${copy('просроченных ответов','overdue responses')}</span></article></div>
  <div class="intelligence-stage-rail">${Object.entries(p.stageDistribution||{}).map(([stage,count])=>`<div><span>${esc(stageLabel(stage))}</span><strong>${Number(count||0)}</strong></div>`).join('')}</div>
  <div class="intelligence-two-col">
   <div><div class="intelligence-subhead"><div><span>ARTIST PERFORMANCE</span><h3>${copy('Художники по глубине наблюдаемого интереса','Artists by observed demand depth')}</h3></div></div><div class="intelligence-list">${artists.map(a=>`<article><div><strong>${esc(local(a.creator.displayName))}</strong><small>${a.works} ${copy('работ','works')} · ${a.passiveViews} views · ${a.saves} saves</small></div><span>${esc(stageLabel(a.highestStage))}</span></article>`).join('')||`<div class="empty-state">${copy('Пока недостаточно данных','Not enough data yet')}</div>`}</div></div>
   <div><div class="intelligence-subhead"><div><span>ARTWORK PERFORMANCE</span><h3>${copy('Работы, где интерес движется глубже','Works where interest moves deeper')}</h3></div></div><div class="intelligence-list">${objects.map(o=>`<article><button type="button" data-passport="${esc(o.objectId)}"><strong>${esc(local(o.title)||o.objectCode)}</strong></button><small>${o.passive.views} views · ${o.passive.saved} saves · ${o.commercial.offers} offers</small><span>${esc(stageLabel(o.stage))}</span></article>`).join('')||`<div class="empty-state">${copy('Пока недостаточно данных','Not enough data yet')}</div>`}</div></div>
  </div>
  <p class="intelligence-boundary">${copy('Пассивные просмотры не раскрывают личность. Предшествующий editorial/event exposure — evidence, но не доказательство причинности продажи.','Passive views do not expose identity. Prior editorial/event exposure is evidence, not proof that it caused a sale.')}</p>
 </section>`
}

function scholarlyMarkup(d){
 const x=d.intelligence||{},r=x.researchCoverage||{},m=x.market||{},a=x.attribution||{},questions=x.openResearchQuestions||[],ec=x.evidenceCoverage||{};
 const coverage=[
  [copy('Провенанс','Provenance'),r.provenance?.provenanceEvents||0],
  [copy('Литература','Bibliography'),r.bibliography?.count||0],
  [copy('Выставки','Exhibitions'),r.exhibitionHistory?.count||0],
  [copy('Версии досье','Dossier revisions'),r.passportRevisions?.count||0],
  [copy('Market comparables','Market comparables'),m.comparables||0]
 ];
 return `<section id="scholarlyIntelligenceV44" class="dossier-intelligence-v44">
  <div class="v44-scholar-head"><div><div class="eyebrow">MARKET & SCHOLARLY INTELLIGENCE · v0.44</div><h3>${copy('Что известно, что связано и что ещё требует исследования','What is known, connected and still unresolved')}</h3><p>${copy('Один слой объединяет research coverage, attribution links, revisions и рыночные аналоги — без оценки подлинности и без автоматической оценки стоимости.','One layer combines research coverage, attribution links, revisions and market comparables — without an authenticity score or automated valuation.')}</p></div><span>${a.linkedCreatorCount||0} ${copy('связанных профиля художника','linked artist profiles')}</span></div>
  <div class="v44-coverage">${coverage.map(([label,value])=>`<div><strong>${value}</strong><span>${esc(label)}</span></div>`).join('')}</div>
  <div class="v44-evidence-map">${Object.entries(ec).map(([key,row])=>`<div data-evidence-state="${esc(row.state)}"><span>${esc(key.replaceAll(/([A-Z])/g,' $1'))}</span><strong>${esc(row.state)}</strong><small>${Number(row.count||0)} refs</small></div>`).join('')}</div>
  <div class="v44-scholar-grid">
   <article><span>ATTRIBUTION</span><h4>${esc(local(x.artwork?.artistAttribution)||'—')}</h4><p>${(a.linkedCreators||[]).map(y=>esc(local(y.creator.displayName))+' · '+esc(y.attributionStatus)).join('<br>')||copy('Проверенный профиль художника пока не связан.','No reviewed artist profile linked yet.')}</p><small>NO_AUTHENTICITY_VERDICT</small></article>
   <article><span>OPEN RESEARCH</span><h4>${questions.length}</h4><p>${questions.length?questions.map(y=>esc(y.replaceAll('_',' '))).join('<br>'):copy('Ключевые gaps в текущей проекции не обнаружены.','No key gaps detected in the current projection.')}</p></article>
   <article><span>MARKET CONTEXT</span><h4>${m.comparables||0} ${copy('аналогов','comparables')}</h4><p>${Object.entries(m.realizedByCurrency||{}).map(([ccy,v])=>esc(ccy)+' · '+v.count+' sold · median '+esc(moneyMinor(v.medianMinor,ccy))).join('<br>')||copy('Подтверждённых реализованных аналогов в данных ANTIQUA пока нет.','No confirmed realized comparables in ANTIQUA data yet.')}</p><small>COMPARABLES ≠ APPRAISAL</small></article>
  </div>
 </section>`
}

async function mountCollector(){
 if(q('#collectorIntelligenceV44')||collectorLoading)return;
 const host=q('.account-v12 .account-layout > div');if(!host)return;
 collectorLoading=true;try{const d=await safe('/api/intelligence/collector?limit=8');if(!d?.intelligence||!host.isConnected)return;const box=document.createElement('div');box.innerHTML=collectorMarkup(d);host.prepend(box.firstElementChild)}catch{}finally{collectorLoading=false}
}
async function mountProfessional(){
 if(q('#professionalIntelligenceV44')||professionalLoading)return;
 const host=q('[data-v14-panel="dealer"]');if(!host)return;
 professionalLoading=true;try{const d=await safe('/api/intelligence/professional?limit=12');if(!d?.intelligence||!host.isConnected)return;const box=document.createElement('div');box.innerHTML=professionalMarkup(d);host.append(box.firstElementChild)}catch{}finally{professionalLoading=false}
}
async function mountScholarly(id){
 const request=++scholarlySeq;q('#scholarlyIntelligenceV44')?.remove();
 const d=await safe('/api/lots/'+encodeURIComponent(id)+'/intelligence?limit=6');if(request!==scholarlySeq||!d?.intelligence)return;
 const body=q('#dialog[open] .dossier-body');if(!body)return;const box=document.createElement('div');box.innerHTML=scholarlyMarkup(d);
 const market=q('#dossierMarketIntelligenceV25',body),similar=q('#dossierSimilarV18',body),disclaimer=q('.dossier-disclaimer',body);
 if(market)market.before(box.firstElementChild);else if(similar)similar.before(box.firstElementChild);else if(disclaimer)disclaimer.before(box.firstElementChild);else body.append(box.firstElementChild)
}

window.addEventListener('antiqua:passport',e=>{const id=String(e.detail?.id||'');if(id)mountScholarly(id).catch(console.error)});
const observer=new MutationObserver(()=>{mountCollector();mountProfessional()});observer.observe(q('#app'),{childList:true,subtree:true});
window.addEventListener('hashchange',()=>setTimeout(()=>{mountCollector();mountProfessional()},40));
setTimeout(()=>{mountCollector();mountProfessional()},80);
