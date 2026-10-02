import {safe,copy,local} from './core.js';

const q=(s,r=document)=>r.querySelector(s);
const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n};
const route=()=>{const r=location.hash.slice(1).split('/')[0]||'gallery';return r==='shop'?'gallery':r};
const canonical=v=>String(v?.en??v??'').trim();
const money=(value,currency='EUR')=>new Intl.NumberFormat(document.documentElement.lang==='ru'?'ru-RU':'en-GB',{style:'currency',currency,maximumFractionDigits:0}).format(Number(value)||0);
let sequence=0;

function updateBrandShell(){
 const line=q('#brandLine'),promise=q('#brandPromise'),footer=q('#footerCopy'),footerPromise=q('#footerPromise');
 if(line)line.textContent=copy('ANTIQUA · МИР ИСКУССТВА','ANTIQUA · WORLD OF ART');
 if(promise)promise.textContent=copy('Художники · Произведения · Знание · Коллекционирование','Artists · Artworks · Knowledge · Collecting');
 if(footer)footer.textContent=copy('Мир искусства','World of Art');
 if(footerPromise)footerPromise.textContent=copy('Живопись · Графика · Гравюра · История · Коллекционирование','Painting · Works on paper · Prints · History · Collecting');
}

function listingFor(catalog,id){return (catalog.listings||[]).find(x=>x.lotId===id)||null}
function auctionFor(catalog,id){return (catalog.auctions||[]).find(x=>x.lotId===id&&x.state!=='CLOSED')||null}
function displayPrice(catalog,lot){const a=auctionFor(catalog,lot.id),l=listingFor(catalog,lot.id);if(a)return copy('Текущая ставка ','Current bid ')+money(a.currentBid,a.currency);if(l)return money(l.price,l.currency);return copy('Смотреть паспорт','View passport')}

function objectCard(catalog,lot,saved,reason='',{dismissible=false}={}){
 const card=make('article','culture-object-card');
 const media=make('div','culture-object-media'),open=make('button','culture-object-open');open.type='button';open.dataset.passport=lot.id;open.setAttribute('aria-label',local(lot.title));
 const img=make('img');img.loading='lazy';img.decoding='async';img.src=lot.image||'';img.alt=local(lot.title);open.append(img);media.append(open);
 const save=make('button','culture-object-save '+(saved?'active':''),saved?'♥':'♡');save.type='button';save.dataset.save=lot.id;save.setAttribute('aria-label',copy('Сохранить','Save'));media.append(save);
 card.append(media);
 const body=make('div','culture-object-copy');
 if(reason)body.append(make('div','culture-match-reason',reason));
 body.append(make('div','culture-object-maker',local(lot.maker)));
 body.append(make('h3','',local(lot.title)));
 body.append(make('p','culture-object-meta',[local(lot.period),local(lot.origin)].filter(Boolean).join(' · ')));
 body.append(make('strong','culture-object-price',displayPrice(catalog,lot)));
 const trust=make('div','culture-object-trust');trust.append(make('span','',copy('Паспорт произведения','Artwork Passport')));if(lot.conditionGrade)trust.append(make('span','',copy('Состояние ','Condition ')+lot.conditionGrade));body.append(trust);
 if(dismissible){const dismiss=make('button','text-button culture-object-dismiss',copy('Не моё','Not for me'));dismiss.type='button';dismiss.dataset.tasteDismiss=lot.id;body.append(dismiss)}
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
 const copyBox=make('div','culture-hero-copy');copyBox.append(make('div','eyebrow','ANTIQUA'));copyBox.append(make('h1','',copy('Мир искусства','World of Art')));copyBox.append(make('p','',copy('Живопись, графика и гравюра — через художников, историю, происхождение, коллекции и новые открытия.','Painting, works on paper and prints through artists, history, provenance, collections and discovery.')));copyBox.append(make('small','',copy('Открывайте произведения, изучайте художников, собирайте собственный взгляд на искусство и находите события вокруг него.','Discover works, explore artists, build your own view of art and find the events around it.')));
 const actions=make('div','culture-hero-actions'),discover=make('button','primary-button',copy('Открывать искусство','Discover art'));discover.type='button';discover.addEventListener('click',()=>q('#cultureCatalogue')?.scrollIntoView({behavior:'smooth',block:'start'}));actions.append(discover);if(f.live){const link=make('a','secondary-button culture-hero-link',copy('Кураторская история','Curated story'));link.href='#exhibition/'+f.live.id;actions.append(link)}copyBox.append(actions);section.append(copyBox);
 const media=make('div','culture-hero-media');if(f.cover){const open=make('button');open.type='button';open.dataset.passport=f.cover.id;const img=make('img');img.src=f.cover.image||'';img.alt=local(f.cover.title);open.append(img);media.append(open);const caption=make('div','culture-hero-caption');caption.append(make('span','',local(f.cover.maker)));caption.append(make('strong','',local(f.cover.title)));caption.append(make('small','',[local(f.cover.period),local(f.cover.origin)].filter(Boolean).join(' · ')));media.append(caption)}section.append(media);return section
}

function tasteDimensionLabel(d){return({maker:copy('Художник / автор','Artist / creator'),department:copy('Категория','Category'),period:copy('Эпоха','Period'),origin:copy('Происхождение','Origin')})[d]||d}
function authorityTaste(data){
 const t=data.taste;if(!t?.profile||!Array.isArray(t.recommendations))return null;const savedIds=new Set(data.client?.savedLots||[]);
 const items=t.recommendations.map(r=>{const lot=(data.catalog.lots||[]).find(x=>x.id===r.object?.id)||r.object;if(!lot)return null;const reasons=(r.reasons||[]).filter(x=>x.points>0).slice(0,2).map(x=>tasteDimensionLabel(x.dimension)+': '+local(x.value));return{lot,reasons,affinityPoints:r.affinityPoints||0}}).filter(Boolean);
 const tags=['maker','department','period'].flatMap(d=>(t.profile.dimensions?.[d]||[]).filter(x=>x.points>0).slice(0,2).map(x=>({label:local(x.value),points:x.points}))).filter((x,i,a)=>a.findIndex(y=>y.label===x.label)===i).slice(0,5);
 return{profile:t.profile,items,tags,savedIds}
}
function taste(data){
 const authority=authorityTaste(data),fallback=authority?null:tasteItems(data.catalog,data.client),section=make('section','page culture-taste');section.dataset.cultureFeed='';
 const head=make('div','culture-section-head'),intro=make('div'),has=authority?authority.profile.signalCount>0:fallback.profile.saved.length>0;
 intro.append(make('div','eyebrow',has?copy('ВАШ ВКУС','YOUR TASTE'):copy('НАЧНИТЕ ОТСЮДА','START HERE')));
 intro.append(make('h2','',has?copy('Подобрано по вашим действиям','Based on your actions'):copy('Работы, с которых легко начать','Works worth discovering first')));
 intro.append(make('p','',authority?(has?copy('Сохранения, глубина просмотра, подписки, переговоры, просмотры и покупки складываются в объяснимую карту вкуса. Цена не участвует в подборе.','Saves, engaged views, follows, negotiations, viewings and purchases form an explainable taste map. Price is not used for matching.'):copy('Исследуйте и сохраняйте произведения. Antiqua строит карту вкуса только из ваших явных действий.','Explore and save artworks. Antiqua builds your taste map only from your explicit actions.')):(has?copy('Подбор объяснимый: мастер, категория, эпоха и происхождение. Никакого скрытого рейтинга.','Explainable matching by maker, category, period and origin. No hidden score.'):copy('Сохраняйте то, что нравится. Antiqua постепенно соберёт карту вашего вкуса и будет объяснять каждую рекомендацию.','Save what you like. Antiqua will gradually build your taste map and explain every recommendation.'))));
 if(authority){const explain=make('button','text-link culture-taste-explain',copy('Почему это здесь','Why this is here'));explain.type='button';explain.dataset.tasteExplain='';intro.append(explain)}head.append(intro);
 if(has){const count=authority?authority.profile.signalCount:fallback.profile.saved.length;head.append(make('span','culture-saved-count',String(count)+' '+copy('сигналов','signals')))}section.append(head);
 const tags=authority?authority.tags:[...fallback.profile.maker,...fallback.profile.department,...fallback.profile.period].filter((x,i,a)=>a.findIndex(y=>y.key===x.key)===i).slice(0,5).map(x=>({label:x.label,points:null}));
 if(tags.length){const rail=make('div','culture-taste-tags');for(const x of tags)rail.append(make('span','',x.label+(x.points!=null?' · '+(x.points>0?'+':'')+x.points:'')));section.append(rail)}
 const items=authority?authority.items:fallback.items,grid=make('div','culture-feed-grid');for(const item of items){const wrap=make('div','culture-feed-item'),saved=authority?authority.savedIds.has(item.lot.id):fallback.profile.ids.has(item.lot.id);wrap.append(objectCard(data.catalog,item.lot,saved,item.reasons.slice(0,2).join(' · '),{dismissible:Boolean(authority)}));grid.append(wrap)}section.append(grid);return section
}

function drop(data){
 const exhibition=(data.exhibitions||[]).find(x=>x.status==='LIVE')||(data.exhibitions||[])[0];if(!exhibition)return null;const f=feature(data),section=make('section','page culture-drop');section.dataset.cultureDrop='';
 const media=make('div','culture-drop-media');if(f.cover){const img=make('img');img.loading='lazy';img.src=f.cover.image||'';img.alt=local(f.cover.title);media.append(img)}section.append(media);
 const body=make('div','culture-drop-copy');body.append(make('div','eyebrow',copy('КУРАТОРСКИЙ ВЫПУСК · СЕЙЧАС','CURATED DROP · LIVE')));body.append(make('h2','',local(exhibition.title)));body.append(make('p','',local(exhibition.subtitle)||local(exhibition.curatorialStatement)||''));const link=make('a','primary-button link-button',copy('Открыть выпуск','Open the drop'));link.href='#exhibition/'+exhibition.id;body.append(link);section.append(body);return section
}

function editorial(data){
 const items=(data.editorial?.items||[]).slice(0,3);if(!items.length)return null;const section=make('section','page culture-editorial'),head=make('div','culture-section-head'),intro=make('div');intro.append(make('div','eyebrow','ANTIQUA EDITORIAL'));intro.append(make('h2','',copy('Журнал искусства','Art Journal')));intro.append(make('p','',copy('Истории художников, произведений, техник, выставок и новых имён, связанные с реальными работами и событиями.','Stories, materials and new names that lead back to real works, creators and events.')));head.append(intro);const all=make('a','text-link',copy('Открыть журнал','Open journal'));all.href='#journal';head.append(all);section.append(head);const grid=make('div','culture-editorial-grid');for(const story of items){const a=make('a','culture-editorial-card');a.href='#story/'+story.slug;const media=make('div','culture-editorial-media');if(story.heroImage){const img=make('img');img.loading='lazy';img.src=story.heroImage;img.alt='';media.append(img)}media.append(make('span','',String(story.storyType||'STORY').replaceAll('_',' ')));a.append(media);const body=make('div','culture-editorial-copy');body.append(make('div','micro','ANTIQUA EDITORIAL'));body.append(make('h3','',local(story.title)));body.append(make('p','',local(story.dek)));body.append(make('small','',story.byline?.name||'Antiqua Editorial'));a.append(body);grid.append(a)}section.append(grid);return section
}

function collections(data){
 const source=(data.collections||[]).slice(0,3);if(!source.length)return null;const section=make('section','page culture-collections'),head=make('div','culture-section-head'),intro=make('div');intro.append(make('div','eyebrow',copy('КОЛЛЕКЦИИ','COLLECTIONS')));intro.append(make('h2','',copy('Коллекции и личный взгляд','Collections and personal vision')));intro.append(make('p','',copy('Не каталог ради каталога, а связи между произведениями, художниками, эпохами и идеями.','Not catalogue categories, but relationships between artworks, artists, periods and ideas.')));head.append(intro);const all=make('a','text-link',copy('Все коллекции','All collections'));all.href='#collections';head.append(all);section.append(head);
 const grid=make('div','culture-collection-grid');for(const c of source){const a=make('a','culture-collection-card');a.href='#collection/'+c.id;const cover=c.items?.find(x=>x.objectId===c.coverObjectId)?.object||c.items?.[0]?.object;const media=make('div','culture-collection-cover');if(cover?.image){const img=make('img');img.loading='lazy';img.src=cover.image;img.alt='';media.append(img)}a.append(media);a.append(make('span','',String(c.collectionType||'COLLECTION').replaceAll('_',' ')));a.append(make('h3','',local(c.title)));a.append(make('p','',local(c.summary)));a.append(make('small','',String(c.items?.length||0)+' '+copy('работ','works')));grid.append(a)}section.append(grid);return section
}

function refineCatalogue(catalogue){
 catalogue.id='cultureCatalogue';catalogue.classList.add('culture-catalogue');const eyebrow=q('.editorial-head .eyebrow',catalogue),intro=q('.editorial-head .muted',catalogue);if(eyebrow)eyebrow.textContent=copy('ГАЛЕРЕЯ','GALLERY');if(intro)intro.textContent=copy('Исследуйте живопись, графику и гравюру по художнику, периоду, технике и происхождению. Паспорт произведения, состояние, провенанс и аукционный контекст остаются рядом с каждой работой.','Explore painting, works on paper and prints by artist, period, technique and origin. Artwork passport, condition, provenance and auction context remain close to every work.');
}

async function decorate(){
 updateBrandShell();if(route()!=='gallery'||q('[data-culture-root]'))return;const catalogue=q('#app > .page.section');if(!catalogue)return;const ticket=++sequence;
 const [catalog,collectionsData,exhibitionsData,client,tasteData,editorialData]=await Promise.all([safe('/api/catalog?scope=FINE_ART'),safe('/api/collections'),safe('/api/exhibitions'),safe('/api/client-state'),safe('/api/taste/recommendations?limit=8&scope=FINE_ART'),safe('/api/editorial?limit=3')]);if(ticket!==sequence||route()!=='gallery'||!catalog)return;
 const data={catalog,collections:collectionsData?.collections||[],exhibitions:exhibitionsData?.exhibitions||[],client:client||{},taste:tasteData||null,editorial:editorialData||null};refineCatalogue(catalogue);
 const root=make('div','culture-discovery-root');root.dataset.cultureRoot='';root.append(hero(data));root.append(taste(data));const e=editorial(data);if(e)root.append(e);const d=drop(data);if(d)root.append(d);const c=collections(data);if(c)root.append(c);catalogue.before(root)
}

const observer=new MutationObserver(()=>{queueMicrotask(()=>decorate().catch(console.error))});
const app=q('#app');if(app)observer.observe(app,{childList:true});
window.addEventListener('hashchange',()=>setTimeout(()=>decorate().catch(console.error),0));
window.addEventListener('antiqua:culture-refresh',()=>{q('[data-culture-root]')?.remove();decorate().catch(console.error)});
decorate().catch(console.error);
