import {db,uid,requirePermission} from './runtime-v09.mjs';
import {requireOrganizationRole} from './organizations-v15.mjs';

const PROFILE_ROLES=new Set(['ARTIST','GALLERY_REPRESENTATIVE','CURATOR','EXPERT','ART_HISTORIAN','RESEARCHER','COLLECTOR','ENTHUSIAST','INSTITUTION_REPRESENTATIVE']);
const CLAIM_STATES=new Set(['SELF_DECLARED','EVIDENCE_SUBMITTED','REVIEWED','VERIFIED','REJECTED','EXPIRED']);
const VISIBILITY=new Set(['PRIVATE','PSEUDONYMOUS','PUBLIC']);
const ORG_REL=new Set(['REPRESENTATIVE','FOUNDER','DIRECTOR','CURATOR','RESEARCHER','STAFF']);
const CREATOR_REL=new Set(['SELF','REPRESENTATIVE','ESTATE','STUDIO_MEMBER']);
const REVIEWABLE=new Set(['ROLE','EXPERTISE','CREATOR_LINK','GALLERY_PROFILE']);
const PROFESSIONAL_ROLES=new Set(['ARTIST','GALLERY_REPRESENTATIVE','CURATOR','EXPERT','ART_HISTORIAN','RESEARCHER','INSTITUTION_REPRESENTATIVE']);
const memory={profiles:new Map(),roles:new Map(),expertise:new Map(),creatorLinks:new Map(),orgLinks:new Map(),galleries:new Map()};
const fail=(status,code,message)=>{throw Object.assign(new Error(message),{status,code})};
const clone=x=>structuredClone(x);
const iso=v=>v?new Date(v).toISOString():null;
const bi=v=>typeof v==='object'&&v&&!Array.isArray(v)?{en:String(v.en||v.ru||''),ru:String(v.ru||v.en||'')}:{en:String(v||''),ru:String(v||'')};
const arr=v=>Array.isArray(v)?v.map(x=>typeof x==='string'?x.trim():x).filter(Boolean).slice(0,50):[];
const slugify=v=>String(v||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);
const validSlug=v=>/^[a-z0-9][a-z0-9-]{2,59}$/.test(v);
const now=()=>new Date().toISOString();

const mapProfile=r=>r?{
 id:r.id,accountId:r.account_id??r.accountId,slug:r.slug,displayName:r.display_name??r.displayName,
 headline:r.headline||{},about:r.about||{},city:r.city||{},country:r.country||{},
 languages:Array.isArray(r.languages)?r.languages:[],interests:Array.isArray(r.interests)?r.interests:[],
 visibility:r.visibility,avatarUrl:r.avatar_url??r.avatarUrl??null,
 collaborationPreferences:r.collaboration_preferences??r.collaborationPreferences??{},
 status:r.status,createdAt:iso(r.created_at??r.createdAt),updatedAt:iso(r.updated_at??r.updatedAt)
}:null;
const mapRole=r=>r?{id:r.id,profileId:r.profile_id??r.profileId,role:r.role,status:r.status,evidence:r.evidence||{},reviewNote:r.review_note??r.reviewNote??null,reviewedAt:iso(r.reviewed_at??r.reviewedAt),expiresAt:iso(r.expires_at??r.expiresAt),createdAt:iso(r.created_at??r.createdAt),updatedAt:iso(r.updated_at??r.updatedAt)}:null;
const mapExpertise=r=>r?{id:r.id,profileId:r.profile_id??r.profileId,expertiseCode:r.expertise_code??r.expertiseCode,label:r.label||{},scope:r.scope||{},status:r.status,evidence:r.evidence||{},conflictDisclosure:r.conflict_disclosure??r.conflictDisclosure??{},reviewNote:r.review_note??r.reviewNote??null,reviewedAt:iso(r.reviewed_at??r.reviewedAt),expiresAt:iso(r.expires_at??r.expiresAt),createdAt:iso(r.created_at??r.createdAt),updatedAt:iso(r.updated_at??r.updatedAt)}:null;
const mapCreatorLink=r=>r?{id:r.id,profileId:r.profile_id??r.profileId,creatorId:r.creator_id??r.creatorId,relationshipType:r.relationship_type??r.relationshipType,status:r.status,evidence:r.evidence||{},reviewNote:r.review_note??r.reviewNote??null,reviewedAt:iso(r.reviewed_at??r.reviewedAt),expiresAt:iso(r.expires_at??r.expiresAt)}:null;
const mapOrgLink=r=>r?{id:r.id,profileId:r.profile_id??r.profileId,organizationId:r.organization_id??r.organizationId,relationshipType:r.relationship_type??r.relationshipType,status:r.status,public:Boolean(r.public),evidence:r.evidence||{}}:null;

async function profileByAccount(accountId){
 if(db.kind==='POSTGRES')return mapProfile((await db.pool.query('SELECT * FROM art_profiles WHERE account_id=$1',[accountId])).rows[0]);
 return mapProfile([...memory.profiles.values()].find(x=>x.accountId===accountId));
}
async function profileById(id){
 if(db.kind==='POSTGRES')return mapProfile((await db.pool.query('SELECT * FROM art_profiles WHERE id=$1',[id])).rows[0]);
 return mapProfile(memory.profiles.get(id));
}
async function profileBySlug(slug){
 if(db.kind==='POSTGRES')return mapProfile((await db.pool.query('SELECT * FROM art_profiles WHERE slug=$1',[slug])).rows[0]);
 return mapProfile([...memory.profiles.values()].find(x=>x.slug===slug));
}
async function claimsFor(profileId){
 if(db.kind==='POSTGRES'){
  const [r,e,c,o]=await Promise.all([
   db.pool.query('SELECT * FROM art_profile_role_claims WHERE profile_id=$1 ORDER BY role',[profileId]),
   db.pool.query('SELECT * FROM art_expertise_claims WHERE profile_id=$1 ORDER BY expertise_code',[profileId]),
   db.pool.query('SELECT * FROM art_profile_creator_links WHERE profile_id=$1 ORDER BY created_at,id',[profileId]),
   db.pool.query('SELECT * FROM art_profile_organization_links WHERE profile_id=$1 ORDER BY created_at,id',[profileId])
  ]);
  return{roles:r.rows.map(mapRole),expertise:e.rows.map(mapExpertise),creatorLinks:c.rows.map(mapCreatorLink),organizationLinks:o.rows.map(mapOrgLink)};
 }
 return{
  roles:[...memory.roles.values()].filter(x=>x.profileId===profileId).map(mapRole),
  expertise:[...memory.expertise.values()].filter(x=>x.profileId===profileId).map(mapExpertise),
  creatorLinks:[...memory.creatorLinks.values()].filter(x=>x.profileId===profileId).map(mapCreatorLink),
  organizationLinks:[...memory.orgLinks.values()].filter(x=>x.profileId===profileId).map(mapOrgLink)
 };
}

function publicRoleAllowed(role,claims){
 const x=claims.roles.find(r=>r.role===role&&!['REJECTED','EXPIRED'].includes(r.status));if(!x)return false;
 if(!PROFESSIONAL_ROLES.has(role))return true;
 if(['EXPERT','ART_HISTORIAN','CURATOR','RESEARCHER'].includes(role))return x.status==='VERIFIED';
 if(role==='ARTIST')return x.status==='VERIFIED'||claims.creatorLinks.some(l=>l.status==='VERIFIED'&&l.relationshipType==='SELF');
 if(['GALLERY_REPRESENTATIVE','INSTITUTION_REPRESENTATIVE'].includes(role))return x.status==='VERIFIED'||claims.organizationLinks.some(l=>l.public&&['ORGANIZATION_CONFIRMED','REVIEWED','VERIFIED'].includes(l.status));
 return x.status==='VERIFIED'
}
async function publicProjection(profile){
 if(!profile||profile.status!=='ACTIVE'||!['PUBLIC','PSEUDONYMOUS'].includes(profile.visibility))return null;
 const claims=await claimsFor(profile.id);
 const roles=claims.roles.filter(x=>publicRoleAllowed(x.role,claims)).map(x=>({role:x.role,status:x.status}));
 const expertise=claims.expertise.filter(x=>x.status==='VERIFIED').map(x=>({expertiseCode:x.expertiseCode,label:x.label,scope:x.scope,status:x.status}));
 const creatorLinks=claims.creatorLinks.filter(x=>x.status==='VERIFIED').map(x=>({creatorId:x.creatorId,relationshipType:x.relationshipType,status:x.status}));
 const organizationLinks=claims.organizationLinks.filter(x=>x.public&&['ORGANIZATION_CONFIRMED','REVIEWED','VERIFIED'].includes(x.status)).map(x=>({organizationId:x.organizationId,relationshipType:x.relationshipType,status:x.status}));
 return{id:profile.id,slug:profile.slug,displayName:profile.displayName,headline:profile.headline,about:profile.about,city:profile.city,country:profile.country,languages:profile.languages,interests:profile.interests,visibility:profile.visibility,avatarUrl:profile.avatarUrl,collaborationPreferences:profile.collaborationPreferences,roles,expertise,creatorLinks,organizationLinks,updatedAt:profile.updatedAt}
}

export function artNetworkCapabilities(){return{
 contractVersion:'v41',oneAccountIdentity:true,publicDescriptorsNotPermissions:true,
 visibility:['PRIVATE','PSEUDONYMOUS','PUBLIC'],roles:[...PROFILE_ROLES],
 claimStates:[...CLAIM_STATES],expertiseUniversalScore:false,creatorAuthority:'CREATOR_GRAPH_V30',
 organizationAuthority:'ORGANIZATIONS_V15',privacyByDefault:true
}}

export async function upsertArtProfile(account,input={}){
 if(!account)fail(401,'AUTH_REQUIRED','Authentication required');
 let p=await profileByAccount(account.id),created=!p;
 const displayName=String(input.displayName??p?.displayName??account.displayName??'').trim().slice(0,160);if(!displayName)fail(400,'ART_PROFILE_NAME_REQUIRED','Display name required');
 const visibility=String(input.visibility??p?.visibility??'PRIVATE').toUpperCase();if(!VISIBILITY.has(visibility))fail(400,'ART_PROFILE_VISIBILITY_INVALID','Invalid visibility');
 let slug=slugify(input.slug??p?.slug??displayName);if(slug.length<3)slug='art-'+account.id.replace(/[^a-z0-9]/gi,'').toLowerCase().slice(-12);if(!validSlug(slug))fail(400,'ART_PROFILE_SLUG_INVALID','Invalid profile slug');
 const next={id:p?.id||uid('ap'),accountId:account.id,slug,displayName,headline:bi(input.headline??p?.headline??{}),about:bi(input.about??p?.about??{}),city:bi(input.city??p?.city??{}),country:bi(input.country??p?.country??{}),languages:arr(input.languages??p?.languages??[]),interests:arr(input.interests??p?.interests??[]),visibility,avatarUrl:input.avatarUrl===undefined?(p?.avatarUrl||null):(input.avatarUrl?String(input.avatarUrl).slice(0,1000):null),collaborationPreferences:input.collaborationPreferences&&typeof input.collaborationPreferences==='object'?input.collaborationPreferences:(p?.collaborationPreferences||{}),status:'ACTIVE',createdAt:p?.createdAt||now(),updatedAt:now()};
 if(db.kind==='POSTGRES'){try{const r=(await db.pool.query(`INSERT INTO art_profiles(id,account_id,slug,display_name,headline,about,city,country,languages,interests,visibility,avatar_url,collaboration_preferences,status,created_at,updated_at)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'ACTIVE',now(),now())
 ON CONFLICT(account_id) DO UPDATE SET slug=excluded.slug,display_name=excluded.display_name,headline=excluded.headline,about=excluded.about,city=excluded.city,country=excluded.country,languages=excluded.languages,interests=excluded.interests,visibility=excluded.visibility,avatar_url=excluded.avatar_url,collaboration_preferences=excluded.collaboration_preferences,updated_at=now()
 RETURNING *`,[next.id,next.accountId,next.slug,next.displayName,next.headline,next.about,next.city,next.country,JSON.stringify(next.languages),JSON.stringify(next.interests),next.visibility,next.avatarUrl,next.collaborationPreferences])).rows[0];p=mapProfile(r)}catch(e){if(e.code==='23505')fail(409,'ART_PROFILE_SLUG_CONFLICT','Profile slug already exists');throw e}}
 else{memory.profiles.set(next.id,next);p=mapProfile(next)}
 return{profile:p,created,claims:await claimsFor(p.id)}
}
export async function getMyArtProfile(account){
 if(!account)fail(401,'AUTH_REQUIRED','Authentication required');const p=await profileByAccount(account.id);return p?{profile:p,claims:await claimsFor(p.id)}:null
}
export async function listPublicArtProfiles({role=null,q=null,limit=60}={}){
 let ps;if(db.kind==='POSTGRES')ps=(await db.pool.query("SELECT * FROM art_profiles WHERE status='ACTIVE' AND visibility IN('PUBLIC','PSEUDONYMOUS') ORDER BY updated_at DESC,id LIMIT 200")).rows.map(mapProfile);else ps=[...memory.profiles.values()].map(mapProfile).filter(x=>x.status==='ACTIVE'&&['PUBLIC','PSEUDONYMOUS'].includes(x.visibility));
 const out=[];for(const p of ps){const x=await publicProjection(p);if(!x)continue;if(role&&!x.roles.some(r=>r.role===String(role).toUpperCase()))continue;const s=(x.displayName+' '+Object.values(x.headline||{}).join(' ')+' '+Object.values(x.about||{}).join(' ')).toLowerCase();if(q&&!s.includes(String(q).toLowerCase()))continue;out.push(x);if(out.length>=Math.max(1,Math.min(100,Number(limit)||60)))break}return out
}
export async function getPublicArtProfile(slug){return publicProjection(await profileBySlug(String(slug||'')))}

async function requireProfile(account){const p=await profileByAccount(account?.id);if(!p)fail(409,'ART_PROFILE_REQUIRED','Create Art Profile first');return p}
export async function setRoleClaim(account,input={}){
 const p=await requireProfile(account),role=String(input.role||'').toUpperCase();if(!PROFILE_ROLES.has(role))fail(400,'ART_PROFILE_ROLE_INVALID','Invalid public role');
 const evidence=input.evidence&&typeof input.evidence==='object'?input.evidence:{},status=Object.keys(evidence).length?'EVIDENCE_SUBMITTED':'SELF_DECLARED';
 if(db.kind==='POSTGRES'){const r=(await db.pool.query(`INSERT INTO art_profile_role_claims(id,profile_id,role,status,evidence,created_at,updated_at) VALUES($1,$2,$3,$4,$5,now(),now())
 ON CONFLICT(profile_id,role) DO UPDATE SET status=excluded.status,evidence=excluded.evidence,review_note=NULL,reviewed_by_account_id=NULL,reviewed_at=NULL,expires_at=NULL,updated_at=now() RETURNING *`,[uid('apr'),p.id,role,status,evidence])).rows[0];return mapRole(r)}
 const k=p.id+'|'+role,x={id:memory.roles.get(k)?.id||uid('apr'),profileId:p.id,role,status,evidence,createdAt:memory.roles.get(k)?.createdAt||now(),updatedAt:now()};memory.roles.set(k,x);return mapRole(x)
}
export async function setExpertiseClaim(account,input={}){
 const p=await requireProfile(account),code=String(input.expertiseCode||'').trim().toUpperCase().replace(/[^A-Z0-9_-]/g,'_').slice(0,80);if(!code)fail(400,'EXPERTISE_CODE_REQUIRED','expertiseCode required');
 const evidence=input.evidence&&typeof input.evidence==='object'?input.evidence:{},status=Object.keys(evidence).length?'EVIDENCE_SUBMITTED':'SELF_DECLARED',label=bi(input.label||code),scope=input.scope&&typeof input.scope==='object'?input.scope:{},conflict=input.conflictDisclosure&&typeof input.conflictDisclosure==='object'?input.conflictDisclosure:{};
 if(db.kind==='POSTGRES'){const r=(await db.pool.query(`INSERT INTO art_expertise_claims(id,profile_id,expertise_code,label,scope,status,evidence,conflict_disclosure,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now(),now())
 ON CONFLICT(profile_id,expertise_code) DO UPDATE SET label=excluded.label,scope=excluded.scope,status=excluded.status,evidence=excluded.evidence,conflict_disclosure=excluded.conflict_disclosure,review_note=NULL,reviewed_by_account_id=NULL,reviewed_at=NULL,expires_at=NULL,updated_at=now() RETURNING *`,[uid('aex'),p.id,code,label,scope,status,evidence,conflict])).rows[0];return mapExpertise(r)}
 const k=p.id+'|'+code,x={id:memory.expertise.get(k)?.id||uid('aex'),profileId:p.id,expertiseCode:code,label,scope,status,evidence,conflictDisclosure:conflict,createdAt:memory.expertise.get(k)?.createdAt||now(),updatedAt:now()};memory.expertise.set(k,x);return mapExpertise(x)
}
export async function linkProfileCreator(account,input={}){
 const p=await requireProfile(account),creatorId=String(input.creatorId||''),relationshipType=String(input.relationshipType||'SELF').toUpperCase();if(!creatorId||!CREATOR_REL.has(relationshipType))fail(400,'ART_PROFILE_CREATOR_LINK_INVALID','Invalid creator link');
 let creator;if(db.kind==='POSTGRES')creator=(await db.pool.query('SELECT id,managed_by_account_id FROM creators WHERE id=$1 OR slug=$1',[creatorId])).rows[0];else creator={id:creatorId,managed_by_account_id:null};if(!creator)fail(404,'CREATOR_NOT_FOUND','Creator not found');
 const autoVerified=relationshipType==='SELF'&&creator.managed_by_account_id===account.id,status=autoVerified?'VERIFIED':'EVIDENCE_SUBMITTED',evidence=input.evidence&&typeof input.evidence==='object'?input.evidence:{};
 if(db.kind==='POSTGRES'){const r=(await db.pool.query(`INSERT INTO art_profile_creator_links(id,profile_id,creator_id,relationship_type,status,evidence,reviewed_by_account_id,reviewed_at,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now(),now())
 ON CONFLICT(profile_id,creator_id,relationship_type) DO UPDATE SET status=excluded.status,evidence=excluded.evidence,review_note=NULL,reviewed_by_account_id=excluded.reviewed_by_account_id,reviewed_at=excluded.reviewed_at,expires_at=NULL,updated_at=now() RETURNING *`,[uid('apc'),p.id,creator.id,relationshipType,status,evidence,autoVerified?account.id:null,autoVerified?now():null])).rows[0];return mapCreatorLink(r)}
 const k=p.id+'|'+creator.id+'|'+relationshipType,x={id:memory.creatorLinks.get(k)?.id||uid('apc'),profileId:p.id,creatorId:creator.id,relationshipType,status,evidence,reviewedAt:autoVerified?now():null};memory.creatorLinks.set(k,x);return mapCreatorLink(x)
}
export async function linkProfileOrganization(account,input={}){
 const p=await requireProfile(account),organizationId=String(input.organizationId||''),relationshipType=String(input.relationshipType||'STAFF').toUpperCase();if(!organizationId||!ORG_REL.has(relationshipType))fail(400,'ART_PROFILE_ORG_LINK_INVALID','Invalid organization link');
 await requireOrganizationRole(account.id,organizationId);
 const x={id:uid('apo'),profileId:p.id,organizationId,relationshipType,status:'ORGANIZATION_CONFIRMED',public:input.public===true,evidence:input.evidence&&typeof input.evidence==='object'?input.evidence:{}};
 if(db.kind==='POSTGRES'){return mapOrgLink((await db.pool.query(`INSERT INTO art_profile_organization_links(id,profile_id,organization_id,relationship_type,status,public,evidence,created_at,updated_at) VALUES($1,$2,$3,$4,'ORGANIZATION_CONFIRMED',$5,$6,now(),now())
 ON CONFLICT(profile_id,organization_id,relationship_type) DO UPDATE SET status='ORGANIZATION_CONFIRMED',public=excluded.public,evidence=excluded.evidence,updated_at=now() RETURNING *`,[x.id,x.profileId,x.organizationId,x.relationshipType,x.public,x.evidence])).rows[0])}
 const k=[p.id,organizationId,relationshipType].join('|');memory.orgLinks.set(k,x);return mapOrgLink(x)
}

export async function updateCulturalOrganizationProfile(account,organizationId,input={}){
 await requireOrganizationRole(account.id,organizationId,['OWNER','ADMIN']);const publicationStatus=String(input.publicationStatus||'DRAFT').toUpperCase();if(!['DRAFT','PUBLISHED','SUSPENDED'].includes(publicationStatus))fail(400,'CULTURAL_PROFILE_STATUS_INVALID','Invalid publication status');
 const metadata=input.culturalMetadata&&typeof input.culturalMetadata==='object'?input.culturalMetadata:{},prefs=input.collaborationPreferences&&typeof input.collaborationPreferences==='object'?input.collaborationPreferences:{},reviewEvidence=input.reviewEvidence&&typeof input.reviewEvidence==='object'?input.reviewEvidence:{},reviewStatus=Object.keys(reviewEvidence).length?'EVIDENCE_SUBMITTED':'SELF_DECLARED';
 if(db.kind==='POSTGRES'){const r=(await db.pool.query(`INSERT INTO organization_cultural_profiles(organization_id,publication_status,review_status,cultural_metadata,collaboration_preferences,review_evidence,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,now(),now())
 ON CONFLICT(organization_id) DO UPDATE SET publication_status=excluded.publication_status,review_status=CASE WHEN organization_cultural_profiles.review_status='VERIFIED' THEN organization_cultural_profiles.review_status ELSE excluded.review_status END,cultural_metadata=excluded.cultural_metadata,collaboration_preferences=excluded.collaboration_preferences,review_evidence=excluded.review_evidence,updated_at=now() RETURNING *`,[organizationId,publicationStatus,reviewStatus,metadata,prefs,reviewEvidence])).rows[0];return{organizationId:r.organization_id,publicationStatus:r.publication_status,reviewStatus:r.review_status,culturalMetadata:r.cultural_metadata||{},collaborationPreferences:r.collaboration_preferences||{},updatedAt:iso(r.updated_at)}}
 const x={organizationId,publicationStatus,reviewStatus,culturalMetadata:metadata,collaborationPreferences:prefs,reviewEvidence,updatedAt:now()};memory.galleries.set(organizationId,x);return clone(x)
}
export async function listPublicGalleries(){
 if(db.kind!=='POSTGRES')return[];
 const rows=(await db.pool.query(`SELECT o.id,o.slug,o.name,o.organization_type,o.city,o.country,o.specialties,o.about,o.verified,c.publication_status,c.review_status,c.cultural_metadata,c.collaboration_preferences
 FROM organizations o JOIN organization_cultural_profiles c ON c.organization_id=o.id
 WHERE o.status='ACTIVE' AND o.organization_type='GALLERY' AND c.publication_status='PUBLISHED'
 ORDER BY o.name`)).rows;
 return rows.map(r=>({id:r.id,slug:r.slug,name:r.name,organizationType:r.organization_type,city:r.city||{},country:r.country||{},specialties:r.specialties||[],about:r.about||{},legalVerified:Boolean(r.verified),culturalReviewStatus:r.review_status,culturalMetadata:r.cultural_metadata||{},collaborationPreferences:r.collaboration_preferences||{}}))
}

export async function reviewArtNetworkClaim(account,{entityType,id,status,reviewNote=null,expiresAt=null}={}){
 requirePermission(account,'trust.review');entityType=String(entityType||'').toUpperCase();status=String(status||'').toUpperCase();if(!REVIEWABLE.has(entityType)||!['REVIEWED','VERIFIED','REJECTED','EXPIRED'].includes(status))fail(400,'ART_NETWORK_REVIEW_INVALID','Invalid review');
 if(db.kind!=='POSTGRES')fail(503,'POSTGRES_REQUIRED','Review requires PostgreSQL');
 const table=entityType==='ROLE'?'art_profile_role_claims':entityType==='EXPERTISE'?'art_expertise_claims':entityType==='CREATOR_LINK'?'art_profile_creator_links':'organization_cultural_profiles';
 const key=entityType==='GALLERY_PROFILE'?'organization_id':'id';
 const q=await db.pool.query(`UPDATE ${table} SET ${entityType==='GALLERY_PROFILE'?'review_status':'status'}=$2,review_note=$3,reviewed_by_account_id=$4,reviewed_at=now(),${entityType==='GALLERY_PROFILE'?'updated_at=now()':'expires_at=$5,updated_at=now()'} WHERE ${key}=$1 RETURNING *`,entityType==='GALLERY_PROFILE'?[id,status,reviewNote,account.id]:[id,status,reviewNote,account.id,expiresAt?new Date(expiresAt).toISOString():null]);
 if(!q.rows[0])fail(404,'ART_NETWORK_CLAIM_NOT_FOUND','Claim not found');return{entityType,id,status,reviewedAt:now()}
}
