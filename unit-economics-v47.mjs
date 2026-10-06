import {db,requirePermission} from './runtime-v09.mjs';
import {investorCommercialAggregate,listOperatorCommercialPilots} from './commercial-evidence-v46.mjs';

const sumMap=maps=>{const out={};for(const m of maps||[])for(const [c,v] of Object.entries(m||{}))out[c]=(out[c]||0)+Number(v||0);return out};
const ratioMap=(num,den)=>{const out={};for(const c of new Set([...Object.keys(num||{}),...Object.keys(den||{})]))out[c]=(den?.[c]||0)>0?Number(((num?.[c]||0)/(den[c]||1)).toFixed(4)):null;return out};

export function unitEconomicsCapabilities(){return{
 contractVersion:'v47',
 evidenceFirst:true,
 noImplicitFx:true,
 observedMetrics:[
  'paid_pilots','verified_cash_by_currency','gross_contribution_by_currency',
  'direct_contribution_ratio_by_currency','recurring_cash_share_by_currency',
  'cost_mix_by_class','pricing_confidence_distribution'
 ],
 lockedUntilSourceAuthority:[
  'ARR','GAAP_IFRS_REVENUE','GROSS_MARGIN','CAC','CAC_PAYBACK','LTV','LTV_CAC','NET_REVENUE_RETENTION','PAID_CONVERSION'
 ],
 boundaries:{
  grossContributionIsNotGrossMargin:true,
  recurringCashShareIsNotARR:true,
  acquisitionCostPerPaidPilotIsNotCAC:true,
  renewalEvidenceIsNotRetentionRateWithoutEligibleDenominator:true
 }
}}

export function deriveUnitEconomics({aggregate=null,pilots=[]}={}){
 const paidPilots=Number(aggregate?.paidPilots||0);
 const cash=aggregate?.cashReceivedMinorByCurrency||{};
 const contribution=aggregate?.grossContributionMinorByCurrency||{};
 const directContributionRatio=ratioMap(contribution,cash);

 const recurringMaps=[],allClassifiedCashMaps=[],costClassMaps={};
 let paymentTotal=0,paymentClassified=0,costTotal=0,costClassified=0,renewalEvidence=0;
 for(const p of pilots||[]){
  const s=p.summary||{};
  paymentTotal+=Number(s.classificationCoverage?.payments?.total||0);
  paymentClassified+=Number(s.classificationCoverage?.payments?.classified||0);
  costTotal+=Number(s.classificationCoverage?.costs?.total||0);
  costClassified+=Number(s.classificationCoverage?.costs?.classified||0);
  recurringMaps.push(s.cashByRevenueClass?.RECURRING||{});
  for(const [klass,map] of Object.entries(s.cashByRevenueClass||{}))if(klass!=='UNCLASSIFIED')allClassifiedCashMaps.push(map);
  for(const [klass,map] of Object.entries(s.costByClass||{})){costClassMaps[klass]??=[];costClassMaps[klass].push(map)}
  if(s.renewalAccepted||s.expansionAccepted)renewalEvidence++;
 }
 const recurringCash=sumMap(recurringMaps),classifiedCash=sumMap(allClassifiedCashMaps),recurringCashShare=ratioMap(recurringCash,classifiedCash);
 const costMixByClass=Object.fromEntries(Object.entries(costClassMaps).map(([k,maps])=>[k,sumMap(maps)]));
 const acquisitionCost=sumMap(costClassMaps.ACQUISITION||[]);
 const acquisitionCostPerPaidPilot={};
 for(const [c,v] of Object.entries(acquisitionCost))acquisitionCostPerPaidPilot[c]=paidPilots>0?Math.round(v/paidPilots):null;

 const paymentCoverage=paymentTotal?Number((paymentClassified/paymentTotal).toFixed(4)):null;
 const costCoverage=costTotal?Number((costClassified/costTotal).toFixed(4)):null;

 const locks={
  ARR:{state:'LOCKED',reason:'Requires active recurring contract authority with billing cadence and effective dates. Payment cash alone is insufficient.'},
  GAAP_IFRS_REVENUE:{state:'LOCKED',reason:'Commercial Evidence is not an accounting ledger.'},
  GROSS_MARGIN:{state:'LOCKED',reason:'Requires an approved accounting cost-of-revenue policy. Gross contribution is not gross margin.'},
  CAC:{state:'LOCKED',reason:'Requires acquisition-spend authority plus attributable acquired-customer denominator.'},
  CAC_PAYBACK:{state:'LOCKED',reason:'Requires validated CAC and recurring gross-margin contribution cadence.'},
  LTV:{state:'LOCKED',reason:'Requires retained recurring cohorts and churn/expansion evidence over time.'},
  LTV_CAC:{state:'LOCKED',reason:'Requires validated LTV and CAC authorities.'},
  NET_REVENUE_RETENTION:{state:'LOCKED',reason:'Requires recurring contracted revenue cohorts and comparable period denominator.'},
  PAID_CONVERSION:{state:'LOCKED',reason:'Requires authoritative qualified-commercial-opportunity denominator, not just paid pilots.'}
 };

 return{
  evidenceState:paidPilots>0?'OBSERVED':'MISSING',
  paidPilots,
  cashReceivedMinorByCurrency:cash,
  grossContributionMinorByCurrency:contribution,
  directContributionRatioByCurrency:directContributionRatio,
  recurringCashMinorByCurrency:recurringCash,
  recurringCashShareByCurrency:recurringCashShare,
  costMixMinorByClass:costMixByClass,
  acquisitionCostPerPaidPilotMinorByCurrency:acquisitionCostPerPaidPilot,
  renewalOrExpansionEvidencePilots:renewalEvidence,
  classificationCoverage:{payments:{classified:paymentClassified,total:paymentTotal,ratio:paymentCoverage},costs:{classified:costClassified,total:costTotal,ratio:costCoverage}},
  pricingConfidence:aggregate?.pricingConfidence||{HIGH:0,MEDIUM:0,LOW:0,UNPROVEN:0},
  locks,
  boundaries:unitEconomicsCapabilities().boundaries
 }
}

export async function operatorUnitEconomics(account){
 requirePermission(account,'audit.read');
 if(db.kind!=='POSTGRES')return{persistence:'MEMORY_FALLBACK',economics:deriveUnitEconomics({aggregate:{paidPilots:0,cashReceivedMinorByCurrency:{},grossContributionMinorByCurrency:{}},pilots:[]})};
 const [aggregate,pilotIndex]=await Promise.all([investorCommercialAggregate(account),listOperatorCommercialPilots(account)]);
 return{persistence:'POSTGRES',economics:deriveUnitEconomics({aggregate,pilots:pilotIndex.pilots||[]})}
}
