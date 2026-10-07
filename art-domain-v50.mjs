const ALLOWED=[
 'painting','oil painting','watercolor','watercolour','gouache','tempera','pastel','acrylic painting',
 'живопись','масляная живопись','акварель','гуашь','темпера','пастель','акриловая живопись'
];

const BLOCKED=[
 'drawing','etching','engraving','lithograph','lithography','print','printmaking','graphics','works on paper',
 'furniture','decorative art','ceramic','porcelain','silver','jewelry','jewellery','sculpture','clock','watch','bronze object','manuscript','antique',
 'рисунок','офорт','гравюра','литография','эстамп','графика','работы на бумаге','произведения на бумаге',
 'мебель','декоративное искусство','керамика','фарфор','серебро','ювелир','скульптура','часы','бронзовый предмет','рукопись','антиквариат'
];

const text=v=>typeof v==='string'?v:[v?.en,v?.ru].filter(Boolean).join(' ');
const norm=v=>text(v).toLocaleLowerCase().replace(/ё/g,'е').trim();

export function isPaintingCategory(value){
 const n=norm(value);
 if(!n)return false;
 if(BLOCKED.some(x=>n.includes(x)))return false;
 return ALLOWED.some(x=>n.includes(x));
}

export function assertPaintingCategory(value){
 if(isPaintingCategory(value))return true;
 const e=new Error('ANTIQUA public product accepts paintings only');
 e.status=422;
 e.code='PAINTING_CATEGORY_REQUIRED';
 e.details={allowed:['PAINTING','WATERCOLOR','GOUACHE','TEMPERA','PASTEL','ACRYLIC_PAINTING']};
 throw e;
}

export function paintingsDomainCapabilities(){
 return{
  contractVersion:'v50',
  publicScope:'PAINTINGS_ONLY',
  allowed:['PAINTING','WATERCOLOR','GOUACHE','TEMPERA','PASTEL','ACRYLIC_PAINTING'],
  drawing:false,
  printmaking:false,
  decorativeArts:false,
  sculpture:false,
  furniture:false,
  ceramics:false,
  jewelry:false,
  clocks:false,
  internalObjectAuthorityRetained:true
 };
}
