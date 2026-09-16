import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {Pool} from 'pg';

if(!process.env.DATABASE_URL){console.log('ANTIQUA 0.15 PostgreSQL organizations: skipped (DATABASE_URL not set)');process.exit(0)}

const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSL==='disable'?false:{rejectUnauthorized:false},max:4});
const port=12023,base=`http://127.0.0.1:${port}`,appSecret=crypto.randomBytes(32).toString('hex'),sleep=ms=>new Promise(r=>setTimeout(r,ms));let child=null;

class Client{
  constructor(){this.cookies=new Map()}
  header(){return[...this.cookies].map(([k,v])=>`${k}=${v}`).join('; ')}
  async call(path,opts={}){
    const headers={'content-type':'application/json',...(opts.headers||{})};if(this.cookies.size)headers.cookie=this.header();
    if(!['GET','HEAD'].includes((opts.method||'GET').toUpperCase())&&this.cookies.get('antiqua_csrf'))headers['x-csrf-token']=decodeURIComponent(this.cookies.get('antiqua_csrf'));
    const r=await fetch(base+path,{...opts,headers});for(const s of r.headers.getSetCookie?.()||[]){const[kv]=s.split(';'),i=kv.indexOf('=');if(i>0)this.cookies.set(kv.slice(0,i),kv.slice(i+1))}
    let body;try{body=await r.json()}catch{body=null}return{r,body};
  }
}
async function start(){child=spawn(process.execPath,['server-v14.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),PREVIEW_MODE:'true',APP_SECRET:appSecret,NODE_ENV:'test',PGSSL:'disable'},stdio:['ignore','pipe','pipe']});let stderr='';child.stderr?.on('data',b=>stderr+=String(b));for(let i=0;i<180;i++){if(child.exitCode!=null)throw new Error(`Server exited before readiness: ${stderr}`);try{if((await fetch(base+'/api/health')).ok)return}catch{}await sleep(100)}throw new Error(`Server not ready: ${stderr}`)}
async function stop(){if(!child)return;const p=child;child=null;if(p.exitCode==null)p.kill('SIGTERM');await Promise.race([new Promise(r=>p.once('exit',r)),sleep(5000)]);if(p.exitCode==null)p.kill('SIGKILL');await sleep(150)}

try{
  await start();
  const token=crypto.randomUUID(),sellerEmail=`org-seller-${token}@example.test`,memberEmail=`org-member-${token}@example.test`,password=`Aa1!${crypto.randomBytes(18).toString('base64url')}`;
  const owner=new Client(),member=new Client();
  let x=await owner.call('/api/auth/register',{method:'POST',body:JSON.stringify({email:sellerEmail,displayName:`Durable Dealer ${token.slice(0,8)}`,password,accountType:'SELLER'})});assert.equal(x.r.status,201);const sellerId=x.body.account.sellerId;assert.ok(sellerId);
  x=await member.call('/api/auth/register',{method:'POST',body:JSON.stringify({email:memberEmail,displayName:'Dealer Cataloguer',password,accountType:'BUYER'})});assert.equal(x.r.status,201);const memberAccountId=x.body.account.id;

  x=await owner.call('/api/organizations/me');assert.equal(x.r.status,200);assert.equal(x.body.memberships.length,1);const membership=x.body.memberships[0],organizationId=membership.organization.id;assert.equal(membership.role,'OWNER');assert.equal(membership.status,'ACTIVE');assert.equal(membership.organization.sellerId,sellerId);assert.equal(membership.organization.status,'ACTIVE');

  const publicName=`Durable Gallery ${token.slice(0,8)}`;
  x=await owner.call(`/api/organizations/${organizationId}`,{method:'PATCH',body:JSON.stringify({name:publicName,legalName:'Private Legal Entity BV',city:{en:'Amsterdam',ru:'Амстердам'},country:{en:'Netherlands',ru:'Нидерланды'},specialties:['Furniture','Decorative Arts'],about:{en:'Durable dealer authority',ru:'Постоянный профиль дилера'},publicPolicies:{en:'Insured shipping',ru:'Застрахованная доставка'},website:'https://dealer.example.test',publicEmail:sellerEmail})});assert.equal(x.r.status,200);assert.equal(x.body.organization.name,publicName);assert.equal(x.body.membership.role,'OWNER');

  x=await owner.call(`/api/organizations/${organizationId}/members`,{method:'POST',body:JSON.stringify({email:memberEmail,role:'CATALOGUER'})});assert.equal(x.r.status,200);assert.equal(x.body.member.accountId,memberAccountId);assert.equal(x.body.member.role,'CATALOGUER');
  x=await owner.call(`/api/organizations/${organizationId}/members`);assert.equal(x.r.status,200);assert.ok(x.body.members.some(m=>m.accountId===memberAccountId&&m.role==='CATALOGUER'));

  x=await member.call('/api/organizations/me');assert.equal(x.r.status,200);const memberMembership=x.body.memberships.find(m=>m.organization.id===organizationId);assert.ok(memberMembership);assert.equal(memberMembership.role,'CATALOGUER');
  x=await member.call(`/api/organizations/${organizationId}`,{method:'PATCH',body:JSON.stringify({name:'Unauthorized rename'})});assert.equal(x.r.status,403);assert.equal(x.body.code,'ORGANIZATION_FORBIDDEN');

  x=await owner.call('/api/catalog');assert.equal(x.r.status,200);let publicProfile=x.body.sellers.find(s=>s.id===sellerId);assert.ok(publicProfile);assert.equal(publicProfile.name,publicName);assert.equal(publicProfile.organizationId,organizationId);assert.equal('legalName' in publicProfile,false);assert.equal('members' in publicProfile,false);
  x=await owner.call(`/api/sellers/${sellerId}`);assert.equal(x.r.status,200);assert.equal(x.body.seller.name,publicName);assert.equal('legalName' in x.body.seller,false);

  const dbOrg=(await pool.query('SELECT id,seller_id,name,status FROM organizations WHERE id=$1',[organizationId])).rows[0];assert.equal(dbOrg.seller_id,sellerId);assert.equal(dbOrg.name,publicName);assert.equal(dbOrg.status,'ACTIVE');
  let count=Number((await pool.query('SELECT count(*)::int AS n FROM organization_members WHERE organization_id=$1 AND status=$2',[organizationId,'ACTIVE'])).rows[0].n);assert.equal(count,2);

  await stop();await start();
  x=await owner.call('/api/organizations/me');assert.equal(x.r.status,200);const afterRestart=x.body.memberships.find(m=>m.organization.id===organizationId);assert.ok(afterRestart);assert.equal(afterRestart.role,'OWNER');assert.equal(afterRestart.organization.name,publicName);
  x=await member.call('/api/organizations/me');assert.equal(x.r.status,200);assert.equal(x.body.memberships.find(m=>m.organization.id===organizationId)?.role,'CATALOGUER');
  x=await owner.call('/api/catalog');assert.equal(x.r.status,200);publicProfile=x.body.sellers.find(s=>s.id===sellerId);assert.ok(publicProfile);assert.equal(publicProfile.name,publicName);
  count=Number((await pool.query('SELECT count(*)::int AS n FROM organizations WHERE seller_id=$1',[sellerId])).rows[0].n);assert.equal(count,1,'seller retries/restarts must not duplicate organization authority');

  console.log('ANTIQUA 0.15 organization proof: seller registration + OWNER/CATALOGUER roles + forbidden admin mutation + public privacy + restart durability passed');
}finally{await stop();await pool.end()}
