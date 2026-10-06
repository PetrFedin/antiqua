import {pilotLaunchBoard} from './pilot-launch.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=v=>v==null?'—':new Intl.NumberFormat(undefined,{style:'percent',maximumFractionDigits:1}).format(Number(v));
const num=v=>v==null?'—':new Intl.NumberFormat().format(Number(v));
const mins=v=>v==null?'—':num(v)+' min';
const moneyMap=m=>Object.keys(m||{}).length?Object.entries(m).map(([c,v])=>new Intl.NumberFormat(undefined,{style:'currency',currency:c,maximumFractionDigits:2}).format(Number(v||0)/100)).join(' · '):'—';
const copy=(lang,ru,en)=>lang==='ru'?ru:en;
const api=async path=>{const r=await fetch(path,{credentials:'same-origin'});let d={};try{d=await r.json()}catch{}if(!r.ok)throw new Error(d.error||'Request failed');return d};

function metric(label,value,detail=''){return `<article class="pilot-kpi"><span>${esc(label)}</span><strong>${esc(value)}</strong>${detail?`<small>${esc(detail)}</small>`:''}</article>`}
function delta(v,{inverse=false,percent=false}={}){if(v==null)return'<span class="pilot-delta neutral">—</span>';const good=inverse?Number(v)<0:Number(v)>0,bad=inverse?Number(v)>0:Number(v)<0,cls=good?'good':bad?'bad':'neutral',text=(Number(v)>0?'+':'')+(percent?pct(v):num(v));return`<span class="pilot-delta ${cls}">${esc(text)}</span>`}

function scorecard(proof,lang){
 const c=proof.comparison||{},p=c.pilot||{},u=c.uplift||{};
 return`<section class="pilot-card pilot-scorecard"><div class="pilot-card-head"><div><div class="eyebrow">PILOT SCORECARD</div><h2>${copy(lang,'Коммерческий результат пилота','Pilot commercial outcome')}</h2></div><span class="pilot-period">${esc(c.interpretation||'—')}</span></div>
 <div class="pilot-kpi-grid">
  ${metric(copy(lang,'Лиды','Leads'),num(p.leads),copy(lang,'в пилотном периоде','in pilot period'))}
  ${metric(copy(lang,'Покрытие ответом','Response coverage'),pct(p.responseCoverage))}
  ${metric(copy(lang,'Медиана ответа','Median response'),mins(p.medianResponseMinutes))}
  ${metric(copy(lang,'Переговоры / won','Negotiating / won'),num(p.negotiatingOrWon))}
  ${metric(copy(lang,'Победы','Won'),num(p.won))}
  ${metric(copy(lang,'Просрочено','Overdue'),num(p.overdue))}
 </div>
 <div class="pilot-uplift-strip">
  <div><span>${copy(lang,'Δ response coverage','Δ response coverage')}</span>${delta(u.responseCoverageDelta,{percent:true})}</div>
  <div><span>${copy(lang,'Δ median response','Δ median response')}</span>${delta(u.medianResponseMinutesDelta,{inverse:true})}</div>
  <div><span>${copy(lang,'Δ won','Δ won')}</span>${delta(u.wonDelta)}</div>
  <div><span>${copy(lang,'Δ overdue','Δ overdue')}</span>${delta(u.overdueDelta,{inverse:true})}</div>
 </div></section>`
}

function comparison(proof,lang){
 const c=proof.comparison||{},b=c.baseline||{},p=c.pilot||{};
 const rows=[
  [copy(lang,'Лиды','Leads'),b.leads,p.leads],
  [copy(lang,'Покрытие ответом','Response coverage'),pct(b.responseCoverage),pct(p.responseCoverage)],
  [copy(lang,'Медиана ответа','Median response'),mins(b.medianResponseMinutes),mins(p.medianResponseMinutes)],
  [copy(lang,'Viewing+','Viewing+'),b.viewingOrHigher,p.viewingOrHigher],
  [copy(lang,'Negotiating / won','Negotiating / won'),b.negotiatingOrWon,p.negotiatingOrWon],
  [copy(lang,'Won','Won'),b.won,p.won],
  [copy(lang,'Closed outcome rate','Closed outcome rate'),pct(b.closedOutcomeRate),pct(p.closedOutcomeRate)]
 ];
 return`<section class="pilot-card"><div class="pilot-card-head"><div><div class="eyebrow">BASELINE VS PILOT</div><h2>${copy(lang,'Что изменилось','What changed')}</h2></div><small>${esc((b.from||'').slice(0,10))} → ${esc((p.to||'').slice(0,10))}</small></div>
 <div class="pilot-comparison-table"><div class="head"><span></span><b>Baseline</b><b>Pilot</b></div>${rows.map(r=>`<div><span>${esc(r[0])}</span><b>${esc(r[1]??'—')}</b><b>${esc(r[2]??'—')}</b></div>`).join('')}</div></section>`
}

function rolling(proof,lang){
 const blocks=['D7','D30','D90'].map(k=>{const x=proof.rolling?.[k]||{},c=x.current||{},u=x.uplift||{};return`<article><div class="pilot-window-title"><strong>${k}</strong><span>${copy(lang,'текущее окно','current window')}</span></div><div class="pilot-window-metrics"><span>${copy(lang,'Лиды','Leads')} <b>${num(c.leads)}</b></span><span>${copy(lang,'Ответ','Response')} <b>${pct(c.responseCoverage)}</b></span><span>${copy(lang,'Медиана','Median')} <b>${mins(c.medianResponseMinutes)}</b></span><span>Won <b>${num(c.won)}</b></span></div><div class="pilot-window-deltas"><span>Response ${delta(u.responseCoverageDelta,{percent:true})}</span><span>Median ${delta(u.medianResponseMinutesDelta,{inverse:true})}</span><span>Won ${delta(u.wonDelta)}</span></div></article>`}).join('');
 return`<section class="pilot-card"><div class="pilot-card-head"><div><div class="eyebrow">D7 · D30 · D90</div><h2>${copy(lang,'Динамика по окнам','Rolling cohort movement')}</h2></div></div><div class="pilot-window-grid">${blocks}</div></section>`
}

function inventory(proof,performance,lang){
 const inv=proof.inventory||{},rows=(inv.rows||[]).slice(0,12);
 return`<section class="pilot-card"><div class="pilot-card-head"><div><div class="eyebrow">OBJECT PERFORMANCE</div><h2>${copy(lang,'Предметы и коммерческий исход','Inventory & commercial outcome')}</h2></div><div class="pilot-inline-kpis"><span>${copy(lang,'Intent','Intent')} <b>${num(inv.withCommercialIntent)}</b></span><span>${copy(lang,'Transacting','Transacting')} <b>${num(inv.transacting)}</b></span><span>${copy(lang,'Evidence','Evidence')} <b>${num(inv.withPriorExposureEvidence)}</b></span></div></div>
 <div class="pilot-object-table"><div class="head"><span>Object</span><span>Stage</span><span>Evidence</span></div>${rows.map(r=>`<div><span>${esc(r.objectId)}</span><span><b>${esc(r.stage||'—')}</b></span><span>${r.evidenceRows?esc(String(r.evidenceRows)): '—'}</span></div>`).join('')||`<div class="empty">${copy(lang,'Пока нет измеримых предметов','No measured objects yet')}</div>`}</div>
 <p class="pilot-boundary">${copy(lang,'Evidence = предшествующее editorial/drop-событие на том же предмете. Это не причинная атрибуция и не идентификация покупателя.','Evidence = prior editorial/drop activity on the same object. It is not causal attribution and does not identify the buyer.')}</p></section>`
}

function ledger(proof,lang){
 const rows=(proof.dealerOutcomeLedger||[]).slice(0,20);
 return`<section class="pilot-card"><div class="pilot-card-head"><div><div class="eyebrow">OUTCOME LEDGER</div><h2>${copy(lang,'Реестр коммерческих исходов','Commercial outcome ledger')}</h2></div></div><div class="pilot-ledger"><div class="head"><span>Object</span><span>Stage</span><span>Response</span><span>Outcome</span></div>${rows.map(r=>`<div><span>${esc(r.objectId||'—')}<small>${esc((r.firstBuyerActivityAt||'').slice(0,10))}</small></span><span>${esc(r.stage||'—')}</span><span>${r.responseMinutes==null?'—':esc(String(r.responseMinutes))+' min'}</span><span class="outcome ${String(r.outcome||'').toLowerCase()}">${esc(r.outcome||'OPEN')}</span></div>`).join('')||`<div class="empty">${copy(lang,'Исходов пока нет','No outcomes yet')}</div>`}</div></section>`
}



function paidPilotReadiness(engagement,board,commercial,bilateral,lang){
 const r=board?.readiness||{},op=board?.operation||{},summary=commercial?.summary||{},counts=summary.eventCounts||{},contractAcceptance=(r.checks||[]).find(x=>x.code==='CONTRACT_ACCEPTANCE');
 const checks=[
  {code:'SCOPE_FROZEN',ok:Boolean(engagement?.contractDigest),detail:engagement?.contractDigest?String(engagement.contractDigest).slice(0,12):'MISSING'},
  {code:'COUNTERPARTY_ACCEPTED',ok:Boolean(contractAcceptance?.ok),detail:contractAcceptance?.ok?'ACCEPTED':'PENDING'},
  {code:'LAUNCH_READY',ok:Boolean(r.ready),detail:r.ready?'READY':'BLOCKED'},
  {code:'LAUNCHED',ok:op.launch_status==='LAUNCHED',detail:op.launch_status||'PREPARING'},
  {code:'PRICE_ACCEPTED',ok:Number(counts.PRICE_WRITTEN_ACCEPTED||0)>0,detail:Number(counts.PRICE_WRITTEN_ACCEPTED||0)>0?'WRITTEN':'MISSING'},
  {code:'INVOICE',ok:Number(counts.INVOICE_ISSUED||0)>0,detail:Number(counts.INVOICE_ISSUED||0)>0?'ISSUED':'MISSING'},
  {code:'VERIFIED_CASH',ok:Number(counts.PAYMENT_RECEIVED||0)>0,detail:Number(counts.PAYMENT_RECEIVED||0)>0?'PAID':'MISSING'},
  {code:'DIRECT_COST_CAPTURE',ok:Number(counts.DIRECT_COST_RECORDED||0)>0&&summary.classificationCoverage?.costs?.ratio===1,detail:Number(counts.DIRECT_COST_RECORDED||0)>0?(summary.classificationCoverage?.costs?.ratio===1?'COMPLETE':'PARTIAL'):'MISSING'},
  {code:'FINAL_REVIEW',ok:bilateral?.bilateralFinalStatus&&bilateral.bilateralFinalStatus!=='PENDING',detail:bilateral?.bilateralFinalStatus||'PENDING'},
  {code:'RENEWAL_DECISION',ok:Number(counts.RENEWAL_ACCEPTED||0)+Number(counts.RENEWAL_REJECTED||0)+Number(counts.EXPANSION_ACCEPTED||0)>0,detail:counts.EXPANSION_ACCEPTED?'EXPAND':counts.RENEWAL_ACCEPTED?'RENEW':counts.RENEWAL_REJECTED?'STOP':'PENDING'}
 ];
 const paid=checks.find(x=>x.code==='VERIFIED_CASH')?.ok,economic=paid&&checks.find(x=>x.code==='DIRECT_COST_CAPTURE')?.ok,renewal=checks.find(x=>x.code==='RENEWAL_DECISION')?.ok;
 const level=renewal?'RENEWAL DECIDED':economic?'ECONOMICALLY OBSERVED':paid?'PAID':checks.find(x=>x.code==='PRICE_ACCEPTED')?.ok?'PRICE ACCEPTED':checks.find(x=>x.code==='LAUNCHED')?.ok?'LAUNCHED':'PREPARING';
 return`<section class="pilot-card paid-pilot-readiness"><div class="pilot-card-head"><div><div class="eyebrow">PAID PILOT EVIDENCE LADDER</div><h2>${copy(lang,'Где пилот находится по уровню доказательства','Where the pilot sits on the evidence ladder')}</h2><p>${copy(lang,'Каждый статус вычисляется из существующих pilot / governance / commercial authorities. Ручных галочек нет.','Each status is derived from existing pilot, governance and commercial authorities. There are no manual checkboxes.')}</p></div><span class="pilot-period">${esc(level)}</span></div>
 <div class="launch-checks">${checks.map(x=>`<article><b>${x.ok?'✓':'×'}</b><span>${esc(x.code.replaceAll('_',' '))}<small>${esc(x.detail)}</small></span></article>`).join('')}</div>
 <p class="pilot-boundary">${copy(lang,'PAID требует PAYMENT_RECEIVED. Economically observed дополнительно требует зафиксированные и классифицированные direct costs. Renewal evidence требует явного письменного решения, а не устного оптимизма.','PAID requires PAYMENT_RECEIVED. Economically observed additionally requires recorded and classified direct costs. Renewal evidence requires an explicit written decision, not verbal optimism.')}</p></section>`
}

function commercialEvidencePanel(commercial,lang){
 if(!commercial?.summary)return`<section class="pilot-card pilot-commercial-evidence"><div class="pilot-card-head"><div><div class="eyebrow">COMMERCIAL EVIDENCE · v0.46</div><h2>${copy(lang,'Доказательство денег','Proof of money')}</h2></div><span class="pilot-period">MISSING / DURABLE DB REQUIRED</span></div><p class="pilot-boundary">${copy(lang,'Коммерческий ledger появляется только после durable PostgreSQL и операторской фиксации quote / accepted price / invoice / payment / direct cost / renewal.','The commercial ledger appears only with durable PostgreSQL and operator-recorded quote / accepted price / invoice / payment / direct cost / renewal evidence.')}</p></section>`;
 const s=commercial.summary,p=s.pricingEvidence||{};
 return`<section class="pilot-card pilot-commercial-evidence"><div class="pilot-card-head"><div><div class="eyebrow">COMMERCIAL EVIDENCE · v0.46</div><h2>${copy(lang,'Цена, cash и gross contribution','Price, cash and gross contribution')}</h2></div><span class="pilot-period">${esc(s.evidenceLevel||'MISSING')}</span></div>
 <div class="pilot-kpi-grid">
  ${metric(copy(lang,'Pricing confidence','Pricing confidence'),esc(p.confidence||'UNPROVEN'))}
  ${metric(copy(lang,'Quoted','Quoted'),moneyMap(s.quotedMinorByCurrency))}
  ${metric(copy(lang,'Accepted','Accepted'),moneyMap(s.acceptedMinorByCurrency))}
  ${metric(copy(lang,'Cash received','Cash received'),moneyMap(s.cashReceivedMinorByCurrency))}
  ${metric(copy(lang,'Direct cost','Direct cost'),moneyMap(s.directCostMinorByCurrency))}
  ${metric(copy(lang,'Gross contribution','Gross contribution'),moneyMap(s.grossContributionMinorByCurrency))}
 </div>
 <div class="pilot-uplift-strip">
  <div><span>${copy(lang,'Realized price ratio','Realized price ratio')}</span><b>${p.realizedPriceRatio==null?'—':pct(p.realizedPriceRatio)}</b></div>
  <div><span>${copy(lang,'Discount rate','Discount rate')}</span><b>${p.discountRate==null?'—':pct(p.discountRate)}</b></div>
  <div><span>${copy(lang,'Renewal','Renewal')}</span><b>${s.renewalAccepted?'ACCEPTED':'—'}</b></div>
  <div><span>${copy(lang,'Expansion','Expansion')}</span><b>${s.expansionAccepted?'ACCEPTED':'—'}</b></div>
 </div>
 <p class="pilot-boundary">${copy(lang,'Quote, written acceptance и invoice не считаются cash. Только PAYMENT_RECEIVED увеличивает cash; refund и direct cost уменьшают экономический результат.','Quote, written acceptance and invoice are not cash. Only PAYMENT_RECEIVED increases cash; refunds and direct cost reduce the economic result.')}</p></section>`
}

function evidence(proof,performance,lang){
 const e=proof.evidenceSnapshot||{},a=performance.attribution||{};
 return`<section class="pilot-card pilot-evidence"><div class="pilot-card-head"><div><div class="eyebrow">SIGNED EVIDENCE PACK</div><h2>${copy(lang,'Проверяемый снимок результатов','Verifiable evidence snapshot')}</h2></div><a class="primary-button" href="/api/pilot/commercial-proof/report" target="_blank" rel="noopener">${copy(lang,'Экспорт отчёта','Export report')}</a></div>
 <div class="pilot-evidence-grid"><div><span>SHA-256</span><code>${esc(e.digest||'—')}</code></div><div><span>HMAC-SHA256</span><code>${esc(e.signature||'—')}</code></div><div><span>${copy(lang,'Модель attribution','Attribution model')}</span><strong>${esc(a.model||'—')}</strong></div><div><span>${copy(lang,'Объектов с evidence','Objects with evidence')}</span><strong>${num(a.objectsWithEvidence)}</strong></div></div>
 <p>${copy(lang,'Любое изменение подписанных цифр меняет digest и делает подпись недействительной. Snapshot доказывает целостность зафиксированного расчёта, а не причинность бизнес-эффекта.','Any change to signed figures changes the digest and invalidates the signature. The snapshot proves integrity of the captured calculation, not causality of business impact.')}</p></section>`
}

export async function dealerPilotWorkspace(lang='ru'){
 const [proofRes,performanceRes,pilotRes,authorityRes]=await Promise.all([
  api('/api/pilot/commercial-proof'),
  api('/api/dealer/performance'),
  api('/api/partner/pilot-analytics'),
  api('/api/dealer/pilots')
 ]);
 const proof=proofRes.proof||{},performance=performanceRes.performance||{},pilot=pilotRes.analytics||{},engagement=(authorityRes.pilots||[]).find(x=>x.status==='ACTIVE')||(authorityRes.pilots||[])[0]||null;
 const [launch,boardRes,commercial,bilateralRes]=engagement?await Promise.all([
  pilotLaunchBoard(engagement.id),
  api('/api/dealer/pilots/'+encodeURIComponent(engagement.id)+'/operating-board').catch(()=>null),
  api('/api/dealer/pilots/'+encodeURIComponent(engagement.id)+'/commercial-evidence').catch(()=>null),
  api('/api/dealer/pilots/'+encodeURIComponent(engagement.id)+'/bilateral-status').catch(()=>null)
 ]):['',null,null,null];const board=boardRes?.board||null,bilateral=bilateralRes?.status||null;return`<main class="pilot-workspace page section">${engagement?`<section class="pilot-engagement-banner"><div><span>REAL PILOT · ${esc(engagement.status)}</span><strong>${esc(engagement.name)}</strong><small>${esc((engagement.startsAt||'').slice(0,10))} → ${esc((engagement.endsAt||'').slice(0,10))}</small></div><div><span>CONTRACT</span><code>${esc(engagement.contractDigest||'DRAFT · NOT FROZEN')}</code></div></section>`:`<section class="pilot-engagement-banner draft"><div><span>REAL PILOT AUTHORITY</span><strong>${copy(lang,'Engagement ещё не создан','No engagement created yet')}</strong><small>${copy(lang,'Метрики ниже остаются техническим evidence workspace до фиксации реального пилота.','Metrics below remain a technical evidence workspace until a real pilot is contracted.')}</small></div></section>`}<section class="pilot-hero"><div><div class="eyebrow">ANTIQUA · DEALER PILOT WORKSPACE</div><h1>${copy(lang,'Коммерческий контроль пилота','Pilot commercial control')}</h1><p>${copy(lang,'Один кабинет: от response SLA и cohort-динамики до object outcomes и подписываемого доказательства результата.','One workspace: from response SLA and cohort movement to object outcomes and a signed evidence pack.')}</p></div><aside><span>${copy(lang,'Активный pipeline','Active pipeline')}</span><strong>${num(performance.dealerPerformance?.currentActiveLeads)}</strong><small>${copy(lang,'Просрочено','Overdue')}: ${num(performance.dealerPerformance?.currentOverdue)}</small></aside></section>
 ${scorecard(proof,lang)}
 ${paidPilotReadiness(engagement,board,commercial?.commercial||null,bilateral,lang)}
 ${commercialEvidencePanel(commercial?.commercial||null,lang)}
 <div class="pilot-two-col">${comparison(proof,lang)}${rolling(proof,lang)}</div>
 ${inventory(proof,performance,lang)}
 ${ledger(proof,lang)}
 ${evidence(proof,performance,lang)}
 <section class="pilot-card pilot-method"><div class="eyebrow">MEASUREMENT BOUNDARY</div><p>${copy(lang,'Данные кабинета — наблюдаемые outcomes и равные cohort-окна. Antiqua не заявляет причинность там, где её нельзя доказать, и не связывает пассивного читателя editorial с конкретным покупателем.','The workspace shows observed outcomes and equal cohort windows. Antiqua does not claim causality where it cannot be proven and does not join passive editorial viewers to specific buyers.')}</p><small>v0.36 UI · v0.35 proof · v0.34 evidence · v0.33 pilot analytics</small></section>${launch}</main>`
}
