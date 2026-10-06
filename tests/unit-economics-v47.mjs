import assert from 'node:assert/strict';
import {deriveUnitEconomics,unitEconomicsCapabilities} from '../unit-economics-v47.mjs';

const caps=unitEconomicsCapabilities();
assert.equal(caps.contractVersion,'v47');
assert.equal(caps.boundaries.grossContributionIsNotGrossMargin,true);
assert.equal(caps.boundaries.recurringCashShareIsNotARR,true);
assert.equal(caps.boundaries.acquisitionCostPerPaidPilotIsNotCAC,true);

const aggregate={
 paidPilots:2,
 cashReceivedMinorByCurrency:{EUR:200000},
 grossContributionMinorByCurrency:{EUR:140000},
 pricingConfidence:{HIGH:1,MEDIUM:1,LOW:0,UNPROVEN:0}
};
const pilots=[
 {summary:{
   cashByRevenueClass:{RECURRING:{EUR:70000},ONE_TIME:{EUR:30000}},
   costByClass:{ACQUISITION:{EUR:20000},ONBOARDING:{EUR:15000}},
   classificationCoverage:{payments:{classified:2,total:2},costs:{classified:2,total:2}},
   renewalAccepted:true,expansionAccepted:false
 }},
 {summary:{
   cashByRevenueClass:{RECURRING:{EUR:50000},PROJECT:{EUR:50000}},
   costByClass:{ACQUISITION:{EUR:10000},SUPPORT:{EUR:15000}},
   classificationCoverage:{payments:{classified:2,total:2},costs:{classified:2,total:2}},
   renewalAccepted:false,expansionAccepted:false
 }}
];
const e=deriveUnitEconomics({aggregate,pilots});
assert.equal(e.evidenceState,'OBSERVED');
assert.equal(e.directContributionRatioByCurrency.EUR,0.7);
assert.equal(e.recurringCashMinorByCurrency.EUR,120000);
assert.equal(e.recurringCashShareByCurrency.EUR,0.6);
assert.equal(e.acquisitionCostPerPaidPilotMinorByCurrency.EUR,15000);
assert.equal(e.renewalOrExpansionEvidencePilots,1);
assert.equal(e.classificationCoverage.payments.ratio,1);
assert.equal(e.classificationCoverage.costs.ratio,1);
assert.equal(e.quality.recurringCashShare.state,'DECISION_GRADE');
assert.equal(e.quality.costMix.state,'DECISION_GRADE');
assert.deepEqual(e.metricLineage.grossContribution,['PAYMENT_RECEIVED','REFUND_RECORDED','DIRECT_COST_RECORDED']);

for(const key of ['ARR','GAAP_IFRS_REVENUE','GROSS_MARGIN','CAC','CAC_PAYBACK','LTV','LTV_CAC','NET_REVENUE_RETENTION','PAID_CONVERSION']){
 assert.equal(e.locks[key].state,'LOCKED',key+' must remain locked without source authority');
}

const empty=deriveUnitEconomics({aggregate:{paidPilots:0,cashReceivedMinorByCurrency:{},grossContributionMinorByCurrency:{}},pilots:[]});
assert.equal(empty.evidenceState,'MISSING');
assert.deepEqual(empty.cashReceivedMinorByCurrency,{});
assert.equal(empty.locks.ARR.state,'LOCKED');
assert.equal(empty.quality.cash.state,'MISSING');
assert.equal(empty.quality.recurringCashShare.state,'MISSING');

console.log('ANTIQUA v47 Unit Economics Authority methodology passed');
