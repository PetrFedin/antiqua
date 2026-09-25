import {safe,copy,local} from './core.js';

const q=(s,r=document)=>r.querySelector(s);
const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n};
const route=()=>location.hash.slice(1).split('/')[0]||'shop';
const canonical=v=>String(v?.en??v??'').trim();
const money=(value,currency='EUR')=>new Intl.NumberFormat(document.documentElement.lang==='ru'?'ru-RU':'en-GB',{style:'currency',currency,maximumFractionDigits:0}).format(Number(value)||0);
let sequence=0;

function updateBrandShell(){
 const line=q('#brandLine'),promise=q('#brandPromise'),footer=q('#footerCopy'),footerPromise=q('#footerPromise');
 if(line)line.textContent=copy('ANTIQUA · КУЛЬТУРА ВЕЩЕЙ','ANTIQUA · CULTURE OF OBJECTS');
 if(promise)promise.textContent=copy('Вкус · История · Происхождение · Коллекционирование','Taste · History · Provenance · Collecting');
 if(footer)footer.textContent=copy('Культура вещей','Culture of Objects');
 if(footerPromise)footerPromise.textContent=copy('Вкус · Индивидуальность · Знание · Происхождение · Удовольствие находки','Taste · Individuality · Knowledge · Provenance · The pleasure of discovery');
}

function listingFor(catalog,id){return (catalog.listings||[]).find(x=>x.lotId===id)||null}
function auctionFor(catalog,id){return (catalog.auctions||[]).find(x=>x.lotId===id&&x.state!=='CLOSED')||null}
function displayPrice(catalog,lot){const a=auctionFor(catalog,lot.id),l=listingFor(catalog,lot.id);if(a)return copy('Текущая ставка ','Current bid ')+money(a.currentBid,a.currency);if(l)return money(l.price,l.currency);return copy('Смотреть паспорт','View passport')}

function objectCard(catalog,lot,saved,reason=''){
 const card=make('article','culture-object-card');
 const media=make('button','culture-object-media');media.type='button';media.dataset.passport=lot.id;media.setAttribute('aria-label',local(lot.title));
 const img=make('img');img.loading='lazy';img.decoding='async';img.src=lot.image||'';img.alt=local(lot.title);media.append(img);
 const save=make('button','culture-object-save '+(saved?'active':''),saved?'♥':'♡');save.type='button';save.dataset.save=lot.id;save.setAttribute('aria-label',copy('Сохранить','Save'));media.append(save);
 card.append(media);
 const body=make('div','culture-object-copy');
 if(reason)body.append(make('div','culture-match-reason',reason));
 body.append(make('div','culture-object-maker',local(lot.maker)));
 body.append(make('h3','',local(lot.title)));
 body.append(make('p','culture-object-meta',[local(lot.period),local(lot.origin)].filter(Boolean).join(' · ')));
 body.append(make('strong','culture-object-price',displayPrice(catalog,lot)));
 const trust=make('div','culture-object-trust');trust.append(make('span','',copy('Паспорт предмета','Object Passport')));if(lot.conditionGrade)trust.append(make('span','',copy('Состояние ','Condition ')+lot.conditionGrade));body.append(trust);
 card.append(body);return card
}

function rank(saved,field){
 const counts=new Map();
 for(const lot of saved){const key=canonical(lot[field]);if(!key)continue;const prev=counts.get(key)||{key,label:local(lot[field]),count:0};prev.count++;counts.set(key,prev)}
 return [...counts.values()].sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label)).slice(0,3)
}

function tasteModel(catalog,client){
 const ids=new Set(client?.savedLots||[]),saved=(catalog.lots||[]).filter(x=>ids.has(x.id));
 return{ids,saved,maker:rank(saved,'maker'),department:rank(saved,'department'),period:rank(saved,'period'),origin:rank(saved,'origin')}
}

function tasteItems(catalog,client,limit=4){
 const profile=tasteModel(catalog,client),all=(catalog.lots||[]).filter(x=>!profile.ids.has(x.id));
 if(!profile.saved.length){const seen=new Set(),items=[];for(const lot of all){const key=canonical(lot.department)||lot.id;if(seen.has(key))continue;seen.add(key);items.push({lot,reasons:[]});if(items.length===limit)break}for(const lot of all){if(items.length===limit)break;if(!items.some(x=>x.lot.id===lot.id))items.push({lot,reasons:[]})}return{profile,items}}
 const has=(values,v)=>values.some(x=>x.key===canonical(v));
 const items=all.map(lot=>{const flags={maker:has(profile.maker,lot.maker),department:has(profile.department,lot.department),period:has(profile.period,lot.period),origin:has(profile.origin,lot.origin)},reasons=[];if(flags.maker)reasons.push(copy('Тот же мастер / атрибуция','Same maker / attribution'));if(flags.department)reasons.push(copy('Близкая категория','Related category'));if(flags.period)reasons.push(copy('Та же эпоха','Same period'));if(flags.origin)reasons.push(copy('То же происхождение','Same origin'));return{lot,flags,reasons}});
 items.sort((a,b)=>Number(b.flags.maker)-Number(a.flags.maker)||Number(b.flags.department)-Number(a.flags.department)||Number(b.flags.period)-Number(a.flags.period)||Number(b.flags.origin)-Number(a.flags.origin)||a.lot.id.localeCompare(b.lot.id));
 return{profile,items:items.slice(0,limit)}
}

function feature(data){
 const live=(data.exhibitions||[]).find(x=>x.status==='LIVE')||(data.exhibitions||[])[0]||null;
 const coverId=live?.coverObjectId||(data.collections||[])[0]?.coverObjectId;
 const cover=(data.catalog.lots||[]).find(x=>x.id===coverId)||(data.catalog.lots||[]).find(x=>x.image)||null;
 return{live,cover}
}

function hero(data){
 const f=feature(data),section=make('section','culture-hero');section.dataset.cultureHero='';
 const copyBox=make('div','culture-hero-copy');copyBox.append(make('div','eyebrow','ANTIQUA'));copyBox.append(make('h1','',copy('Культура вещей','Culture of Objects')));copyBox.append(make('p','',copy('Вкус, индивидуальность, знание, происхождение, статус находки и удовольствие охоты.','Taste, individuality, knowledge, provenance, the status of a find and the pleasure of the hunt.')));copyBox.append(make('small','',copy('Редкие предметы с историей — не архив прошлого, а часть сегодняшней жизни.','Rare objects with history — not an archive of the past, but part of life today.')));
 const actions=make('div','culture-hero-actions'),discover=make('button','primary-button',copy('Открывать предметы','Discover objects'));discover.type='button';discover.addEventListener('click',()=>q('#cultureCatalogue')?.scrollIntoView({behavior:'smooth',block:'start'}));actions.append(discover);if(f.live){const link=make('a','secondary-button culture-hero-link',copy('Кураторская история','Curated story'));link.href='#exhibition/'+f.live.id;actions.append(link)}copyBox.append(actions);section.append(copyBox);
 const media=make('div','culture-hero-media');if(f.cover){const open=make('button');open.type='button';open.dataset.passport=f.cover.id;const img=make('img');img.src=f.cover.image||'';img.alt=local(f.cover.title);open.append(img);media.append(open);const caption=make('div','culture-hero-caption');caption.append(make('span','',local(f.cover.maker)));caption.append(make('strong','',local(f.cover.title)));caption.append(make('small','',[local(f.cover.period),local(f.cover.origin)].filter(Boolean).join(' · ')));media.append(caption)}section.append(media);return section
}

function taste(data){
 const model=tasteItems(data.catalog,data.client),section=make('section','page culture-taste');section.dataset.cultureFeed='';
 const head=make('div','culture-section-head'),intro=make('div'),has=model.profile.saved.length>0;intro.append(make('div','eyebrow',has?copy('ВАШ ВКУС','YOUR TASTE'):copy('НАЧНИТЕ ОТСЮДА','START HERE')));intro.append(make('h2','',has?copy('Подобрано по вашим сохранениям','Based on what you saved'):copy('Предметы, с которых легко начать','Objects worth discovering first')));intro.append(make('p','',has?copy('Подбор объяснимый: мастер, категория, эпоха и происхождение. Никакого скрытого рейтинга.','Explainable matching by maker, category, period and origin. No hidden score.'):copy('Сохраняйте то, что нравится. Antiqua постепенно соберёт карту вашего вкуса и будет объяснять каждую рекомендацию.','Save what you like. Antiqua will gradually build your taste map and explain every recommendation.')));head.append(intro);if(has)head.append(make('span','culture-saved-count',String(model.profile.saved.length)+' '+copy('сохранено','saved')));section.append(head);
 const tags=[...model.profile.maker,...model.profile.department,...model.profile.period].filter((x,i,a)=>a.findIndex(y=>y.key===x.key)===i).slice(0,5);if(tags.length){const rail=make('div','culture-taste-tags');for(const x of tags)rail.append(make('span','',x.label+(x.count>1?' · '+x.count:'')));section.append(rail)}
 const grid=make('div','culture-feed-grid');for(const item of model.items){const wrap=make('div','culture-feed-item');wrap.append(objectCard(data.catalog,item.lot,model.profile.ids.has(item.lot.id),item.reasons.slice(0,2).join(' · ')));grid.append(wrap)}section.append(grid);return section
}

function drop(data){
 const exhibition=(data.exhibitions||[]).find(x=>x.status==='LIVE')||(data.exhibitions||[])[0];if(!exhibition)return null;const f=feature(data),section=make('section','page culture-drop');section.dataset.cultureDrop='';
 const media=make('div','culture-drop-media');if(f.cover){const img=make('img');img.loading='lazy';img.src=f.cover.image||'';img.alt=local(f.cover.title);media.append(img)}section.append(media);
 const body=make('div','culture-drop-copy');body.append(make('div','eyebrow',copy('КУРАТОРСКИЙ ВЫПУСК · СЕЙЧАС','CURATED DROP · LIVE')));body.append(make('h2','',local(exhibition.title)));body.append(make('p','',local(exhibition.subtitle)||local(exhibition.curatorialStatement)||''));const link=make('a','primary-button link-button',copy('Открыть выпуск','Open the drop'));link.href='#exhibition/'+exhibition.id;body.append(link);section.append(body);return section
}

function collections(data){
 const source=(data.collections||[]).slice(0,3);if(!source.length)return null;const section=make('section','page culture-collections'),head=make('div','culture-section-head'),intro=make('div');intro.append(make('div','eyebrow',copy('КОЛЛЕКЦИИ','COLLECTIONS')));intro.append(make('h2','',copy('Смотреть глазами коллекционеров','See through a collector’s eye')));intro.append(make('p','',copy('Не категории каталога, а связи между предметами, эпохами и идеями.','Not catalogue categories, but relationships between objects, periods and ideas.')));head.append(intro);const all=make('a','text-link',copy('Все коллекции','All collections'));all.href='#collections';head.append(all);section.append(head);
 const grid=make('div','culture-collection-grid');for(const c of source){const a=make('a','culture-collection-card');a.href='#collection/'+c.id;const cover=c.items?.find(x=>x.objectId===c.coverObjectId)?.object||c.items?.[0]?.object;const media=make('div','culture-collection-cover');if(cover?.image){const img=make('img');img.loading='lazy';img.src=cover.image;img.alt='';media.append(img)}a.append(media);a.append(make('span','',String(c.collectionType||'COLLECTION').replaceAll('_',' ')));a.append(make('h3','',local(c.title)));a.append(make('p','',local(c.summary)));a.append(make('small','',String(c.items?.length||0)+' '+copy('предметов','objects')));grid.append(a)}section.append(grid);return section
}

function refineCatalogue(catalogue){
 catalogue.id='cultureCatalogue';catalogue.classList.add('culture-catalogue');const eyebrow=q('.editorial-head .eyebrow',catalogue),intro=q('.editorial-head .muted',catalogue);if(eyebrow)eyebrow.textContent=copy('ВСЕ ПРЕДМЕТЫ','ALL OBJECTS');if(intro)intro.textContent=copy('Ищите точно, фильтруйте глубоко или просто продолжайте исследовать. Паспорт, состояние, происхождение и коммерческий статус остаются рядом с каждым предметом.','Search precisely, filter deeply, or simply keep exploring. Passport, condition, provenance and commercial status stay close to every object.');
}

async function decorate(){
 updateBrandShell();if(route()!=='shop'||q('[data-culture-root]'))return;const catalogue=q('#app > .page.section');if(!catalogue)return;const ticket=++sequence;
 const [catalog,collectionsData,exhibitionsData,client]=await Promise.all([safe('/api/catalog'),safe('/api/collections'),safe('/api/exhibitions'),safe('/api/client-state')]);if(ticket!==sequence||route()!=='shop'||!catalog)return;
 const data={catalog,collections:collectionsData?.collections||[],exhibitions:exhibitionsData?.exhibitions||[],client:client||{}};refineCatalogue(catalogue);
 const root=make('div','culture-discovery-root');root.dataset.cultureRoot='';root.append(hero(data));root.append(taste(data));const d=drop(data);if(d)root.append(d);const c=collections(data);if(c)root.append(c);catalogue.before(root)
}

const observer=new MutationObserver(()=>{queueMicrotask(()=>decorate().catch(console.error))});
const app=q('#app');if(app)observer.observe(app,{childList:true});
window.addEventListener('hashchange',()=>setTimeout(()=>decorate().catch(console.error),0));
window.addEventListener('antiqua:culture-refresh',()=>decorate().catch(console.error));
decorate().catch(console.error);
