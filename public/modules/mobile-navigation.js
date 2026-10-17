// ANTIQUA v66: human-sized mobile actions and a keyboard-accessible index.
const nav=document.querySelector('.mobile-tabbar');
const more=nav?.querySelector('[data-mobile-more]');
const sheet=document.getElementById('mobileMoreDialog');
const close=sheet?.querySelector('[data-mobile-more-close]');
const secondary=new Set(['network','learn','events','auctions']);
const copy=(r,e)=>document.documentElement.lang==='en'?e:r;
function synchronize(){
 if(!more||!sheet)return;
 const route=location.hash.slice(1).split('/')[0]||'gallery';
 more.querySelector('[data-mobile-more-label]').textContent=copy('Ещё','More');
 more.setAttribute('aria-label',copy('Другие разделы','More sections'));
 sheet.querySelector('[data-mobile-more-title]').textContent=copy('Другие разделы','More sections');
 sheet.querySelector('.mobile-more-kicker').textContent=copy('ANTIQUA / НАВИГАЦИЯ','ANTIQUA / NAVIGATION');
 sheet.querySelector('nav').setAttribute('aria-label',copy('Дополнительные разделы','Additional sections'));
 close?.setAttribute('aria-label',copy('Закрыть','Close'));
 if(secondary.has(route))more.setAttribute('aria-current','page');
 else more.removeAttribute('aria-current');
}
if(nav && more && sheet && close){
 synchronize();
 new MutationObserver(synchronize).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 more.addEventListener('click',()=>{
  if(sheet.open){sheet.close();return}
  synchronize();sheet.showModal();more.setAttribute('aria-expanded','true');close.focus();
 });
 close.addEventListener('click',()=>sheet.close());
 sheet.addEventListener('click',event=>{
  if(event.target.closest?.('a[data-nav]') || event.target===sheet)sheet.close();
 });
 sheet.addEventListener('close',()=>{
  more.setAttribute('aria-expanded','false');
  if(document.activeElement===document.body || document.activeElement===sheet)more.focus({preventScroll:true});
 });
 window.addEventListener('hashchange',()=>{
  if(sheet.open)sheet.close();
  synchronize();
 });
 window.matchMedia('(min-width: 801px)').addEventListener('change',event=>{
  if(event.matches && sheet.open)sheet.close();
 });
}
