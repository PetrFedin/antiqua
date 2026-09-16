import crypto from 'node:crypto';
import {db,bi,sellers} from './runtime-v09.mjs';

const ORG_ROLES=new Set(['OWNER','ADMIN','CATALOGUER','SALES','FINANCE','LOGISTICS','VIEWER']);
const uid=()=>`org-${crypto.randomUUID().replaceAll('-','').slice(0,20)}`;
const orgError=(message,status=400,code='ORGANIZATION_ERROR')=>Object.assign(new Error(message),{status,code});
const asBi=(value,fallback='Not set')=>{if(value&&typeof value==='object'&&!Array.isArray(value))return{en:String(value.en||value.ru||fallback),ru:String(value.ru||value.en||fallback)};if(String(value||'').trim())return{en:String(value).trim(),ru:String(value).trim()};return bi(fallback,fallback==='Not set'?'Не указано':fallback)};
const mapOrg=r=>r?{id:r.id,sellerId:r.seller_id??r.sellerId,organizationType:r.organization_type??r.organizationType,name:r.name,legalName:r.legal_name??r.legalName??null,slug:r.slug,status:r.status,verified:Boolean(r.verified),city:r.city||{},country:r.country||{},specialties:Array.isArray(r.specialties)?r.specialties:[],about:r.about||{},publicPolicies:r.public_policies??r.publicPolicies??{},website:r.website||null,publicEmail:r.public_email??r.publicEmail??null,publicPhone:r.public_phone??r.publicPhone??null,shippingPolicy:r.shipping_policy??r.shippingPolicy??{},returnPolicy:r.return_policy??r.returnPolicy??{},storefrontMetadata:r.storefront_metadata??r.storefrontMetadata??{},createdAt:r.created_at?.toISOString?.()||r.createdAt,updatedAt:r.updated_at?.toISOString?.()||r.updatedAt}:null;
const publicSeller=o=>({id:o.sellerId,organizationId:o.id,name:o.name,slug:o.slug,city:asBi(o.city),country:asBi(o.country),verified:o.verified,specialties:o.specialties||[],about:asBi(o.about,'ANTIQUA seller'),policies:asBi(o.publicPolicies),website:o.website||null,publicEmail:o.publicEmail||null,publicPhone:o.publicPhone||null,organizationType:o.organizationType});
const orgSelect=`SELECT o.*,d.website,d.public_email,d.public_phone,d.shipping_policy,d.return_policy,d.storefront_metadata FROM organizations o LEFT JOIN dealer_profiles d ON d.organization_id=o.id`;

export async function ensureSellerOrganization(account){
  if(!account?.sellerId)return null;
  if(db.kind!=='POSTGRES'){
    let existing=sellers.get(account.sellerId);if(!existing){existing={id:account.sellerId,name:account.displayName,slug:account.sellerId,city:bi('Not set','Не указано'),country:bi('Not set','Не указано'),verified:false,specialties:[],about:bi('New ANTIQUA seller','Новый продавец ANTIQUA'),policies:bi('Not set','Не указано')};sellers.set(account.sellerId,existing)}
    return{id:`preview-${account.sellerId}`,sellerId:account.sellerId,name:existing.name,slug:existing.slug,status:'ACTIVE',organizationType:'DEALER',verified:Boolean(existing.verified),persistent:false};
  }
  const c=await db.pool.connect();try{
    await c.query('BEGIN');
    let row=(await c.query(`${orgSelect} WHERE o.seller_id=$1 FOR UPDATE OF o`,[account.sellerId])).rows[0];
    if(!row){
      const id=uid(),name=String(account.displayName||'ANTIQUA seller').trim(),slug=String(account.sellerId);
      await c.query(`INSERT INTO organizations(id,seller_id,organization_type,name,slug,status,verified,city,country,specialties,about,public_policies,created_at,updated_at)
        VALUES($1,$2,'DEALER',$3,$4,'ACTIVE',false,$5,$6,'[]',$7,$8,now(),now())`,[id,account.sellerId,name,slug,bi('Not set','Не указано'),bi('Not set','Не указано'),bi('New ANTIQUA seller','Новый продавец ANTIQUA'),bi('Not set','Не указано')]);
      await c.query('INSERT INTO dealer_profiles(organization_id,updated_at) VALUES($1,now()) ON CONFLICT(organization_id) DO NOTHING',[id]);
      row=(await c.query(`${orgSelect} WHERE o.id=$1`,[id])).rows[0];
    }
    await c.query(`INSERT INTO organization_members(organization_id,account_id,role,status,joined_at,updated_at) VALUES($1,$2,'OWNER','ACTIVE',now(),now())
      ON CONFLICT(organization_id,account_id) DO UPDATE SET status='ACTIVE',updated_at=now()`,[row.id,account.id]);
    await c.query('COMMIT');return{...mapOrg(row),persistent:true};
  }catch(e){try{await c.query('ROLLBACK')}catch{}throw e}finally{c.release()}
}

export async function listOrganizationsForAccount(account){
  if(account?.sellerId)await ensureSellerOrganization(account);
  if(db.kind!=='POSTGRES'){const org=account?.sellerId?await ensureSellerOrganization(account):null;return org?[{organization:org,role:'OWNER',status:'ACTIVE'}]:[]}
  const rows=(await db.pool.query(`${orgSelect} JOIN organization_members m ON m.organization_id=o.id WHERE m.account_id=$1 AND m.status='ACTIVE' ORDER BY o.updated_at DESC`,[account.id])).rows;
  return rows.map(r=>({organization:mapOrg(r),role:r.role,status:r.status}));
}

async function membership(accountId,organizationId,client=db.pool){const r=(await client.query('SELECT role,status FROM organization_members WHERE organization_id=$1 AND account_id=$2',[organizationId,accountId])).rows[0];return r&&r.status==='ACTIVE'?{role:r.role,status:r.status}:null}
export async function requireOrganizationRole(accountId,organizationId,roles=null,client=db.pool){if(db.kind!=='POSTGRES')return{role:'OWNER',status:'ACTIVE'};const m=await membership(accountId,organizationId,client);if(!m)throw orgError('Organization not found',404,'ORGANIZATION_NOT_FOUND');if(roles&&!roles.includes(m.role))throw orgError('Organization permission required',403,'ORGANIZATION_FORBIDDEN');return m}

export async function getOrganizationForMember(accountId,organizationId){
  if(db.kind!=='POSTGRES')return null;const m=await requireOrganizationRole(accountId,organizationId);const row=(await db.pool.query(`${orgSelect} WHERE o.id=$1`,[organizationId])).rows[0];if(!row)throw orgError('Organization not found',404,'ORGANIZATION_NOT_FOUND');return{organization:mapOrg(row),membership:m};
}

export async function updateOrganization(accountId,organizationId,input={}){
  if(db.kind!=='POSTGRES')throw orgError('Durable organization editing requires PostgreSQL',503,'POSTGRES_REQUIRED');
  await requireOrganizationRole(accountId,organizationId,['OWNER','ADMIN']);
  const current=(await db.pool.query(`${orgSelect} WHERE o.id=$1`,[organizationId])).rows[0];if(!current)throw orgError('Organization not found',404,'ORGANIZATION_NOT_FOUND');
  const name=input.name==null?current.name:String(input.name).trim(),legalName=input.legalName===undefined?current.legal_name:(input.legalName?String(input.legalName).trim():null),city=input.city===undefined?current.city:asBi(input.city),country=input.country===undefined?current.country:asBi(input.country),specialties=input.specialties===undefined?current.specialties:(Array.isArray(input.specialties)?input.specialties.map(x=>String(x).trim()).filter(Boolean).slice(0,30):(()=>{throw orgError('specialties must be an array')})()),about=input.about===undefined?current.about:asBi(input.about,'ANTIQUA seller'),publicPolicies=input.publicPolicies===undefined?current.public_policies:asBi(input.publicPolicies),website=input.website===undefined?current.website:(input.website?String(input.website).trim():null),publicEmail=input.publicEmail===undefined?current.public_email:(input.publicEmail?String(input.publicEmail).trim().toLowerCase():null),publicPhone=input.publicPhone===undefined?current.public_phone:(input.publicPhone?String(input.publicPhone).trim():null);
  if(!name)throw orgError('Organization name required');if(publicEmail&&!publicEmail.includes('@'))throw orgError('Valid public email required');
  const c=await db.pool.connect();try{await c.query('BEGIN');await c.query(`UPDATE organizations SET name=$2,legal_name=$3,city=$4,country=$5,specialties=$6,about=$7,public_policies=$8,updated_at=now() WHERE id=$1`,[organizationId,name,legalName,city,country,specialties,about,publicPolicies]);await c.query(`INSERT INTO dealer_profiles(organization_id,website,public_email,public_phone,updated_at) VALUES($1,$2,$3,$4,now()) ON CONFLICT(organization_id) DO UPDATE SET website=excluded.website,public_email=excluded.public_email,public_phone=excluded.public_phone,updated_at=now()`,[organizationId,website,publicEmail,publicPhone]);await c.query('COMMIT')}catch(e){try{await c.query('ROLLBACK')}catch{}throw e}finally{c.release()}
  return getOrganizationForMember(accountId,organizationId);
}

export async function listOrganizationMembers(accountId,organizationId){
  await requireOrganizationRole(accountId,organizationId,['OWNER','ADMIN']);
  if(db.kind!=='POSTGRES')return[];
  const rows=(await db.pool.query(`SELECT m.account_id,m.role,m.status,m.joined_at,m.updated_at,a.email,a.display_name,a.account_type FROM organization_members m JOIN accounts a ON a.id=m.account_id WHERE m.organization_id=$1 ORDER BY CASE m.role WHEN 'OWNER' THEN 0 WHEN 'ADMIN' THEN 1 ELSE 2 END,a.display_name`,[organizationId])).rows;
  return rows.map(r=>({accountId:r.account_id,role:r.role,status:r.status,email:r.email,displayName:r.display_name,accountType:r.account_type,joinedAt:r.joined_at.toISOString(),updatedAt:r.updated_at.toISOString()}));
}

export async function addOrganizationMember(actorAccountId,organizationId,{email,accountId,role='VIEWER'}={}){
  role=String(role||'VIEWER').toUpperCase();if(!ORG_ROLES.has(role))throw orgError('Invalid organization role');const actor=await requireOrganizationRole(actorAccountId,organizationId,['OWNER','ADMIN']);if(role==='OWNER'&&actor.role!=='OWNER')throw orgError('Only an owner can appoint another owner',403,'ORGANIZATION_FORBIDDEN');
  const target=accountId?(await db.pool.query('SELECT * FROM accounts WHERE id=$1',[String(accountId)])).rows[0]:(await db.pool.query('SELECT * FROM accounts WHERE email=$1',[String(email||'').trim().toLowerCase()])).rows[0];if(!target)throw orgError('Account not found',404,'ACCOUNT_NOT_FOUND');
  await db.pool.query(`INSERT INTO organization_members(organization_id,account_id,role,status,joined_at,updated_at) VALUES($1,$2,$3,'ACTIVE',now(),now()) ON CONFLICT(organization_id,account_id) DO UPDATE SET role=excluded.role,status='ACTIVE',updated_at=now()`,[organizationId,target.id,role]);
  return{accountId:target.id,email:target.email,displayName:target.display_name,role,status:'ACTIVE'};
}

export async function getPublicSellerProfile(sellerId){
  if(db.kind==='POSTGRES'){const row=(await db.pool.query(`${orgSelect} WHERE o.seller_id=$1 AND o.status='ACTIVE'`,[sellerId])).rows[0];if(row)return publicSeller(mapOrg(row))}
  return sellers.get(sellerId)||null;
}
export async function listPublicSellerProfiles(){
  const merged=new Map([...sellers.values()].map(s=>[s.id,s]));if(db.kind==='POSTGRES'){const rows=(await db.pool.query(`${orgSelect} WHERE o.status='ACTIVE' ORDER BY o.name`)).rows;for(const row of rows){const p=publicSeller(mapOrg(row));merged.set(p.id,p)}}return[...merged.values()];
}
export function organizationCapabilities(){return{durable:db.kind==='POSTGRES',memberships:true,roles:[...ORG_ROLES],dealerProfile:true,locations:true,publicSellerAuthority:db.kind==='POSTGRES'}}
