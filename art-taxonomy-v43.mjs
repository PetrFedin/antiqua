const norm=v=>String(v?.en??v?.ru??v??'').trim().toLowerCase()
 .normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[_/–—-]+/g,' ').replace(/\s+/g,' ').trim();

const GROUPS={
 painting:['painting','paintings','живопись','картина','картины','oil painting','масляная живопись'],
 drawing:['drawing','drawings','рисунок','рисунки','graphite drawing','charcoal drawing'],
 print:['print','prints','printmaking','graphic','graphics','печатная графика','графика','эстамп','эстампы','engraving','etching','lithograph','lithography','woodcut','linocut','screenprint','silkscreen','гравюра','офорт','литография','ксилография','линогравюра','шелкография'],
 works_on_paper:['works on paper','work on paper','работы на бумаге','работа на бумаге','watercolor','watercolour','акварель','gouache','гуашь','pastel','пастель','mixed media on paper','смешанная техника на бумаге']
};

const LOOKUP=new Map(Object.entries(GROUPS).flatMap(([key,values])=>values.map(v=>[norm(v),key])));
const LABELS={
 painting:{en:'Painting',ru:'Живопись'},
 drawing:{en:'Drawing',ru:'Рисунок'},
 print:{en:'Printmaking',ru:'Печатная графика'},
 works_on_paper:{en:'Works on Paper',ru:'Работы на бумаге'}
};

export const artworkDepartmentKeys=Object.freeze(Object.keys(GROUPS));

export function canonicalArtworkDepartment(value){
 const n=norm(value);if(!n)return'';
 if(LOOKUP.has(n))return LOOKUP.get(n);
 for(const [alias,key] of LOOKUP){if(n.includes(alias)||alias.includes(n))return key}
 return n.replace(/\s+/g,'_');
}

export function canonicalArtworkDimension(dimension,value){
 return dimension==='department'?canonicalArtworkDepartment(value):norm(value);
}

export function artworkDepartmentLabel(value){
 const key=canonicalArtworkDepartment(value);
 return LABELS[key]??(typeof value==='object'&&value?value:{en:String(value||''),ru:String(value||'')});
}

export function sameArtworkDepartment(a,b){
 const aa=canonicalArtworkDepartment(a),bb=canonicalArtworkDepartment(b);
 return Boolean(aa&&bb&&aa===bb);
}
