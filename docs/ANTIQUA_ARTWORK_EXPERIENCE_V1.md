# ANTIQUA — Artwork Experience Layer v1

**Status:** UX / PRODUCT CONTRACT  
**Dependency:** artwork-first foundation v0.43+  
**Goal:** make ANTIQUA technically deep **and** visually compelling for collectors, researchers, galleries and art lovers without creating another top-level product pillar.

## 1. Core principle

The primary experience is not:

`catalogue card -> price -> buy`

It is:

`see -> understand -> investigate -> connect -> save -> revisit -> enquire / view / acquire when relevant`

The artwork remains the central object.

## 2. Artwork Dossier — visual hierarchy

The Dossier should read in five layers:

### Layer A — LOOK
- large artwork-first image;
- fullscreen / zoom / pan;
- media strip;
- discreet title / artist / date / medium;
- commercial state does not dominate the image.

### Layer B — UNDERSTAND
A compact visual facts rail:
- artist / attribution state;
- artwork type;
- medium / technique / support;
- period / date;
- dimensions;
- location/public-location state;
- evidence state;
- sale state only when real.

### Layer C — STORY
One visual artwork journey that combines dated public facts from:
- provenance;
- exhibitions;
- catalogue/research revisions;
- condition publications;
- market/commercial events only where public and appropriate.

The journey must distinguish fact types visually instead of pretending they are one homogeneous chronology.

### Layer D — RESEARCH
- Evidence Coverage Map;
- bibliography;
- provenance gaps;
- exhibition-history gaps;
- revision history;
- open research questions;
- source-backed expert notes;
- explicit boundaries: no authenticity score, no appraisal score.

### Layer E — CONTINUE
- artist page;
- related works;
- same technique / period / department;
- exhibition context;
- collection / ensemble relations;
- save / follow / add to collection;
- inquiry / viewing / offer only where authority exists.

## 3. Artwork Story Map

Create a visual horizontal/vertical chronology from existing authority facts.

Supported event families:
- CREATED / DATED;
- PROVENANCE;
- EXHIBITED;
- PUBLISHED;
- RESEARCH_REVISION;
- CONDITION;
- CATALOGUE;
- MARKET_CONTEXT.

Rules:
- every visible event has a source authority;
- private owner/location data is excluded;
- undated events render as “date unknown”, not a guessed date;
- market event does not imply attribution validity;
- chronological gaps remain visible.

## 4. Evidence Map

The current six-dimension evidence model should become a visual research map:

- Attribution;
- Provenance;
- Bibliography;
- Exhibition history;
- Revisions;
- Market comparables.

States:
- PRESENT;
- PARTIAL;
- MISSING.

Interaction:
- tap/click a dimension -> scroll to the corresponding Dossier section;
- show count of linked records;
- show one-line explanation of what is missing;
- no aggregate confidence percentage.

## 5. Research Questions

Open research questions become first-class visible objects, not a paragraph at the bottom.

Examples:
- provenance gap before [known event];
- no reviewed bibliography linked;
- exhibition history incomplete;
- attribution evidence not linked;
- comparable market set too small.

For professionals:
- allow contribution/review workflow later through existing evidence authorities.

For public users:
- show the question without exposing private evidence.

## 6. Artist Context

From Artwork Dossier the user should understand the creator in one glance:

- verified profile state;
- chronology;
- disciplines;
- represented / independent / not stated;
- works in ANTIQUA;
- exhibition context;
- related works grouped by technique / period;
- research-source count.

Avoid follower-count vanity dominance.

## 7. Explainable Related Works

Every related-work card should answer:

**Why am I seeing this?**

Visible reason chips:
- same artist;
- same department;
- same technique;
- shared material/support;
- related period;
- same exhibition / ensemble;
- adjacent taste direction.

Price proximity must never be shown as an artistic similarity explanation unless explicitly framed as market context.

## 8. Collector Journey

For an authenticated collector:

`Artwork -> Save -> Artist -> Related Work -> Collection -> Collection Strategy -> Return`

The system should remember:
- recently researched works;
- saved works;
- followed creators;
- collection additions;
- explicit negative feedback where supported.

The collector should always be able to answer:
- what did I look at?
- why did I save it?
- what collection does it belong to?
- what should I explore next?
- why is the recommendation relevant?

## 9. Collection Experience

A Collection should feel like a private/public exhibition rather than a spreadsheet.

Visual surfaces:
- cover artwork;
- collection statement;
- artwork wall / masonry view;
- chronological / artist / medium grouping;
- concentration map;
- collection gaps / adjacent directions;
- private ownership and insurance remain outside public presentation.

No automatic investment-performance framing.

## 10. Visual Research Graph

Use existing relations to render an optional lightweight graph:

`Artwork <-> Artist <-> Exhibition <-> Collection <-> Related Work <-> Source`

Rules:
- graph is a navigation aid, not a scientific claim;
- no hidden graph score;
- no private owner nodes;
- each edge is explainable;
- mobile falls back to stacked relationship cards rather than an unusable force graph.

## 11. Technical visual signals

The UI should communicate technical depth without exposing implementation jargon.

User-facing:
- “Source linked”
- “Reviewed”
- “Research gap”
- “Updated”
- “Public provenance”
- “Related through exhibition”
- “Dossier revision”

Avoid user-facing:
- SHA-256 everywhere;
- event bus terminology;
- database state;
- idempotency;
- internal authority names.

Hashes / technical verification remain available under an advanced Evidence / Verification disclosure.

## 12. Image experience

Current zoom/pan should be strengthened with:
- fit-to-screen;
- double-tap zoom;
- pinch zoom;
- swipe between media;
- optional compare two works;
- detail-image labels;
- signature / reverse / condition-detail media roles;
- loading skeleton rather than layout jump.

Future IIIF:
- deep zoom tiles;
- region links;
- annotations;
- scholarly citations to image regions.

Do not fake IIIF capabilities before a real image server is connected.

## 13. Mobile priorities

On iPhone:
- artwork image first;
- sticky bottom actions limited to Save / Research / commercial CTA when applicable;
- horizontal evidence rail;
- no async block may move the active CTA under the user’s finger;
- related works are swipeable cards;
- timelines use a single vertical spine;
- graphs collapse into relationship cards.

On tablet:
- image + facts split layout;
- research and related works two-column where space permits.

On desktop:
- image remains large;
- research details can expand beside/under artwork;
- no dense admin-dashboard aesthetic on public pages.

## 14. Performance requirements

Visual richness must not create a slow art experience.

Requirements:
- primary artwork image prioritized;
- non-primary media lazy loaded;
- reserve aspect-ratio space to prevent CLS;
- async intelligence surfaces use skeleton/reserved slots;
- no late-mounted block may intercept an existing CTA;
- related work thumbnails lazy load;
- mobile interaction target >= 44px where practical.

## 15. Accessibility

- keyboard-accessible artwork cards;
- meaningful image alt text where catalogued;
- no information encoded by color alone;
- focus states on tabs, related works and evidence map;
- reduced-motion support;
- zoom/pan must not trap keyboard users;
- research state labels remain textual.

## 16. What makes this distinctive

ANTIQUA should combine four experiences that are usually separated:

1. museum-quality artwork viewing;
2. research/provenance dossier;
3. collector memory and discovery;
4. professional/commercial workflow.

The commercial CTA is therefore an **optional exit from knowledge**, not the organizing principle of the artwork page.

## 17. First implementation wave after base green

1. reserve stable Dossier async slots to eliminate layout jumps;
2. Artwork Story Map using provenance + exhibition + revision facts;
3. interactive Evidence Map linked to Dossier sections;
4. research-question cards;
5. explainable related-work reason chips;
6. improved artist-context summary inside Dossier;
7. Collection visual wall + grouping modes;
8. mobile sticky actions and CTA stability;
9. tablet/desktop visual QA;
10. browser E2E for Dossier exploration journey.

## 18. Acceptance journey

A new visitor should be able to complete:

`Gallery -> Artwork -> fullscreen detail -> understand medium/date/artist -> inspect provenance -> inspect evidence gaps -> open artist -> open related work -> save -> add to collection`

without encountering:
- a dead end;
- a misleading authenticity/value score;
- a commerce CTA for a non-sale artwork;
- unexplained recommendations;
- a mobile layout jump over an active control.

## 19. Success evidence

Before claiming the experience improved retention, measure:

- Dossier depth;
- artist continuation rate;
- related-work continuation rate;
- save rate;
- collection-add rate;
- D7 return after research interaction;
- D30 return after collection interaction.

These are product telemetry metrics. They do not become commercial causality claims automatically.
