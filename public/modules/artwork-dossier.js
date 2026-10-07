const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const local=(v,lang)=>typeof v==='string'?v:(v?.[lang]??v?.en??v?.ru??'');
const date=(v,lang)=>v?new Intl.DateTimeFormat(lang==='ru'?'ru-RU':'en-GB',{dateStyle:'medium'}).format(new Date(v)):'—';
const moneyMinor=(v,currency='EUR',lang='ru')=>new Intl.NumberFormat(lang==='ru'?'ru-RU':'en-GB',{style:'currency',currency,maximumFractionDigits:0}).format((Number(v)||0)/100);

function credentialCard(c,lang){
  const issuer=c.issuer?.name||c.issuer?.organizationId||'—';
  return `<div class="dossier-credential">
    <div><strong>${esc(c.roleLabel||c.credentialType)}</strong><span>${esc(c.projectRef||'')}</span></div>
    <small>${esc(issuer)} · ${lang==='ru'?'действовал на момент review':'valid at review'} · ${esc(c.currentStatus||'')}</small>
  </div>`;
}

function scholarlyBlock(rows,lang){
  const title=lang==='ru'?'Научные и экспертные вклады':'Scholarly contributions';
  const empty=lang==='ru'?'Опубликованных научных вкладов по этой картине пока нет.':'No published scholarly contributions are recorded for this painting yet.';
  return `<section class="artwork-research-section" id="dossier-scholarly">
    <div class="dossier-section-head"><div><div class="eyebrow">SCHOLARLY GRAPH</div><h3>${title}</h3></div></div>
    ${rows.length?`<div class="dossier-contribution-list">${rows.map(x=>{
      const who=x.contributor?.displayName?local(x.contributor.displayName,lang):(x.contributor?.name||x.contributor?.profileSlug||x.contributor?.organizationId||'—');
      const expertise=x.verifiedExpertise?.expertiseType?String(x.verifiedExpertise.expertiseType).replaceAll('_',' '):null;
      return `<article class="dossier-contribution">
        <div class="dossier-contribution-head"><strong>${esc(who)}</strong><span>${esc(String(x.contributionType||'').replaceAll('_',' '))}</span></div>
        ${expertise?`<div class="micro">${esc(expertise)}</div>`:''}
        <p>${esc(local(x.summary,lang)||'—')}</p>
        <div class="dossier-contribution-meta"><span>${lang==='ru'?'Опубликовано':'Published'}: ${date(x.publishedAt,lang)}</span><span>${lang==='ru'?'Disclosure':'Disclosure'}: ${esc(x.disclosureStatus||'—')}</span></div>
        ${x.credentialsAtReview?.length?`<div class="dossier-credentials">${x.credentialsAtReview.map(c=>credentialCard(c,lang)).join('')}</div>`:''}
        <small class="research-boundary">${lang==='ru'?'Credential подтверждает роль и scope, но не истинность заключения и не подлинность картины.':'A credential attests role and scope, not the truth of a conclusion or artwork authenticity.'}</small>
      </article>`;
    }).join('')}</div>`:`<p class="muted">${empty}</p>`}
  </section>`;
}

function marketBlock(rows,lang){
  const title=lang==='ru'?'История рынка':'Market history';
  const empty=lang==='ru'?'Подтверждённых завершённых аукционных результатов по этой картине пока нет.':'No authoritative closed-auction results are recorded for this painting yet.';
  return `<section class="artwork-research-section" id="dossier-market-history">
    <div class="dossier-section-head"><div><div class="eyebrow">MARKET HISTORY</div><h3>${title}</h3></div></div>
    ${rows.length?`<div class="dossier-market-history">${rows.map(x=>`<article class="market-history-row">
      <div><strong>${esc(x.status)}</strong><span>${date(x.endedAt,lang)}</span></div>
      <div><span>${lang==='ru'?'Hammer':'Hammer'}</span><b>${x.hammerAmountMinor==null?'—':moneyMinor(x.hammerAmountMinor,x.currency,lang)}</b></div>
      <div><span>${lang==='ru'?'Реализовано':'Realized'}</span><b>${x.realizedAmountMinor==null?'—':moneyMinor(x.realizedAmountMinor,x.currency,lang)}</b></div>
    </article>`).join('')}</div>`:`<p class="muted">${empty}</p>`}
    <small class="research-boundary">${lang==='ru'?'История рынка показывает только authoritative closed-auction records. Текущая цена предложения отображается отдельно.':'Market history contains authoritative closed-auction records only. Current asking price is shown separately.'}</small>
  </section>`;
}

function provenanceSummary(passport,lang){
  const s=passport?.evidenceSummary;
  if(!s)return'';
  const gaps=s.gapIndex?.totalGaps??0;
  return `<section class="artwork-research-summary">
    <div><span>${lang==='ru'?'Статус провенанса':'Provenance status'}</span><strong>${esc(s.completeness||'—')}</strong></div>
    <div><span>${lang==='ru'?'События':'Events'}</span><strong>${Number(s.totalEvents||0)}</strong></div>
    <div><span>${lang==='ru'?'Конфликты':'Conflicts'}</span><strong>${Number(s.conflictEventIds?.length||0)}</strong></div>
    <div><span>${lang==='ru'?'Пробелы evidence':'Evidence gaps'}</span><strong>${Number(gaps)}</strong></div>
  </section>`;
}

export function artworkResearchSections(dossier,lang='ru'){
  if(!dossier)return'';
  return `${provenanceSummary(dossier.provenancePassport,lang)}
    ${scholarlyBlock(dossier.scholarlyContributions||[],lang)}
    ${marketBlock(dossier.marketHistory||[],lang)}
    <small class="research-boundary dossier-boundary">${lang==='ru'?'Research Dossier — derived read-model. Конфликты и пробелы сохраняются; authenticity не сертифицируется автоматически.':'Research Dossier is a derived read-model. Conflicts and gaps are preserved; authenticity is never automatically certified.'}</small>`;
}


async function safeDossier(id){
  try{
    const r=await fetch('/api/lots/'+encodeURIComponent(id)+'/dossier',{headers:{accept:'application/json'}});
    if(!r.ok)return null;
    return await r.json();
  }catch{return null}
}

function ensureResearchTabs(body,lang){
  const tabs=body?.querySelector('.dossier-tabs');
  if(!tabs)return;
  if(!tabs.querySelector('a[href="#dossier-scholarly"]')){
    const a=document.createElement('a');
    a.href='#dossier-scholarly';
    a.textContent=lang==='ru'?'Исследователи':'Scholarly';
    tabs.append(a);
  }
  if(!tabs.querySelector('a[href="#dossier-market-history"]')){
    const a=document.createElement('a');
    a.href='#dossier-market-history';
    a.textContent=lang==='ru'?'Рынок':'Market';
    tabs.append(a);
  }
}

async function enhanceArtworkDossier(event){
  const id=String(event.detail?.id||'');
  if(!id)return;
  const dialog=document.querySelector('#dialog[open]')||document.querySelector('#dialog');
  const body=dialog?.querySelector('.dossier-body');
  if(!body)return;
  const lang=document.documentElement.lang==='en'?'en':'ru';
  if(body.querySelector('#dossier-scholarly')&&body.querySelector('#dossier-market-history')){
    ensureResearchTabs(body,lang);
    return;
  }
  const payload=await safeDossier(id);
  const dossier=payload?.dossier||null;
  if(!dossier||!body.isConnected)return;
  const evidence=body.querySelector('#dossier-evidence');
  if(!evidence)return;
  const box=document.createElement('div');
  box.innerHTML=artworkResearchSections(dossier,lang);
  for(const node of [...box.children]){
    if(node.id&&body.querySelector('#'+CSS.escape(node.id)))continue;
    evidence.append(node);
  }
  ensureResearchTabs(body,lang);
}

window.addEventListener('antiqua:passport',e=>{
  enhanceArtworkDossier(e).catch(console.error);
});
