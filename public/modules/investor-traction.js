import {safe,copy,esc} from './core.js';

const badge=(state)=>`<span class="traction-badge traction-${String(state).toLowerCase().replaceAll(' ','-')}">${esc(state)}</span>`;
const fmt=v=>v==null?'—':String(v);
const moneyMap=m=>Object.keys(m||{}).length?Object.entries(m).map(([c,v])=>new Intl.NumberFormat(undefined,{style:'currency',currency:c,maximumFractionDigits:2}).format(Number(v||0)/100)).join(' · '):'—';
const metric=(label,value,state,detail)=>`<article class="traction-metric"><div>${badge(state)}<span>${esc(label)}</span></div><strong>${esc(fmt(value))}</strong><small>${esc(detail||'')}</small></article>`;

function structuralMetrics(health,commercial){
 const dbReady=Boolean(health?.persistence?.persistent),hasCommercial=commercial?.persistence==='POSTGRES';
 return[
  {label:copy('Production readiness','Production readiness'),value:dbReady?'POSTGRES':'MEMORY_FALLBACK',state:dbReady?'PRODUCT CAPABILITY':'MISSING',detail:copy('Фактический persistence status текущего runtime.','Actual persistence state of the current runtime.')},
  {label:copy('Активные реальные пилоты','Active real pilots'),value:hasCommercial?commercial.activePilots:null,state:hasCommercial?'PILOT TELEMETRY':'MISSING',detail:copy('Считаются только записи Pilot Authority.','Counted only from Pilot Authority records.')},
  {label:copy('Платные пилоты','Paid pilots'),value:hasCommercial?commercial.paidPilots:null,state:commercial?.paidPilots>0?'VERIFIED CASH':hasCommercial?'PILOT TELEMETRY':'MISSING',detail:copy('Пилот становится paid только при PAYMENT_RECEIVED.','A pilot becomes paid only with PAYMENT_RECEIVED.')},
  {label:copy('Полученные деньги','Cash received'),value:hasCommercial?moneyMap(commercial.cashReceivedMinorByCurrency):null,state:commercial?.paidPilots>0?'VERIFIED CASH':hasCommercial?'PILOT TELEMETRY':'MISSING',detail:copy('Quote, LOI и invoice сюда не входят.','Quote, LOI and invoice are excluded.')},
  {label:copy('D30 retained paid partners','D30 retained paid partners'),value:null,state:'MISSING',detail:copy('Появится после первого когорного окна.','Available only after the first eligible cohort window.')},
  {label:copy('Eligible completed GMV','Eligible completed GMV'),value:null,state:'MISSING',detail:copy('Только завершённые сделки eligible works.','Completed transactions on eligible works only.')},
  {label:copy('Recurring revenue share','Recurring revenue share'),value:null,state:'MISSING',detail:copy('Нужна фактическая revenue mix.','Requires actual revenue mix.')},
  {label:copy('Gross contribution','Gross contribution'),value:hasCommercial?moneyMap(commercial.grossContributionMinorByCurrency):null,state:commercial?.paidPilots>0?'VERIFIED CASH':hasCommercial?'PILOT TELEMETRY':'MISSING',detail:copy('Cash − refunds − direct onboarding/support/provider cost.','Cash − refunds − direct onboarding/support/provider cost.')}
 ];
}

const stages=[
 ['Qualified partner','MISSING'],['Proposal','MISSING'],['Accepted scope','MISSING'],['Paid pilot','MISSING'],['Completed pilot','MISSING'],['Renewed / expanded','MISSING']
];

const evidenceRows=[
 {stream:'Professional SaaS',status:'ASSUMPTION',proof:copy('Pricing structure defined; paid willingness-to-pay not yet proven.','Pricing structure defined; paid willingness-to-pay not yet proven.')},
 {stream:'Partner Editions',status:'ASSUMPTION',proof:copy('Package and measurement are defined; real paid edition still required.','Package and measurement are defined; real paid edition still required.')},
 {stream:'Transaction revenue',status:'PRODUCT CAPABILITY',proof:copy('Offer/auction workflows exist; real payment/settlement economics remain gated.','Offer/auction workflows exist; real payment/settlement economics remain gated.')},
 {stream:'Cultural partnerships',status:'ASSUMPTION',proof:copy('Activation model defined; fee and renewal evidence missing.','Activation model defined; fee and renewal evidence missing.')},
 {stream:'Institutional Research',status:'ASSUMPTION',proof:copy('Strategic backlog only until a real institutional design partner exists.','Strategic backlog only until a real institutional design partner exists.')}
];

export async function investorTractionView(){
 const [health,pilotCaps,partnerCaps,creatorCaps,commercialCaps,commercialAggregate,unitCaps,unitData]=await Promise.all([
  safe('/api/health'),
  safe('/api/pilot/commercial-proof/capabilities'),
  safe('/api/partner/pilot-analytics/capabilities'),
  safe('/api/creators/capabilities'),
  safe('/api/commercial-evidence/capabilities'),
  safe('/api/operator/investor-commercial-aggregate'),
  safe('/api/unit-economics/capabilities'),
  safe('/api/operator/unit-economics')
 ]);
 const commercial=commercialAggregate?.commercial||null,unit=unitData?.unitEconomics?.economics||null,metrics=structuralMetrics(health||{},commercial);
 const capabilityCount=[pilotCaps?.capabilities,partnerCaps?.capabilities,creatorCaps?.capabilities,commercialCaps?.capabilities,unitCaps?.capabilities].filter(Boolean).length;
 return `<main class="traction-page page section">
 <section class="traction-hero">
  <div><div class="eyebrow">INVESTOR TRACTION CONTROL</div><h1>${copy('Только доказанные цифры','Only evidence-backed numbers')}</h1><p>${copy('Этот экран специально не заполняется “красивыми” прогнозами. Пока нет факта — стоит MISSING. Когда появятся real pilots, pricing, retention и cash, те же ячейки станут доказательной историей компании.','This surface deliberately avoids decorative forecasts. If a fact does not exist, it stays MISSING. Once real pilots, pricing, retention and cash exist, the same cells become the company evidence trail.')}</p></div>
  <aside><strong>${capabilityCount}</strong><span>${copy('проверяемых capability-контрактов подключено сейчас','verifiable capability contracts connected now')}</span></aside>
 </section>

 <section class="traction-block"><div class="section-head"><div><div class="eyebrow">EXECUTIVE STRIP</div><h2>${copy('Что инвестор может считать фактом сегодня','What an investor can treat as fact today')}</h2></div></div><div class="traction-metric-grid">${metrics.map(x=>metric(x.label,x.value,x.state,x.detail)).join('')}</div></section>

 <section class="traction-block"><div class="section-head"><div><div class="eyebrow">PARTNER FUNNEL</div><h2>${copy('Коммерческая воронка без подмены pipeline выручкой','Commercial funnel without treating pipeline as revenue')}</h2></div></div><div class="traction-funnel">${stages.map(([name,state],i)=>`<div><b>${String(i+1).padStart(2,'0')}</b><strong>${esc(name)}</strong>${badge(state)}<small>—</small></div>`).join('')}</div></section>

 <section class="traction-block"><div class="section-head"><div><div class="eyebrow">COMMERCIAL EVIDENCE AUTHORITY · v0.46</div><h2>${copy('Что считается деньгами — и что ими не является','What counts as money — and what does not')}</h2><p>${copy('Quote → written acceptance → invoice → cash → direct cost → renewal фиксируются отдельными подписанными событиями. Только payment формирует cash.','Quote → written acceptance → invoice → cash → direct cost → renewal are separate signed events. Only payment creates cash.')}</p></div></div><div class="traction-evidence-table"><div class="head"><span>Event</span><span>${copy('Экономический статус','Economic status')}</span><span>${copy('Правило','Rule')}</span></div><div><strong>QUOTE / LOI</strong><span>${badge('NOT REVENUE')}</span><p>${copy('Коммерческая гипотеза или намерение.','Commercial hypothesis or intent.')}</p></div><div><strong>INVOICE</strong><span>${badge('NOT CASH')}</span><p>${copy('Создаёт требование к оплате, но не cash.','Creates a receivable, not cash.')}</p></div><div><strong>PAYMENT_RECEIVED</strong><span>${badge('VERIFIED CASH')}</span><p>${copy('Единственное событие, увеличивающее подтверждённый cash.','The only event that increases verified cash.')}</p></div><div><strong>REFUND / DIRECT COST</strong><span>${badge('ECONOMIC ADJUSTMENT')}</span><p>${copy('Уменьшают gross contribution.','Reduce gross contribution.')}</p></div><div><strong>RENEWAL / EXPANSION</strong><span>${badge('RETENTION EVIDENCE')}</span><p>${copy('Повышает pricing confidence и подтверждает повторяемость.','Raises pricing confidence and supports repeatability.')}</p></div></div></section>

 <section class="traction-block"><div class="section-head"><div><div class="eyebrow">PRICING EVIDENCE</div><h2>${copy('Каждый revenue stream имеет собственный уровень доказательства','Every revenue stream has its own evidence level')}</h2></div></div><div class="traction-evidence-table"><div class="head"><span>${copy('Поток','Stream')}</span><span>${copy('Статус','Status')}</span><span>${copy('Что доказано','Evidence')}</span></div>${evidenceRows.map(x=>`<div><strong>${esc(x.stream)}</strong><span>${badge(x.status)}</span><p>${esc(x.proof)}</p></div>`).join('')}</div></section>


 <section class="traction-block"><div class="section-head"><div><div class="eyebrow">UNIT ECONOMICS AUTHORITY · v0.47</div><h2>\${copy('Наблюдаемая экономика отдельно от заблокированных KPI','Observed economics separated from locked KPIs')}</h2><p>\${copy('ANTIQUA показывает только те показатели, для которых уже существует первичный источник. Остальные не заполняются нулями — они остаются LOCKED с причиной.','ANTIQUA shows only metrics backed by a source authority. Everything else is not filled with zeros — it remains LOCKED with an explicit reason.')}</p></div></div>
 <div class="traction-metric-grid">
  \${metric(copy('Direct contribution ratio','Direct contribution ratio'),unit?Object.entries(unit.directContributionRatioByCurrency||{}).map(([c,v])=>v==null?'—':c+' '+Math.round(v*100)+'%').join(' · ')||'—':'—',unit?.evidenceState==='OBSERVED'?'OBSERVED':'MISSING',copy('Gross contribution / verified cash. Это не gross margin.','Gross contribution / verified cash. This is not gross margin.'))}
  \${metric(copy('Recurring cash share','Recurring cash share'),unit?Object.entries(unit.recurringCashShareByCurrency||{}).map(([c,v])=>v==null?'—':c+' '+Math.round(v*100)+'%').join(' · ')||'—':'—',unit?.evidenceState==='OBSERVED'?'OBSERVED':'MISSING',copy('Доля классифицированного recurring cash. Это не ARR.','Share of classified recurring cash. This is not ARR.'))}
  \${metric(copy('Renewal / expansion evidence','Renewal / expansion evidence'),unit?.renewalOrExpansionEvidencePilots??null,unit?.evidenceState==='OBSERVED'?'OBSERVED':'MISSING',copy('Число пилотов с подтверждённым renewal/expansion; не retention rate без denominator.','Pilots with verified renewal/expansion; not a retention rate without a denominator.'))}
  \${metric(copy('Payment classification coverage','Payment classification coverage'),unit?.classificationCoverage?.payments?.ratio==null?'—':Math.round(unit.classificationCoverage.payments.ratio*100)+'%',unit?.classificationCoverage?.payments?.ratio===1?'OBSERVED':'MISSING',copy('Нужно 100%, прежде чем доверять revenue-mix метрикам.','Must reach 100% before revenue-mix metrics are decision-grade.'))}
 </div>
 <div class="traction-evidence-table"><div class="head"><span>KPI</span><span>Status</span><span>\${copy('Почему закрыт','Why locked')}</span></div>\${Object.entries(unit?.locks||{ARR:{state:'LOCKED',reason:'Source authority missing.'},CAC:{state:'LOCKED',reason:'Source authority missing.'},CAC_PAYBACK:{state:'LOCKED',reason:'Source authority missing.'},GROSS_MARGIN:{state:'LOCKED',reason:'Source authority missing.'}}).slice(0,9).map(([k,v])=>\`<div><strong>\${esc(k.replaceAll('_',' '))}</strong><span>\${badge(v.state||'LOCKED')}</span><p>\${esc(v.reason||'')}</p></div>\`).join('')}</div>
 </section>

 <section class="traction-block traction-gates"><div class="section-head"><div><div class="eyebrow">SCALE GATES</div><h2>${copy('Когда можно переходить к следующему уровню','When the company can move to the next level')}</h2></div></div><div class="traction-gate-grid">
  <article><b>A</b><h3>Working product</h3><p>${copy('Consumer + professional golden paths проходят CI/E2E и production persistence.','Consumer + professional golden paths pass CI/E2E and production persistence.')}</p></article>
  <article><b>B</b><h3>Paid validation</h3><p>${copy('Хотя бы один внешний контрагент реально платит за ограниченный pilot scope.','At least one external counterparty actually pays for a bounded pilot scope.')}</p></article>
  <article><b>C</b><h3>Repeatability</h3><p>${copy('Несколько независимых партнёров принимают сравнимую экономику.','Multiple independent partners accept comparable economics.')}</p></article>
  <article><b>D</b><h3>Retention</h3><p>${copy('Есть renewal / expansion, а не только первая продажа.','Renewal / expansion exists, not just first-sale evidence.')}</p></article>
  <article><b>E</b><h3>Unit economics</h3><p>${copy('Измерены CAC, cost-to-serve, gross contribution и payback.','CAC, cost to serve, gross contribution and payback are measurable.')}</p></article>
  <article><b>F</b><h3>Scale</h3><p>${copy('Рост supply, partners и пользователей не требует линейного роста затрат.','Supply, partners and users can grow without linear cost growth.')}</p></article>
 </div></section>

 <section class="traction-block traction-next"><div><div class="eyebrow">CURRENT NEXT PROOF</div><h2>${copy('Что должно измениться первым','What must change first')}</h2><p>${copy('Первый настоящий коммерческий переход — не ARR. Это: real counterparty → accepted scope → paid pilot → evidence period → renewal decision. После этого pricing dashboard начинает содержать факты.','The first real commercial transition is not ARR. It is: real counterparty → accepted scope → paid pilot → evidence period → renewal decision. Only then does the pricing dashboard begin to contain facts.')}</p></div><a class="primary-button link-button" href="#partners/investor">${copy('Вернуться к investor case','Back to investor case')}</a></section>
 </main>`
}
