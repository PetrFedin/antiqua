import {api,safe,copy,esc,local,toast} from './core.js';

const labels={
 ARTIST:['Художник','Artist'],GALLERY_REPRESENTATIVE:['Представитель галереи','Gallery representative'],
 CURATOR:['Куратор','Curator'],EXPERT:['Эксперт','Expert'],ART_HISTORIAN:['Историк искусства','Art historian'],
 RESEARCHER:['Исследователь','Researcher'],COLLECTOR:['Коллекционер','Collector'],ENTHUSIAST:['Ценитель искусства','Art enthusiast'],
 INSTITUTION_REPRESENTATIVE:['Представитель институции','Institution representative']
};
const roleLabel=r=>{const x=labels[r]||[String(r||'').replaceAll('_',' '),String(r||'').replaceAll('_',' ')];return copy(x[0],x[1])};

function personCard(p){
 const roles=(p.roles||[]).map(x=>'<span>'+esc(roleLabel(x.role))+(x.status==='VERIFIED'?' ✓':'')+'</span>').join('');
 const expertise=(p.expertise||[]).slice(0,3).map(x=>'<small>'+esc(local(x.label)||x.expertiseCode)+'</small>').join('');
 const avatar=p.avatarUrl?'<img loading="lazy" src="'+esc(p.avatarUrl)+'" alt="">':'<span>'+esc((p.displayName||'?').slice(0,1))+'</span>';
 return '<a class="network-person-card" href="#profile/'+esc(p.slug)+'"><div class="network-avatar">'+avatar+'</div><div><div class="network-role-row">'+roles+'</div><h3>'+esc(p.displayName)+'</h3>'+(local(p.headline)?'<p>'+esc(local(p.headline))+'</p>':'')+'<div class="network-expertise">'+expertise+'</div></div></a>';
}
function galleryCard(g){
 return '<article class="network-gallery-card"><div class="eyebrow">'+esc(String(g.culturalReviewStatus||'').replaceAll('_',' '))+'</div><h3>'+esc(g.name)+'</h3><p>'+esc([local(g.city),local(g.country)].filter(Boolean).join(' · '))+'</p><div class="network-tags">'+(g.specialties||[]).slice(0,4).map(x=>'<span>'+esc(local(x)||x)+'</span>').join('')+'</div></article>';
}
function profileEditor(me){
 const p=me&&me.profile;
 if(!p)return '<section class="network-onboarding"><div><div class="eyebrow">ANTIQUA ART NETWORK</div><h2>'+copy('Создайте культурный профиль','Create your art profile')+'</h2><p>'+copy('Один профиль для искусства, коллекционирования, исследований и сотрудничества. Публичные роли не дают системных прав.','One profile for art, collecting, research and collaboration. Public roles never grant system permissions.')+'</p></div><form id="artProfileForm"><label>'+copy('Имя / псевдоним','Name / pseudonym')+'<input name="displayName" required maxlength="160"></label><label>'+copy('Коротко о себе','Headline')+'<input name="headline" maxlength="240"></label><label>'+copy('Видимость','Visibility')+'<select name="visibility"><option value="PRIVATE">'+copy('Приватно','Private')+'</option><option value="PSEUDONYMOUS">'+copy('Псевдоним публично','Public pseudonym')+'</option><option value="PUBLIC">'+copy('Публично','Public')+'</option></select></label><button class="primary-button">'+copy('Создать Art Profile','Create Art Profile')+'</button></form></section>';
 const roles=(me.claims&&me.claims.roles)||[];
 const choices=['ENTHUSIAST','COLLECTOR','ARTIST','GALLERY_REPRESENTATIVE','CURATOR','EXPERT','ART_HISTORIAN','RESEARCHER'];
 return '<section class="network-onboarding network-profile-ready"><div><div class="eyebrow">'+copy('МОЙ ART PROFILE','MY ART PROFILE')+'</div><h2>'+esc(p.displayName)+'</h2><p>'+copy('Профессиональные роли проходят отдельную проверку и не дают системных прав.','Professional claims are reviewed separately and never grant system permissions.')+'</p></div><div class="network-role-actions">'+choices.map(r=>{const x=roles.find(v=>v.role===r);return '<button class="secondary-button" data-art-role="'+r+'" '+(x?'disabled':'')+'>'+esc(roleLabel(r))+(x?' · '+esc(x.status.replaceAll('_',' ')):'')+'</button>'}).join('')+'</div></section>';
}

export async function artNetworkView(){
 const data=await Promise.all([api('/api/art-profiles'),api('/api/galleries').catch(()=>({galleries:[]})),safe('/api/art-profile/me')]);
 const profiles=data[0].profiles||[],galleries=data[1].galleries||[],my=data[2];
 const experts=profiles.filter(p=>(p.roles||[]).some(r=>['EXPERT','ART_HISTORIAN','CURATOR','RESEARCHER'].includes(r.role)));
 return '<section class="network-page"><div class="page network-hero"><div><div class="eyebrow">ANTIQUA · ART NETWORK</div><h1>'+copy('Сообщество искусства','Art community')+'</h1><p>'+copy('Художники, галереи, коллекционеры, эксперты, историки искусства и ценители — вокруг произведений, выставок, знаний и сотрудничества.','Artists, galleries, collectors, experts, art historians and enthusiasts — connected through artworks, exhibitions, knowledge and collaboration.')+'</p></div><div class="network-principles"><span>'+copy('Без гонки лайков','No like race')+'</span><span>'+copy('Роли ≠ права','Roles ≠ permissions')+'</span><span>'+copy('Экспертиза проверяема','Reviewable expertise')+'</span></div></div>'+profileEditor(my)+'<div class="page section"><div class="section-head"><div><div class="eyebrow">'+copy('ЛЮДИ','PEOPLE')+'</div><h2>'+copy('Люди искусства','People in art')+'</h2></div></div>'+(profiles.length?'<div class="network-people-grid">'+profiles.map(personCard).join('')+'</div>':'<p class="muted">'+copy('Первые публичные профили формируются.','The first public profiles are being created.')+'</p>')+'</div><div class="page section"><div class="section-head"><div><div class="eyebrow">'+copy('ГАЛЕРЕИ','GALLERIES')+'</div><h2>'+copy('Галереи и институции','Galleries & institutions')+'</h2></div></div>'+(galleries.length?'<div class="network-gallery-grid">'+galleries.map(galleryCard).join('')+'</div>':'<p class="muted">'+copy('Профили галерей появляются только после явной публикации организацией.','Gallery profiles appear only after explicit organization publication.')+'</p>')+'</div>'+(experts.length?'<div class="page section"><div class="section-head"><div><div class="eyebrow">'+copy('ЭКСПЕРТЫ И ИСТОРИКИ','EXPERTS & HISTORIANS')+'</div><h2>'+copy('Проверяемая экспертиза','Reviewable expertise')+'</h2></div></div><div class="network-people-grid">'+experts.map(personCard).join('')+'</div></div>':'')+'</section>';
}
export async function artProfileView(slug){
 const p=(await api('/api/art-profiles/'+encodeURIComponent(slug))).profile;
 const roles=(p.roles||[]).map(x=>'<span>'+esc(roleLabel(x.role))+(x.status==='VERIFIED'?' ✓':'')+'</span>').join('');
 const avatar=p.avatarUrl?'<img src="'+esc(p.avatarUrl)+'" alt="">':'<span>'+esc((p.displayName||'?').slice(0,1))+'</span>';
 const ex=(p.expertise||[]).map(x=>'<article><strong>'+esc(local(x.label)||x.expertiseCode)+'</strong><span class="network-verified">✓ '+copy('Проверено','Verified')+'</span><p>'+esc(local(x.scope&&x.scope.description)||'')+'</p></article>').join('');
 return '<section class="page network-profile-page"><a class="text-link" href="#network">← '+copy('Сообщество','Community')+'</a><div class="network-profile-hero"><div class="network-avatar network-avatar-large">'+avatar+'</div><div><div class="network-role-row">'+roles+'</div><h1>'+esc(p.displayName)+'</h1><p class="lead">'+esc(local(p.headline))+'</p><p>'+esc(local(p.about))+'</p></div></div>'+(ex?'<section class="artist-research-card"><div class="eyebrow">'+copy('ПРОВЕРЕННАЯ ЭКСПЕРТИЗА','VERIFIED EXPERTISE')+'</div><div class="network-expertise-list">'+ex+'</div></section>':'')+'</section>';
}
document.addEventListener('submit',async e=>{
 if(e.target.id!=='artProfileForm')return;e.preventDefault();const f=new FormData(e.target);
 try{await api('/api/art-profile/me',{method:'PATCH',body:JSON.stringify({displayName:f.get('displayName'),headline:{ru:f.get('headline'),en:f.get('headline')},visibility:f.get('visibility')})});toast(copy('Art Profile создан','Art Profile created'));location.hash='network';location.reload()}catch(err){toast(err.message)}
});
document.addEventListener('click',async e=>{
 const b=e.target.closest&&e.target.closest('[data-art-role]');if(!b)return;b.disabled=true;
 try{const r=await api('/api/art-profile/me/roles',{method:'POST',body:JSON.stringify({role:b.dataset.artRole})});b.textContent=roleLabel(r.claim.role)+' · '+r.claim.status.replaceAll('_',' ');toast(copy('Роль сохранена. Профессиональные роли проходят проверку.','Role saved. Professional claims are reviewed separately.'))}catch(err){b.disabled=false;toast(err.message)}
});
