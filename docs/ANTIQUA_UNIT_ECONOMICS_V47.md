# ANTIQUA v0.47 — Unit Economics Authority

**Status:** DEPENDENT FEATURE BRANCH / VERIFYING  
**Dependency:** v0.46 Commercial Evidence Authority.

## 1. Objective

Convert verified commercial evidence into decision-grade operating economics without inventing finance KPIs that do not yet have a source authority.

## 2. Observed metrics

v0.47 may derive directly from v0.46:

- paid pilots;
- verified cash by currency;
- gross contribution by currency;
- direct contribution ratio = gross contribution / verified cash;
- recurring cash by currency;
- recurring cash share within classified cash;
- cost mix by class;
- observed acquisition cost per paid pilot;
- renewal / expansion evidence count;
- pricing-confidence distribution;
- payment/cost classification coverage.

These are operating evidence metrics, not accounting statements.

## 3. Revenue classes

Each payment may optionally be classified at source as:

- RECURRING;
- ONE_TIME;
- USAGE;
- TRANSACTION;
- SPONSORSHIP;
- PROJECT.

Classification is captured on the immutable commercial event.

## 4. Cost classes

Each direct cost may optionally be classified at source as:

- ACQUISITION;
- ONBOARDING;
- SUPPORT;
- PROVIDER;
- EVENT_DELIVERY;
- RESEARCH_DELIVERY;
- OTHER.

## 5. Locked KPIs

The following remain explicitly LOCKED until dedicated authorities exist:

- ARR;
- GAAP/IFRS revenue;
- Gross Margin;
- CAC;
- CAC Payback;
- LTV;
- LTV/CAC;
- Net Revenue Retention;
- Paid Conversion.

### Why

ARR requires:
- active recurring contract authority;
- billing cadence;
- effective dates;
- contract value;
- cancellation/renewal state.

CAC requires:
- attributable acquisition spend;
- acquired-customer denominator;
- attribution window/policy.

CAC payback requires:
- validated CAC;
- recurring contribution cadence;
- accepted margin policy.

Gross margin requires:
- accounting-approved cost-of-revenue policy.

Paid conversion requires:
- authoritative qualified opportunity denominator.

NRR requires:
- recurring contracted revenue cohort;
- comparable opening/closing period.

## 6. Important terminology boundaries

- gross contribution ≠ gross margin;
- recurring cash share ≠ ARR;
- acquisition cost per paid pilot ≠ CAC;
- renewal evidence count ≠ renewal rate;
- cash received ≠ accounting revenue.

## 7. Currency

No implicit cross-currency aggregation.

All monetary metrics remain grouped by currency until an explicit FX authority and conversion date policy exist.

## 8. Evidence coverage

Revenue-mix metrics should not become decision-grade until payment classification coverage is complete enough for the cohort.

The Investor Traction Dashboard displays classification coverage explicitly.

## 9. Investor experience

The investor sees:

### Observed
- verified cash;
- gross contribution;
- direct contribution ratio;
- recurring cash share;
- renewal/expansion evidence;
- classification coverage.

### Locked
For every unsupported KPI:
- KPI name;
- state = LOCKED;
- missing authority / denominator.

This is intentional. A blank/locked metric is stronger evidence governance than an invented number.

## 10. Acceptance gate

v0.47 is PASS only when:

- v0.46 is green and merged first;
- unit methodology tests pass;
- buyer cannot access operator economics;
- operator projection works on durable and memory fallback modes;
- investor dashboard shows observed and locked metrics separately;
- recurring cash is never labelled ARR;
- acquisition cost per paid pilot is never labelled CAC;
- gross contribution ratio is never labelled gross margin;
- mobile browser test passes.
