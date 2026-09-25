import {PREVIEW,db,send,storageConfig,SALE,lots,auctions,listings,bi,publicAuction,seller,lot,objectRiskFlags,authContext} from './runtime-v09.mjs';
import {financeCapabilities} from './finance-v10.mjs';
import {publicOwnershipHistory} from './ownership-v14.mjs';
import {passportRevisionHistory} from './passport-revisions-v16.mjs';
import {listAuthoritativePublicAuctions,getAuthoritativePublicAuction,getAuthoritativePublicAuctionForObject} from './auction-authority-v15.mjs';
import {listPublicSellerProfiles,getPublicSellerProfile,organizationCapabilities} from './organizations-v15.mjs';
import {recordObjectView,engagementCapabilities} from './engagement-v17.mjs';
import {auctionResultCapabilities} from './auction-results-v20.mjs';
import {inquiryCapabilities} from './inquiry-v21.mjs';
import {conditionReportCapabilities} from './condition-report-v23.mjs';
import {viewingCapabilities} from './viewing-v23.mjs';

const techniques={
 'lot-101':bi('Gilt-bronze mounting & enamelling','Монтаж золочёной бронзы и эмаль'),
 'lot-102':bi('Tin glazing','Оловянная глазурь'),'lot-103':bi('Bronze casting & patination','Литьё бронзы и патинирование'),
 'lot-104':bi('Oil painting','Масляная живопись'),'lot-105':bi('Stone carving','Резьба по камню'),
 'lot-106':bi('Cabinetmaking & gilt-bronze mounting','Краснодеревное дело и золочёная бронза'),
 'lot-107':bi('Porcelain forming & glazing','Формовка фарфора и глазурование'),'lot-108':bi('Manuscript illumination','Книжная миниатюра'),
 'lot-109':bi('Cabinetmaking','Краснодеревное дело'),'lot-110':bi('Silversmithing','Серебряное дело'),
 'lot-111':bi('Porcelain modelling','Моделирование фарфора'),'lot-112':bi('Bronze casting & patination','Литьё бронзы и патинирование')
};
const locations={Amsterdam:bi('Amsterdam','Амстердам'),London:bi('London','Лондон')};
const purchaseLabels={BUY_NOW:bi('Buy now','Купить сейчас'),MAKE_OFFER:bi('Make offer','Предложить цену'),AUCTION:bi('Auction','Аукцион'),PRIVATE_SALE:bi('Private sale','Частная продажа')};
const statusLabels={"A-":bi('Very good','Очень хорошее'),B:bi('Good','Хорошее')};
const unique=(xs,key=x=>JSON.stringify(x))=>{const m=new Map();for(const x of xs){if(x==null)continue;const k=key(x);if(!m.has(k))m.set(k,x)}return[...m.values()]};
const pairKey=x=>`${x?.en||''}|${x?.ru||''}`;
function techniqueFor(o){return o.technique||techniques[o.id]||bi('Specialist technique review pending','Техника ожидает проверки специалистом')}
function locationFor(o){return o.locationLabel||locations[o.location]||bi(String(o.location||'Not specified'),String(o.location||'Не указано'))}
function restorationFor(o){if(String(o.restoration?.en||'').startsWith('No restoration asserted'))return bi(o.restoration.en,'В демонстрационной записи реставрация не заявлена');return o.restoration}
function activeListingFor(id){return[...listings.values()].find(x=>x.lotId===id&&x.status==='ACTIVE')||null}
function auctionFor(id,auctionByLot=null){if(auctionByLot)return auctionByLot.get(id)||null;const a=auctions.find(x=>x.lotId===id);return a?publicAuction(a):null}
function purchaseMethodsFor(o,auctionByLot=null){const out=[],li=activeListingFor(o.id),au=auctionFor(o.id,auctionByLot);if(li)out.push(li.saleType);if(au&&au.state!=='CLOSED')out.push('AUCTION');return unique(out)}
function enrichLot(o,auctionByLot=null){const methods=purchaseMethodsFor(o,auctionByLot);return{...o,restoration:restorationFor(o),technique:techniqueFor(o),locationLabel:locationFor(o),conditionLabel:statusLabels[o.conditionGrade]||bi(o.conditionGrade||'Not graded',o.conditionGrade||'Без оценки'),purchaseMethods:methods,primaryPurchaseMethod:methods[0]||'NOT_FOR_SALE'}}
function publicListingV13(x,auctionByLot=null,sellerById=null){return{...x,purchaseMethod:x.saleType,lot:enrichLot(lot(x.lotId),auctionByLot),seller:sellerById?.get(x.sellerId)||seller(x.sellerId)}}
function facetOptions(values){return unique(values,pairKey).sort((a,b)=>String(a.en||'').localeCompare(String(b.en||''))).map(x=>({value:x.en,label:x}))}
function materialOptions(objects){const all=[];for(const o of objects){const en=String(o.materials?.en||'').split(',').map(x=>x.trim()).filter(Boolean),ru=String(o.materials?.ru||'').split(',').map(x=>x.trim()).filter(Boolean);en.forEach((x,i)=>all.push(bi(x,ru[i]||x)))}return facetOptions(all)}
function buildFacets(objects,activeListings,publicAuctions,sellerProfiles){const prices=[...activeListings.map(x=>Number(x.price)),...publicAuctions.filter(x=>x.state!=='CLOSED').map(x=>Number(x.currentBid))].filter(Number.isFinite);return{
 categories:facetOptions(objects.map(x=>x.department)),
 eras:facetOptions(objects.map(x=>x.period)),
 countries:facetOptions(objects.map(x=>x.origin)),
 materials:materialOptions(objects),
 techniques:facetOptions(objects.map(x=>x.technique)),
 conditions:unique(objects.map(x=>({value:x.conditionGrade,label:x.conditionLabel})),x=>x.value),
 locations:facetOptions(objects.map(x=>x.locationLabel)),
 purchaseMethods:Object.entries(purchaseLabels).map(([value,label])=>({value,label})),
 sellers:sellerProfiles.map(s=>({value:s.id,label:bi(s.name,s.name)})),
 price:{currency:'EUR',min:prices.length?Math.min(...prices):0,max:prices.length?Math.max(...prices):0}
}}
export async function routeProductPublicV13(req,res,url){
 if(url.pathname==='/api/health'&&req.method==='GET'){const finance=financeCapabilities();return send(res,200,{status:'ok',service:'antiqua-preview',version:'0.13.0',uiVersion:'0.13.0',preview:PREVIEW,persistence:await db.health(),objectStorage:storageConfig(),auth:{sessions:true,passwordHash:'scrypt',twoFactor:'TOTP',recoveryCodes:true,csrf:true},auctionIntegrity:{engine:db.kind==='POSTGRES'?'POSTGRES_ROW_LOCK':'SERIALIZED_MEMORY_PREVIEW',serverClock:true,idempotencyRequired:true,proxyMaxPrivate:true,authoritativeReads:db.kind==='POSTGRES'},organizations:organizationCapabilities(),engagement:engagementCapabilities(),collectionGraph:{collections:true,distributedEnsembles:true,virtualExhibitions:true,iiif:true,linkedArt:true},interaction:{touchFirst:true,directManipulation:true,bottomSheets:true,safeArea:true,reducedMotion:true,dossierCommerce:true,fullscreenGallery:true,pinchZoom:true,dossierNeighbors:true,bilingual:true,nativeBilingualData:true,alignedCards:true,advancedFacets:true,compareObjects:true,productionAccount:true,productionDossier:true,dealerStorefront:true,collectionBuilder:true,exhibitionBuilder:true,ensembleMap:true,explainableSimilarObjects:true,shareablePassport:true,watchNotifications:true,publicAuctionResults:true,objectInquiry:true,conditionReports:true,viewingRequests:true},auctionResults:auctionResultCapabilities(),inquiries:inquiryCapabilities(),commercialServices:{conditionReports:conditionReportCapabilities(),viewings:viewingCapabilities()},payments:{ledgerSchema:finance.ledger,doubleEntry:finance.doubleEntry,payoutHolds:finance.payoutHolds,reconciliation:finance.reconciliation,providerConfigured:finance.providerConfigured},verification:{providerAdapter:true,providerConfigured:Boolean(process.env.KYC_PROVIDER&&process.env.KYC_PROVIDER!=='NOT_CONFIGURED')},time:new Date().toISOString()})}
 if(url.pathname==='/api/catalog'&&req.method==='GET'){const publicAuctions=await listAuthoritativePublicAuctions(),auctionByLot=new Map(publicAuctions.map(a=>[a.lotId,a])),objects=lots.map(o=>enrichLot(o,auctionByLot)),active=[...listings.values()].filter(x=>x.status==='ACTIVE'),sellerProfiles=await listPublicSellerProfiles(),sellerById=new Map(sellerProfiles.map(s=>[s.id,s]));return send(res,200,{sale:{id:SALE,title:bi('The Collector','Коллекционер'),location:bi('Amsterdam · Online','Амстердам · Онлайн'),status:'LIVE'},lots:objects,auctions:publicAuctions,listings:active.map(x=>publicListingV13(x,auctionByLot,sellerById)),sellers:sellerProfiles,facets:buildFacets(objects,active,publicAuctions,sellerProfiles),catalogueVersion:'0.15'})}
 const hm=url.pathname.match(/^\/api\/auctions\/([^/]+)\/history$/);if(hm&&req.method==='GET'){const a=await getAuthoritativePublicAuction(hm[1]);return a?send(res,200,{auction:a,history:a.history}):send(res,404,{error:'Auction not found'})}
 const sm=url.pathname.match(/^\/api\/sellers\/([^/]+)$/);if(sm&&req.method==='GET'){const s=await getPublicSellerProfile(sm[1]);if(!s)return send(res,404,{error:'Seller not found'});const publicAuctions=await listAuthoritativePublicAuctions(),auctionByLot=new Map(publicAuctions.map(a=>[a.lotId,a])),sellerById=new Map([[s.id,s]]);return send(res,200,{seller:s,inventory:[...listings.values()].filter(x=>x.sellerId===s.id&&x.status==='ACTIVE').map(x=>publicListingV13(x,auctionByLot,sellerById))})}
 const pm=url.pathname.match(/^\/api\/lots\/([^/]+)\/passport$/);if(pm&&req.method==='GET'){const raw=lot(pm[1]);if(!raw)return send(res,404,{error:'Object not found'});const aa=await getAuthoritativePublicAuctionForObject(raw.id),auctionByLot=new Map(aa?[[raw.id,aa]]:[]),o=enrichLot(raw,auctionByLot),li=activeListingFor(o.id),viewer=await authContext(req),ownershipHistory=await publicOwnershipHistory(db,o.id),revisionHistory=await passportRevisionHistory(o.id,{includePrivate:false,limit:20}),sellerProfile=li?await getPublicSellerProfile(li.sellerId):null,sellerById=new Map(sellerProfile?[[sellerProfile.id,sellerProfile]]:[]);await recordObjectView(db,req,viewer?.account||null,o.id,{ownerSellerId:li?.sellerId||[...listings.values()].find(x=>x.lotId===o.id)?.sellerId||raw.sellerId||null});return send(res,200,{lot:{...o,passportHash:revisionHistory?.currentHash||o.passportHash||null},commercial:{listing:li?publicListingV13(li,auctionByLot,sellerById):null,auction:aa},riskFlags:objectRiskFlags(raw),ownershipHistory,passportRevision:{revisionNo:revisionHistory?.currentRevisionNo||1,hash:revisionHistory?.currentHash||o.passportHash||null},revisionHistory:revisionHistory?.revisions||[],disclaimer:bi('Catalogue approval is not a guarantee of authenticity.','Каталожное одобрение не является гарантией подлинности.'),dossier:{permanentPassport:true,passportRevisions:true,evidenceStateModel:true,ownershipHistory:true,iiif:true,linkedArt:true,engagement:engagementCapabilities()}})}
 return false
}