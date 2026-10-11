# ANTIQUA — Investor, Sponsor & Feature Strategy Register

**Версия:** 2026-10-11 · STRATEGIC PROPOSAL / NON-AUTHORITATIVE FOR PROD
**Связанный главный документ:** [ANTIQUA_INTEGRATION_MASTER_PLAN_2026-10-01.md](./ANTIQUA_INTEGRATION_MASTER_PLAN_2026-10-01.md)
**Связанный identity gate:** [ANTIQUA_DATABASE_IDENTITY_GATE_2026-10-09.md](./ANTIQUA_DATABASE_IDENTITY_GATE_2026-10-09.md)
**Исходный main при формировании:** `a72b3198ad615224d7ef84d2ee3afce3004c3e24`
**Отдельная visual wave:** [PR #130](https://github.com/PetrFedin/antiqua/pull/130)
**Статус:** План для обсуждения и инвесторского/партнёрского формирования; не выдаёт ROADMAP за уже внедрённое.
**Объём реестра:** 103 feature-level items, 8 workstreams.

## 1. Product thesis

ANTIQUA = Artwork-centric Art Ecosystem:
**Discover → Understand → Follow → Visit → Collect → Collaborate → (only when authorized) Buy/Bid → Preserve/Research**.

В отличие от чистого маркетплейса, ценность возвращается в каждую Artwork карточку после сделки: изображение, автор, источник, права, научная неопределённость, выставки, биография, provenance, библиография, доказательства, отношения с институциями и коллекционером. Никакого второго ядра идентичности Artwork, Artist, Organization, Collection, Auction, Payment или Evidence.

### Segment-specific value proposition

| Сегмент | Входной момент | Ценность | Подтверждение |
|---|---|---|---|
| Посетитель / ценитель | произведение / автор / выставка | визуальное открытие, исследование, события | реальные переходы и возвраты |
| Коллекционер | личная подборка / приватное собрание | privacy + context + сохранение документов | коллекции, D30 return, consent |
| Художник | портфолио / выставка / галерея | показ, представительство, заявки | активные профили, запросы |
| Галерея | инвентарь / private view / клиент | меньше ручной работы, больше релевантных контактов | время до публикации, inquiries, оплаты |
| Эксперт / историк | evidence / вопрос атрибуции | источники, версии, независимые позиции | review, cited entries, gaps |
| Музей / фонд / архив | выставка / IIIF / каталог | интеграция, архив, rights, аудит | подписанный institutional pilot |
| Спонсор / меценат | конкретная культурная программа | измеряемое вовлечение, поддержка образования | согласованный impact report |
| Финансовый инвестор | рост платящих клиентов | B2B recurring + defensible research network | contracts, gross margin, retention |

## 2. Правила стратегии: что НЕ делать

- **Не переименовывать PREVIEW в production.** Runtime пока не допущен к dedicated PostgreSQL, без exact 001–033 / READY / durability.
- **Не использовать чужую БД.** Supabase ref `yutrntnncubcssqbohco` запрещён для Antiqua. Правильный project ref не установлен; сперва fresh OAuth identity + read-only schema lineage.
- **Не подменять реальные работы вымышленными лотами.** CC0 музейный демонстрационный каталог отделён от якобы продаваемых seed-коммерческих объектов.
- **Не утверждать реальный provenance или authenticity на основании AI/OCR/image similarity/подписи эксперта.**
- **Не продавать персональные данные коллекционеров спонсорам.** Только согласованные агрегаты, consent.
- **Не продавать институциональную независимость:** sponsorship не влияет на атрибуцию/статус эксперта/результат исследования.
- **Не расширять без решения предметную область.** Сегодня authoritative `PAINTINGS_ONLY` (масло, акрил, темпера, акварель, гуашь, пастель). Отдельные рисунки/гравюры/тиражи — только отдельное изменение taxonomy, rights, edition, provenance, tests и решение о product scope.
- **Не собирать все новые продукты как отдельные authorities.** Feature UI ↔ существующая system-of-record и права доступа.

## 3. Verification/Feature status legend

| Код статуса | Что означает |
|---|---|
| CODE | Есть соответствующий продуктовый/доменный код либо тесты в репозитории. Это **не** подтверждение production-ready, реальных пользователей или дохода. |
| PR | Есть код в **PR #130**, ещё не слитый в main на момент формирования реестра. |
| GATED | Заявлено в master-plan либо частично существует как каркас, но требует условий/приёмки или не доказано end-to-end. |
| NEW | Новая инициативa/продуктовый пакет, требует интервью, дизайна и решения. |
| DEFER | Пока не начинать; открывать только после явного решения о продуктовой области. |

Приоритеты: P0 — до коммерческого/инвесторского пилота; P1 — ранний B2B и удержание; P2 — масштабирование после спроса; P3 — исследовательская/институциональная экспансия.

## 4. World-practice source map — grounded examples

| Источник | Практика, которую разумно перенять | Antiqua differentiation / boundary |
|---|---|---|
| [Artsy — Collectors](https://www.artsy.net/collector-profile/my-collection) | приватная коллекция, мониторинг художников, market context | explicit uncertainty + rights + cross-entity artwork continuity |
| [Artsy — gallery partnership](https://partners.artsy.net/articles/artsy-asks-what-art-collectors-are-looking-for) | follow/alert, inquiries, detailed images/provenance | single source-of-truth with museum/research layers |
| [Artlogic — gallery management](https://artlogic.net/products/gallery/management) | artwork inventory, CRM, invoicing, consignment, shipping | artwork-centric scholarly identity and evidence |
| [Artlogic — Private Views](https://support.artlogic.net/hc/en-gb/articles/17337147499036-How-to-create-Private-Views) | permissioned curated client presentation | reversible ACL and no duplicated mutable metadata |
| [MutualArt — database and alerts](https://www.mutualart.com/price-database) | auction results, artist alerts, price insights | licensed source facts, no fake appraisal/certification |
| [Smartify — institutional tools](https://smartify.org/partners/) | visitor audio/QR/scanning, accessibility, post-visit lifecycle | Artwork Passport is permanent anchor |
| [Smartify — accessible media](https://smartify.org/partners/features/media-player) | audio, transcripts, offline guides, languages | rights attribution + verified object match |
| [ArtPlacer — Viewing Room](https://help.artplacer.com/support/solutions/articles/65000189245-how-to-set-up-a-viewing-room) | wall preview/AR/virtual shows | only with approved artwork images and dimensions |
| [Art Basel — app](https://www.artbasel.com/stories/art-basel-launches-new-app--the-ultimate-digital-companion-to-art-basel-shows) | lens, itineraries, events, VIP companion | connect visit → collection → research, not generic navigation |
| [Getty Provenance Index](https://data.getty.edu/provenance/docs/) | linked open provenance, source/audit, SPARQL | preserve contested events + evidence gap |
| [Linked Art](https://linked.art/model/provenance/) | semantic provenance/acquisition/exhibition events | versioned research interchange, not truth override |
| [IIIF Presentation API](https://iiif.io/api/presentation/3.0/) | image viewers, interoperability, annotations | enforce media rights and immutable originals |
| [MoMA corporate sponsorship](https://www.moma.org/support/corporate/sponsorship) | funded exhibitions, education, digital activation, VIP | impact + no buying expert conclusions |

## 5. Unified feature register — all capabilities to adopt, improve or decline

**Interpretation:** CODE describes implementation surface/authority only. Every CODE feature still needs production acceptance and real customer validation.

### А. Визуальная Галерея и каталог

| ID | Функциональность | Статус | Приоритет | Кому нужна | Gate / Authority |
|---|---|---|---|---|---|
| ART-01 | Кураторская главная, реальные изображения, подписанные источники | PR | P0 | посетитель, спонсор | PR #130; rights admission |
| ART-02 | Галерея: категории, фильтры, поиск и сортировка | CODE | P0 | ценитель, коллекционер | catalogue and UI |
| ART-03 | Изображения высокого разрешения, zoom, detail/verso | GATED | P0 | коллекционер, эксперт | Object Media Authority → IIIF |
| ART-04 | Музейный режим: исторический контекст, нет торговых CTA | PR | P0 | музей, ценитель | PR #130 → visual QA |
| ART-05 | Паспорт Artwork: атрибуция, техника, размеры, история | CODE | P0 | все | Passport / Dossier read model |
| ART-06 | Художник: биография с источниками, хронология, работы | CODE | P1 | художник, исследователь | Creator Graph |
| ART-07 | Related Works с объяснимыми основаниями сходства | CODE | P1 | ценитель, исследователь | Similarity authority |
| ART-08 | Виртуальная выставка, кураторский текст, архив | CODE | P1 | куратор, галерея | Exhibition authority |
| ART-09 | Rights ledger: CC0 / лицензии / запреты / credit line | GATED | P0 | правообладатель, музей | Media Authority |
| ART-10 | Раздел 'История / научный контекст' на музейных картах | GATED | P1 | ценитель | права + источники + редактура |
| ART-11 | Переводы RU/EN, позже локализации для рынка | CODE | P1 | международные пользователи | ручной контроль имён/атрибуции |
| ART-12 | Доступность и быстрая загрузка на телефонах | GATED | P0 | все | LCP/INP/WCAG/browser QA |

### B. Коллекционер и персонализация

| ID | Функциональность | Статус | Приоритет | Кому нужна | Gate / Authority |
|---|---|---|---|---|---|
| COL-01 | Сохранить работу, художника, выставку | CODE | P0 | коллекционер | Engagement authority |
| COL-02 | Приватная коллекция, выставляемые публично подборки | CODE | P0 | коллекционер | Collection ACL |
| COL-03 | Taste Graph: объяснимые персональные рекомендации | CODE | P1 | коллекционер | Taste authority |
| COL-04 | Хочу найти (wanted list), запрос подбора работы | CODE | P1 | коллекционер, галерея | Inquiry / discovery |
| COL-05 | Подписки и осмысленные уведомления о работах | CODE | P1 | коллекционер | Watch / follow |
| COL-06 | Личный Art Passport Vault: чеки, право, состояние, фото | GATED | P1 | владелец | PostgreSQL + ACL + object storage |
| COL-07 | Приватная комната с ограниченным сроком доступа | GATED | P1 | коллекционер, галерея | Media ACL + immutable artwork link |
| COL-08 | История посещённых выставок и просмотренных работ | GATED | P2 | ценитель | consent + Events |
| COL-09 | Семейная/наследственная коллекция и разграничение доступа | NEW | P2 | семья/наследник | ownership/legal review |
| COL-10 | Кураторские подборки 'для вас' без непрозрачной оценки | GATED | P1 | ценитель | Taste + editorial moderation |
| COL-11 | Портфельная аналитика с осторожной оценкой рынка | GATED | P2 | коллекционер | licensed comparable datasets |
| COL-12 | Досье для страховщика / наследования с правами доступа | GATED | P2 | коллекционер, страховщик | evidence + explicit consent |

### C. Профессиональный кабинет галереи и художника

| ID | Функциональность | Статус | Приоритет | Кому нужна | Gate / Authority |
|---|---|---|---|---|---|
| PRO-01 | Художник: мастерская, портфолио, работы, CV, открытые показы | CODE | P1 | художник | Creator Graph / Artist |
| PRO-02 | Галерея/институция: организация, представители, направления | CODE | P0 | галерея | Organization + Art Network |
| PRO-03 | Artwork inventory, статусы наличия, владельцы, локации | CODE | P0 | галерея | Object/Listing authority; production proof |
| PRO-04 | Онбординг галереи: права, условия, импорт из таблиц | GATED | P0 | галерея | KYB + migration/rights gate |
| PRO-05 | Подборка для коллекционера / Private View с ACL | GATED | P1 | галерея | Presentation over existing works |
| PRO-06 | CRM: избранные художники, интересы, переговоры, follow-up | CODE | P1 | галерея | Inquiries / Dealer Leads |
| PRO-07 | Воронка запрос → просмотр → предложение → сделка | CODE | P1 | галерея | Inquiry/Offer/Viewing/Order |
| PRO-08 | Artist↔Gallery representation / consignment handshake | GATED | P1 | художник, галерея | representation authority |
| PRO-09 | Оффлайн-каталог на ярмарке и безопасная синхронизация | NEW | P2 | галерея | outbox + privacy |
| PRO-10 | Печатные подборки, PDF dossiers, экспорт без потери атрибуции | GATED | P1 | галерея | publication/versioning |
| PRO-11 | Учёт комиссий, взаиморасчёты, счета, отгрузки | CODE | P2 | галерея | Finance authority + provider onboarding |
| PRO-12 | Отчётность: спрос, сохранения, просмотры, конверсии | CODE | P1 | галерея | analytics / seller authority |
| PRO-13 | Консервация/хранение/передвижение между площадками | GATED | P2 | галерея, музей | Condition / movement / loan |
| PRO-14 | White-label кабинет галереи/фонда на Antiqua API | GATED | P2 | галерея, фонд | rights + account isolation |

### D. Сообщество, знания, события

| ID | Функциональность | Статус | Приоритет | Кому нужна | Gate / Authority |
|---|---|---|---|---|---|
| CULT-01 | Роли: художник, куратор, эксперт, историк, коллекционер | CODE | P0 | сообщество | Art Network v0.41 |
| CULT-02 | Проверяемые области экспертизы, а не общий 'экспертный балл' | CODE | P0 | эксперт, музей | Scholarly / Credential authority |
| CULT-03 | Дискуссия, вопрос специалисту, цитата, источники | GATED | P1 | ценитель, эксперт | moderation + cited artwork |
| CULT-04 | Календарь выставок, событий, лекций | CODE | P1 | все | Cultural Calendar v0.42 |
| CULT-05 | Билеты/регистрация/QR/check-in и согласованная аналитика | GATED | P1 | организатор | Event authority + partner terms |
| CULT-06 | Визит в музей: камера/QR → подтверждённое произведение | GATED | P2 | посетитель | approved image identities |
| CULT-07 | Аудиогиды, субтитры, транскрипты, доступная экскурсия | NEW | P1 | посетитель, музей | content rights + accessibility |
| CULT-08 | Путеводитель по галереям/арт-неделе/сохранённые маршруты | GATED | P2 | посетитель, партнёр | Event schedule + location |
| CULT-09 | Материалы: книги, курсы, научные публикации, переводы | GATED | P1 | ценитель, исследователь | content graph; license |
| CULT-10 | Обучение: авторский курс, эфир, клубная лекция | GATED | P2 | эксперт, спонсор | rights + billing |
| CULT-11 | Группы по художнику/теме, модерируемые экспертами | GATED | P2 | сообщество | community moderation |
| CULT-12 | Волонтёрская/кураторская программа с доказанным вкладом | NEW | P2 | институции, меценаты | institutional contribution gate |
| CULT-13 | Event → произведение → сохранить → посетить → вернуться | GATED | P1 | ценитель | unified event tracking |

### E. Коммерция: только когда реально допустима

| ID | Функциональность | Статус | Приоритет | Кому нужна | Gate / Authority |
|---|---|---|---|---|---|
| MKT-01 | Контекст продажи/публичного аукциона — только при sale state | CODE | P0 | покупатель, продавец | Listing/Auction authority |
| MKT-02 | Торги, шаг, резерв, идемпотентность, конкурентность ставок | CODE | P2 | аукцион | PostgreSQL live concurrency gate |
| MKT-03 | Watch, alerts, отслеживание ставок и результатов | CODE | P1 | покупатель | Auction Result / Watch |
| MKT-04 | Offer / counteroffer / accept / reject / withdraw | CODE | P2 | продавец, покупатель | Offer authority |
| MKT-05 | Viewing Request / Condition Report с версиями | CODE | P1 | покупатель | Viewing/Condition workflow |
| MKT-06 | Invoice / payment / escrow / settlement / refund | CODE | P2 | покупатель, галерея | regulated provider + legal/finance sign-off |
| MKT-07 | KYC/KYB/AML, экспорт/санкции/налоги по юрисдикции | GATED | P1 | комплаенс | jurisdictional legal review |
| MKT-08 | Логистика и страхование реальной картины | CODE | P2 | покупатель | provider contracts + licensed coverage |
| MKT-09 | Коммерческий экспорт подлинных auction results | CODE | P2 | аналитик | Auction Result authority |
| MKT-10 | Поиск сопоставимых продаж/динамика только с лицензией | GATED | P2 | покупатель, аналитик | auction data license |
| MKT-11 | Artist commissions/заказ картины с юридическими условиями | NEW | P2 | современный художник | commission contract/rights |
| MKT-12 | Тиражи/эстампы: edition, state, impression | DEFER | P3 | графика, гравюра | ONLY after explicit scope change |

### F. Провенанс, знания и инфраструктура доверия

| ID | Функциональность | Статус | Приоритет | Кому нужна | Gate / Authority |
|---|---|---|---|---|---|
| TRUST-01 | Сведения о провенансе: события, источники и пробелы | CODE | P0 | исследователь | Provenance Passport |
| TRUST-02 | Сравнение спорящих атрибуций без ложной уверенности | CODE | P1 | эксперт | Scholarly statements |
| TRUST-03 | PDF/сканы архивов, OCR как непроверенная гипотеза | GATED | P2 | исследователь | Media/IIIF + reviewer workflow |
| TRUST-04 | Указатели музеев, каталогов-резоне, архивов, аукционов | GATED | P1 | исследователь | rights + identity reconciliation |
| TRUST-05 | Linked Art / CIDOC event graph, provenance interchange | CODE | P2 | музей, университет | Interchange projection; live proof |
| TRUST-06 | IIIF manifests и совместимое глубокое изображение | CODE | P1 | музей, эксперт | Media Authority for production |
| TRUST-07 | Mirador side-by-side, annotated image regions | GATED | P2 | реставратор, эксперт | IIIF + media |
| TRUST-08 | Evidence Gap Index, исследовательские запросы | CODE | P2 | историк, фонд | passport + controlled evidence |
| TRUST-09 | Независимое чтение версии/подписанных экспертных выводов | CODE | P2 | институция | Independent Verification LIVE READY |
| TRUST-10 | Research Interchange, Synthetic Reference Catalogue | CODE | P2 | музей/архив | production smoke after READY |
| TRUST-11 | Conservation/condition change intelligence | GATED | P2 | музей, страховщик | calibrated source imaging |
| TRUST-12 | Catalogue Raisonné committee workflow | GATED | P3 | artist estate, фонд | committee agreement |
| TRUST-13 | Управление интеллектуальными правами/репродукциями | GATED | P1 | музей, правообладатель | rights registry |
| TRUST-14 | Scholar research copilot: ответ с цитатами и uncertainty | GATED | P2 | исследователь | retrieval with sources; human review |
| TRUST-15 | Federated institutional contributors after READY | GATED | P3 | музей, архив, фонд | explicit institutional acceptance |

### G. Спонсоры, инвесторы, меценаты

| ID | Функциональность | Статус | Приоритет | Кому нужна | Gate / Authority |
|---|---|---|---|---|---|
| PART-01 | Публичная страница 'Партнёрство' / opportunity deck | NEW | P0 | спонсор, инвестор | validated claims only |
| PART-02 | Программы: Heritage / Discovery / Education / Access | NEW | P0 | спонсор | cultural program owners |
| PART-03 | Договор спонсорства, права на упоминания, brand-safety | NEW | P0 | спонсор, юрист | legal review |
| PART-04 | Кураторская независимость, запрет оплаты экспертного статуса | NEW | P0 | музей, спонсор | conflict-of-interest policy |
| PART-05 | Партнёрская витрина без рекламного вмешательства в паспорт | NEW | P1 | спонсор | editorial separation |
| PART-06 | Impact dashboard: согласованный охват, вовлечение, результаты | NEW | P1 | спонсор | aggregated analytics, consent |
| PART-07 | Event sponsor pack: бренд-активация, регистрации, QR | NEW | P1 | спонсор | Event authority + opt-in |
| PART-08 | Founding Galleries / Founding Institutions programme | NEW | P0 | стратегический партнёр | signed, scoped pilot |
| PART-09 | Investor Data Room: модель, риски, IP, cap table, команда | NEW | P0 | equity инвестор | founder/legal/finance source documents |
| PART-10 | Investor Demo 7–10 min: 3 роли, end-to-end, actual proof | GATED | P0 | инвестор | quality QA + clear PREVIEW label |
| PART-11 | LOI/партнёрские контракты, пилоты, измерение выручки | NEW | P0 | инвестор | real signed agreements |
| PART-12 | Grant/foundation proposal & independent research governance | NEW | P1 | меценат/фонд | grant compliance |
| PART-13 | Комитет по конфликтам интересов и коммерческой независимости | NEW | P1 | институция | charter and escalation |

### H. Platform / данные / безопасность / экономика

| ID | Функциональность | Статус | Приоритет | Кому нужна | Gate / Authority |
|---|---|---|---|---|---|
| OPS-01 | Правильная Supabase identity + dedicated PostgreSQL bind | GATED | P0 | все | identity gate #61; NEVER wrong ref |
| OPS-02 | 001–033 exact, READY and restart durability | GATED | P0 | все | same captured SHA, approved DSN |
| OPS-03 | Авторизация, RBAC, закрытый доступ, auditable decisions | CODE | P0 | все | real production security proof |
| OPS-04 | Контроль приватности владельца, consent, selective visibility | CODE | P0 | коллекционер | RBAC/privacy QA |
| OPS-05 | Media originals/derivatives, CDN, hotlink-safe rights | GATED | P0 | все | Object Media Authority |
| OPS-06 | Событийная аналитика и независимый KPI dictionary | GATED | P0 | инвестор | real data, no demo inflation |
| OPS-07 | Панель бизнес-модели: CAC, LTV, MRR, GMV, cohort, retention | NEW | P1 | оператор, инвестор | truthful paid metrics |
| OPS-08 | Audit/export/backup/restore/security incident process | CODE | P1 | институция, инвестор | production proof |
| OPS-09 | Multi-tenant institution workspaces, contract billing | GATED | P2 | галерея, музей | PostgreSQL + permission isolation |
| OPS-10 | API/SDK institutional licenses and scoped change feed | GATED | P3 | институция | Research Interchange live, partner demand |
| OPS-11 | Search/semantic relevance with licensed data and provenance | GATED | P2 | посетитель | source-safe indexing |
| OPS-12 | Owner Control Tower / business & sponsor executive dashboard | NEW | P1 | директор, инвестор | measured metrics + auditable sources |

## 6. Build priorities / dependencies

### Gate 0 — trust & image proof (before credible external claims)

- Keep PR #130 **unmerged until exact-head CI + Browser E2E + real IIIF image proof**; museum images separate from sale inventory.
- Protect paid/commercial CTAs: no claim that synthetic lots are offered by real sellers.
- Restore correct Supabase OAuth → primary project ref/organization/host proof → read-only schema proof → explicit Render binding → migration 001–033 exact → final same-head deploy → READY → restart durability.
- Finish proof of visual mobile quality / accessibility and public rights metadata.
- Set up baseline analytical event dictionary and exclude test/demo traffic.
- Prepare two separate external presentations: institutional cultural mission and financial B2B recurring economics.

### Gate 1 — founding pilot (only after production admission)

- Get **5–10 verified real pilot institutions** (mix of gallery/artist/historian), tracked as internal targets — not existing commitments.
- Secure rights-cleared real artworks + image set + named source + provenance/attribution uncertainty; never promise authenticity without review.
- Run full **Gallery upload → Curate/Publish → Visitor discovery → Artwork → Save/Inquiry → Gallery follow-up → outcome** Golden Path.
- Pilot feedback and sponsor work must remain separate from financial deal authority.
- Record honest time-to-value, conversions, repeat visits and partner satisfaction.

### Gate 2 — sell a repeatable problem solved

- Gallery Pro: inventory + rights-aware publication + private client views + CRM/offer and condition flows + reports.
- Collectors: privacy + collection + saved works + alerts + research + invitation-only rooms.
- Culture: first themed editorial program, event, audio/QR pilot, one sponsor-ready report.
- Test and optimize prices through interviews and paid contracts (no assumed willingness-to-pay).

### Gate 3 — defendability / partner expansion

- Media Authority + IIIF/Mirador + regions + rights + backed-up originals.
- Import and reconciliation with Getty/other *permitted* open data; maintain provenance uncertainty and source attribution.
- Verified scientific workflow: evidence gaps, expert statement + conflicts, versioned passports.
- Scoped institutional integration after production Reference Catalogue, Verification and Interchange smoke.

### Gate 4 — network moat only after demand

- Catalogue Raisonné committees / studio-archive partnerships / licensed API / institutional federation.
- High-res condition longitudinal study and insurance due diligence only under adequate data+consent.
- Deferred: blockchain/NFT minting, tokenized fractional ownership, giant 3D metaverse, autonomous authenticity AI, pay-to-verify, speculative custom payment rail.

## 7. Commercial model — separate economic engines

**Revenue engine A: B2B Gallery SaaS** — subscription by tier/active team/volume, optional onboarding and white-label. Track contracted monthly recurring revenue (MRR), gross revenue retention, net retention, support/compute costs per institution.

**Revenue engine B: Artist Studio** — accessible/limited free portfolio followed by subscription for commercial tools, official studio records, client contacts, scheduling.

**Revenue engine C: Licensed commercial transaction services** — only when lawful/KYC/settlement/insurance/chargebacks are confirmed; record GMV separately from recognized net revenue and payment partner processing fees.

**Revenue engine D: Collector research subscription** — privacy-first collection tools + source-backed insights, not a fee for fabricated market values or authenticity certificates.

**Revenue engine E: Sponsor/Patron Programmes** — fixed, deliverable-linked sponsorship or grants with independent editorial/curatorial governance. **Not equity financing.**

**Revenue engine F: Institutional Research/API** — long-cycle, gated; needs live research data+rights, partnerships, audited access and SLA.

### Unit economics and truthful denominators

- SaaS ARR = signed paying organizations × contracted monthly recurring price × 12, excluding non-recurring setup.
- Net platform transaction revenue = eligible GMV × contractual platform take rate, **not** gross artwork price.
- Contribution margin by tier = attributable revenue − variable payment, infra, rights, customer-support costs.
- Sponsor recognized revenue follows contract deliverables/terms, **not** impressions multiplied by assumed CPM.
- Cohorts, signed contracts, independent invoices/receipts and pilot case studies must be separated from test/demo records.
- Bottom-up TAM/SAM/SOM only: addressable organizations × obtainable annual price + legally serviceable volume × take rate. Do not call the entire $59.6bn art market Antiqua TAM.

## 8. Investor readiness pack

Before investor outreach, prepare:
1. Product proof: stable current deployed SHA + mobile/tablet/desktop full-role click-through + database durability + no fake image/price claims.
2. Real customer proof: named with consent active pilots, signed LOIs/paid invoices, catalogue/image rights, real research use cases.
3. Market & competition: product map with credible differentiation and proof.
4. Business model: tier pricing hypothesis, actual willingness-to-pay evidence, conservative/base/stretch cases, CAC, retention, variable gross margin.
5. Defensibility: artwork↔source/revision/rights graph, rights-cleared partner contributions, export interoperability, contracts—not 'AI superiority' slogans.
6. 18-month execution budget based on actual salary, cloud, data rights, legal/compliance, acquisition and partner operations quotes.
7. Risk register: IP/reproduction, privacy, provenance liability, restitution, jurisdiction-specific AML, export restrictions, dependence on external image sources, unlicensed market data.
8. Investor process: one-page teaser, 10-slide deck, 7–10m owner demo, 18-month model, controlled evidence room, pilot agreements, founder/cap table documents.

## 9. Sponsor/patron readiness pack

### Four programme formats

| Programme | Sponsor incentive | User/public deliverables | Measurable report |
|---|---|---|---|
| Heritage & Provenance | preservation and cultural credibility | public source-linked historical research project | sources linked, works studied, participation |
| Art Discovery | art access and audience development | curated open-access exhibition + gallery experience | unique visitors, deeper engagement, repeat visits |
| Art Education | education / CSR | expert-backed lectures, school programmes, guides | opt-in attendance, completion, useful feedback |
| Accessible Art | inclusion / accessibility | accessible audio, captions, translations, mobile exhibition routes | verified WCAG checks, sessions, consented satisfaction |

Never sell sponsorship inside a scholarly conclusion or an object's veracity/attribution status. Sponsor listing ≠ endorsement by an institution; no personal data access to sponsor without explicit, valid consent.

### Partner pipeline

Programme → sponsor ICP and requested outcomes → 1-page concept note → rights/legal/source readiness → commercial proposal → signed agreement → activation → mutually approved impact report → renewal decision.

## 10. Metrics and stop/go gates

| Dimension | Baseline we must measure | Pilot decision threshold **(internal hypothesis, NOT historical fact)** |
|---|---|---|
| Real image/source coverage | published real works with valid source/rights / all works | 100% of published reference images sourced and rights-checked |
| Catalogue safety | wrong work ↔ media matches / total | 0 mismatch in QA |
| Product trust | publicly surfaced private owner data | 0 known leaks |
| Critical path | DB identity/migrations/READY/durability | all PASS or no production claims |
| Pilot supply | real, consented active partners | target 5–10 to learn, not claim |
| Activation | partner first real published work / onboarded partner | set threshold after first cohort |
| Audience | artwork→artist, saved works, research click, D7/D30 | measure cohorts, do not invent targets |
| Gallery value | qualified inquiries → response → visit/offer → outcome | first paid use cases with evidenced time savings |
| Sponsor outcome | contracted activation deliverables delivered | 100% agreed deliverables or remediation |
| Revenue | actual MRR/ARR, recognized fees | distinguish signed/paid/pipeline |
| Cost | storage, bandwidth, moderation, legal, support by partner | positive variable unit contribution for paying product |

## 11. Proposed execution sequence

**0–30 days (conditional on systems access):** exact-head gate for museum PR; restore dedicated PostgreSQL identity; fix visual QA; rights/synthetic disclosures; instrument first journeys; issue founder pilot outreach pack.

**30–90 days following READY:** source-cleared original inventory from real partners; gallery onboarding and private presentation; launch expert-backed events/editorial; collect signed sponsor interests and paid SaaS pilot evidence.

**3–6 months following validated pilot:** monetize repeatable B2B workflows, run privacy-first collector loop, partner impact reports, add Media Authority + modern IIIF as rights and scale require.

**6–12 months:** replicate in further partner cohorts, move from one-off events to retained user growth, standardize institution exports, legal compliance, audited analytics, multi-tenant billing if justified.

**12–24 months:** institutional knowledge network and research licensing only after real enterprise demand and contract-backed data rights.

This is a dependency roadmap, **not** a promise about elapsed delivery time or financing outcome.

## 12. Operational ownership and update protocol

- This document is an *incremental opportunity register*. It **does not replace** the canonical integration plan, pre-existing authorities or exact-head merge gates.
- Every feature ID can be promoted to an implementation issue only if: named real-user problem, source benchmark, existing authority, data/privacy rights, scope, acceptance test, measurable outcome, dependency state and commercial value are specified.
- Before new code: re-read `docs/ANTIQUA_INTEGRATION_MASTER_PLAN_2026-10-01.md` and database identity gate; avoid duplicate capabilities already implemented.
- For new investor claims, classify: `SOURCE-VERIFIED MARKET FACT` / `CODE-CONFIRMED` / `PRODUCTION-PROVEN` / `PILOT-OBSERVED` / `HYPOTHESIS`.
- Institutional Contributors remains **blocked** until Research Interchange + Independent Verification + Synthetic Reference Catalogue are proven live after PostgreSQL READY.
