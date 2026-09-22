import {api,safe,copy,esc,local,toast} from './core.js';

let passportSeq=0;
const TOPICS=[
 ['CONDITION','Состояние и реставрация','Condition & restoration'],
 ['PROVENANCE','Провенанс и документы','Provenance & documents'],
 ['VIEWING','Просмотр предмета','Viewing appointment'],
 ['SHIPPING','Доставка и страхование','Shipping & insurance'],
 ['AVAILABILITY','Наличие и покупка','Availability & purchase'],
 ['OTHER','Другой вопрос','Other question']
];
const actionSheet=()=>({dialog:document.querySelector('#actionSheet'),body:document.querySelector('#actionSheetBody')});
function openSheet(html){
 const {dialog,body}=actionSheet();if(!dialog||!body)return null;
 body.innerHTML=`<div class="action-sheet-body inquiry-sheet-v21">${html}</div>`;
 if(!dialog.open)dialog.showModal();
 return body;
}
function authRequired(){
 openSheet(`<div class="action-sheet-head"><div><div class="micro">OBJECT INQUIRY</div><h2>${copy('Войдите, чтобы написать дилеру','Sign in to contact the dealer')}</h2><p>${copy('Переписка привязана к предмету и хранится в разделе «Сообщения» вашего аккаунта.','The conversation is tied to the object and remains available in your account Messages.')}</p></div><button class="action-sheet-close" data-close-sheet>×</button></div><div class="action-sheet-actions"><button class="primary-button" data-close-sheet>${copy('Понятно','Got it')}</button></div>`);
}
function inquiryForm(ctx){
 const options=TOPICS.map(([value,ru,en])=>`<option value="${value}">${copy(ru,en)}</option>`).join('');
 return openSheet(`<div class="action-sheet-head"><div><div class="micro">OBJECT INQUIRY</div><h2>${copy('Запросить информацию','Ask the dealer')}</h2><p><strong>${esc(local(ctx.title))}</strong>${ctx.sellerName?` · ${esc(ctx.sellerName)}`:''}</p></div><button class="action-sheet-close" data-close-sheet>×</button></div>
 <form id="v21InquiryForm" data-listing="${esc(ctx.id)}" data-client-message-id="${esc(crypto.randomUUID())}">
  <div class="action-sheet-field"><label>${copy('Тема запроса','Inquiry topic')}<select name="inquiryType">${options}</select></label></div>
  <div class="action-sheet-field"><label>${copy('Сообщение','Message')}<textarea name="message" minlength="5" maxlength="4000" rows="6" required placeholder="${copy('Например: уточните, пожалуйста, состояние поверхности и известные реставрации.','For example: could you clarify the surface condition and any known restoration?')}"></textarea></label></div>
  <div class="inquiry-note-v21">${copy('Сообщение будет добавлено в переписку по этому предмету. Повторная отправка после сетевого сбоя не создаст дубль.','Your message will be added to this object thread. Retrying after a network interruption will not create a duplicate.')}</div>
  <div class="action-sheet-actions"><button type="button" class="secondary-button" data-close-sheet>${copy('Отмена','Cancel')}</button><button class="primary-button" type="submit">${copy('Отправить дилеру','Send to dealer')}</button></div>
 </form>`);
}
function installButton(ctx,me,seq){
 if(seq!==passportSeq||!ctx?.id)return;
 if(me?.account?.sellerId&&me.account.sellerId===ctx.sellerId)return;
 const dock=document.querySelector('#dialog[open] .dossier-commerce-dock .dock-actions');if(!dock||dock.querySelector('[data-object-inquiry]'))return;
 const b=document.createElement('button');b.type='button';b.className='secondary-button inquiry-button-v21';b.dataset.objectInquiry=ctx.id;b.dataset.sellerId=ctx.sellerId||'';b.textContent=copy('Запросить информацию','Ask dealer');dock.append(b);
 b._inquiryContext=ctx;
}
window.addEventListener('antiqua:passport',async e=>{
 const seq=++passportSeq,ctx=e.detail?.listing;
 document.querySelector('[data-object-inquiry]')?.remove();
 if(!ctx)return;
 const me=await safe('/api/auth/me');
 installButton(ctx,me,seq);
});
document.addEventListener('click',async e=>{
 const b=e.target.closest?.('[data-object-inquiry]');if(!b)return;
 e.preventDefault();
 const me=await safe('/api/auth/me');
 if(!me?.account)return authRequired();
 if(!(me.account.roles||[]).includes('BUYER'))return toast(copy('Для запроса нужен аккаунт покупателя','A buyer account is required for inquiries'));
 if(me.account.sellerId&&me.account.sellerId===b.dataset.sellerId)return toast(copy('Нельзя отправить запрос по собственному листингу','You cannot inquire about your own listing'));
 inquiryForm(b._inquiryContext||{id:b.dataset.objectInquiry,sellerId:b.dataset.sellerId,title:{ru:'Предмет',en:'Object'}});
});
document.addEventListener('submit',async e=>{
 const f=e.target;if(f.id!=='v21InquiryForm')return;
 e.preventDefault();const submit=f.querySelector('button[type="submit"]');submit.disabled=true;
 try{
  const fd=new FormData(f),result=await api('/api/inquiries',{method:'POST',body:JSON.stringify({listingId:f.dataset.listing,inquiryType:fd.get('inquiryType'),message:fd.get('message'),clientMessageId:f.dataset.clientMessageId})});
  actionSheet().dialog?.close();
  toast(result.idempotent?copy('Запрос уже был отправлен','Inquiry was already sent'):copy('Сообщение отправлено дилеру','Message sent to dealer'));
 }catch(err){submit.disabled=false;toast(err.message)}
});
