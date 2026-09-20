import {db,lots,listings,auctions,lot,publicAuction,bi} from './runtime-v09.mjs';

const norm=v=>String(v?.en??v??'').trim().toLowerCase().replace(/[‐‑‒–—]/g,'-');
const words=v=>new Set(norm(v).split(/[^a-z0-9]+/).filter(x=>x.length>2&&!['the','and','with','style','century'].includes(x)));
const equal=(a,b)=>Boolean(norm(a)&&norm(a)===norm(b));
const overlap=(a,b)=>[...words(a)].filter(x=>words(b).has(x));
const midpoint=o=>(Number(o.estimateLow||0)+Number(o.estimateHigh||0))/2;

function centuries(v){
 const s=norm(v),out=new Set();
 for(const m of s.matchAll(/(\d{1,2})(?:st|nd|rd|th)\s*century/g))out.add(Number(m[1]));
 for(const m of s.matchAll(/\b(1[0-9]{3}|20[0-9]{2})\b/g)){const y=Number(m[1]);out.add(Math.ceil(y/100))}
 return out;
}
const centuryOverlap=(a,b)=>{const aa=centuries(a),bb=centuries(b);return [...aa].some(x=>bb.has(x))};
function activeListing(objectId){return[...listings.values()].find(x=>x.lotId===objectId&&x.status==='ACTIVE')||null}
function activeAuction(objectId){const a=auctions.find(x=>x.lotId===objectId);if(!a)return null;const p=publicAuction(a);return p.state==='CLOSED'?null:p}
function commerceFor(o){
 const li=activeListing(o.id);if(li)return{kind:li.saleType,status:li.status,price:Number(li.price),currency:li.currency||o.currency||'EUR'};
 const a=activeAuction(o.id);if(a)return{kind:'AUCTION',status:a.state,price:Number(a.currentBid),currency:a.currency||o.currency||'EUR'};
 return{kind:'REFERENCE',status:'NOT_FOR_SALE',price:midpoint(o),currency:o.currency||'EUR'};
}
function reason(code,ru,en,value=null){return{code,label:bi(en,ru),value}}
function compareCandidate(source,candidate){
 const reasons=[],materials=overlap(source.materials,candidate.materials),sameMaker=equal(source.maker,candidate.maker),sameDepartment=equal(source.department,candidate.department),sameOrigin=equal(source.origin,candidate.origin),samePeriod=centuryOverlap(source.period,candidate.period);
 const sourceCommerce=commerceFor(source),candidateCommerce=commerceFor(candidate),den=Math.max(sourceCommerce.price||0,candidateCommerce.price||0,1),priceDistance=Math.abs((sourceCommerce.price||0)-(candidateCommerce.price||0))/den,closePrice=priceDistance<=.25;
 if(sameMaker)reasons.push(reason('SAME_MAKER','Тот же мастер / атрибуция','Same maker / attribution',candidate.maker));
 if(sameDepartment)reasons.push(reason('SAME_DEPARTMENT','Та же категория','Same category',candidate.department));
 if(materials.length)reasons.push(reason('MATERIAL_OVERLAP','Общий материал','Shared material',bi(materials.slice(0,3).join(', '),materials.slice(0,3).join(', '))));
 if(samePeriod)reasons.push(reason('PERIOD_OVERLAP','Близкий исторический период','Related historical period',candidate.period));
 if(sameOrigin)reasons.push(reason('SAME_ORIGIN','То же происхождение','Same origin',candidate.origin));
 if(closePrice)reasons.push(reason('PRICE_PROXIMITY','Близкий ценовой диапазон','Similar price range',null));
 const conceptual=Number(sameMaker)+Number(sameDepartment)+materials.length+Number(samePeriod)+Number(sameOrigin);
 if(!conceptual)return null;
 const strength=(sameDepartment&&(sameMaker||materials.length||samePeriod||sameOrigin))||(sameMaker&&(materials.length||samePeriod||sameOrigin))?'HIGH':sameDepartment||sameMaker||(materials.length&&(samePeriod||sameOrigin))?'MEDIUM':'LOW';
 return{candidate,reasons,strength,rank:{sameMaker:Number(sameMaker),sameDepartment:Number(sameDepartment),materials:materials.length,samePeriod:Number(samePeriod),sameOrigin:Number(sameOrigin),priceDistance}};
}
function cmp(a,b){
 return b.rank.sameDepartment-a.rank.sameDepartment||
  b.rank.sameMaker-a.rank.sameMaker||
  b.rank.materials-a.rank.materials||
  b.rank.samePeriod-a.rank.samePeriod||
  b.rank.sameOrigin-a.rank.sameOrigin||
  a.rank.priceDistance-b.rank.priceDistance||
  a.candidate.lotNumber-b.candidate.lotNumber;
}
function publicItem(x){
 const o=x.candidate;
 return{id:o.id,objectId:o.objectId,title:o.title,image:o.image,department:o.department,maker:o.maker,period:o.period,origin:o.origin,materials:o.materials,conditionGrade:o.conditionGrade,commerce:commerceFor(o),strength:x.strength,reasons:x.reasons};
}
export function similarityCapabilities(){return{method:'CATALOGUE_RULES_V1',ranking:'LEXICOGRAPHIC_EXPLAINABLE',personalized:false,behavioralInputs:false,opaqueScore:false,reasonCodes:['SAME_MAKER','SAME_DEPARTMENT','MATERIAL_OVERLAP','PERIOD_OVERLAP','SAME_ORIGIN','PRICE_PROXIMITY']}}
async function publicObjectIds(){
 if(db.kind!=='POSTGRES')return new Set(lots.map(x=>x.id));
 const rows=(await db.pool.query("SELECT id FROM objects WHERE publication_status='PUBLIC' AND catalogue_status='APPROVED'")).rows;
 return new Set(rows.map(x=>String(x.id)));
}
export async function similarObjectsFor(objectId,{limit=4}={}){
 const source=lot(String(objectId||''));if(!source)return null;
 const visible=await publicObjectIds();if(!visible.has(source.id))return null;
 limit=Math.max(1,Math.min(12,Number(limit)||4));
 const rows=lots.filter(x=>x.id!==source.id&&visible.has(x.id)).map(x=>compareCandidate(source,x)).filter(Boolean).sort(cmp).slice(0,limit).map(publicItem);
 return{source:{id:source.id,objectId:source.objectId,title:source.title},items:rows,capabilities:similarityCapabilities()};
}
