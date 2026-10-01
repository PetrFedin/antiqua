import {copy,esc,local} from './core.js';

export function relatedWorksGrid(items=[],{
  emptyText=null,
  className='artwork-related-grid',
  itemClass='artwork-related-card',
  limit=12
}={}){
 const rows=(items||[]).slice(0,Math.max(1,Number(limit)||12));
 if(!rows.length)return `<p class="muted">${esc(emptyText||copy('Связанные работы пока не определены','No related works identified yet'))}</p>`;
 return `<div class="${esc(className)}">${rows.map(x=>`<button class="${esc(itemClass)}" data-passport="${esc(x.id||x.object?.id||'')}"><span class="artwork-related-media">${x.image||x.object?.image?`<img loading="lazy" decoding="async" src="${esc(x.image||x.object?.image)}" alt="${esc(local(x.title||x.object?.title))}">`:''}</span><strong>${esc(local(x.title||x.object?.title))}</strong><small>${esc((x.reasons||[]).slice(0,2).map(r=>local(r.label)).filter(Boolean).join(' · ')||local(x.object?.period)||'')}</small></button>`).join('')}</div>`;
}
