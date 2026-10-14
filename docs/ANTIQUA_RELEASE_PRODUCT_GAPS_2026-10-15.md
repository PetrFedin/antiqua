# ANTIQUA — реестр невыполненного и маршрут к запуску
**Срез:** 15.10.2026. **Статус:** рабочий аудит, НЕ акт готовности. Трекер: Issue #135.  
**Правило:** SPEC ≠ CODE ≠ CI_PASS ≠ MERGED ≠ LIVE_VERIFIED ≠ PRODUCTION_ADMITTED. Не выдавать тесты синтетической БД за допуск реальной.

## I. Фактическая инфраструктура
- GitHub main: **4f3e396ce6052ae8924235eab3ed4ad11cac470c**; Render сообщает live на этом SHA. Это ещё не доказывает PostgreSQL durability и будущие auto deploy.
- Доступная организация Supabase ethylfresh-87's Org показывает только Marco Pescarolo и MFW. **Исходная dedicated antiqua-postgres не подтверждена**. Запрещено использовать чужие схемы, создавать замену или выполнять DDL без проверки владельца/истории.
- В журнале live Preview ранее доказан **MEMORY_FALLBACK**; настоящий production DB/restore ещё не допущен.
- GitHub main отмечен **protected=false**. Owner/admin должен включить mandatory review/required checks/защиту merge до реального запуска.
- Ни новые платные ресурсы, ни миграции на чужой БД не разрешены. 0 ₽ дополнительной стоимости — ограничение, а не утверждение о бесплатности всех действий.

## II. P0 — блокирующие пробелы

| ID | Работа | Источник | Критерий завершения |
|---|---|---|---|
| P0-01 | Восстановить доступ к исходной Supabase Antiqua, сверить owner/org/project ref/lineage read-only | [#135](https://github.com/PetrFedin/antiqua/issues/135), [#61](https://github.com/PetrFedin/antiqua/issues/61) | Независимое подтверждение принадлежности БД и безопасный backup/restore |
| P0-02 | Data API, inherited GRANT, RLS, schema/default privileges; независимое ревью | [Draft #143](https://github.com/PetrFedin/antiqua/pull/143) → [Draft #136](https://github.com/PetrFedin/antiqua/pull/136) | Exact-head CI + reviewer; реально защищённые роли, не только тестовый PostgreSQL |
| P0-03 | Canonical migrations 001–033, READY и durable restart/restore | [#135](https://github.com/PetrFedin/antiqua/issues/135), [#140](https://github.com/PetrFedin/antiqua/issues/140) | Применены все 33 миграции на VERIFIED dedicated DB; запрос READ после restart + отдельно восстановленная резервная копия |
| P0-04 | Закрытые документы, лицензии, реальные signed URLs и права доступа | [#140](https://github.com/PetrFedin/antiqua/issues/140), [#62](https://github.com/PetrFedin/antiqua/issues/62) | Dedicated authorized storage, upload/checksum/authorized read/revoke/restore и отрицательные тесты |
| P0-05 | Устранить утечки публичных источников и ID владельцев, экспертов, документов, сделок | [Draft #142](https://github.com/PetrFedin/antiqua/pull/142) → [Draft #144](https://github.com/PetrFedin/antiqua/pull/144) | Exact-head green, field whitelist, reviewer, mobile+desktop API assertions |
| P0-06 | Повторная визуальная приёмка after integration | [#133](https://github.com/PetrFedin/antiqua/issues/133) | decoded painting assets + права, iPhone 320×568/390×844, iPad, desktop, scroll/focus, реальный просмотр PNG |
| P0-07 | GitHub review governance + Render exact deploy/rollback | [#135](https://github.com/PetrFedin/antiqua/issues/135) | Protected main, approvals, integrated CI, known Render SHA, rollback and health evidence |
| P0-08 | Честный release admission вместо одной зелёной READY | [#140](https://github.com/PetrFedin/antiqua/issues/140) | Technical health отдельно от доказательства backup, storage, rights, security review and owner sign-off |

**Две независимые очереди:** #143 → #136 и #144 → #142. Не интегрировать Draft без independent approval. На момент аудита #143 прошёл CI изолированных проверок; #142 также 5/5 PASS на 6b4fabf, но оба ждут review. В #144 старый Chromium E2E дал 90/92 PASS из-за версии API; тест обновлён, CI на новом SHA перепроверяется. Дополнительно обнаружен и исправлен ReferenceError: lots is not defined в preview provenance overview. Правку и регрессионный тест необходимо сохранить и в parent #142, и в дочернем #144.

## III. P1 — основной продукт после P0

| Направление | Существующая база | Что ещё реально нужно |
|---|---|---|
| Decision Dossier [#137](https://github.com/PetrFedin/antiqua/issues/137), [#139](https://github.com/PetrFedin/antiqua/pull/139) | Artwork Passport/Dossier, provenance, gap index, scholarly trust, research, market read models | Revision pin, claims/sources/conflicts/unknown, reviewed grant-aware documents, приватная часть и мобильный путь принятия решения |
| Private Rooms [#103](https://github.com/PetrFedin/antiqua/issues/103) | Требования SNAPSHOT/LIVE, структуры приглашений и заявок | Миграция 034+, роли owner/invitee/reviewer, expiry/revocation, per-document grants, аудит, IDOR/no-existence-leak tests; SECRET_LINK не запускать без отдельного ревью |
| Painting-first Gallery [#73](https://github.com/PetrFedin/antiqua/issues/73), [#99](https://github.com/PetrFedin/antiqua/issues/99) | В main есть живописный fictional preview seed, существующий Artwork source | Нормализованные human-reviewed классы, источники/права медиа, реалистичная разнообразная подборка и Artwork→Artist→Exhibition/Collection |
| Art Network / experts [#91–#98](https://github.com/PetrFedin/antiqua/issues/91) | Модули и тесты профилей/claims имеются; старые PR могут оставаться open | Real-role/onboarding/pseudonymity/permissions, verified institution and contributor identities |
| Cultural Calendar / Lens [#76](https://github.com/PetrFedin/antiqua/issues/76), [#104](https://github.com/PetrFedin/antiqua/issues/104), [#105](https://github.com/PetrFedin/antiqua/issues/105) | Существующие календарные/событийные модели | Проверенные часы/адреса, mobile Art Day, map and visits; не выдумывать ETA |
| Inquiry → Offer → Sale | В исходном коде есть торговая цепочка и синтетические тесты | Real buyer/seller proof, разрешение на публикацию исторической цены, consent, analytics; не выдавать demo cash за revenue |

**Обнаружено противоречие в ассортименте:** [#73](https://github.com/PetrFedin/antiqua/issues/73) включает графику/эстампы/гравюры, а [zero-cost scope](https://github.com/PetrFedin/antiqua/pull/134) исключает эстампы и фиксирует живопись. До версионированного owner scope decision не открывать новые категории автоматически. Безусловно исключить антиквариат/декоративные предметы из публичной витрины, исторические records не удалять.

## IV. P2 — после реального запуска, а не вместо него
- IIIF/Mirador и media derivatives [#63](https://github.com/PetrFedin/antiqua/issues/63), C2PA [#68](https://github.com/PetrFedin/antiqua/issues/68), image similarity [#67](https://github.com/PetrFedin/antiqua/issues/67), photogrammetry [#69](https://github.com/PetrFedin/antiqua/issues/69). Сначала source and rights.
- Provenance knowledge graph [#66](https://github.com/PetrFedin/antiqua/issues/66), OCR candidates [#64](https://github.com/PetrFedin/antiqua/issues/64), editorial reconciliation [#65](https://github.com/PetrFedin/antiqua/issues/65); всё остаётся reviewable evidence, не сертификат подлинности.
- Expert Desk / Exhibition Studio / Open Calls [#102](https://github.com/PetrFedin/antiqua/issues/102), [#101](https://github.com/PetrFedin/antiqua/issues/101), [#100](https://github.com/PetrFedin/antiqua/issues/100): после Rooms и профилей.
- [ARCOO benchmark #138](https://github.com/PetrFedin/antiqua/pull/138): брать частные презентации, проверку источников и конверсионные действия, а не копировать интерфейс/данные.
- Коммерческие метрики: сначала реальные baseline и подтвержденные пилоты, затем GMV/conversion; не выдумывать CAC, LTV, ROI и ARR.

## V. Реальный порядок внедрения и QA
1. Исправить и проверить API/browser регрессии PR #142/#144 на каждом точном SHA. Визуально проверить Gallery/Artwork dialog и границы публичных данных.
2. Получить independent security review по #142/#144 и #143/#136, интегрировать без обхода required checks; зафиксировать integrated-head evidence.
3. Владелец восстанавливает Supabase Antiqua; read-only identity + backup; затем только verified migrations 001–033, grant/RLS review и READY с настоящим persistence/restore.
4. Подтвердить отдельный authorized private storage и права медиа, затем #137 DD-01 → DD-02 → 034+ / Private Rooms auth → mobile/desktop workflows → cross-role negative tests and funnel.
5. Улучшить уже работающие Gallery/Network/Calendar модули, наполнить verified контентом; новая сложная технология только после доказанной потребности.

**Acceptance для каждого пункта:** URL/привязанный Issue, exact SHA, CI, negative access, real iPhone/iPad/desktop screenshots (если визуал), copyright/source grants, database restore proof (если stateful), независимое ревью и отсутствие неподтверждённого биллинга.
