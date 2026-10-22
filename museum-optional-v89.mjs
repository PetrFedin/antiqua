// ANTIQUA v89: bounded museum metadata import. This is an educational
// reference-only projection, never an auction, Passport or ownership authority.
// Upstream is EXACTLY one hardcoded source and five reviewed optional AIC IDs.
export const MUSEUM_OPTIONAL_IDS_V89=Object.freeze([16568,16571,111442,61128,25865]);
const FIELDS='id,title,artist_display,date_display,medium_display,dimensions,main_reference_number,artwork_type_title,is_public_domain,image_id';
export const MUSEUM_OPTIONAL_SOURCE_V89=
 'https://api.artic.edu/api/v1/artworks?ids='+MUSEUM_OPTIONAL_IDS_V89.join(',')+'&fields='+FIELDS;
const ALLOWED=new Set(MUSEUM_OPTIONAL_IDS_V89);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BYTES=65536;
const LIMIT_MS=4500;
const empty=()=>({status:'UNAVAILABLE',data:[],source:'ART_INSTITUTE_OF_CHICAGO',verified:false});
const bounded=(x,max=220)=>typeof x==='string'?x.trim().slice(0,max):'';

export function projectVerifiedMuseumOptionalV89(payload){
 if(!payload||!Array.isArray(payload.data))return {status:'UNAVAILABLE',data:[],source:'ART_INSTITUTE_OF_CHICAGO',verified:false};
 const counts=new Map();
 for(const item of payload.data){
  if(item&&typeof item==='object'&&ALLOWED.has(item.id))
   counts.set(item.id,(counts.get(item.id)||0)+1);
 }
 const data=payload.data.flatMap(item=>{
  if(!item||typeof item!=='object'||Array.isArray(item)||
   !ALLOWED.has(item.id)||counts.get(item.id)!==1||
   item.artwork_type_title!=='Painting'||item.is_public_domain!==true||
   !UUID.test(String(item.image_id||''))||!bounded(item.title))return[];
  // No artist/identity guessing. Only source fields explicitly requested.
  return [{
   id:item.id,title:bounded(item.title),artist_display:bounded(item.artist_display),
   date_display:bounded(item.date_display,100),
   medium_display:bounded(item.medium_display,240),
   dimensions:bounded(item.dimensions,220),
   main_reference_number:bounded(item.main_reference_number,80),
   artwork_type_title:'Painting',is_public_domain:true,
   image_id:String(item.image_id).toLowerCase()
  }];
 });
 return {status:'VERIFIED',data,source:'ART_INSTITUTE_OF_CHICAGO',verified:true};
}

async function readBoundedJsonV89(response){
 const declared=Number(response.headers?.get?.('content-length')||0);
 if(Number.isFinite(declared)&&declared>MAX_BYTES)throw Error('MUSEUM_RESPONSE_TOO_LARGE');
 const reader=response.body?.getReader?.();
 if(!reader){
  const text=await response.text();
  if(Buffer.byteLength(text,'utf8')>MAX_BYTES)throw Error('MUSEUM_RESPONSE_TOO_LARGE');
  return JSON.parse(text);
 }
 let size=0,body='';
 const decoder=new TextDecoder('utf-8',{fatal:true});
 try{
  while(true){
   const chunk=await reader.read();
   if(chunk.done)break;
   size+=chunk.value.byteLength;
   if(size>MAX_BYTES)throw Error('MUSEUM_RESPONSE_TOO_LARGE');
   body+=decoder.decode(chunk.value,{stream:true});
  }
  body+=decoder.decode();
  return JSON.parse(body);
 }finally{
  // Cancel only unread bodies; the bounded projection never retains streams.
  try{reader.releaseLock()}catch{}
 }
}

export async function fetchMuseumOptionalV89({fetchImpl=fetch,timeoutMs=LIMIT_MS}={}){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),Math.max(500,Math.min(6000,timeoutMs)));
 try{
  const response=await fetchImpl(MUSEUM_OPTIONAL_SOURCE_V89,{
   method:'GET',redirect:'error',signal:controller.signal,
   headers:{accept:'application/json'}
  });
  const type=String(response.headers?.get?.('content-type')||'').toLowerCase();
  if(!response.ok||!type.includes('application/json'))return empty();
  return projectVerifiedMuseumOptionalV89(await readBoundedJsonV89(response));
 }catch{return empty()}finally{clearTimeout(timer)}
}
