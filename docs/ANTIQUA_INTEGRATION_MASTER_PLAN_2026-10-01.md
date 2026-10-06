# Antiqua — Artwork-First Integration Master Plan

**Status:** ACTIVE — PRODUCT SCOPE RESET / v0.43 planning  
**Date:** 2026-10-06  
**Canonical file:** `docs/ANTIQUA_INTEGRATION_MASTER_PLAN_2026-10-01.md`  
**Reference main state before this reset:** `446f9521b568f9a849c3212a677bbbcd9ee11a74` — v0.42 Cultural Calendar

## 1. Product decision

ANTIQUA is a focused platform for **paintings and works on paper**, not a universal antiques / collectible-object marketplace.

The product should become unusually strong at four things:

1. seeing a work properly;
2. understanding the work, artist and context;
3. building trusted personal / public collections and expert knowledge around it;
4. enabling an inquiry, viewing, private sale or auction only when the work actually has a commercial state.

### Public promise

**Discover art -> understand it -> save and collect -> connect with people around it -> attend -> acquire when relevant.**

### Primary public journey

`Home / Gallery -> Artwork -> Artist -> Related works -> Research / provenance -> Save -> Collection -> Community / Event -> Inquiry / Bid`

Commerce is progressive disclosure. The Gallery must never imply that every work is for sale.

---

## 2. Active artwork taxonomy

Public catalogue and recommendations prioritize only:

- painting;
- drawing;
- graphics;
- engraving;
- etching;
- lithography;
- woodcut;
- linocut;
- screenprint and other artist prints;
- watercolor;
- gouache;
- pastel;
- mixed-media works on paper where the work is still primarily two-dimensional fine art.

Photography, sculpture, decorative art, furniture, jewellery, watches, coins, militaria, books-as-collectibles and generic antiques do **not** define the active product.

Existing legacy records do not need destructive deletion. They may remain technically stored, but they must not shape the public navigation, seed content, recommendations or investor demo.

---

## 3. Primary audiences

### Collector / art lover
Discover, research, save, compare, build collections, follow artists and specialists, plan exhibitions, request viewings and transact when relevant.

### Artist
Maintain a reviewed professional profile, connect works to exhibitions and publications, show available works when appropriate and participate in the professional community.

### Gallery / dealer
Maintain a verified profile and inventory, publish or propose works, answer inquiries, manage viewings, offers and auction participation.

### Expert / historian / curator
Add reviewed context, provenance evidence, catalogue notes, exhibition history, bibliography, annotations and expert commentary without becoming an untraceable parallel authority.

### Auction / institutional partner
Publish reviewed lots or exhibition/event references through bounded professional workflows.

---

## 4. Public information architecture

Keep the top-level product compact:

1. **Gallery** — image-first discovery.
2. **Artists** — artist pages and related works.
3. **Community** — art-specific professional and collector network.
4. **Collections** — saved/private/curated collections.
5. **Research** — editorial essays, provenance context, exhibition history, bibliography and scholarly notes.
6. **Events** — exhibitions, previews, lectures and art events.
7. **Auction** — only works with an actual auction state.
8. **My ANTIQUA** — saves, collections, follows, plans, inquiries, offers and bids.

### What changes from the previous concept

- **Books and Courses stop being independent product pillars.** A book, catalogue, article, lecture or course may appear only as a research/reference/event relation to an artist, work, movement or exhibition.
- **Dealer/pilot/evidence governance remains backstage.** It is important infrastructure, not consumer navigation.
- **Generic “objects / antiques / collectibles” language is removed from the public promise.**
- **Community is retained**, but it must be art-specific rather than a generic social feed.

---

## 5. Core domain model

### Artwork
The central public entity.

Required public facts:
- title;
- artist / attribution state;
- date / date range;
- medium / technique;
- support;
- dimensions;
- inscriptions / signatures / marks;
- edition where relevant;
- current location visibility state;
- high-resolution media;
- exhibition history;
- literature / catalogue references;
- provenance summary;
- condition summary;
- publication/review state;
- commercial state: none / inquiry / private sale / auction / historical result.

### Artist
- reviewed identity;
- dates / geography;
- biography;
- movements / schools;
- works;
- exhibitions;
- bibliography / catalogue references;
- related artists;
- professional representation where verified.

### Provenance / Research evidence
Every substantive claim should be traceable to a source, reviewer and status. Competing or disputed claims must be representable.

### Collection
A collection is not merely a wishlist. Support:
- private personal collections;
- curated thematic collections;
- public institutional / editorial collections;
- save/favorite state separately from collection membership.

### Art Network
Profiles and relationships for artists, galleries, experts, historians, curators, collectors and institutions. Network actions should resolve back to art: a work, artist, collection, exhibition or research topic.

### Event / Exhibition
v0.42 Cultural Calendar remains relevant because exhibitions and viewings are part of the art journey. Generic city/event functionality must not expand beyond art.

### Commercial state
Reuse existing inquiry, offer/counteroffer, condition report, viewing and auction authorities. Do not create a second commerce stack.

---

## 6. Keep now

These capabilities directly improve the painting / works-on-paper product and remain in the active roadmap:

- high-resolution artwork media;
- IIIF manifest/viewing pattern;
- zoom and comparison;
- region annotation for signatures, labels, condition and details;
- provenance graph with evidence and uncertainty;
- authority reconciliation for artists, places, techniques and institutions;
- OCR only as a candidate observation for labels/inscriptions/documents;
- visual similarity for related works, duplicate/reappearance detection and discovery;
- artist / creator graph;
- related works;
- collections;
- art-specific community;
- exhibitions and Cultural Calendar;
- condition report and viewing request;
- inquiry and offer negotiation;
- auction state and historical results;
- privacy controls for private collections, locations and unpublished works.

---

## 7. Remove from the active concept

The following must not consume current product or investor-demo capacity:

- universal antiques marketplace positioning;
- non-art collectible categories as public discovery pillars;
- standalone book marketplace;
- standalone course marketplace;
- generic lifestyle events;
- generic social feed detached from artworks/artists;
- 3D-first presentation of paintings;
- photogrammetry as a near-term requirement;
- glTF pipeline as an MVP requirement;
- transferable verifiable-credential passport as an MVP requirement;
- speculative blockchain-style ownership concepts;
- enterprise workflow surfaces in the primary consumer navigation;
- transaction/settlement complexity presented before a real provider contour is verified.

Existing code can remain where removing it would create unnecessary regression risk, but it should be hidden, deprioritized or marked deferred rather than promoted as product scope.

---

## 8. Deferred research backlog

Potentially useful later, but not active MVP work:

- C2PA ingestion;
- Linked Art / RDF public export;
- OCFL-style preservation packaging;
- external research APIs beyond the minimum required authority reconciliation;
- transferable credentials;
- 3D / photogrammetry / glTF;
- advanced institutional interoperability;
- large-scale automated semantic enrichment.

Reopen a deferred item only when it materially improves one of:
1. artwork understanding;
2. artwork trust/research;
3. collection value;
4. art-community collaboration;
5. commercial conversion for eligible works.

---

## 9. v0.43 — Focused Gallery & Artwork Dossier

This is the next product wave.

### 9.1 Public language cleanup
Replace visible generic terms:
- object -> artwork / work;
- maker -> artist where semantically correct;
- object passport -> artwork dossier;
- culture of things -> art / provenance / collecting.

Internal identifiers may remain for compatibility.

### 9.2 Catalogue scope guard
Add an explicit public artwork allow-list. Legacy non-art records should not enter:
- Gallery;
- recommendations;
- related works;
- investor-demo seed data;
- public search facets.

### 9.3 Gallery
Gallery must be:
- image-first;
- quiet;
- fast on iPhone, tablet and desktop;
- filterable by artist, period, medium/technique, support, dimensions, availability and provenance/review state;
- free from dealer-operations UI.

### 9.4 Artwork Dossier
The artwork page becomes the strongest surface in the product:

**Image -> essential facts -> artist -> why this work matters -> provenance -> exhibition history -> literature -> condition -> expert notes -> related works -> collection/save -> commercial state if any.**

Research depth stays progressive; first screen remains visual.

### 9.5 Artist page
Prioritize:
- portrait or archival image only when rights/quality are acceptable;
- biography;
- timeline;
- movements / schools;
- works in Antiqua;
- exhibitions;
- references;
- related artists;
- follow/save.

### 9.6 Community
No generic posting race.

Useful actions:
- follow artist / gallery / expert / collector;
- ask a question on an artwork or research topic;
- publish reviewed note;
- contribute provenance lead;
- connect a work to an exhibition/publication;
- invite to viewing/event;
- create or follow a curated collection.

### 9.7 Events
Keep exhibitions, private views, auctions, talks and specialist events that have a direct art relation. Do not turn Antiqua into a general city guide.

---

## 10. Research and trust rules

1. Similarity is not attribution.
2. OCR is not authentication.
3. A valid digital signature on a document proves document-integrity properties under the configured trust policy; it does not prove the artwork is authentic.
4. Provenance claims must preserve source, reviewer, status and uncertainty.
5. Private owner/location information is private by default.
6. Publication review and authentication must not be conflated.
7. Original media must not be overwritten.

---

## 11. Commercial boundary

A work can be:

- research/discovery only;
- in a private or public collection;
- in an exhibition;
- available for inquiry;
- available for private sale;
- scheduled/live/closed auction lot;
- linked to a historical auction result.

The commercial CTA appears only when supported by an actual commercial state.

Existing v0.21-v0.23 inquiry / offer / condition / viewing workflows are still valuable because they map naturally to art dealing. They remain secondary to the artwork dossier rather than defining the home experience.

---

## 12. Infrastructure boundary

The dedicated Antiqua PostgreSQL/Supabase contour and the existing governance work remain valid foundations.

This scope reset **does not claim** that live-production gates are complete. Before representing the product as production-ready for real transactions, independently verify:

- exact deployed commit;
- `persistence=POSTGRES`;
- restart durability;
- production identity/security settings;
- real provider/payment/settlement integrations where used;
- real counterparty acceptance and operational evidence.

Do not reuse another project's database.

---

## 13. MVP success metrics

Primary:
- artwork opens / session;
- artwork -> artist continuation;
- artwork -> related-work continuation;
- save rate;
- collection add/create rate;
- follow rate;
- research-depth engagement;
- D7 / D30 authenticated return;
- event save/plan rate;
- inquiry/viewing/offer/bid conversion only for eligible works.

Do not blend dealer-pilot operational KPIs into consumer engagement metrics.

---

## 14. v0.43 acceptance gate

v0.43 is complete only when:

- public positioning says paintings / works on paper rather than antiques / collectibles;
- visible shell no longer says “culture of things”;
- research replaces Books/Courses as the public knowledge pillar;
- Gallery seed content is art-only;
- non-art categories cannot surface through normal public Gallery/search;
- Artwork Dossier uses artwork-specific language;
- artist, collection, community and event links resolve correctly;
- commercial CTA is absent when no commercial state exists;
- iPhone, tablet and desktop smoke paths remain usable;
- existing v0.41 Art Network and v0.42 Cultural Calendar routes still work.

## 15. Next implementation order

1. scope-language and navigation cleanup;
2. public artwork taxonomy guard;
3. art-only seed/catalogue cleanup;
4. Artwork Dossier restructuring;
5. artist-page strengthening;
6. research/provenance UI;
7. community actions tied to art entities;
8. exhibition/event refinement;
9. commercial CTA cleanup;
10. deployed responsive smoke and investor-demo pass.

Anything outside this order must justify itself against the artwork-first product thesis.
