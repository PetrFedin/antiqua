import {buildProvenanceEvidencePassport,buildPortableProvenanceBundle} from './provenance-evidence-passport-v43.mjs';
import {buildIndependentVerification} from './independent-passport-verification-v46.mjs';
import {buildResearchInterchangeProfile} from './research-interchange-profile-v47.mjs';

export const SYNTHETIC_REFERENCE_CATALOGUE_VERSION='antiqua-synthetic-reference-catalogue-v1';

export function buildSyntheticReferenceCatalogue(){
  const creator={
    id:'syn-creator-elena-volkova',
    displayName:{ru:'Елена Волкова',en:'Elena Volkova'},
    synthetic:true,
    lifespan:{from:1878,to:1944}
  };
  const work={
    id:'syn-work-river-study-1912',
    objectCode:'SYN-REF-001',
    passport:{
      title:{ru:'Этюд у реки',en:'Study by the River'},
      maker:{ru:'Елена Волкова',en:'Elena Volkova'},
      attributionStatus:'DISPUTED',
      bibliography:[{id:'syn-bib-1',citation:'Synthetic Catalogue of Elena Volkova, vol. 1, no. 42',status:'PUBLIC'}],
      exhibitions:[{id:'syn-exh-1',title:{ru:'Новая живопись 1913',en:'New Painting 1913'},venue:'Synthetic City Museum',year:1913,status:'DOCUMENTED'}],
      institutionalIdentifiers:[{scheme:'MUSEUM_ACCESSION',value:'SCM-1913-42',institutionId:'syn-inst-museum',status:'REVIEWED',sourceRef:'syn-source-museum-ledger'}],
      media:[{id:'syn-media-1',type:'IMAGE',iiifManifest:'https://example.invalid/iiif/synthetic-reference/manifest',rights:{metadata:'CC0-1.0',media:'PUBLIC_DOMAIN_MARK'},publicationState:'PUBLIC'}],
      metadataRights:{license:'CC0-1.0'},
      mediaRights:{statement:'PUBLIC_DOMAIN_SYNTHETIC'}
    }
  };
  const revision={
    id:'syn-rev-3',revisionNo:3,passportHash:'c'.repeat(64),previousHash:'b'.repeat(64),
    changeKind:'ATTRIBUTION_AND_PROVENANCE_REVIEW',createdAt:'2026-10-07T00:00:00.000Z'
  };
  const entries=[
    {
      id:'syn-prov-1',sequenceNo:1,
      event:{kind:'EXHIBITION',date:'1913',place:'Synthetic City Museum',exhibitionId:'syn-exh-1'},
      evidenceClass:'INSTITUTIONAL_RECORD',evidenceStatus:'VERIFIED',evidenceRef:'syn-source-museum-ledger',
      createdAt:'2026-10-01T00:00:00.000Z'
    },
    {
      id:'syn-prov-2',sequenceNo:2,
      event:{kind:'OWNERSHIP',from:'1914',to:'1921',ownerLabel:'Private collection A'},
      evidenceClass:'PRIMARY_DOCUMENT',evidenceStatus:'VERIFIED',evidenceRef:'syn-source-letter-1914',
      createdAt:'2026-10-02T00:00:00.000Z'
    },
    {
      id:'syn-prov-3',sequenceNo:3,
      event:{kind:'OWNERSHIP',from:'1921',to:'1932',note:'Ownership interval remains unsupported'},
      evidenceClass:'OWNER_DEALER_STATEMENT',evidenceStatus:'UNVERIFIED',evidenceRef:null,
      createdAt:'2026-10-03T00:00:00.000Z'
    },
    {
      id:'syn-prov-4',sequenceNo:4,
      event:{kind:'ATTRIBUTION',status:'CONFLICT',conflict:true,claim:'Attributed to Elena Volkova; competing publication proposes studio of Volkova'},
      evidenceClass:'SCHOLARLY_PUBLICATION',evidenceStatus:'DISPUTED',evidenceRef:'syn-source-article-2024',
      createdAt:'2026-10-04T00:00:00.000Z'
    }
  ];
  const passport=buildProvenanceEvidencePassport({object:work,latestRevision:revision,entries});
  const contributions=[
    {
      id:'syn-contribution-1',contributorAccountId:'syn-scholar-1',contributionType:'PROVENANCE_REVIEW',
      subjectType:'OBJECT',subjectId:work.id,
      summary:{ru:'Проверена выставочная запись 1913 года; период 1921–1932 остаётся неподтверждённым.',en:'The 1913 exhibition record was reviewed; the 1921–1932 period remains unsupported.'},
      disclosureState:'DECLARED',reviewedAt:'2026-10-06T00:00:00.000Z',publishedAt:'2026-10-07T00:00:00.000Z'
    },
    {
      id:'syn-contribution-2',contributorOrganizationId:'syn-inst-university',contributionType:'ATTRIBUTION_OPINION',
      subjectType:'PROVENANCE_EVENT',subjectId:'syn-prov-4',
      summary:{ru:'Конкурирующая атрибуция сохранена как спорная.',en:'The competing attribution is preserved as disputed.'},
      disclosureState:'NOT_DECLARED',reviewedAt:'2026-10-06T00:00:00.000Z',publishedAt:'2026-10-07T00:00:00.000Z'
    }
  ];
  const credentials=[
    {
      id:'syn-cred-1',issuerOrganizationId:'syn-inst-museum',subjectAccountId:'syn-scholar-1',
      credentialType:'PROVENANCE_REVIEW_PARTICIPANT',projectRef:'syn-project-volkova',
      roleLabel:'Provenance review participant',scope:{artistId:creator.id,objectId:work.id},
      status:'ACTIVE',validFrom:'2026-09-01T00:00:00.000Z',validUntil:'2026-12-31T23:59:59.000Z',issuedAt:'2026-09-01T00:00:00.000Z'
    }
  ];
  const verification=buildIndependentVerification({
    objectId:work.id,
    requestedHash:passport.evidencePackageSha256,
    passport,
    currentRevision:revision,
    requestedRevision:revision,
    contributions,
    credentials
  });
  const interchange=buildResearchInterchangeProfile({
    passport,
    objectMetadata:work.passport,
    exhibitions:work.passport.exhibitions,
    bibliography:work.passport.bibliography,
    institutionalIdentifiers:work.passport.institutionalIdentifiers,
    media:work.passport.media,
    scholarlyContributions:contributions,
    scopedCredentials:credentials
  });
  const partnerBundle=buildPortableProvenanceBundle(passport);
  return {
    catalogueVersion:SYNTHETIC_REFERENCE_CATALOGUE_VERSION,
    synthetic:true,
    rights:{data:'CC0-1.0',media:'SYNTHETIC_PUBLIC_DOMAIN'},
    creator,
    work:{id:work.id,objectCode:work.objectCode,title:work.passport.title,maker:work.passport.maker},
    sources:[
      {id:'syn-source-museum-ledger',class:'INSTITUTIONAL_RECORD',public:true},
      {id:'syn-source-letter-1914',class:'PRIMARY_DOCUMENT',public:true},
      {id:'syn-source-article-2024',class:'SCHOLARLY_PUBLICATION',public:true}
    ],
    exhibition:work.passport.exhibitions[0],
    bibliography:work.passport.bibliography,
    scholarlyContributions:contributions,
    scopedCredentials:credentials,
    passport,
    partnerBundle,
    verification,
    interchange,
    acceptance:{
      containsIntentionalConflict:passport.evidenceSummary.conflictEventIds.length>0,
      containsIntentionalEvidenceGap:passport.evidenceSummary.gapIndex.totalGaps>0,
      privateOwnerIdentityIncluded:false,
      authenticityCertified:false,
      uncertaintyPreserved:interchange.boundaries.uncertaintyFlattened===false
    }
  };
}
