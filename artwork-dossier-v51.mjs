import {db,auctions} from './runtime-v09.mjs';
import {provenanceEvidencePassport} from './provenance-evidence-passport-v43.mjs';
import {projectPublicAuctionResult} from './auction-results-v20.mjs';

const iso=v=>v?.toISOString?.()||v||null;
const clone=v=>JSON.parse(JSON.stringify(v??null));

export function artworkDossierCapabilities(){
  return {
    schemaVersion:'antiqua-artwork-dossier-v51',
    readModel:true,
    writableAuthority:false,
    scholarlyContributions:true,
    credentialsAtReview:true,
    provenancePassport:true,
    marketHistory:true,
    currentSaleStateAuthority:'PRODUCT_PASSPORT',
    expertScore:false,
    authenticityCertified:false
  };
}

export function buildArtworkResearchProjection({
  objectId,
  provenancePassport=null,
  scholarlyContributions=[],
  marketHistory=[]
}={}){
  return {
    schemaVersion:'antiqua-artwork-dossier-v51',
    objectId:String(objectId||''),
    provenancePassport:clone(provenancePassport),
    scholarlyContributions:clone(scholarlyContributions),
    marketHistory:clone(marketHistory),
    boundaries:{
      readModelOnly:true,
      credentialProvesRoleNotTruth:true,
      supersededHistoricalValidityRequiresTimestamp:true,
      contributionDoesNotCertifyAuthenticity:true,
      marketHistoryExcludesCurrentAskingPrice:true,
      conflictsAndGapsPreserved:true
    }
  };
}

async function evidenceLinksFor(ids=[]){
  if(!ids.length)return new Map();
  const rows=(await db.pool.query(
    `SELECT contribution_id,evidence_type,evidence_id,relation_type
     FROM scholarly_contribution_evidence_links
     WHERE contribution_id=ANY($1::text[])
     ORDER BY contribution_id,evidence_type,evidence_id,relation_type`,
    [ids]
  )).rows;
  const by=new Map(ids.map(id=>[id,[]]));
  for(const row of rows)(by.get(row.contribution_id)||[]).push({
    evidenceType:row.evidence_type,
    evidenceId:row.evidence_id,
    relationType:row.relation_type
  });
  return by;
}

async function credentialsAtReview(accountId,reviewedAt){
  if(!accountId||!reviewedAt)return[];
  const rows=(await db.pool.query(
    `SELECT id,issuer_organization_id,credential_type,project_ref,role_label,scope,status,
            valid_from,valid_until,issued_at,revoked_at,supersedes_credential_id
     FROM scholarly_credentials
     WHERE subject_account_id=$1
       AND issued_at IS NOT NULL
       AND issued_at <= $2
       AND (valid_from IS NULL OR valid_from <= $2)
       AND (valid_until IS NULL OR valid_until >= $2)
       AND (revoked_at IS NULL OR revoked_at > $2)
       AND status IN('ACTIVE','REVOKED','EXPIRED')
     ORDER BY issued_at DESC,id`,
    [accountId,reviewedAt]
  )).rows;
  if(!rows.length)return[];
  const issuerIds=[...new Set(rows.map(x=>x.issuer_organization_id).filter(Boolean))];
  const orgRows=issuerIds.length?(await db.pool.query(
    'SELECT id,name,slug FROM organizations WHERE id=ANY($1::text[])',
    [issuerIds]
  )).rows:[];
  const orgBy=new Map(orgRows.map(x=>[x.id,x]));
  return rows.map(row=>({
    id:row.id,
    credentialType:row.credential_type,
    projectRef:row.project_ref,
    roleLabel:row.role_label,
    scope:row.scope||{},
    validFrom:iso(row.valid_from),
    validUntil:iso(row.valid_until),
    issuedAt:iso(row.issued_at),
    currentStatus:row.status,
    statusAtReview:'VALID_AT_REVIEW',
    issuer:row.issuer_organization_id?{
      organizationId:row.issuer_organization_id,
      name:orgBy.get(row.issuer_organization_id)?.name||null,
      slug:orgBy.get(row.issuer_organization_id)?.slug||null
    }:null,
    assertions:{
      roleScopeAttested:true,
      scholarlyConclusionCertified:false,
      authenticityCertified:false
    }
  }));
}

export async function scholarlyContributionsForArtwork(objectId){
  if(db.kind!=='POSTGRES')return[];
  const rows=(await db.pool.query(
    `SELECT sc.id,sc.contributor_account_id,sc.contributor_organization_id,sc.expertise_claim_id,
            sc.contribution_type,sc.subject_type,sc.subject_id,sc.summary,sc.disclosure,
            sc.reviewed_at,sc.published_at,
            ap.slug AS profile_slug,ap.display_name AS profile_display_name,
            org.name AS organization_name,org.slug AS organization_slug,
            ec.expertise_type,ec.scope AS expertise_scope
     FROM scholarly_contributions sc
     LEFT JOIN art_profiles ap ON ap.account_id=sc.contributor_account_id
       AND ap.profile_status='PUBLISHED' AND ap.visibility IN('PUBLIC','PSEUDONYMOUS')
     LEFT JOIN organizations org ON org.id=sc.contributor_organization_id
     LEFT JOIN expertise_claims ec ON ec.id=sc.expertise_claim_id AND ec.status='VERIFIED'
     WHERE sc.subject_type='OBJECT' AND sc.subject_id=$1 AND sc.status='PUBLISHED'
     ORDER BY sc.published_at DESC,sc.id`,
    [objectId]
  )).rows;
  const links=await evidenceLinksFor(rows.map(x=>x.id));
  const out=[];
  for(const row of rows){
    const reviewTime=iso(row.reviewed_at||row.published_at);
    out.push({
      id:row.id,
      contributionType:row.contribution_type,
      summary:row.summary||{},
      disclosureStatus:Object.keys(row.disclosure||{}).length?'DISCLOSED':'NONE_RECORDED',
      reviewedAt:iso(row.reviewed_at),
      publishedAt:iso(row.published_at),
      contributor:row.contributor_account_id?{
        type:'PERSON',
        profileSlug:row.profile_slug||null,
        displayName:row.profile_display_name||null
      }:{
        type:'ORGANIZATION',
        organizationId:row.contributor_organization_id,
        name:row.organization_name||null,
        slug:row.organization_slug||null
      },
      verifiedExpertise:row.expertise_claim_id?{
        claimId:row.expertise_claim_id,
        expertiseType:row.expertise_type||null,
        scope:row.expertise_scope||{}
      }:null,
      evidenceLinks:links.get(row.id)||[],
      credentialsAtReview:await credentialsAtReview(row.contributor_account_id,reviewTime),
      assertions:{
        contributionPublished:true,
        conclusionCertified:false,
        authenticityCertified:false
      }
    });
  }
  return out;
}

export async function marketHistoryForArtwork(objectId){
  if(db.kind!=='POSTGRES'){
    return auctions
      .filter(a=>a.lotId===objectId&&a.state==='CLOSED')
      .map(a=>projectPublicAuctionResult(a,null))
      .filter(Boolean);
  }
  const rows=(await db.pool.query(
    `SELECT a.id,a.object_id,a.sale_id,a.status,a.current_bid,a.increment,a.bid_count,a.reserve_price,
            a.starts_at,a.ends_at,a.state,
            s.winning_amount_minor,s.currency AS settlement_currency,s.status AS settlement_status,s.completed_at
     FROM auctions a
     LEFT JOIN auction_settlements s ON s.auction_id=a.id
     WHERE a.object_id=$1 AND (a.status='CLOSED' OR a.ends_at<=now())
     ORDER BY a.ends_at DESC,a.id`,
    [objectId]
  )).rows;
  return rows.map(row=>{
    const auction={
      id:row.id,lotId:row.object_id,saleId:row.sale_id,
      currency:row.settlement_currency||row.state?.currency||'EUR',
      currentBid:Number(row.current_bid||0),bidCount:Number(row.bid_count||0),
      reserveMet:Number(row.current_bid||0)>=Number(row.reserve_price||0),
      startsAt:iso(row.starts_at),endsAt:iso(row.ends_at),state:'CLOSED'
    };
    const settlement=row.settlement_status?{
      winningAmountMinor:Number(row.winning_amount_minor||0),
      currency:row.settlement_currency||'EUR',
      status:row.settlement_status
    }:null;
    const result=projectPublicAuctionResult(auction,settlement);
    return {...result,completedAt:iso(row.completed_at)};
  });
}

export async function artworkResearchDossier(objectId){
  const [provenancePassport,scholarlyContributions,marketHistory]=await Promise.all([
    provenanceEvidencePassport(objectId,{publicOnly:true}),
    scholarlyContributionsForArtwork(objectId),
    marketHistoryForArtwork(objectId)
  ]);
  if(!provenancePassport)return null;
  return buildArtworkResearchProjection({
    objectId,
    provenancePassport,
    scholarlyContributions,
    marketHistory
  });
}
