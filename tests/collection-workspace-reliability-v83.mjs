import assert from 'node:assert/strict';

// Execute the real browser handlers and core HTTP client with deterministic
// transport failures and detached DOM nodes. No DB or publication is simulated
// as approved; these checks cover only client delivery and render isolation.
const handlers=new Map();
let output;
globalThis.document={cookie:'antiqua_csrf=test-csrf',
 addEventListener:(kind,fn)=>handlers.set(kind,fn),
 querySelector:selector=>selector==='[data-review-output]'?output:null};
globalThis.localStorage={getItem:()=> 'en'};
globalThis.FormData=class {constructor(form){this.values=form.values}get(key){return this.values[key]??null}};
const requests=[];
let transport;
globalThis.fetch=async(path,options)=>{
 requests.push({path,options});return transport(path,options);
};
const ok=data=>({ok:true,status:200,json:async()=>data});
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return{promise,resolve}};
const node=()=>({isConnected:true,innerHTML:'',querySelector:()=>null});
const {loadReviewQueue}=await import('../public/modules/collection-publication-ui.js');

// The last initiated read wins, even when server responses arrive backwards.
output=node();const active=output,older=deferred(),newer=deferred();
let count=0;transport=()=>++count===1?older.promise:newer.promise;
const first=loadReviewQueue(),second=loadReviewQueue();
newer.resolve(ok({items:[{id:'new',title:'Newest case',stage:'CATALOGUE'}]}));await second;
older.resolve(ok({items:[{id:'old',title:'Stale private case',stage:'CATALOGUE'}]}));await first;
assert.match(active.innerHTML,/Newest case/);assert.doesNotMatch(active.innerHTML,/Stale private case/);

// Replacing a workspace while a request is pending cannot leak the old inbox.
const pending=deferred();transport=()=>pending.promise;
const read=loadReviewQueue();active.isConnected=false;output=node();output.innerHTML='New account';
pending.resolve(ok({items:[{id:'secret',title:'Previous account confidential queue'}]}));await read;
assert.equal(output.innerHTML,'New account');

// A late error also cannot replace another account's current workspace.
const lateError=deferred();transport=()=>lateError.promise;
const failedRead=loadReviewQueue();output.isConnected=false;output=node();output.innerHTML='Safe';
lateError.resolve({ok:false,status:503,json:async()=>({error:'unavailable'})});await failedRead;
assert.equal(output.innerHTML,'Safe');

// Late reviewer dossier response uses its original container, not a new one.
const previous=output,detail=deferred();transport=()=>detail.promise;
const openButton={dataset:{reviewOpen:'old-case'},disabled:false,isConnected:true,closest:()=>null};
const opening=handlers.get('click')({target:{closest:()=>openButton}});
previous.isConnected=false;openButton.isConnected=false;output=node();output.innerHTML='Other account';
detail.resolve(ok({collectionId:'old-case',stage:'CATALOGUE',title:'PRIVATE DOSSIER',works:[]}));await opening;
assert.equal(output.innerHTML,'Other account');

// Identical user retries after a lost response carry the original key and CSRF.
const button={disabled:false};
const form={id:'collectionReviewDecisionForm',dataset:{collection:'case-83',reviewToken:'a'.repeat(64)},isConnected:true,
 values:{action:'approve',note:'Independently checked catalogue'},
 querySelector:()=>button,closest:()=>output};
transport=async()=>{throw new TypeError('Connection lost after server commit')};
const submit=()=>handlers.get('submit')({target:form,preventDefault(){}});
await submit();await submit();
let posts=requests.filter(r=>r.options?.method==='POST');
assert.equal(posts.length,2);assert.equal(posts[0].options.headers['x-csrf-token'],'test-csrf');
assert.equal(JSON.parse(posts[0].options.body).idempotencyKey,JSON.parse(posts[1].options.body).idempotencyKey);
form.values.note='Changed independent catalogue assessment';await submit();
posts=requests.filter(r=>r.options?.method==='POST');
assert.notEqual(JSON.parse(posts[1].options.body).idempotencyKey,JSON.parse(posts[2].options.body).idempotencyKey);
assert.equal(button.disabled,false);

// Server success clears the retry identity; the next intentional action is new.
const successfulKey=JSON.parse(posts.at(-1).options.body).idempotencyKey;
transport=async()=>ok({items:[]});await submit();await submit();
posts=requests.filter(r=>r.options?.method==='POST');
assert.equal(JSON.parse(posts.at(-2).options.body).idempotencyKey,successfulKey);
assert.notEqual(JSON.parse(posts.at(-1).options.body).idempotencyKey,successfulKey);

// Owner submission also survives an uncertain network failure without new keys.
const ownerButton={dataset:{collectionSubmit:'owner-case'},disabled:false,isConnected:true,closest:()=>null};
transport=async()=>{throw new TypeError('Lost reply')};
const clickOwner=()=>handlers.get('click')({target:{closest:()=>ownerButton}});
await clickOwner();await clickOwner();
posts=requests.filter(r=>r.path.endsWith('/publication/submit'));
assert.equal(posts.length,2);
assert.equal(JSON.parse(posts[0].options.body).idempotencyKey,JSON.parse(posts[1].options.body).idempotencyKey);
console.log('ANTIQUA v83 workspace: lost-response replay, CSRF, changed payload, stale response and account isolation PASS');
