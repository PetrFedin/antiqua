import {safe,api,toast,copy,esc,local,date} from './core.js';

let loading=false;
function markup(items){
 return `<section id="recentlyViewedV17" class="account-block">
  <div class="block-head"><div><div class="eyebrow">RECENTLY VIEWED</div><h2>${copy('Недавно просмотренные','Recently viewed')}</h2><p>${copy('История строится только по фактическим открытиям паспорта предмета в вашем аккаунте.','History is based only on object passports actually opened while signed in.')}</p></div><button class="quiet-button" data-clear-recent>${copy('Очистить историю','Clear history')}</button></div>
  <div class="account-card-grid compact">${items.map(x=>`<article class="account-card"><button class="image-button mini-object" data-passport="${esc(x.object.id)}"><img src="${esc(x.object.image||'')}" alt=""></button><h3>${esc(local(x.object.title))}</h3><small>${copy('Последний просмотр','Last viewed')}: ${date(x.lastViewedAt)}</small><button class="quiet-button" data-passport="${esc(x.object.id)}">${copy('Открыть паспорт','Open passport')}</button></article>`).join('')}</div>
 </section>`;
}
async function mount(){
 if(document.querySelector('#recentlyViewedV17')||loading)return;
 const host=document.querySelector('.account-v12 .account-layout > div');
 if(!host||document.querySelector('.seller-workspace-form'))return;
 loading=true;
 try{
  const d=await safe('/api/engagement/recent'),items=d?.items||[];if(!items.length)return;
  const box=document.createElement('div');box.innerHTML=markup(items);host.prepend(box.firstElementChild);
 }catch(e){console.error(e)}finally{loading=false}
}
const observer=new MutationObserver(()=>mount());
observer.observe(document.querySelector('#app'),{childList:true,subtree:true});
window.addEventListener('hashchange',()=>setTimeout(mount,30));
setTimeout(mount,60);

document.addEventListener('click',async e=>{
 const button=e.target.closest?.('[data-clear-recent]');if(!button)return;
 button.disabled=true;
 try{await api('/api/engagement/recent',{method:'DELETE',body:'{}'});document.querySelector('#recentlyViewedV17')?.remove();toast(copy('История просмотров очищена','Viewing history cleared'))}catch(err){button.disabled=false;toast(err.message)}
});
