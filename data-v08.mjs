export const bi=(en,ru)=>({en,ru});
export const SALE='sale-collector-2026-09';
export const BUYER_ID='preview-buyer';
export const SELLER_ID='preview-seller';

export const sellers=new Map([
 ['dealer-vermeer',{id:'dealer-vermeer',name:'Atelier Vermeer Gallery',slug:'atelier-vermeer',city:bi('Amsterdam','Амстердам'),country:bi('Netherlands','Нидерланды'),since:1987,verified:true,rating:4.9,responseHours:4,specialties:[bi('European Painting','Европейская живопись'),bi('19th-century Painting','Живопись XIX века'),bi('Watercolor & Pastel','Акварель и пастель')],about:bi('A gallery focused exclusively on paintings and painterly media with structured provenance, condition and scholarly documentation.','Галерея, специализирующаяся исключительно на живописи и живописных техниках, с системной фиксацией провенанса, состояния и исследовательских материалов.'),policies:bi('Viewing by appointment. Insured art shipping quotes are prepared individually.','Просмотр по записи. Расчёт специализированной застрахованной перевозки произведений выполняется индивидуально.') }],
 ['dealer-north',{id:'dealer-north',name:'North & Co. Fine Art',slug:'north-fine-art',city:bi('London','Лондон'),country:bi('United Kingdom','Великобритания'),since:1994,verified:true,rating:4.8,responseHours:24,specialties:[bi('19th-century Painting','Живопись XIX века'),bi('Modern Painting','Живопись XX века'),bi('Watercolor & Gouache','Акварель и гуашь')],about:bi('Paintings and painterly works from European private collections.','Живопись из европейских частных коллекций.'),policies:bi('International art shipping subject to export and cultural-property review.','Международная перевозка произведений зависит от экспортных ограничений и проверки культурных ценностей.') }],
 ['seller-preview',{id:'seller-preview',name:'ANTIQUA Fine Art Preview',slug:'preview-fine-art',city:bi('Amsterdam','Амстердам'),country:bi('Netherlands','Нидерланды'),since:2026,verified:true,rating:null,responseHours:null,specialties:[bi('Painting','Живопись'),bi('Watercolor','Акварель'),bi('Pastel','Пастель')],about:bi('Demonstration painting seller account used to test the ANTIQUA artwork lifecycle.','Демонстрационный кабинет продавца живописи для проверки полного жизненного цикла картины в ANTIQUA.'),policies:bi('Preview only.','Только демонстрационная среда.') }]
]);

const media=url=>[
 {id:'m1',type:'IMAGE',url,role:'PRIMARY',caption:bi('Primary catalogue view','Основной каталожный вид')},
 {id:'m2',type:'CHECKLIST',role:'DETAIL',caption:bi('Signature / inscription detail required before publication','До публикации требуется фото подписи / надписей')},
 {id:'m3',type:'CHECKLIST',role:'CONDITION',caption:bi('Condition detail photograph required before publication','До публикации требуется фото состояния')}
];
const evidence=(source,labelEn,labelRu)=>({id:`ev-${source}-${labelEn.slice(0,5).toLowerCase()}`,source,label:bi(labelEn,labelRu),status:'USER_SUPPLIED'});

const raw=[
 ['101','Painting','Живопись','Northern European School','Североевропейская школа','River landscape after rain','Речной пейзаж после дождя','circa 1870','около 1870 года','Northern Europe','Северная Европа',18000,26000,'/demo-art/painting-placeholder.svg','Oil on canvas','Холст, масло','64 × 92 cm','64 × 92 см'],
 ['102','Painting','Живопись','French School','Французская школа','Portrait in a blue interior','Портрет в синем интерьере','late 19th century','конец XIX века','France','Франция',28000,42000,'/demo-art/painting-placeholder.svg','Oil on canvas','Холст, масло','81 × 65 cm','81 × 65 см'],
 ['103','Painting','Живопись','Italian School','Итальянская школа','Trees by the riverbank','Деревья у берега реки','early 20th century','начало XX века','Italy','Италия',9000,14000,'/demo-art/painting-placeholder.svg','Watercolor and gouache on paper','Акварель и гуашь на бумаге','31 × 40 cm','31 × 40 см'],
 ['104','Painting','Живопись','European School','Европейская школа','River landscape at dusk','Речной пейзаж в сумерках','19th century','XIX век','Europe','Европа',9000,14000,'/demo-art/painting-placeholder.svg','Oil on canvas','Холст, масло','64 × 92 cm','64 × 92 см'],
 ['105','Painting','Живопись','Russian School','Русская школа','Interior with red chair','Интерьер с красным креслом','circa 1910','около 1910 года','Russia','Россия',22000,32000,'/demo-art/painting-placeholder.svg','Oil on board','Масло на картоне','58 × 46 cm','58 × 46 см'],
 ['106','Watercolor','Акварель','British School','Британская школа','Coastal study','Береговой этюд','circa 1900','около 1900 года','United Kingdom','Великобритания',12000,18000,'/demo-art/painting-placeholder.svg','Watercolor on paper','Акварель на бумаге','38 × 54 cm','38 × 54 см'],
 ['107','Painting','Живопись','Dutch School','Голландская школа','Still life with fruit and glass','Натюрморт с фруктами и бокалом','19th century','XIX век','Netherlands','Нидерланды',15000,24000,'/demo-art/painting-placeholder.svg','Oil on panel','Масло на дереве','45 × 61 cm','45 × 61 см'],
 ['108','Painting','Живопись','Continental European School','Континентальная европейская школа','Architectural capriccio','Архитектурное каприччио','late 18th century','конец XVIII века','Europe','Европа',11000,16000,'/demo-art/painting-placeholder.svg','Gouache on paper','Гуашь на бумаге','36 × 28 cm','36 × 28 см'],
 ['109','Painting','Живопись','Italian School','Итальянская школа','View across the lagoon','Вид через лагуну','circa 1880','около 1880 года','Italy','Италия',16800,24000,'/demo-art/painting-placeholder.svg','Oil on canvas','Холст, масло','72 × 98 cm','72 × 98 см'],
 ['110','Painting','Живопись','French School','Французская школа','Figure by the window','Фигура у окна','1920s','1920-е годы','France','Франция',14000,22000,'/demo-art/painting-placeholder.svg','Tempera on board','Темпера на картоне','49 × 36 cm','49 × 36 см'],
 ['111','Painting','Живопись','European School','Европейская школа','Portrait study','Портретный этюд','early 20th century','начало XX века','Europe','Европа',12000,18000,'/demo-art/painting-placeholder.svg','Pastel on prepared paper','Пастель на подготовленной бумаге','55 × 42 cm','55 × 42 см'],
 ['112','Painting','Живопись','German School','Немецкая школа','Forest path','Лесная тропа','19th century','XIX век','Germany','Германия',10000,15000,'/demo-art/painting-placeholder.svg','Oil on board','Масло на картоне','41 × 58 cm','41 × 58 см']
];

export const lots=raw.map((x,i)=>({
 id:`lot-${x[0]}`,objectId:`AQ-${x[0]}-2026`,lotNumber:Number(x[0]),department:bi(x[1],x[2]),maker:bi(x[3],x[4]),title:bi(x[5],x[6]),period:bi(x[7],x[8]),origin:bi(x[9],x[10]),currency:'EUR',estimateLow:x[11],estimateHigh:x[12],image:x[13],materials:bi(x[14],x[15]),dimensions:bi(x[16],x[17]),
 attributionStatus:i%3===0?'ATTRIBUTED':'CATALOGUED',
 marks:bi(i%2?'Signature / inscriptions not recorded in preview':'Signature / inscriptions recorded in owner documentation',i%2?'Подпись / надписи в preview не указаны':'Подпись / надписи зафиксированы в документах владельца'),
 cataloguing:bi('Demonstration painting catalogue record. Real publication requires specialist review of artist / attribution, dating, medium, dimensions, signature / inscriptions and provenance.','Демонстрационная каталожная запись картины. Для реальной публикации требуется проверка специалистом авторства / атрибуции, датировки, техники, размеров, подписи / надписей и провенанса.'),
 provenance:bi(['Private European collection — owner supplied','Demonstration provenance; external verification pending'],['Частная европейская коллекция — со слов владельца','Демонстрационный провенанс; внешняя проверка ожидается']),
 provenanceTimeline:[
  {date:'1998',event:bi('Recorded in a private collection','Зафиксирована в частной коллекции'),evidenceStatus:'USER_SUPPLIED'},
  {date:'2026',event:bi('Entered ANTIQUA painting catalogue preview','Внесена в демонстрационный каталог живописи ANTIQUA'),evidenceStatus:'PLATFORM_RECORD'}
 ],
 condition:bi('Artwork condition preview only. Craquelure, paper condition, retouching, lining, trimming and other interventions must be mapped to images before publication.','Только демонстрационный отчёт о состоянии произведения. Кракелюр, состояние бумаги, ретушь, дублирование холста, обрезка и другие вмешательства должны быть привязаны к изображениям до публикации.'),
 conditionGrade:i%4===0?'B':'A-',
 restoration:bi(i%3===0?'Historic restoration noted; details pending':'No restoration asserted in preview',i%3===0?'Отмечена историческая реставрация; детали ожидаются':'В демонстрационной записи реставрация не заявлена'),
 literature:bi(i%3===0?['Reference catalogue entry, demo record 2026']:['No published literature verified yet'],i%3===0?['Запись в справочном каталоге, demo record 2026']:['Опубликованная литература пока не подтверждена']),
 exhibitions:bi(i%4===0?['Private collection study display, 2024']:['No verified exhibition history yet'],i%4===0?['Исследовательский показ частной коллекции, 2024']:['Подтверждённая выставочная история пока отсутствует']),
 documents:[evidence('OWNER','Ownership statement','Заявление владельца')],
 media:media(x[13]),
 location:i%2===0?'Amsterdam':'London',
 exportStatus:i===7?'REVIEW_REQUIRED':'NO_FLAG',
 culturalPropertyStatus:'NOT_SCREENED',
 passportHash:`preview-${x[0]}`,
 catalogueStatus:'APPROVED'
}));

const t0=Date.now();
const seed=[[101,14500,9,5,16500],[102,26000,4,7,32000],[103,9000,7,9,10500],[104,7200,3,11,8500],[105,18000,5,14,21000],[106,10000,2,17,13000]];
export const auctions=seed.map(([n,cur,count,h,res])=>({id:`auc-${n}`,saleId:SALE,lotId:`lot-${n}`,currency:'EUR',baselineBid:cur,currentBid:cur,increment:step(cur),bidCount:count,reservePrice:res,reserveMet:cur>=res,startsAt:new Date(t0-7200000).toISOString(),endsAt:new Date(t0+h*3600000).toISOString(),state:'LIVE',leaderClientId:null,proxyBids:[],history:[{amount:cur,bidder:'Bidder •••',time:new Date(t0-1200000).toISOString(),type:'seed'}]}));
export function step(n){return n<1000?50:n<5000?100:n<10000?250:n<20000?500:n<50000?1000:2500;}

export const listings=new Map([
 ['lst-107',{id:'lst-107',lotId:'lot-107',sellerId:'dealer-vermeer',saleType:'BUY_NOW',price:19000,currency:'EUR',negotiable:true,status:'ACTIVE',shippingFrom:'Amsterdam',publishedAt:new Date(t0-86400000*12).toISOString(),views:184,saves:23}],
 ['lst-108',{id:'lst-108',lotId:'lot-108',sellerId:'dealer-north',saleType:'MAKE_OFFER',price:14500,currency:'EUR',negotiable:true,status:'ACTIVE',shippingFrom:'London',publishedAt:new Date(t0-86400000*9).toISOString(),views:119,saves:14}],
 ['lst-109',{id:'lst-109',lotId:'lot-109',sellerId:'seller-preview',saleType:'BUY_NOW',price:20500,currency:'EUR',negotiable:true,status:'ACTIVE',shippingFrom:'Amsterdam',publishedAt:new Date(t0-86400000*6).toISOString(),views:82,saves:9}],
 ['lst-110',{id:'lst-110',lotId:'lot-110',sellerId:'seller-preview',saleType:'MAKE_OFFER',price:18500,currency:'EUR',negotiable:true,status:'ACTIVE',shippingFrom:'Amsterdam',publishedAt:new Date(t0-86400000*4).toISOString(),views:64,saves:11}],
 ['lst-111',{id:'lst-111',lotId:'lot-111',sellerId:'dealer-vermeer',saleType:'BUY_NOW',price:15000,currency:'EUR',negotiable:false,status:'ACTIVE',shippingFrom:'Amsterdam',publishedAt:new Date(t0-86400000*7).toISOString(),views:96,saves:8}],
 ['lst-112',{id:'lst-112',lotId:'lot-112',sellerId:'dealer-north',saleType:'BUY_NOW',price:12500,currency:'EUR',negotiable:true,status:'ACTIVE',shippingFrom:'London',publishedAt:new Date(t0-86400000*3).toISOString(),views:141,saves:19}]
]);

export const draftItems=new Map([
 ['draft-1',{id:'draft-1',sellerId:'seller-preview',status:'CHANGES_REQUESTED',saleRoute:'SHOP',createdAt:new Date(t0-86400000*2).toISOString(),updatedAt:new Date(t0-3600000*5).toISOString(),title:bi('Landscape study with clouds','Пейзажный этюд с облаками'),category:bi('Painting','Живопись'),maker:bi('European School','Европейская школа'),period:bi('late 19th century','конец XIX века'),origin:bi('Europe','Европа'),materials:bi('Oil on canvas','Холст, масло'),dimensions:bi('42 × 61 cm','42 × 61 см'),description:bi('Seller-supplied draft painting catalogue description.','Черновое каталожное описание картины от продавца.'),provenance:bi('Private collection, acquired before 2010','Частная коллекция, приобретено до 2010 года'),condition:bi('Surface dirt and craquelure; UV and raking-light review pending','Поверхностные загрязнения и кракелюр; проверка в УФ и скользящем свете ожидается'),price:2400,estimateLow:1800,estimateHigh:2600,shippingFrom:'Amsterdam',media:[{url:'/demo-art/painting-placeholder.svg',role:'PRIMARY'}],documents:[],reviewNotes:[bi('Add recto, verso, signature, stretcher/frame and condition-detail photographs.','Добавьте фото лицевой и оборотной стороны, подписи, подрамника/рамы и деталей состояния.')]}],
 ['draft-2',{id:'draft-2',sellerId:'seller-preview',status:'DRAFT',saleRoute:'AUCTION',createdAt:new Date(t0-86400000).toISOString(),updatedAt:new Date(t0-3600000).toISOString(),title:bi('Portrait study','Портретный этюд'),category:bi('Painting','Живопись'),maker:bi('French School','Французская школа'),period:bi('circa 1900','около 1900 года'),origin:bi('France','Франция'),materials:bi('Pastel on prepared paper','Пастель на подготовленной бумаге'),dimensions:bi('48 × 33 cm','48 × 33 см'),description:bi('Draft attribution and cataloguing pending specialist review.','Черновая атрибуция и каталогизация ожидают проверки специалиста.'),provenance:bi('Private collection; documentary chain incomplete','Частная коллекция; документальная цепочка неполна'),condition:bi('Paper support requires condition review','Бумажная основа требует проверки состояния'),price:0,estimateLow:3200,estimateHigh:4800,shippingFrom:'Amsterdam',media:[{url:'/demo-art/painting-placeholder.svg',role:'PRIMARY'}],documents:[],reviewNotes:[]}]
]);

export const offers=new Map();
export const orders=new Map();
export const messages=new Map();
export const clients=new Map();
export const idem=new Map();
