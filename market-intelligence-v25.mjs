import {db,lots,bi} from './runtime-v09.mjs';
import {listAuthoritativePublicAuctions} from './auction-authority-v15.mjs';
import {getPublicAuctionResult} from './auction-results-v20.mjs';

const norm=v=>String(v?.en??v??'').trim().toLowerCase().replace(/[‐‑‒–—]/g,'-');
const words=v=>new Set(norm(v).split(/[^a-z0-9]+/).filter(x=>x.length>2&&!['the','and','with','style','century'].includes(x)));
const equal=(a,b)=>Boolean(norm(a)&&norm(a)===norm(b));
const genericAttribution=v=>/\b(school|style)\b/.test(norm(v))||['french','italian','english','chinese','european','continental european','northern italian'].includes(norm(v));
const overlap=(a,b)=>[...words(a)].filter(x=>words(b).has(x));
const parseMs=v=>{const n=Date.parse(v||'');return Number.isFinite(n)?n:0};
const reason=(code,en,ru,value=null)=>({code,label:bi(en,ru),value});

function centuries(v){
 const s=norm(v),out=new Set();
 for(const m of s.matchAll(/(\d{1,2})(?:st|nd|rd|th)\s*century/g))out.add(Number(m[1]));
 for(const m of s.matchAll(/\b(1[0-9]{3}|20[0-9]{2})\b/g)){const y=Number(m[1]);out.add(Math.ceil(y/100))}
 return out
}
const periodOverlap=(a,b)=>{const aa=centuries(a),bb=centuries(b);return[...aa].some(x=>bb.has(x))};

function catalogueReasons(source,candidate){
 const materialWords=overlap(source.materials,candidate.materials);
 const sameMaker=equal(source.maker,candidate.maker)&&!genericAttribution(source.maker);
 const sameDepartment=equal(source.department,candidate.department);
 const samePeriod=periodOverlap(source.period,candidate.period);
 const sameOrigin=equal(source.origin,candidate.origin);
 const reasons=[];
 if(sameMaker)reasons.push(reason('SAME_MAKER','Same maker / attribution','Тот же мастер / атрибуция',candidate.maker));
 if(sameDepartment)reasons.push(reason('SAME_DEPARTMENT','Same category','Та же категория',candidate.department));
 if(materialWords.length)reasons.push(reason('MATERIAL_OVERLAP','Shared material','Общий материал',candidate.materials));
 if(samePeriod)reasons.push(reason('PERIOD_OVERLAP','Related historical period','Близкий исторический период',candidate.period));
 if(sameOrigin)reasons.push(reason('SAME_ORIGIN','Same origin','То же происхождение',candidate.origin));
 return{reasons,rank:{sameMaker:Number(sameMaker),sameDepartment:Number(sameDepartment),materials:materialWords.length,samePeriod:Number(samePeriod),sameOrigin:Number(sameOrigin)}}
}
function comparable(source,record){
 const x=catalogueReasons(source,record);
 const conceptual=x.rank.sameMaker+x.rank.sameDepartment+x.rank.materials+x.rank.samePeriod;
 if(!conceptual)return null;
 const strength=(x.rank.sameMaker&&x.rank.sameDepartment)||(x.rank.sameDepartment&&(x.rank.materials||x.rank.samePeriod))||(x.rank.sameMaker&&(x.rank.materials||x.rank.samePeriod))?'HIGH':conceptual>=2?'MEDIUM':'LOW';
 return{...record,strength,reasons:x.reasons,rank:x.rank}
}
function compareComparable(a,b){
 return b.rank.sameMaker-a.rank.sameMaker||
  b.rank.sameDepartment-a.rank.sameDepartment||
  b.rank.materials-a.rank.materials||
  b.rank.samePeriod-a.rank.samePeriod||
  b.rank.sameOrigin-a.rank.sameOrigin||
  parseMs(b.endedAt)-parseMs(a.endedAt)||
  String(a.auctionId).localeCompare(String(b.auctionId))
}
function median(values){
 if(!values.length)return null;
 const s=[...values].sort((a,b)=>a-b),m=Math.floor(s.length/2);
 return s.length%2?s[m]:Math.round((s[m-1]+s[m])/2)
}
function realizedSummary(items){
 const groups={};
 for(const x of items){
  if(x.status!=='SOLD'||!Number.isSafeInteger(x.realizedAmountMinor)||x.realizedAmountMinor<=0)continue;
  const c=String(x.currency||'EUR').toUpperCase();(groups[c]??=[]).push(x.realizedAmountMinor)
 }
 return Object.fromEntries(Object.entries(groups).map(([currency,values])=>[currency,{
  count:values.length,minMinor:Math.min(...values),medianMinor:median(values),maxMinor:Math.max(...values)
 }]))
}
function publicObject(row){
 const p=row?.passport||row||{};
 return{
  id:row?.id||p.id,objectId:row?.object_code||p.objectId||p.id,
  title:p.title||bi(row?.object_code||p.id||'Object',row?.object_code||p.id||'Предмет'),
  image:p.image||p.media?.find?.(x=>x.role==='PRIMARY')?.url||null,
  department:p.department||p.category||bi('',''),maker:p.maker||bi('',''),period:p.period||bi('',''),
  origin:p.origin||bi('',''),materials:p.materials||bi('',''),estimateLow:p.estimateLow??null,estimateHigh:p.estimateHigh??null,currency:p.currency||'EUR'
 }
}
async function publicCatalogue(){
 if(db.kind!=='POSTGRES')return lots.map(publicObject);
 const rows=(await db.pool.query("SELECT id,object_code,passport FROM objects WHERE publication_status='PUBLIC' AND catalogue_status='APPROVED'")).rows;
 return rows.map(publicObject)
}
function recordFor(auction,result,object){
 return{
  auctionId:result.auctionId,objectId:object.id,objectCode:object.objectId,title:object.title,image:object.image,
  department:object.department,maker:object.maker,period:object.period,origin:object.origin,materials:object.materials,
  estimateLow:object.estimateLow,estimateHigh:object.estimateHigh,estimateCurrency:object.currency||result.currency,
  status:result.status,final:Boolean(result.final),currency:result.currency,
  hammerAmountMinor:result.hammerAmountMinor,realizedAmountMinor:result.realizedAmountMinor,bidCount:result.bidCount,endedAt:result.endedAt,
  source:{type:'PLATFORM',name:'ANTIQUA',saleId:auction.saleId||null}
 }
}

export function marketIntelligenceCapabilities(){
 return{
  contractVersion:'v25',method:'CATALOGUE_COMPARABLE_RULES_V1',ranking:'LEXICOGRAPHIC_EXPLAINABLE',
  catalogueInputs:['MAKER','DEPARTMENT','MATERIALS','PERIOD','ORIGIN_SECONDARY'],
  priceUsedForMatching:false,personalized:false,opaqueScore:false,
  hammerVsRealizedSeparated:true,realizedStatsSoldOnly:true,crossCurrencyAggregation:false,
  publicApprovedObjectsOnly:true,buyerIdentityExposed:false,settlementIdentityExposed:false,
  sourceModel:'EXPLICIT',externalSources:false
 }
}

export function buildMarketIntelligence(source,records,{limit=8}={}){
 if(!source)return null;limit=Math.max(1,Math.min(50,Number(limit)||8));
 const items=(records||[]).filter(x=>x?.object&&x.object.id!==source.id&&x.result)
  .map(x=>comparable(source,recordFor(x.auction,x.result,x.object))).filter(Boolean).sort(compareComparable).slice(0,limit)
  .map(({rank,...x})=>x);
 return{
  source:{id:source.id,objectId:source.objectId,title:source.title,maker:source.maker,department:source.department,period:source.period,materials:source.materials},
  summary:{comparables:items.length,realizedByCurrency:realizedSummary(items)},
  items,capabilities:marketIntelligenceCapabilities()
 }
}

export async function listPublicMarketResults({limit=50,status=null,currency=null}={}){
 limit=Math.max(1,Math.min(200,Number(limit)||50));
 const [objects,auctions]=await Promise.all([publicCatalogue(),listAuthoritativePublicAuctions()]);
 const objectById=new Map(objects.map(x=>[x.id,x])),rows=[];
 for(const auction of auctions){
  if(auction.state!=='CLOSED')continue;
  const object=objectById.get(auction.lotId);if(!object)continue;
  const result=await getPublicAuctionResult(auction.id);if(!result)continue;
  if(status&&String(result.status)!==String(status).toUpperCase())continue;
  if(currency&&String(result.currency).toUpperCase()!==String(currency).toUpperCase())continue;
  rows.push(recordFor(auction,result,object))
 }
 rows.sort((a,b)=>parseMs(b.endedAt)-parseMs(a.endedAt)||String(a.auctionId).localeCompare(String(b.auctionId)));
 return{items:rows.slice(0,limit),capabilities:marketIntelligenceCapabilities()}
}

export async function marketIntelligenceFor(objectId,{limit=8}={}){
 const objects=await publicCatalogue(),source=objects.find(x=>x.id===String(objectId||''));
 if(!source)return null;
 const auctions=await listAuthoritativePublicAuctions(),records=[];
 for(const auction of auctions){
  if(auction.state!=='CLOSED'||auction.lotId===source.id)continue;
  const object=objects.find(x=>x.id===auction.lotId);if(!object)continue;
  const result=await getPublicAuctionResult(auction.id);if(!result)continue;
  records.push({auction,result,object})
 }
 return buildMarketIntelligence(source,records,{limit})
}
