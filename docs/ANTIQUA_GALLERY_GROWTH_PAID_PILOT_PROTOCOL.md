# ANTIQUA — Gallery Growth Paid Pilot Protocol v1

**Status:** EXECUTION PROTOCOL  
**Purpose:** run the first real paid Gallery Growth pilot so that product, commercial and unit-economics evidence is created at source and is usable by v0.46 Commercial Evidence and v0.47 Unit Economics.

## 1. Pilot admission

A Gallery Growth pilot may be treated as a **real paid pilot** only when the following are explicitly known or explicitly marked MISSING:

- legal counterparty;
- named counterparty representative;
- ANTIQUA pilot owner;
- seller/gallery account;
- primary workflow/use case;
- artwork scope;
- artist scope;
- start date;
- end date;
- baseline window;
- KPI contract;
- proposed commercial scope;
- accepted commercial scope;
- fee and currency, when accepted;
- commercial evidence reference;
- renewal decision date.

Unknown values are not replaced with investor assumptions.

## 2. Bounded pilot design

Recommended operating shape for the first pilot:

- one gallery / professional seller;
- one primary decision owner;
- one bounded artwork cohort;
- one bounded artist cohort;
- one agreed pilot period;
- one primary professional workflow;
- one final evidence pack.

A practical starting cohort can be approximately **20–60 artworks and 5–15 artists**, but this is an operating design range, not market evidence and not a commercial commitment.

The pilot must stay narrow enough that direct delivery cost and outcome evidence can be attributed without guesswork.

## 3. Primary workflow

The first paid pilot should exercise the smallest complete Gallery Growth loop:

`Artwork → Artist → Research → Save/Follow → Inquiry → Viewing → Offer → Outcome`

Professional-side loop:

`Inventory → demand evidence → response → viewing → offer → outcome → renewal decision`

The pilot should not depend on unrelated ANTIQUA modules.

## 4. Frozen baseline

Before launch, freeze the baseline window in the existing Pilot Authority.

Candidate baseline fields:

- enquiries in the comparable baseline period;
- median first-response time;
- viewing requests;
- completed viewings;
- offers;
- accepted/completed outcomes;
- returning-user baseline if available;
- current digital catalogue engagement if available.

If a baseline does not exist, mark it **MISSING**.

Do not reconstruct baseline values from memory after the pilot begins.

## 5. KPI contract

KPIs must be defined before launch with:

- code;
- definition;
- unit;
- numerator;
- denominator where applicable;
- source system / authority;
- direction;
- target only if the counterparty actually agreed one.

Candidate evidence families:

### Product engagement
- artwork opens;
- artist continuation;
- research depth;
- saves;
- follows;
- collection adds;
- D7 return;
- D30 return.

### Professional workflow
- qualified enquiries;
- response coverage;
- median response time;
- viewing requests;
- viewing completion;
- offers;
- accepted outcomes;
- explicit closed outcomes.

### Commercial
- accepted pilot fee;
- verified cash;
- direct attributable cost;
- gross contribution;
- renewal / expansion evidence.

Product engagement is not automatically proof of commercial causality.

## 6. Commercial evidence sequence

Record commercial facts in v0.46 as separate source events:

1. `QUOTE_ISSUED`
2. `PRICE_VERBAL_ACCEPTED` if it actually occurred
3. `PRICE_WRITTEN_ACCEPTED`
4. `INVOICE_ISSUED`
5. `PAYMENT_RECEIVED`
6. `DIRECT_COST_RECORDED` throughout delivery
7. `REFUND_RECORDED` if applicable
8. `RENEWAL_PROPOSED`
9. `RENEWAL_ACCEPTED` / `RENEWAL_REJECTED` / `EXPANSION_ACCEPTED`

### Evidence-reference minimums

- written price acceptance → proposal / email / contract reference;
- invoice → invoice reference;
- payment → bank / payment-provider evidence reference;
- refund → refund reference;
- renewal / expansion → written acceptance reference.

Do not put banking secrets or unnecessary personal data in free-text notes.

## 7. Revenue classification

Classify each payment at source when known:

- `RECURRING`
- `ONE_TIME`
- `USAGE`
- `TRANSACTION`
- `SPONSORSHIP`
- `PROJECT`

Do **not** label the first pilot fee RECURRING unless the commercial instrument genuinely creates recurring billing.

## 8. Direct-cost taxonomy

Only direct attributable pilot-delivery cost should enter v0.46:

- `ACQUISITION`
- `ONBOARDING`
- `SUPPORT`
- `PROVIDER`
- `EVENT_DELIVERY`
- `RESEARCH_DELIVERY`
- `OTHER`

Examples:

- staff time specifically spent onboarding this pilot;
- provider cost directly caused by this pilot;
- acquisition spend attributable to this counterparty;
- pilot-specific support and delivery work.

Corporate overhead must not be pushed into pilot direct cost unless an explicit allocation policy exists.

## 9. Weekly operating cadence

At every signed weekly checkpoint record:

- scope changes;
- data-quality issues;
- engagement movement;
- enquiries;
- response SLA;
- viewing movement;
- offer movement;
- delivery effort;
- new direct costs;
- unresolved objections;
- evidence gaps.

The checkpoint is an evidence snapshot, not a forecast.

## 10. Counterparty acknowledgement

The gallery counterparty should be able to:

- accept the frozen contract;
- accept / object to checkpoints;
- accept / object to the final evidence pack;
- provide a renewal / expansion decision.

The final investor interpretation must distinguish:

- ANTIQUA telemetry;
- ANTIQUA commercial ledger;
- counterparty acknowledgement;
- counterparty commercial commitment.

## 11. End-of-pilot decision

Classify the end state explicitly:

### STOP
Use when:
- no accepted value;
- no renewal intent;
- economics are operationally unacceptable;
- material trust/data failure exists.

### ITERATE
Use when:
- measurable value exists;
- important product/process/economic gaps remain;
- continuation requires material changes.

### RENEW
Use only when:
- continued paid scope is accepted in writing;
- the counterparty has accepted the relevant evidence;
- delivery appears repeatable enough to continue.

### EXPAND
Use only when:
- a broader paid scope is accepted in writing;
- expansion dimension is explicit: users, artworks, artists, geography, event, institution or workflow.

The decision is evidence, not a hidden score.

## 12. Final evidence pack

The final pilot packet should contain:

1. frozen pilot contract digest;
2. counterparty contract acceptance;
3. launch-readiness proof;
4. launch record;
5. cohort/scope snapshot;
6. baseline snapshot;
7. KPI definitions;
8. weekly checkpoints;
9. product telemetry period;
10. professional workflow summary;
11. v0.46 commercial ledger summary;
12. direct-cost summary;
13. v0.47 observed unit economics;
14. classification coverage;
15. unresolved data-quality gaps;
16. final counterparty review;
17. renewal / expansion decision;
18. signed final evidence pack / certificate where applicable.

## 13. What the first paid pilot can prove

A successful first paid pilot may prove:

- an external counterparty accepted a commercial scope;
- the counterparty accepted a real price;
- money was actually received;
- delivery costs can be observed;
- direct gross contribution can be calculated;
- the product created measurable workflow/engagement evidence;
- the counterparty chose to stop, iterate, renew or expand.

It does **not** by itself prove:

- repeatable pricing;
- repeatable CAC;
- ARR;
- market-wide willingness to pay;
- NRR;
- LTV;
- LTV/CAC;
- scalable gross margin;
- product-market fit.

Those require multiple independent counterparties and time.

## 14. Investor evidence ladder

Use the following language:

`Designed`
→ protocol exists.

`Accepted`
→ counterparty accepted scope / price.

`Paid`
→ PAYMENT_RECEIVED exists.

`Economically observed`
→ direct costs and gross contribution are classified.

`Renewed`
→ written paid renewal exists.

`Repeated`
→ the same commercial motion works across multiple independent counterparties.

`Scalable`
→ economics, delivery capacity and retention remain acceptable as volume increases.

Do not skip levels.

## 15. Pilot acceptance gate

A pilot can be presented as **PAID PILOT EVIDENCE** only if:

- real counterparty exists;
- contract/scope is frozen;
- counterparty acceptance exists;
- launch gate passed;
- actual `PAYMENT_RECEIVED` exists;
- payment has evidence reference;
- direct costs are captured or explicitly marked incomplete;
- classification coverage is visible;
- final counterparty review exists or is explicitly pending;
- renewal decision exists or is explicitly pending.

## 16. Immediate operating checklist

Before inviting the first gallery:

- [ ] choose one real gallery / professional seller;
- [ ] define one primary workflow;
- [ ] select the bounded artwork/artist cohort;
- [ ] freeze baseline definitions;
- [ ] freeze KPI definitions;
- [ ] prepare commercial proposal;
- [ ] prepare counterparty acceptance path;
- [ ] configure pilot governance and quorum;
- [ ] configure weekly cadence;
- [ ] define evidence-reference naming convention;
- [ ] define direct-cost capture owner;
- [ ] define renewal decision date;
- [ ] run launch readiness;
- [ ] only then launch.

