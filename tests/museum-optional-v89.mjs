import test from 'node:test';
import assert from 'node:assert/strict';
import {MUSEUM_OPTIONAL_SOURCE_V89,MUSEUM_OPTIONAL_IDS_V89,
  projectVerifiedMuseumOptionalV89,fetchMuseumOptionalV89
} from '../museum-optional-v89.mjs';

const item=(id=16568,extra={})=>({
 id,title:'Water Lilies',artist_display:'Claude Monet (French)',
 artwork_type_title:'Painting',is_public_domain:true,
 image_id:'12345678-1234-4abc-8abc-123456789abc',
 date_display:'1906',medium_display:'Oil on canvas',
 dimensions:'Verified dimensions',main_reference_number:'1933.1157',
 privateOwnerEmail:'SHOULD_NEVER_LEAVE_SOURCE',
 ...extra
});
const valid=data=>({data});
const reply=(data,headers={})=>new Response(JSON.stringify(data),{
 status:200,headers:{'content-type':'application/json',...headers}
});
const states=['SOURCE_FIELDS_FILTERED','UNAVAILABLE'];

test('exact fixed upstream allowlist; no browser-controlled URL, query or wildcard',()=>{
 assert.equal(new URL(MUSEUM_OPTIONAL_SOURCE_V89).host,'api.artic.edu');
 assert.equal(new URL(MUSEUM_OPTIONAL_SOURCE_V89).pathname,'/api/v1/artworks');
 assert.deepEqual(MUSEUM_OPTIONAL_IDS_V89,[16568,16571,111442,61128,25865]);
 assert.deepEqual(new URL(MUSEUM_OPTIONAL_SOURCE_V89).searchParams.get('ids')?.split(',').map(Number),
  MUSEUM_OPTIONAL_IDS_V89);
});

test('source rejects non-paintings, nonpublic works, duplicate IDs, wrong domains and bad image IDs',()=>{
 const result=projectVerifiedMuseumOptionalV89(valid([
  item(),
  item(16571,{artwork_type_title:'Sculpture'}),
  item(111442,{is_public_domain:false}),
  item(61128,{image_id:'invalid'}),
  item(25865),item(25865,{is_public_domain:false}),
  item(1234,{image_id:'12345678-1234-4abc-8abc-123456789abc'})
 ]));
 assert.equal(result.status,'SOURCE_FIELDS_FILTERED');
 assert.equal(result.sourceFieldsValidated,true);
 assert.deepEqual(result.data.map(x=>x.id),[16568]);
 assert.equal('privateOwnerEmail' in result.data[0],false);
 assert.equal(result.data[0].title,'Water Lilies');
 assert.deepEqual(projectVerifiedMuseumOptionalV89(null).data,[]);
 assert.deepEqual(projectVerifiedMuseumOptionalV89({data:'injected'}).data,[]);
});

test('bounded live adapter returns only source-filtered metadata and strips private fields',async()=>{
 let calls=0;
 const fetchImpl=async(url,opts)=>{
  calls++;
  assert.equal(url,MUSEUM_OPTIONAL_SOURCE_V89);
  assert.equal(opts.method,'GET');
  assert.equal(opts.redirect,'error');
  assert.equal(opts.headers.accept,'application/json');
  assert.ok(opts.signal);
  return reply(valid([item()]));
 };
 const result=await fetchMuseumOptionalV89({fetchImpl});
 assert.equal(calls,1);
 assert.equal(result.status,'SOURCE_FIELDS_FILTERED');
 assert.equal(result.data[0].id,16568);
 assert.equal(result.data[0].privateOwnerEmail,undefined);
});

test('non-JSON, HTTP error, truncated JSON and oversized upstream body fail closed',async()=>{
 const responses=[
  ()=>new Response('<html>blocked</html>',{headers:{'content-type':'text/html'}}),
  ()=>new Response(JSON.stringify(valid([item()])),{status:429,headers:{'content-type':'application/json'}}),
  ()=>new Response('{"data": [', {headers:{'content-type':'application/json'}}),
  ()=>new Response('x'.repeat(65537),{headers:{'content-type':'application/json'}}),
  ()=>new Response('{"data":[]}',{headers:{'content-type':'application/json','content-length':'65537'}})
 ];
 for(const maker of responses){
  const result=await fetchMuseumOptionalV89({fetchImpl:async()=>maker()});
  assert.equal(result.status,'UNAVAILABLE');
  assert.deepEqual(result.data,[]);
  assert.equal(result.sourceFieldsValidated,false);
 }
});

test('aborted upstream is silent, bounded and not a false artwork admission',async()=>{
 const start=Date.now();
 const fetchImpl=(_url,{signal})=>new Promise((_resolve,reject)=>{
  signal.addEventListener('abort',()=>reject(new Error('ABORT')), {once:true});
 });
 const result=await fetchMuseumOptionalV89({fetchImpl,timeoutMs:500});
 assert.equal(result.status,'UNAVAILABLE');
 assert.ok(Date.now()-start<2500);
});

test('only the source-field-filtered and unavailable statuses are possible',()=>{
 for(const payload of [undefined,{}, {data:[]},{data:null}]){
  assert.ok(states.includes(projectVerifiedMuseumOptionalV89(payload).status));
 }
});
