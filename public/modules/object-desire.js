import {safe,copy,local,status} from './core.js';

let requestSeq=0,bodyObserver=null,reorderQueued=false;
const q=(s,r=document)=>r?.querySelector?.(s)||null;
const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n};
const val=v=>String(local(v)||'').trim();

function factualWhy(o){
 const identity=[val(o.maker),val(o.period),val(o.origin)].filter(Boolean).join(' · ');
 const materials=val(o.materials),dimensions=val(o.dimensions);
 const first=identity?copy('Каталожная запись связывает предмет с ','The catalogue record connects the object with ')+identity+'.':'';
 const second=materials?copy('Материалы: ','Materials: ')+materials+(dimensions?' · '+dimensions:'')+'.':dimensions?copy('Размеры: ','Dimensions: ')+dimensions+'.':'';
 const third=copy('Ниже отдельно показаны происхождение, состояние, рыночные аналоги и доказательства паспорта — без смешения подтверждённых данных и маркетингового текста.','Provenance, condition, market comparables and Passport evidence are shown separately below, without blending documented data with marketing copy.');
 return [first,second,third].filter(Boolean).join(' ')
}

function trustTile(label,value,note){
 const d=make('div','v27-trust-tile');d.append(make('span','',label));d.append(make('strong','',value||'—'));if(note)d.append(make('small','',note));return d
}

function trustStrip(o,passport,market){
 const wrap=make('section','v27-trust-strip');wrap.id='dossierTrustV27';
 const provenanceEvents=Array.isArray(o.provenanceTimeline)?o.provenanceTimeline.length:0;
 const docs=Array.isArray(o.documents)?o.documents.length:0;
 const revisions=Array.isArray(passport?.revisionHistory)?passport.revisionHistory.length:0;
 const comps=Number(market?.summary?.comparables||market?.items?.length||0);
 wrap.append(
  trustTile(copy('Каталог','Catalogue'),status(o.catalogueStatus),copy('Статус каталожной записи','Catalogue record status')),
  trustTile(copy('Происхождение','Provenance'),provenanceEvents?String(provenanceEvents)+' '+copy('событ.','events'):'—',copy('Хронология в паспорте','Timeline in Passport')),
  trustTile(copy('Состояние','Condition'),o.conditionGrade||val(o.conditionLabel)||'—',copy('См. полный отчёт ниже','See full report below')),
  trustTile(copy('Рынок','Market'),comps?String(comps)+' '+copy('аналог.','comparables'):copy('Нет аналогов','No comparables'),copy('Только объяснимые сопоставления','Explainable matches only')),
  trustTile(copy('Доказательства','Evidence'),docs||revisions?String(docs+revisions)+' '+copy('запис.','records'):'—',copy('Документы + история паспорта','Documents + Passport history'))
 );
 return wrap
}

function whyBlock(o){
 const s=make('section','v27-why');s.id='dossierWhyV27';
 s.append(make('div','eyebrow',copy('ПОЧЕМУ СТОИТ РАССМОТРЕТЬ','WHY LOOK CLOSER')));
 s.append(make('h3','',copy('Предмет прежде данных','The object before the data')));
 s.append(make('p','',factualWhy(o)));
 return s
}

function moveStory(body){
 const overview=q('#dossier-overview',body);if(!overview||q('#dossierStoryV27',body))return;
 const story=make('section','v27-story');story.id='dossierStoryV27';
 story.append(make('div','eyebrow',copy('ИСТОРИЯ ПРЕДМЕТА','OBJECT STORY')));
 story.append(make('h3','',copy('Что говорит каталожная запись','What the catalogue record says')));
 const children=[...overview.children].filter(x=>!x.classList.contains('dossier-facts'));
 children.forEach(x=>story.append(x));
 const facts=overview.querySelector('.dossier-facts');if(facts){overview.insertBefore(make('div','eyebrow',copy('ДЕТАЛИ','DETAILS')),facts);overview.insertBefore(make('h3','',copy('Факты и параметры','Facts and specifications')),facts)}
 overview.before(story)
}

function rebuildTabs(body){
 const nav=q('.dossier-tabs',body);if(!nav)return;
 const items=[
  ['#dossier-provenance',copy('Происхождение','Provenance')],
  ['#dossier-condition',copy('Состояние','Condition')],
  q('#dossierMarketIntelligenceV25',body)?['#dossierMarketIntelligenceV25',copy('Рынок','Market')]:null,
  q('#dossierStoryV27',body)?['#dossierStoryV27',copy('История','Story')]:null,
  q('#dossierSimilarV18',body)?['#dossierSimilarV18',copy('Похожие','Related')]:null,
  ['#dossier-overview',copy('Детали','Details')],
  ['#dossier-evidence',copy('Паспорт','Passport')]
 ].filter(Boolean);
 nav.replaceChildren(...items.map(([href,label])=>{const a=make('a','',label);a.href=href;return a}));
}

function reorder(body){
 if(!body||!body.isConnected)return;moveStory(body);
 const tabs=q('.dossier-tabs',body),disclaimer=q('.dossier-disclaimer',body);if(!tabs)return;
 const order=['#dossier-provenance','#dossier-condition','#dossierMarketIntelligenceV25','#dossierStoryV27','#dossierSimilarV18','#dossier-overview','#dossier-evidence'];
 let cursor=tabs;
 for(const selector of order){const node=q(selector,body);if(node){if(cursor.nextElementSibling!==node)cursor.after(node);cursor=node}}
 if(disclaimer&&cursor.nextElementSibling!==disclaimer)cursor.after(disclaimer);rebuildTabs(body)
}

function scheduleReorder(body){if(reorderQueued)return;reorderQueued=true;queueMicrotask(()=>{reorderQueued=false;reorder(body)})}

function observeAsyncSections(body){
 bodyObserver?.disconnect();bodyObserver=new MutationObserver(()=>scheduleReorder(body));bodyObserver.observe(body,{childList:true,subtree:false})
}

async function enhancePassport(event){
 const id=String(event.detail?.id||'');if(!id)return;const seq=++requestSeq;
 const dialog=q('#dialog[open]')||q('#dialog'),dossier=q('.native-dossier',dialog),body=q('.dossier-body',dossier);if(!dossier||!body)return;
 dossier.classList.add('desire-v27');
 const [passport,market]=await Promise.all([safe('/api/lots/'+encodeURIComponent(id)+'/passport'),safe('/api/lots/'+encodeURIComponent(id)+'/comparables?limit=8')]);
 if(seq!==requestSeq||!passport?.lot||!body.isConnected)return;const o=passport.lot;
 q('#dossierWhyV27',body)?.remove();q('#dossierTrustV27',body)?.remove();
 const toolbar=q('.dossier-toolbar',body),commerce=q('.dossier-commerce-dock',body),tabs=q('.dossier-tabs',body);
 const why=whyBlock(o),trust=trustStrip(o,passport,market);
 if(toolbar){toolbar.after(why);if(commerce){why.after(commerce);commerce.after(trust)}else why.after(trust)}else if(tabs){tabs.before(why,trust)}
 const eyebrow=q('.dossier-toolbar .eyebrow',body);if(eyebrow)eyebrow.textContent=copy('КУЛЬТУРА ВЕЩЕЙ · ','CULTURE OF OBJECTS · ')+String(o.objectId||id);
 moveStory(body);scheduleReorder(body);observeAsyncSections(body)
}

window.addEventListener('antiqua:passport',e=>enhancePassport(e).catch(console.error));
q('#dialog')?.addEventListener('close',()=>{requestSeq++;bodyObserver?.disconnect();bodyObserver=null});
