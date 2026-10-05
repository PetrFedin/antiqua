import {api,safe,copy,esc,local,toast} from './core.js';

const eventTypeLabel=x=>({
 OPENING:copy('Открытие','Opening'),ARTIST_TALK:copy('Встреча с художником','Artist talk'),CURATOR_TOUR:copy('Кураторская экскурсия','Curator tour'),LECTURE:copy('Лекция','Lecture'),WORKSHOP:copy('Мастер-класс','Workshop'),AUCTION_PREVIEW:copy('Предаукционный просмотр','Auction preview'),AUCTION:copy('Аукцион','Auction'),FAIR_DAY:copy('Арт-ярмарка','Art fair'),PRIVATE_VIEW:copy('Закрытый просмотр','Private view'),BOOK_LAUNCH:copy('Презентация книги','Book launch'),RESEARCH_SESSION:copy('Исследовательская сессия','Research session'),SCREENING:copy('Показ','Screening'),PERFORMANCE:copy('Перформанс','Performance'),OTHER:copy('Событие','Event')
})[x]||String(x||'').replaceAll('_',' ');

const dt=(value,allDay=false)=>{
 if(!value)return copy('Дата уточняется','Date to be announced');
 const d=new Date(value),locale=document.documentElement.lang==='ru'?'ru-RU':'en-GB';
 return new Intl.DateTimeFormat(locale,allDay?{weekday:'short',day:'numeric',month:'long'}:{weekday:'short',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}).format(d)
};
const range=e=>{
 const a=dt(e.startsAt,e.allDay);if(!e.endsAt)return a;
 const b=new Date(e.endsAt),sameDay=new Date(e.startsAt).toDateString()===b.toDateString(),locale=document.documentElement.lang==='ru'?'ru-RU':'en-GB';
 return sameDay&&!e.allDay?a+'–'+new Intl.DateTimeFormat(locale,{hour:'2-digit',minute:'2-digit'}).format(b):a+' — '+dt(e.endsAt,e.allDay)
};
const place=e=>[local(e.venueName),local(e.city),e.organization?.name].filter(Boolean).join(' · ');
const entityType=e=>e.entryType==='EXHIBITION'?'EXHIBITION':'EVENT';
const href=e=>e.entryType==='EXHIBITION'?'#exhibition/'+encodeURIComponent(e.id):'#event/'+encodeURIComponent(e.slug||e.id);
const currentState=(mine,e)=>(mine?.entries||[]).find(x=>x.id===e.id&&x.entryType===e.entryType)?.participation?.state||'NONE';

function stateButtons(e,state='NONE',authenticated=false){
 const id=esc(e.id),type=entityType(e);
 if(!authenticated)return `<div class="calendar-state-actions calendar-state-actions-guest">
  <a href="#account" data-calendar-signin>♡ ${copy('Сохранить','Save')}</a>
  <a href="#account" data-calendar-signin>＋ ${copy('В план','Plan')}</a>
  <a href="#account" data-calendar-signin>✓ ${copy('Был','Visited')}</a>
 </div>`;
 return `<div class="calendar-state-actions" data-calendar-actions data-entity-type="${type}" data-entity-id="${id}">
  <button type="button" data-calendar-state="SAVED" class="${state==='SAVED'?'active':''}">♡ ${copy('Сохранить','Save')}</button>
  <button type="button" data-calendar-state="PLANNED" class="${state==='PLANNED'?'active':''}">＋ ${copy('В план','Plan')}</button>
  <button type="button" data-calendar-state="VISITED" class="${state==='VISITED'?'active':''}">✓ ${copy('Был','Visited')}</button>
 </div>`
}
function eventCard(e,mine,authenticated=false){
 const status=e.classification||{},state=currentState(mine,e);
 return `<article class="calendar-card ${e.entryType==='EXHIBITION'?'exhibition':''}">
  <a class="calendar-card-main" href="${href(e)}">
   <div class="calendar-date-rail"><strong>${esc(new Intl.DateTimeFormat(document.documentElement.lang==='ru'?'ru-RU':'en-GB',{day:'2-digit'}).format(new Date(e.startsAt||Date.now())))}</strong><span>${esc(new Intl.DateTimeFormat(document.documentElement.lang==='ru'?'ru-RU':'en-GB',{month:'short'}).format(new Date(e.startsAt||Date.now())))}</span></div>
   <div class="calendar-card-copy"><div class="micro">${e.entryType==='EXHIBITION'?copy('ВЫСТАВКА','EXHIBITION'):esc(eventTypeLabel(e.eventType))}${status.openNow?' · '+copy('СЕЙЧАС','OPEN NOW'):status.closingSoon?' · '+copy('СКОРО ЗАКРЫТИЕ','CLOSING SOON'):''}</div><h3>${esc(local(e.title))}</h3><p>${esc(local(e.summary)||local(e.description))}</p><div class="calendar-meta"><span>${esc(range(e))}</span>${place(e)?`<span>${esc(place(e))}</span>`:''}</div></div>
  </a>
  <div class="calendar-card-footer">${stateButtons(e,state,authenticated)}${e.entryType==='EVENT'?`<a class="calendar-ics-link" href="/api/calendar/events/${encodeURIComponent(e.id)}/ics">${copy('ICS','ICS')}</a>`:''}</div>
 </article>`
}

function section(title,subtitle,items,mine,authenticated=false,{className=''}={}){
 if(!items.length)return'';
 return `<section class="calendar-section ${className}"><div class="calendar-section-head"><div><div class="eyebrow">${esc(subtitle)}</div><h2>${esc(title)}</h2></div><span>${items.length}</span></div><div class="calendar-list">${items.map(x=>eventCard(x,mine,authenticated)).join('')}</div></section>`
}

function conflictPanel(mine){
 const cs=mine?.conflicts||[];if(!cs.length)return'';
 return `<section class="calendar-conflicts"><div class="eyebrow">${copy('КОНФЛИКТЫ ПЛАНА','PLAN CONFLICTS')}</div><h2>${copy('Два события идут одновременно','Two events overlap')}</h2><div>${cs.map(c=>`<article><strong>${esc(local(c.a.title))}</strong><span>↔</span><strong>${esc(local(c.b.title))}</strong><small>${esc(dt(c.a.startsAt))}</small></article>`).join('')}</div><p>${copy('Antiqua только показывает конфликт. Решение, что оставить в плане, остаётся за вами.','Antiqua only identifies the overlap. You decide what stays in your plan.')}</p></section>`
}

export async function calendarView(){
 const [calendar,mine,me]=await Promise.all([api('/api/calendar'),safe('/api/calendar/mine'),safe('/api/auth/me')]),entries=calendar.entries||[],now=Date.now();
 const localDay=v=>{const d=new Date(v),n=new Date();return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth()&&d.getDate()===n.getDate()},today=entries.filter(x=>x.entryType==='EVENT'&&localDay(x.startsAt)),week=entries.filter(x=>x.entryType==='EVENT'&&!localDay(x.startsAt)&&x.classification?.thisWeek),exhibitions=entries.filter(x=>x.entryType==='EXHIBITION'&&(x.classification?.openNow||Date.parse(x.startsAt||0)>now)).slice(0,18),later=entries.filter(x=>x.entryType==='EVENT'&&!x.classification?.thisWeek&&Date.parse(x.startsAt||0)>now).slice(0,12);
 const planned=(mine?.entries||[]).filter(x=>x.participation?.state==='PLANNED');
 const authenticated=Boolean(me?.account);
 return `<section class="page cultural-calendar-page"><header class="calendar-hero"><div><div class="eyebrow">ANTIQUA · ART CALENDAR</div><h1>${copy('Куда идти за искусством','Where art is happening')}</h1><p>${copy('Выставки, открытия, встречи с художниками, лекции, экскурсии, просмотры и ярмарки — в одном культурном календаре, связанном с реальными художниками, галереями и произведениями.','Exhibitions, openings, artist talks, lectures, tours, private views and fairs in one cultural calendar linked to real artists, galleries and artworks.')}</p></div><aside><strong>${copy('Не афиша ради афиши','More than an event listing')}</strong><span>${copy('Сохраните событие, поставьте его в план, экспортируйте в календарь и отметьте посещение. Antiqua покажет пересечения во времени, но не будет следить за вашей геолокацией.','Save an event, plan it, export it and mark it visited. Antiqua flags time overlaps without tracking your location.')}</span>${me?.account?`<a class="secondary-button" href="/api/calendar/mine.ics">${copy('Экспортировать мой план · ICS','Export my plan · ICS')}</a>`:`<a class="secondary-button" href="#account">${copy('Войти и собрать план','Sign in to build a plan')}</a>`}</aside></header>
 ${conflictPanel(mine)}
 ${planned.length?`<section class="calendar-plan-strip"><div><div class="eyebrow">${copy('МОЙ ПЛАН','MY PLAN')}</div><h2>${planned.length} ${copy('событий запланировано','planned')}</h2></div><div class="calendar-plan-chips">${planned.slice(0,8).map(x=>`<a href="${href(x)}"><strong>${esc(local(x.title))}</strong><span>${esc(dt(x.startsAt))}</span></a>`).join('')}</div></section>`:''}
 ${section(copy('Сегодня','Today'),copy('СЕГОДНЯ','TODAY'),today,mine,authenticated)}
 ${section(copy('В ближайшие семь дней','Next seven days'),copy('НА ЭТОЙ НЕДЕЛЕ','THIS WEEK'),week,mine,authenticated)}
 ${section(copy('Выставки сейчас и дальше','Exhibitions open and upcoming'),copy('ВЫСТАВКИ','EXHIBITIONS'),exhibitions,mine,authenticated,{className:'calendar-exhibitions'})}
 ${section(copy('Дальше по календарю','Later'),copy('ВПЕРЕДИ','UPCOMING'),later,mine,authenticated)}
 ${!today.length&&!week.length&&!exhibitions.length&&!later.length?`<div class="calendar-empty"><strong>${copy('Календарь пока пуст','Calendar is empty for now')}</strong><span>${copy('Публичные события появляются только после проверки записи.','Public events appear only after the record has been reviewed.')}</span></div>`:''}
 <section class="calendar-principles"><div><strong>${copy('Источник виден','Source-aware')}</strong><span>${copy('Событие публикуется как отдельная проверенная запись и может быть связано с официальным источником.','Each event is a reviewed record and may link back to its official source.')}</span></div><div><strong>${copy('Выставка ≠ событие','Exhibition ≠ event')}</strong><span>${copy('Выставка живёт неделями, а opening, tour и talk — отдельные временные точки внутри неё.','An exhibition can last weeks; openings, tours and talks are distinct moments inside it.')}</span></div><div><strong>${copy('История посещений приватна','Visit history is private')}</strong><span>${copy('Saved / Planned / Visited принадлежат вашему аккаунту и не превращаются в публичные check-ins.','Saved / Planned / Visited belong to your account and never become public check-ins.')}</span></div></section></section>`
}

export async function calendarEventPage(id){
 const [d,mine,me]=await Promise.all([api('/api/calendar/events/'+encodeURIComponent(id)),safe('/api/calendar/mine'),safe('/api/auth/me')]),e=d.event,state=currentState(mine,e),authenticated=Boolean(me?.account);
 return `<section class="page calendar-event-page"><a class="text-link" href="#events">← ${copy('Арт-календарь','Art Calendar')}</a><header class="calendar-event-hero"><div><div class="eyebrow">${esc(eventTypeLabel(e.eventType))}</div><h1>${esc(local(e.title))}</h1><p>${esc(local(e.summary)||local(e.description))}</p></div><aside><strong>${esc(range(e))}</strong><span>${esc(place(e)||copy('Онлайн / место уточняется','Online / venue to be announced'))}</span>${e.admissionNote?.en||e.admissionNote?.ru?`<span>${esc(local(e.admissionNote))}</span>`:''}</aside></header>
 <section class="calendar-event-actions">${stateButtons(e,state,authenticated)}<a class="secondary-button" href="/api/calendar/events/${encodeURIComponent(e.id)}/ics">${copy('Добавить в календарь · ICS','Add to calendar · ICS')}</a>${e.bookingUrl?`<a class="primary-button" href="${esc(e.bookingUrl)}" target="_blank" rel="noopener">${copy('Бронирование / билет','Booking / ticket')}</a>`:''}</section>
 <section class="calendar-event-grid"><article><div class="eyebrow">${copy('О СОБЫТИИ','ABOUT')}</div><p>${esc(local(e.description)||local(e.summary))}</p></article><article><div class="eyebrow">${copy('МЕСТО','VENUE')}</div><p>${esc(place(e)||copy('Онлайн','Online'))}</p>${e.addressLine?`<small>${esc(e.addressLine)}</small>`:''}</article><article><div class="eyebrow">${copy('ПРОИСХОЖДЕНИЕ ЗАПИСИ','RECORD SOURCE')}</div><p>${e.publicSourceUrl?copy('Есть ссылка на публичный источник.','A public source link is attached.'):copy('Источник не опубликован.','No public source link is published.')}</p>${e.publicSourceUrl?`<a class="text-link" href="${esc(e.publicSourceUrl)}" target="_blank" rel="noopener">${copy('Открыть источник','Open source')}</a>`:''}</article></section>
 ${e.exhibitionId?`<section class="calendar-linked-exhibition"><div><div class="eyebrow">${copy('СВЯЗАННАЯ ВЫСТАВКА','RELATED EXHIBITION')}</div><h2>${copy('Событие является частью выставочной программы','This event belongs to an exhibition programme')}</h2></div><a class="secondary-button" href="#exhibition/${encodeURIComponent(e.exhibitionId)}">${copy('Открыть выставку','Open exhibition')}</a></section>`:''}</section>`
}

export function bindCulturalCalendar(root=document){
 root.querySelectorAll?.('[data-calendar-state]').forEach(button=>{
  if(button.dataset.bound)return;button.dataset.bound='1';button.addEventListener('click',async ev=>{ev.preventDefault();ev.stopPropagation();const actions=button.closest('[data-calendar-actions]'),state=button.dataset.calendarState,entityType=actions?.dataset.entityType,entityId=actions?.dataset.entityId;if(!entityType||!entityId)return;button.disabled=true;try{const me=await safe('/api/auth/me');if(!me?.account){toast(copy('Войдите, чтобы сохранить событие.','Sign in to save events.'));location.hash='account';return}const r=await api('/api/calendar/participation',{method:'POST',body:JSON.stringify({entityType,entityId,state})});actions.querySelectorAll('[data-calendar-state]').forEach(x=>x.classList.toggle('active',x.dataset.calendarState===r.participation.state));toast(state==='PLANNED'?copy('Добавлено в план.','Added to your plan.'):state==='VISITED'?copy('Отмечено как посещённое.','Marked as visited.'):copy('Сохранено.','Saved.'))}catch(err){toast(err.status===401?copy('Войдите, чтобы сохранить событие.','Sign in to save events.'):err.message)}finally{button.disabled=false}})
 })
}
