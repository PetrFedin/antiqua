import {state,$,$$,t,l,api,toast,refresh,updateChrome,lot} from './core-v08.js';
import {shopView,auctionsView,dealersView,dealerView,accountView,collectionsView,storiesView,sellView} from './views-v08.js';
import {openLotDialog,openSellerDialog,openNotifications,openOrderDialog,openDraftDialog,draftPayload} from './dialogs-v08.js';

const dialogs=['lotDialog','sellerDialog','notificationsDialog','orderDialog','draftDialog'];
function closeDialogs(){dialogs.forEach(id=>{const d=$(`#${id}`);if(d?.open)d.close()})}
function parseRoute(){const h=location.hash.replace(/^#/,'')||'shop';if(h.startsWith('seller/'))return{route:'seller',id:h.split('/')[1]};return{route:['shop','auctions','dealers','collections','stories','sell','account'].includes(h)?h:'shop',id:null}}
function navTo(route,id=null){state.route=route;location.hash=route==='seller'?`seller/${id}`:route;render();}
function view(){const p=parseRoute();state.route=p.route;return p.route==='shop'?shopView():p.route==='auctions'?auctionsView():p.route==='dealers'?dealersView():p.route==='seller'?dealerView(p.id):p.route==='collections'?collectionsView():p.route==='stories'?storiesView():p.route==='sell'?sellView():accountView();}
export function render(){$('#app').innerHTML=view();updateChrome();$$('[data-nav]').forEach(x=>x.classList.toggle('active',x.dataset.nav===state.route));window.scrollTo({top:0,behavior:'instant'});}
async function syncAndRender(){await refresh();render();}

async function toggleSave(id){const enabled=!state.client.savedLots.includes(id);await api(`/api/lots/${id}/save`,{method:'POST',body:JSON.stringify({enabled})});await refresh();toast(enabled?t('saved'):t('save'));render();if(state.activeLot===id&&$('#lotDialog').open)await openLotDialog(id)}
async function collect(id){await api(`/api/lots/${id}/collect`,{method:'POST',body:'{}'});await refresh();toast(t('collections'));if($('#lotDialog').open)await openLotDialog(id)}
async function registerAuction(){if(state.persona!=='BUYER'){toast('Buyer account required');return}await api(`/api/sales/${state.sale.id}/register`,{method:'POST',body:JSON.stringify({acceptTerms:true,country:'Netherlands'})});await refresh();toast(t('registerBid'));render();if(state.activeLot&&$('#lotDialog').open)await openLotDialog(state.activeLot)}
async function placeBid(id){const input=$('#bidAmount'),maxAmount=Number(input?.value||0);const d=await api(`/api/auctions/${id}/bid`,{method:'POST',headers:{'idempotency-key':crypto.randomUUID()},body:JSON.stringify({maxAmount})});await refresh();toast(d.leading?(state.lang==='ru'?'Вы лидируете':'You are leading'):'Bid accepted');await openLotDialog(d.auction.lotId)}
async function buyNow(id){const d=await api(`/api/listings/${id}/buy`,{method:'POST',body:'{}'});closeDialogs();await refresh();toast(state.lang==='ru'?'Предмет зарезервирован':'Object reserved');render();await openOrderDialog(d.order.id)}
async function makeOffer(id){const amount=Number($('#offerAmount')?.value||0);await api(`/api/listings/${id}/offers`,{method:'POST',body:JSON.stringify({amount})});await refresh();toast(state.lang==='ru'?'Предложение отправлено':'Offer sent');await openLotDialog(state.activeLot)}
async function messageSeller(id){const text=prompt(state.lang==='ru'?'Ваш вопрос продавцу':'Your question to the seller');if(!text)return;await api(`/api/listings/${id}/message`,{method:'POST',body:JSON.stringify({message:text})});toast(state.lang==='ru'?'Запрос отправлен':'Enquiry sent')}
async function shippingQuote(id){const country=$('#quoteCountry')?.value||'Netherlands';await api(`/api/orders/${id}/shipping-quote`,{method:'POST',body:JSON.stringify({country})});await refresh();await openOrderDialog(id)}
async function cancelOrder(id){await api(`/api/orders/${id}/cancel`,{method:'POST',body:'{}'});closeDialogs();await refresh();toast(state.lang==='ru'?'Заказ отменён':'Order cancelled');render()}
async function switchPersona(p){state.persona=p;localStorage.setItem('antiqua_persona',p);closeDialogs();await refresh();navTo('account')}
async function saveDraft(form){const payload=draftPayload(form);if(state.activeDraft){await api(`/api/seller/drafts/${state.activeDraft}`,{method:'PATCH',body:JSON.stringify(payload)})}else{const flat={titleEn:payload.title.en,titleRu:payload.title.ru,categoryEn:payload.category.en,categoryRu:payload.category.ru,makerEn:payload.maker.en,makerRu:payload.maker.ru,periodEn:payload.period.en,periodRu:payload.period.ru,originEn:payload.origin.en,originRu:payload.origin.ru,materialsEn:payload.materials.en,materialsRu:payload.materials.ru,dimensionsEn:payload.dimensions.en,dimensionsRu:payload.dimensions.ru,descriptionEn:payload.description.en,descriptionRu:payload.description.ru,provenanceEn:payload.provenance.en,provenanceRu:payload.provenance.ru,conditionEn:payload.condition.en,conditionRu:payload.condition.ru,media:payload.media,saleRoute:payload.saleRoute,price:payload.price,estimateLow:payload.estimateLow,estimateHigh:payload.estimateHigh,shippingFrom:payload.shippingFrom};await api('/api/seller/drafts',{method:'POST',body:JSON.stringify(flat)})}closeDialogs();await refresh();toast(state.lang==='ru'?'Черновик сохранён':'Draft saved');render()}
async function submitDraft(id){try{await api(`/api/seller/drafts/${id}/submit`,{method:'POST',body:'{}'});await refresh();toast(t('review'));render()}catch(e){toast(e.data?.checklist?`${t('publicationChecklist')}: ${e.data.checklist.percent}%`:e.message)}}

function updateFilters(target){if(target.id==='catalogSearch')state.filters.q=target.value;if(target.id==='filterCategory')state.filters.category=target.value;if(target.id==='filterSeller')state.filters.seller=target.value;if(target.id==='filterSale')state.filters.saleType=target.value;if(target.id==='maxPrice')state.filters.maxPrice=target.value;if(target.id==='sortObjects')state.filters.sort=target.value;render()}

document.addEventListener('click',async e=>{
 const el=e.target.closest('button,a,[data-open-lot],[data-open-seller]');if(!el)return;
 try{
  if(el.matches('[data-nav]')){e.preventDefault();navTo(el.dataset.nav);return}
  if(el.matches('[data-route-seller]')){closeDialogs();navTo('seller',el.dataset.routeSeller);return}
  if(el.matches('[data-open-lot]')){if(e.target.closest('[data-save]'))return;await openLotDialog(el.dataset.openLot);return}
  if(el.matches('[data-open-seller]')){await openSellerDialog(el.dataset.openSeller);return}
  if(el.matches('[data-close-dialog]')){el.closest('dialog')?.close();return}
  if(el.matches('[data-save]')){e.stopPropagation();await toggleSave(el.dataset.save);return}
  if(el.matches('[data-collect]')){await collect(el.dataset.collect);return}
  if(el.matches('[data-register-auction]')){await registerAuction();return}
  if(el.matches('[data-bid]')){await placeBid(el.dataset.bid);return}
  if(el.matches('[data-buy]')){await buyNow(el.dataset.buy);return}
  if(el.matches('[data-offer]')){await makeOffer(el.dataset.offer);return}
  if(el.matches('[data-message-seller]')){await messageSeller(el.dataset.messageSeller);return}
  if(el.matches('[data-contact-seller]')){toast(state.lang==='ru'?'Открыт канал связи с дилером':'Dealer contact opened');return}
  if(el.matches('[data-open-notifications]')||el.id==='notificationButton'){openNotifications();return}
  if(el.matches('[data-read-all]')){await api('/api/notifications/read-all',{method:'POST',body:'{}'});await refresh();openNotifications();return}
  if(el.matches('[data-read-notification]')){await api(`/api/notifications/${el.dataset.readNotification}/read`,{method:'POST',body:'{}'});await refresh();openNotifications();return}
  if(el.matches('[data-open-order]')){await openOrderDialog(el.dataset.openOrder);return}
  if(el.matches('[data-shipping-quote]')){await shippingQuote(el.dataset.shippingQuote);return}
  if(el.matches('[data-cancel-order]')){await cancelOrder(el.dataset.cancelOrder);return}
  if(el.matches('[data-switch-persona]')){await switchPersona(el.dataset.switchPersona);return}
  if(el.matches('[data-new-draft]')){openDraftDialog();return}
  if(el.matches('[data-edit-draft]')){const d=state.client.seller?.drafts?.find(x=>x.id===el.dataset.editDraft);openDraftDialog(d);return}
  if(el.matches('[data-submit-draft]')){await submitDraft(el.dataset.submitDraft);return}
  if(el.matches('[data-clear-filters]')){state.filters={q:'',category:'ALL',seller:'ALL',saleType:'ALL',maxPrice:'',sort:'featured'};render();return}
 }catch(err){toast(err.message)}
});
document.addEventListener('input',e=>{if(['catalogSearch','maxPrice'].includes(e.target.id))updateFilters(e.target)});
document.addEventListener('change',e=>{if(['filterCategory','filterSeller','filterSale','sortObjects'].includes(e.target.id))updateFilters(e.target)});
document.addEventListener('submit',async e=>{if(e.target.id==='draftForm'){e.preventDefault();try{await saveDraft(e.target)}catch(err){toast(err.message)}}});
$('#langButton').onclick=()=>{state.lang=state.lang==='ru'?'en':'ru';localStorage.setItem('antiqua_lang',state.lang);render()};
$('#personaButton').onclick=()=>switchPersona(state.persona==='BUYER'?'SELLER':'BUYER');
$('#notificationButton').onclick=()=>openNotifications();
window.addEventListener('hashchange',render);

await refresh();render();
setInterval(async()=>{try{await refresh();updateChrome()}catch{}},30000);
