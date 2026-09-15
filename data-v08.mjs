export const bi=(en,ru)=>({en,ru});
export const SALE='sale-collector-2026-09';
export const BUYER_ID='preview-buyer';
export const SELLER_ID='preview-seller';

export const sellers=new Map([
 ['dealer-vermeer',{id:'dealer-vermeer',name:'Maison Vermeer Antiques',slug:'maison-vermeer',city:bi('Amsterdam','Амстердам'),country:bi('Netherlands','Нидерланды'),since:1987,verified:true,rating:4.9,responseHours:4,specialties:[bi('European Furniture','Европейская мебель'),bi('Decorative Arts','Декоративное искусство'),bi('Clocks','Часы')],about:bi('A specialist dealership focused on European furniture and decorative arts, with structured condition reporting and documented provenance.','Специализированная галерея европейской мебели и декоративного искусства с системной фиксацией состояния и документированного провенанса.'),policies:bi('Viewing by appointment. Insured shipping quotes are prepared individually.','Просмотр по записи. Расчёт застрахованной доставки выполняется индивидуально.') }],
 ['dealer-north',{id:'dealer-north',name:'North & Co. Antiques',slug:'north-and-co',city:bi('London','Лондон'),country:bi('United Kingdom','Великобритания'),since:1994,verified:true,rating:4.8,responseHours:24,specialties:[bi('Sculpture','Скульптура'),bi('Works on Paper','Графика'),bi('Manuscripts','Рукописи')],about:bi('Objects, sculpture and works on paper sourced from European private collections.','Предметы искусства, скульптура и графика из европейских частных коллекций.'),policies:bi('International shipping subject to export and cultural-property review.','Международная доставка зависит от экспортных ограничений и проверки культурных ценностей.') }],
 ['seller-preview',{id:'seller-preview',name:'Preview Dealer Cabinet',slug:'preview-dealer',city:bi('Amsterdam','Амстердам'),country:bi('Netherlands','Нидерланды'),since:2026,verified:true,rating:null,responseHours:null,specialties:[bi('Decorative Arts','Декоративное искусство')],about:bi('Demonstration seller account used to test the ANTIQUA dealer workflow.','Демонстрационный кабинет продавца для проверки рабочего процесса ANTIQUA.'),policies:bi('Preview only.','Только демонстрационная среда.') }]
]);

const media=(url)=>[
 {id:'m1',type:'IMAGE',url,role:'PRIMARY',caption:bi('Primary catalogue view','Основной каталожный вид')},
 {id:'m2',type:'CHECKLIST',role:'DETAIL',caption:bi('Detail / marks photograph required before publication','До публикации требуется фото деталей / маркировок')},
 {id:'m3',type:'CHECKLIST',role:'CONDITION',caption:bi('Condition detail photograph required before publication','До публикации требуется фото состояния')}
];
const evidence=(source,labelEn,labelRu)=>({id:`ev-${source}-${labelEn.slice(0,5).toLowerCase()}`,source,label:bi(labelEn,labelRu),status:'USER_SUPPLIED'});

const raw=[
 ['101','European Decorative Arts','Европейское декоративное искусство','French, Louis XVI period','Франция, период Людовика XVI','A gilt-bronze mounted mantel clock','Каминные часы с золочёной бронзой','late 18th century','конец XVIII века','France','Франция',18000,26000,'https://images.metmuseum.org/CRDImages/es/web-large/DP340468.jpg','Gilt bronze, enamel','Золочёная бронза, эмаль','42 × 28 × 16 cm','42 × 28 × 16 см'],
 ['102','European Ceramics','Европейская керамика','Delft workshop','Делфтская мастерская','A blue-and-white charger','Большое сине-белое блюдо','18th century','XVIII век','Netherlands','Нидерланды',2800,4200,'https://images.metmuseum.org/CRDImages/es/web-large/DP254624.jpg','Tin-glazed earthenware','Фаянс с оловянной глазурью','Ø 35 cm','Ø 35 см'],
 ['103','Sculpture','Скульптура','European School','Европейская школа','Study of a horse','Этюд лошади','late 19th century','конец XIX века','Europe','Европа',6000,9000,'https://images.metmuseum.org/CRDImages/es/web-large/DP169405.jpg','Patinated bronze','Патинированная бронза','31 × 40 × 14 cm','31 × 40 × 14 см'],
 ['104','European Paintings','Европейская живопись','European School','Европейская школа','River landscape at dusk','Речной пейзаж в сумерках','19th century','XIX век','Europe','Европа',9000,14000,'https://images.metmuseum.org/CRDImages/ep/web-large/DP145903.jpg','Oil on canvas','Холст, масло','64 × 92 cm','64 × 92 см'],
 ['105','Works of Art','Предметы искусства','Italian','Италия','A carved marble fragment','Резной мраморный фрагмент','18th–19th century','XVIII–XIX век','Italy','Италия',7500,11000,'https://images.metmuseum.org/CRDImages/es/web-large/DP151938.jpg','Carved marble','Резной мрамор','48 × 31 × 12 cm','48 × 31 × 12 см'],
 ['106','European Furniture','Европейская мебель','French','Франция','A neoclassical occasional table','Неоклассический приставной столик','circa 1800','около 1800 года','France','Франция',12000,18000,'https://images.metmuseum.org/CRDImages/es/web-large/DP247929.jpg','Mahogany, gilt bronze','Красное дерево, золочёная бронза','74 × 58 × 42 cm','74 × 58 × 42 см'],
 ['107','Asian Works of Art','Азиатское искусство','Chinese','Китай','A monochrome glazed vessel','Сосуд с монохромной глазурью','Qing dynasty style','в стиле династии Цин','China','Китай',5000,8000,'https://images.metmuseum.org/CRDImages/as/web-large/DP251139.jpg','Glazed porcelain','Глазурованный фарфор','H 27 cm','В 27 см'],
 ['108','Books & Manuscripts','Книги и рукописи','Continental European','Континентальная Европа','An illuminated manuscript leaf','Лист иллюминированной рукописи','15th century style','в стиле XV века','Europe','Европа',3500,5500,'https://images.metmuseum.org/CRDImages/md/web-large/DP-16286-001.jpg','Parchment, pigment, gold','Пергамент, пигмент, золото','24 × 17 cm','24 × 17 см'],
 ['109','European Furniture','Европейская мебель','Northern Italian','Северная Италия','A walnut commode','Ореховый комод','circa 1780','около 1780 года','Italy','Италия',6800,9000,'https://images.metmuseum.org/CRDImages/es/web-large/DP247929.jpg','Walnut, brass','Орех, латунь','88 × 118 × 54 cm','88 × 118 × 54 см'],
 ['110','Silver','Серебро','English','Англия','A pair of silver candlesticks','Пара серебряных подсвечников','early 19th century','начало XIX века','United Kingdom','Великобритания',4200,6200,'https://images.metmuseum.org/CRDImages/es/web-large/DP340468.jpg','Silver','Серебро','H 29 cm each','В 29 см каждый'],
 ['111','European Ceramics','Европейская керамика','Meissen style','в стиле Мейсена','A porcelain figure group','Фарфоровая скульптурная группа','19th century','XIX век','Germany','Германия',3200,4800,'https://images.metmuseum.org/CRDImages/es/web-large/DP254624.jpg','Porcelain','Фарфор','H 31 cm','В 31 см'],
 ['112','Sculpture','Скульптура','French School','Французская школа','A bronze portrait bust','Бронзовый портретный бюст','circa 1900','около 1900 года','France','Франция',8500,12000,'https://images.metmuseum.org/CRDImages/es/web-large/DP169405.jpg','Patinated bronze','Патинированная бронза','H 46 cm','В 46 см']
];
export const lots=raw.map((x,i)=>({
 id:`lot-${x[0]}`,objectId:`AQ-${x[0]}-2026`,lotNumber:Number(x[0]),department:bi(x[1],x[2]),maker:bi(x[3],x[4]),title:bi(x[5],x[6]),period:bi(x[7],x[8]),origin:bi(x[9],x[10]),currency:'EUR',estimateLow:x[11],estimateHigh:x[12],image:x[13],materials:bi(x[14],x[15]),dimensions:bi(x[16],x[17]),
 attributionStatus:i%3===0?'ATTRIBUTED':'CATALOGUED', marks:bi(i%2?'No marks recorded in preview':'Marks recorded in owner documentation',i%2?'Маркировки в preview не указаны':'Маркировки зафиксированы в документах владельца'),
 cataloguing:bi('Demonstration catalogue record. Real publication requires specialist review of identification, dating, materials, dimensions and marks.','Демонстрационная каталожная запись. Для реальной публикации требуется проверка специалистом идентификации, датировки, материалов, размеров и маркировок.'),
 provenance:bi(['Private European collection — owner supplied','Demonstration provenance; external verification pending'],['Частная европейская коллекция — со слов владельца','Демонстрационный провенанс; внешняя проверка ожидается']),
 provenanceTimeline:[{date:'1998',event:bi('Recorded in a private collection','Зафиксирован в частной коллекции'),evidenceStatus:'USER_SUPPLIED'},{date:'2026',event:bi('Entered ANTIQUA catalogue preview','Внесён в демонстрационный каталог ANTIQUA'),evidenceStatus:'PLATFORM_RECORD'}],
 condition:bi('Illustrative condition report only. Wear consistent with age; all restoration must be mapped to detail photographs before publication.','Иллюстративный отчёт о состоянии. Следы возраста; все реставрации должны быть привязаны к детальным фотографиям до публикации.'),
 conditionGrade:i%4===0?'B':'A-',restoration:bi(i%3===0?'Historic restoration noted; details pending':'No restoration asserted in preview','Отмечена историческая реставрация; детали ожидаются'),
 literature:bi([],[]),exhibitions:bi([],[]),documents:[evidence('OWNER','Ownership statement','Заявление владельца')],media:media(x[13]),
 location:i%2===0?'Amsterdam':'London',exportStatus:i===7?'REVIEW_REQUIRED':'NO_FLAG',culturalPropertyStatus:'NOT_SCREENED',passportHash:`preview-${x[0]}`,catalogueStatus:'APPROVED'
}));

const t0=Date.now();
const seed=[[101,14500,9,5,16500],[102,2600,4,7,3200],[103,5250,7,9,6500],[104,7200,3,11,8500],[105,6000,5,14,7500],[106,10000,2,17,13000]];
export const auctions=seed.map(([n,cur,count,h,res])=>({id:`auc-${n}`,saleId:SALE,lotId:`lot-${n}`,currency:'EUR',baselineBid:cur,currentBid:cur,increment:step(cur),bidCount:count,reservePrice:res,reserveMet:cur>=res,startsAt:new Date(t0-7200000).toISOString(),endsAt:new Date(t0+h*3600000).toISOString(),state:'LIVE',leaderClientId:null,proxyBids:[],history:[{amount:cur,bidder:'Bidder •••',time:new Date(t0-1200000).toISOString(),type:'seed'}]}));
export function step(n){return n<1000?50:n<5000?100:n<10000?250:n<20000?500:n<50000?1000:2500;}

export const listings=new Map([
 ['lst-107',{id:'lst-107',lotId:'lot-107',sellerId:'dealer-vermeer',saleType:'BUY_NOW',price:7200,currency:'EUR',negotiable:true,status:'ACTIVE',shippingFrom:'Amsterdam',publishedAt:new Date(t0-86400000*12).toISOString(),views:184,saves:23}],
 ['lst-108',{id:'lst-108',lotId:'lot-108',sellerId:'dealer-north',saleType:'MAKE_OFFER',price:5200,currency:'EUR',negotiable:true,status:'ACTIVE',shippingFrom:'London',publishedAt:new Date(t0-86400000*9).toISOString(),views:119,saves:14}],
 ['lst-109',{id:'lst-109',lotId:'lot-109',sellerId:'seller-preview',saleType:'BUY_NOW',price:7800,currency:'EUR',negotiable:true,status:'ACTIVE',shippingFrom:'Amsterdam',publishedAt:new Date(t0-86400000*6).toISOString(),views:82,saves:9}],
 ['lst-110',{id:'lst-110',lotId:'lot-110',sellerId:'seller-preview',saleType:'MAKE_OFFER',price:5600,currency:'EUR',negotiable:true,status:'ACTIVE',shippingFrom:'Amsterdam',publishedAt:new Date(t0-86400000*4).toISOString(),views:64,saves:11}],
 ['lst-111',{id:'lst-111',lotId:'lot-111',sellerId:'dealer-vermeer',saleType:'BUY_NOW',price:4300,currency:'EUR',negotiable:false,status:'ACTIVE',shippingFrom:'Amsterdam',publishedAt:new Date(t0-86400000*7).toISOString(),views:96,saves:8}],
 ['lst-112',{id:'lst-112',lotId:'lot-112',sellerId:'dealer-north',saleType:'BUY_NOW',price:10500,currency:'EUR',negotiable:true,status:'ACTIVE',shippingFrom:'London',publishedAt:new Date(t0-86400000*3).toISOString(),views:141,saves:19}]
]);

export const draftItems=new Map([
 ['draft-1',{id:'draft-1',sellerId:'seller-preview',status:'CHANGES_REQUESTED',saleRoute:'SHOP',createdAt:new Date(t0-86400000*2).toISOString(),updatedAt:new Date(t0-3600000*5).toISOString(),title:bi('A walnut writing box','Ореховая шкатулка для письма'),category:bi('Decorative Arts','Декоративное искусство'),maker:bi('English','Англия'),period:bi('19th century','XIX век'),origin:bi('United Kingdom','Великобритания'),materials:bi('Walnut, brass','Орех, латунь'),dimensions:bi('12 × 42 × 28 cm','12 × 42 × 28 см'),description:bi('Seller-supplied draft catalogue description.','Черновое каталожное описание продавца.'),provenance:bi('Private collection, acquired before 2010','Частная коллекция, приобретено до 2010 года'),condition:bi('Surface wear; lock not tested','Потёртости поверхности; замок не проверен'),price:2400,estimateLow:1800,estimateHigh:2600,shippingFrom:'Amsterdam',media:[{url:'https://images.metmuseum.org/CRDImages/es/web-large/DP247929.jpg',role:'PRIMARY'}],documents:[],reviewNotes:[bi('Add clear photographs of marks, underside and condition details.','Добавьте чёткие фотографии маркировок, нижней части и деталей состояния.')]}],
 ['draft-2',{id:'draft-2',sellerId:'seller-preview',status:'DRAFT',saleRoute:'AUCTION',createdAt:new Date(t0-86400000).toISOString(),updatedAt:new Date(t0-3600000).toISOString(),title:bi('A bronze desk object','Бронзовый кабинетный предмет'),category:bi('Works of Art','Предметы искусства'),maker:bi('',''),period:bi('circa 1900','около 1900 года'),origin:bi('France','Франция'),materials:bi('Bronze','Бронза'),dimensions:bi('',''),description:bi('',''),provenance:bi('',''),condition:bi('',''),price:0,estimateLow:1200,estimateHigh:1800,shippingFrom:'Amsterdam',media:[],documents:[],reviewNotes:[]}]
]);

export const offers=new Map();
export const orders=new Map();
export const messages=new Map();
export const clients=new Map();
export const idem=new Map();
