# antiqua — обязательная программа внедрения с нулевой стоимостью

**Snapshot:** 2026-10-12 · **Status:** REQUIRED / NOT ALL IMPLEMENTED · **Purpose:** persistent work pickup, not release evidence.

**Источник канона:** `docs/ANTIQUA_INTEGRATION_MASTER_PLAN_2026-10-01.md`, актуальный живой код и CI

**Текущее ограничение:** Канон продукта после reset 7 октября: только живопись (oil/acrylic/tempera/watercolor/gouache/pastel); не расширять на антиквариат, эстампы или скульптуру.

## Работы в порядке зависимости

| ID | Priority | Обязательно внедрить | Связи/зависимости | Доказательство завершения |
|---|---|---|---|---|
| ANT-ZC-01 | P0 | Исправить изображения Gallery и мобильный Artwork dialog | Gallery → Artwork media → responsive modal → Artist/Passport | изображения реальны и загружаются, alt/fallback, phone/tablet/desktop screenshots и browser E2E |
| ANT-ZC-02 | P0 | Доказать current-main Render публикацию | GitHub exact SHA → Render deployment → `/api/health` → browser flows | верифицированный SHA, отсутствие preview masquerading as production |
| ANT-ZC-03 | P0 | Допустить только собственную Antiqua PostgreSQL | own pooler secret → migrations → `PREVIEW_MODE=false` → restart durability | `persistence=POSTGRES`, save/restart/read, изоляция tenancy, обратимое развертывание; никакой другой проектной БД |
| ANT-ZC-04 | P1 | Artwork Dossier / collections / auction as one graph | Artwork → artist/attribution/provenance/evidence → collect → optional auction | provenance gaps/conflicts отображаются честно, consent/access/versioning/negative tests, без дубликата authorities |

## Непереговорные ограничения: 0 ₽ новых расходов
- Запрещено создавать/включать платные ресурсы, pay-as-you-go, автоапгрейд, платный AI/API, платную БД, облачное хранилище, CI minutes сверх бесплатной квоты или оплачиваемые production-транзакции.
- Сначала доказывать, что существующая локальная инфраструктура, open-source инструменты или **подтверждённый доступный** бесплатный лимит действительно не требуют оплаты. Если 0-cost ресурс не подтверждён — статус `BLOCKED_NO_FREE_CAPACITY`, не выдумывать альтернативную готовность.
- Не менять и не подключать базу, секреты, деплой другого продукта; никогда не публиковать DSN/токены. Никаких несанкционированных изменений production/main. Кодовые задачи — отдельные PR и существующие quality gates.
- Не запускать реальные платежи/торговлю/рассылки/платные провайдеры ради теста: тесты, моки, sandbox без биллинга или проверенная бесплатная среда.

## Правило для исполнителя / агента
1. Сверить **текущие** main/PR/issues/CI с источниками выше: статусы здесь — snapshot на 2026-10-12, не подтверждение release.
2. Работать по очереди P0 → P1 → P2, но сначала разблокировать зависимости; не начинать следующую бизнес-цепочку, если предыдущая не доказана.
3. Для каждого пункта в PR приложить: exact SHA, файлы, миграции/API/UI связи, локальные тесты, негативные проверки прав, browser/device screenshots (если UI), DB/backup proof (если persistence), live verification (если публичный сервис), стоимость **0 ₽** с источником/лимитом.
4. Отмечать отдельно `PLANNED`, `IN_CODE`, `CI_PASS`, `LIVE_VERIFIED`, `BLOCKED`. Никогда не отмечать `DONE` только из-за документации или зелёного unit-test.
5. Сверить с существующими canonical specs/AGENTS.md; этот чеклист добавляет приоритеты и cost gate, но не заменяет доменную архитектуру/политику.

## Передача следующему проходу
- Выбирай **первый незакрытый незаблокированный** пункт P0, проверяй реальное состояние и открывай точечную реализацию, а не создавай ещё один «план без кода».
- После каждого рабочего прохода обновляй issue/PR и данный чеклист с ссылками на evidence, но не перезаписывай наблюдения устаревшим snapshot.
