import {db,uid,now} from './runtime-v09.mjs';

const TYPES=new Set(['PROVENANCE_REVIEW','SOURCE_REVIEW','ATTRIBUTION_OPINION','CATALOGUE_REVIEW','EXHIBITION_RESEARCH','BIBLIOGRAPHY_REVIEW','CONDITION_RESEARCH','OTHER']);
const SUBJECTS=new Set(['OBJECT','PROVENANCE_EVENT','SOURCE','CREATOR','EXHIBITION','PUBLICATION_REVISION']);
const REVIEW_ROLES=new Set(['ADMIN','CATALOGUER','TRUST_REVIEWER']);
const clone=x=>x==null?x:structuredClone(x);
const fail=(status,code,message)=>{const e=new Error(message);e.status=status;e.code=code;throw e};
const bi=v=>v&&typeof v==='object'&&!Array.isArray(v)?{en:String(v.en||v.ru||''),ru:String(v.ru||v.en||'')}:{en:String(v||''),ru:String(v||'')};
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};

export function scholarlyTrustCapabilities(){
  return {
    contractVersion:'v44',
    contributorIdentityAuthority:'ART_NETWORK_V41',
    expertiseAuthority:'EXPERTISE_CLAIMS_V41',
    organizationAuthority:'ORGANIZATIONS_V15',
    contributionModel:'FACTUAL_REVIEWED_ACTIVITY',
    universalScore:false,
    popularityRanking:false,
    contributionTypes:[...TYPES],
    subjectTypes:[...SUBJECTS]
  };
}

export function buildContributorTrustProjection({profile=null,organization=null,expertise=[],contributions=[],affiliations=[]}={}){
  const published=contributions.filter(x=>x.status==='PUBLISHED');
  return {
    contributor: profile?{type:'ART_PROFILE',slug:profile.slug,displayName:profile.displayName}:organization?{type:'ORGANIZATION',id:organization.id,name:organization.name}:null,
    verifiedExpertise: expertise.filter(x=>x.status==='VERIFIED').map(x=>({id:x.id,expertiseType:x.expertiseType,scope:clone(x.scope),expiresAt:x.expiresAt||null})),
    verifiedAffiliations: affiliations.filter(x=>x.status==='VERIFIED').map(x=>({organizationId:x.organizationId,roleLabel:x.roleLabel,validFrom:x.validFrom||null,validUntil:x.validUntil||null})),
    contributions: published.map(x=>({
      id:x.id,contributionType:x.contributionType,subjectType:x.subjectType,subjectId:x.subjectId,
      summary:clone(x.summary),disclosureState:Object.keys(x.disclosure||{}).length?'DECLARED':'NOT_DECLARED',
      reviewedAt:x.reviewedAt||null,publishedAt:x.publishedAt||null,evidenceLinks:clone(x.evidenceLinks||[])
    })),
    assertions:{universalScoreUsed:false,popularityRankingUsed:false,contributionCountIsQualityScore:false}
  };
}

export async function createScholarlyContribution(account,input={}){
  if(!account)fail(401,'AUTH_REQUIRED','Authentication required');
  const contributionType=String(input.contributionType||'').toUpperCase();
  const subjectType=String(input.subjectType||'').toUpperCase();
  if(!TYPES.has(contributionType))fail(400,'SCHOLARLY_CONTRIBUTION_TYPE_INVALID','Invalid contribution type');
  if(!SUBJECTS.has(subjectType))fail(400,'SCHOLARLY_SUBJECT_TYPE_INVALID','Invalid scholarly subject type');
  const subjectId=String(input.subjectId||'').trim();if(!subjectId)fail(400,'SCHOLARLY_SUBJECT_REQUIRED','subjectId required');
  const summary=bi(input.summary||{});
  if(!String(summary.en||summary.ru).trim())fail(400,'SCHOLARLY_SUMMARY_REQUIRED','Contribution summary required');
  let expertiseClaimId=input.expertiseClaimId?String(input.expertiseClaimId):null;
  if(expertiseClaimId){
    const claim=(await db.pool.query('SELECT id,status,account_id FROM expertise_claims WHERE id=$1',[expertiseClaimId])).rows[0];
    if(!claim||claim.account_id!==account.id||claim.status!=='VERIFIED')fail(409,'VERIFIED_EXPERTISE_REQUIRED','Contribution expertise claim must be verified and owned by contributor');
  }
  const id=uid('scholar-contribution');
  const r=(await db.pool.query(`INSERT INTO scholarly_contributions
    (id,contributor_account_id,expertise_claim_id,contribution_type,subject_type,subject_id,summary,disclosure,status,created_at,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,'SUBMITTED',now(),now()) RETURNING *`,
    [id,account.id,expertiseClaimId,contributionType,subjectType,subjectId,summary,obj(input.disclosure)])).rows[0];
  for(const e of Array.isArray(input.evidenceLinks)?input.evidenceLinks.slice(0,50):[]){
    const evidenceType=String(e.evidenceType||'OTHER').toUpperCase(),evidenceId=String(e.evidenceId||'').trim(),relationType=String(e.relationType||'SUPPORTS').toUpperCase();
    if(!evidenceId)continue;
    await db.pool.query('INSERT INTO scholarly_contribution_evidence_links(contribution_id,evidence_type,evidence_id,relation_type) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[id,evidenceType,evidenceId,relationType]);
  }
  return r;
}

export async function reviewScholarlyContribution(reviewer,id,{decision='PUBLISH',note=''}={}){
  if(!reviewer?.roles?.some(x=>REVIEW_ROLES.has(x)))fail(403,'SCHOLARLY_REVIEW_FORBIDDEN','Scholarly review permission required');
  const current=(await db.pool.query('SELECT * FROM scholarly_contributions WHERE id=$1',[id])).rows[0];
  if(!current)fail(404,'SCHOLARLY_CONTRIBUTION_NOT_FOUND','Contribution not found');
  const publish=String(decision).toUpperCase()==='PUBLISH',status=publish?'PUBLISHED':'REJECTED';
  return (await db.pool.query(`UPDATE scholarly_contributions SET status=$2,reviewed_by_account_id=$3,reviewed_at=now(),review_note=$4,
    published_at=CASE WHEN $2='PUBLISHED' THEN now() ELSE published_at END,updated_at=now() WHERE id=$1 RETURNING *`,
    [id,status,reviewer.id,String(note||'').slice(0,2000)])).rows[0];
}

export async function publicContributorTrust(slug){
  const profile=(await db.pool.query("SELECT account_id,slug,display_name FROM art_profiles WHERE slug=$1 AND profile_status='PUBLISHED' AND visibility IN('PUBLIC','PSEUDONYMOUS')",[slug])).rows[0];
  if(!profile)return null;
  const expertise=(await db.pool.query("SELECT id,expertise_type,scope,status,expires_at FROM expertise_claims WHERE account_id=$1 AND status='VERIFIED' ORDER BY updated_at DESC",[profile.account_id])).rows.map(x=>({id:x.id,expertiseType:x.expertise_type,scope:x.scope,status:x.status,expiresAt:x.expires_at}));
  const contributions=(await db.pool.query("SELECT * FROM scholarly_contributions WHERE contributor_account_id=$1 AND status='PUBLISHED' ORDER BY published_at DESC,id",[profile.account_id])).rows;
  for(const c of contributions)c.evidenceLinks=(await db.pool.query('SELECT evidence_type AS "evidenceType",evidence_id AS "evidenceId",relation_type AS "relationType" FROM scholarly_contribution_evidence_links WHERE contribution_id=$1 ORDER BY evidence_type,evidence_id',[c.id])).rows;
  const affiliations=(await db.pool.query("SELECT organization_id,role_label,status,valid_from,valid_until FROM scholarly_affiliations WHERE account_id=$1 AND status='VERIFIED' ORDER BY updated_at DESC",[profile.account_id])).rows.map(x=>({organizationId:x.organization_id,roleLabel:x.role_label,status:x.status,validFrom:x.valid_from,validUntil:x.valid_until}));
  return buildContributorTrustProjection({profile:{slug:profile.slug,displayName:profile.display_name},expertise,contributions:contributions.map(x=>({id:x.id,contributionType:x.contribution_type,subjectType:x.subject_type,subjectId:x.subject_id,summary:x.summary,disclosure:x.disclosure,status:x.status,reviewedAt:x.reviewed_at,publishedAt:x.published_at,evidenceLinks:x.evidenceLinks})),affiliations});
}
