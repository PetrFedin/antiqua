// ANTIQUA Artwork Study Room v68. Visual preferences only; data and rights immutable.
const dialog=document.querySelector('#dialog');
const copy=(ru,en)=>document.documentElement.lang==='en'?en:ru;
function install(){
 const card=dialog?.querySelector('.native-dossier.desire-v27');
 const wall=card?.querySelector('.dossier-gallery');
 const image=wall?.querySelector('.dossier-hero img');
 if(!card||!wall||!image||wall.querySelector('[data-dossier-viewer-controls]'))return;
 card.classList.add('artwork-editorial-v68');
 wall.dataset.dossierMat='paper';

 const rail=document.createElement('div');
 rail.className='dossier-exhibition-rail';
 rail.dataset.dossierViewerControls='';
 const tag=document.createElement('span');
 tag.className='dossier-exhibition-index';
 tag.textContent=copy('ANTIQUA / ИССЛЕДОВАНИЕ ПРОИЗВЕДЕНИЯ','ANTIQUA / ARTWORK STUDY');
 const button=document.createElement('button');
 button.className='dossier-mat-toggle';
 button.type='button';
 button.dataset.dossierMatToggle='';
 const refresh=()=>{
  const dark=wall.dataset.dossierMat==='ink';
  button.setAttribute('aria-pressed',String(dark));
  button.textContent=dark?copy('Светлый фон','Light backdrop'):copy('Тёмный фон','Dark backdrop');
  button.setAttribute('aria-label',button.textContent);
 };
 button.addEventListener('click',()=>{wall.dataset.dossierMat=wall.dataset.dossierMat==='ink'?'paper':'ink';refresh();});
 refresh();rail.append(tag,button);wall.prepend(rail);

 const caption=document.createElement('div');
 caption.className='dossier-image-caption';
 caption.dataset.dossierImageCaption='';
 const label=document.createElement('span');
 label.textContent=copy('Каталожное изображение','Catalogue image');
 const hint=document.createElement('small');
 hint.textContent=copy('Нажмите на изображение для увеличения','Select the artwork to zoom');
 caption.append(label,hint);
 const thumbs=wall.querySelector('.dossier-thumbs');
 if(thumbs)thumbs.after(caption);else wall.append(caption);
}
window.addEventListener('antiqua:passport',install);
dialog?.addEventListener('close',()=>{const wall=dialog.querySelector('.dossier-gallery');if(wall)wall.dataset.dossierMat='paper';});
