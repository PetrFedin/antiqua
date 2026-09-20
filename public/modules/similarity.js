import {safe,copy,esc,local,lang} from './core.js';

const money=(value,currency='EUR')=>new Intl.NumberFormat(lang()==='ru'?'ru-RU':'en-GB',{style:'currency',currency,maximumFractionDigits:0}).format(Number(value)||0);
const reason=x=>`<span class="similarity-reason">${esc(local(x.label))}${x.value?`: ${esc(local(x.value))}`:''}</span>`;
function card(x){
 const c=x.commerce||{},commercial=c.kind!=='REFERENCE'&&Number.isFinite(Number(c.price));
 return `<article class="similarity-card" data-similar-object="${esc(x.id)}">
  <button class="image-button similarity-image" data-passport="${esc(x.id)}"><img src="${esc(x.image||'')}" alt="${esc(local(x.title))}"></button>
  <div class="similarity-copy">
   <div class="similarity-meta"><span>${esc(local(x.department))}</span><span class="similarity-strength">${esc(x.strength)}</span></div>
   <h4>${esc(local(x.title))}</h4>
   <p>${esc(local(x.maker))} · ${esc(local(x.period))}</p>
   <div class="similarity-reasons">${(x.reasons||[]).slice(0,4).map(reason).join('')}</div>
   ${commercial?`<div class="similarity-commerce"><strong>${money(c.price,c.currency)}</strong><span>${esc(String(c.kind||'').replaceAll('_',' '))}</span></div>`:''}
   <button class="quiet-button" data-passport="${esc(x.id)}">${copy('Открыть паспорт','Open passport')}</button>
  </div>
 </article>`;
}
function markup(d){
 return `<section id="dossierSimilarV18" class="dossier-similarity">
  <div class="similarity-head"><div><div class="eyebrow">EXPLAINABLE SIMILARITY</div><h3>${copy('Похожие предметы','Similar objects')}</h3><p>${copy('Подборка строится по каталожным признакам. Причины сходства показаны явно; персонализация и скрытый рейтинг не используются.','Selected from catalogue attributes. Reasons are shown explicitly; no personalization or opaque ranking is used.')}</p></div></div>
  <div class="similarity-grid">${(d.items||[]).map(card).join('')}</div>
 </section>`;
}
window.addEventListener('antiqua:passport',async e=>{
 const id=String(e.detail?.id||'');if(!id)return;
 const dlg=document.querySelector('#dialog[open]')||document.querySelector('#dialog'),body=dlg?.querySelector('.dossier-body');if(!body)return;
 body.querySelector('#dossierSimilarV18')?.remove();
 const d=await safe(`/api/lots/${encodeURIComponent(id)}/similar?limit=4`);
 if(!d?.items?.length||String(e.detail?.id)!==id)return;
 const box=document.createElement('div');box.innerHTML=markup(d);
 const disclaimer=body.querySelector('.dossier-disclaimer');
 if(disclaimer)disclaimer.before(box.firstElementChild);else body.append(box.firstElementChild);
});
