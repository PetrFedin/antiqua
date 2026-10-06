const ACTIVE_TYPES=new Set([
  'PAINTING','DRAWING','GRAPHICS','PRINT','WORK_ON_PAPER',
  'ENGRAVING','ETCHING','LITHOGRAPH','WOODCUT','LINOCUT','SCREENPRINT',
  'WATERCOLOR','GOUACHE','PASTEL','MIXED_MEDIA_ON_PAPER'
]);

const ART_TERMS=[
  'painting','paintings','живопись','картина','картины',
  'drawing','drawings','рисунок','рисунки',
  'graphic','graphics','графика',
  'work on paper','works on paper','работа на бумаге','работы на бумаге',
  'print','prints','printmaking','печатная графика','эстамп',
  'engraving','гравюра','etching','офорт','lithograph','lithography','литография',
  'woodcut','ксилография','linocut','линогравюра','screenprint','silkscreen','шелкография',
  'watercolor','watercolour','акварель','gouache','гуашь','pastel','пастель',
  'oil on canvas','oil painting','масло','холст'
];

const EXCLUDED_TERMS=[
  'sculpture','скульптура','furniture','мебель','ceramic','ceramics','керамика',
  'porcelain','фарфор','silver','серебро','jewellery','jewelry','ювелир',
  'clock','clocks','часы','watch','watches','coin','coins','монет',
  'manuscript','manuscripts','рукопис','book','books','книг',
  'decorative art','decorative arts','декоративное искусство',
  'bronze sculpture','бронзовая скульптура','marble sculpture','мраморная скульптура'
];

const text=v=>v==null?'':typeof v==='string'?v:typeof v==='object'?[v.en,v.ru,v.label?.en,v.label?.ru].filter(Boolean).join(' '):String(v);
const haystack=o=>[
  o?.artworkType,o?.department,o?.category,o?.medium,o?.technique,o?.materials,o?.support,o?.title
].map(text).join(' ').toLowerCase();

export const artworkScopeVersion='v43-artwork-first';

export function normalizeArtworkType(value){
  const v=String(value||'').trim().toUpperCase().replace(/[\s-]+/g,'_');
  if(ACTIVE_TYPES.has(v))return v;
  return null;
}

export function publicArtworkEligible(o){
  if(!o)return false;
  const explicit=normalizeArtworkType(o.artworkType);
  if(explicit)return true;
  const h=haystack(o);
  if(EXCLUDED_TERMS.some(x=>h.includes(x)))return false;
  return ART_TERMS.some(x=>h.includes(x));
}

export function artworkScope(o){
  const explicit=normalizeArtworkType(o?.artworkType);
  return{
    eligible:publicArtworkEligible(o),
    artworkType:explicit||'UNCLASSIFIED',
    scopeVersion:artworkScopeVersion
  };
}

export function filterPublicArtworks(items=[]){
  return (items||[]).filter(publicArtworkEligible);
}

export const activeArtworkTypes=Object.freeze([...ACTIVE_TYPES]);
