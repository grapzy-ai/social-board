# Social Board — Implementation Plan, этап 1 (данные, Обзор, Посты)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Через 4 рабочих дня три RU-аккаунта (Threads, Instagram, Telegram) синкаются каждые 6 часов в Supabase, а дашборд на Vercel показывает Обзор (цели, прирост, автокомментарий) и Посты (множитель к медиане, метки) с входом по magic link.

**Architecture:** Монорепо `social-board`: `apps/web` — Next.js 15 (App Router, TS, Drizzle, Recharts) на Vercel с защищёнными роутами для синка, которые дёргает Supabase pg_cron; `worker` — Python/Telethon на Railway для Telegram. Одна база Postgres (Supabase `vadim-social`), токены шифруются AES-256-GCM, снимки метрик только добавляются.

**Tech Stack:** Next.js 15.x, TypeScript 5, Drizzle ORM + `postgres` driver, Supabase (Auth, Postgres 17, pg_cron, pg_net), Recharts, Tailwind 4, Vitest; Python 3.12, Telethon 1.x, `supabase-py`, pytest; Anthropic SDK (TS).

**Spec:** `claude/Спека — Social Board (дашборд соцсетей), архитектура и этапы.md` (проект «Вадим Бордиян - ЛБ»); контентные правила — `claude/Спека — контентная система v2…`.

## Global Constraints

- Node 20.9+, pnpm; Python 3.12. Все секреты — только в env (Vercel / Railway / Supabase Vault); в репозитории — `.env.example` без значений.
- Уникальность поста: `(account_id, external_id)`. Снимки метрик (`post_metrics_snapshots`) никогда не обновляются — только вставка.
- Дни снимков: 1, 3, 7, 11, 30, затем каждые 7 дней. «День N» считается в часовом поясе `Europe/Chisinau` от даты публикации.
- Множитель = метрика поста на последнем снимке с `day_index ≤ 11` / медиана формата. Медиана — по постам за последние 90 дней того же `account_id` и `format`, у которых есть снимок дня 11; если таких постов < 5 — бенчмарк `null`, в UI «мало данных».
- Сбор каждые 6 часов (00/06/12/18 по Кишинёву); ежедневные метрики аккаунта пишутся по дате Кишинёва.
- Токены платформ: AES-256-GCM, ключ `TOKEN_ENCRYPTION_KEY` (32 байта base64); в UI и логах токены не появляются никогда.
- Язык UI — русский; стиль — тёмная тема, фуксия/чёрный/белый, бейдж VB.
- Роуты синка защищены заголовком `Authorization: Bearer ${CRON_SECRET}`.

## Review Focus

1. **Токен истёк посреди синка** (401 от Meta) → `sync_runs.status='error'`, пост-данные предыдущих запусков не трогаются, создаётся `signals(type='token_expired')`; тест в Task 7.
2. **Пропущенная метрика** (Threads `views` «в разработке», IG `views` может отсутствовать у старых постов) → снимок пишется с `null`, множитель по `views=null` не считается и не ломает страницу; тест в Task 3 и Task 4.
3. **Граница суток и день 11** — пост, опубликованный в 23:30 по Кишинёву: `day_index` считается по локальной дате, не по UTC; тест в Task 2.
4. **Мало данных для медианы** (< 5 постов формата) → `benchmark=null`, UI показывает «мало данных», а не `NaN`/`Infinity`; тест в Task 2 и Task 11.
5. **Повторный синк того же поста** → ни дубликата `posts`, ни второго снимка за тот же `day_index`; тест в Task 5.

---

## Структура файлов

```
social-board/
  package.json  pnpm-workspace.yaml  .gitignore  .env.example  README.md
  supabase/
    migrations/0001_core.sql          # таблицы этапа 1
    migrations/0002_cron.sql          # pg_cron + pg_net расписания (применяется после деплоя)
  apps/web/
    src/lib/db/schema.ts               # Drizzle-схема (единственный источник типов таблиц)
    src/lib/db/client.ts               # drizzle(postgres(DATABASE_URL))
    src/lib/crypto.ts                  # encryptToken / decryptToken
    src/lib/time.ts                    # chisinauDate, dayIndex
    src/lib/metrics/benchmarks.ts      # median, computeBenchmark
    src/lib/metrics/multiplier.ts      # multiplier, snapshotForDay
    src/lib/adapters/types.ts          # NormalizedPost, NormalizedPostMetrics, NormalizedAccountMetrics, Adapter
    src/lib/adapters/threads.ts        # ThreadsAdapter
    src/lib/adapters/instagram.ts      # InstagramAdapter
    src/lib/adapters/meta-http.ts      # fetchJson с ретраями/лимитами, MetaApiError
    src/lib/sync/run.ts                # runSync(accountId) — оркестратор
    src/lib/sync/snapshots.ts          # shouldSnapshot, writeSnapshot
    src/lib/sync/tokens.ts             # refreshIfNeeded
    src/lib/claude/goal-comment.ts     # generateGoalComment
    src/lib/telegram/notify.ts         # sendBotMessage
    src/app/api/cron/sync/route.ts     # POST — все активные аккаунты threads/instagram
    src/app/api/cron/benchmarks/route.ts
    src/app/api/cron/goal-comments/route.ts
    src/app/api/cron/token-refresh/route.ts
    src/app/api/health/route.ts
    src/app/api/auth/threads/start/route.ts   # OAuth окно Threads
    src/app/api/auth/threads/callback/route.ts
    src/app/(auth)/login/page.tsx
    src/app/(dashboard)/layout.tsx     # навигация, проверка сессии
    src/app/(dashboard)/page.tsx       # Обзор
    src/app/(dashboard)/posts/page.tsx
    src/app/(dashboard)/posts/[id]/page.tsx
    src/app/(dashboard)/settings/accounts/page.tsx  # добавить аккаунт, вставить токен, цели месяца
    src/components/ui/*                # карточки, таблица, чипы (фирменная тема)
    src/components/charts/GrowthChart.tsx
    src/middleware.ts                  # Supabase session + allowlist
    tests/**                           # Vitest
  worker/
    pyproject.toml  Dockerfile  main.py
    tg/collector.py                    # Telethon: подписчики, посты, просмотры/репосты/реакции, stats
    tg/normalize.py                    # чистые функции преобразования → словари для БД
    tg/sink.py                         # upsert в Supabase (REST через supabase-py)
    tg/schedule.py                     # цикл: каждые 6 ч + отправка алертов
    tests/test_normalize.py
```

---

### Task 1: Репозиторий, схема базы, миграция

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `.env.example`, `README.md`, `apps/web` (через `pnpm create next-app@latest apps/web --ts --app --tailwind --src-dir --eslint --no-import-alias`), `apps/web/src/lib/db/schema.ts`, `apps/web/src/lib/db/client.ts`, `supabase/migrations/0001_core.sql`, `apps/web/vitest.config.ts`
- Test: `apps/web/tests/db/schema.test.ts`

**Interfaces:**
- Produces: Drizzle-таблицы `accounts, posts, postMetricsSnapshots, accountMetricsDaily, benchmarks, goals, signals, syncRuns, manualMetrics` с полями из спеки §4; `db` клиент; enum'ы `Platform = 'threads'|'instagram'|'telegram'|'tiktok'|'vk'|'youtube'|'linkedin'`, `PostFormat = 'reel'|'carousel'|'image'|'thread'|'tg_post'|'short'|'tiktok'`, `Label = 'hit'|'miss'|'odd'|null`.

- [ ] **Step 1: Инициализировать монорепо** — `pnpm init`, workspace с `apps/*` и `worker`; в `apps/web` установить `drizzle-orm postgres drizzle-kit vitest @vitest/coverage-v8 zod`.
- [ ] **Step 2: Написать `schema.ts`** — таблицы из спеки §4 для этапа 1 (без `replies, drafts, pillars, bricks, audience_profiles` — они в этапе 2). Ключевые ограничения: `posts` unique `(account_id, external_id)`; `post_metrics_snapshots` unique `(post_id, day_index)`; `account_metrics_daily` unique `(account_id, date)`; `benchmarks` unique `(account_id, format, computed_at::date)`; `accounts.token_enc text`, `accounts.token_expires_at timestamptz`, `accounts.language text check in ('ru','en')`, `accounts.role text check in ('focus','mirror','lifestyle')`.
- [ ] **Step 3: Сгенерировать SQL** — `drizzle-kit generate` → перенести в `supabase/migrations/0001_core.sql`; добавить RLS: таблицы читаются ролью `authenticated`, пишутся только `service_role`.
- [ ] **Step 4: Тест схемы** — `tests/db/schema.test.ts`: `getTableColumns(posts)` содержит `externalId, accountId, format, publishedAt, pillarId, rubric, language, label`; `postMetricsSnapshots` содержит `dayIndex, views, reach, likes, comments, saves, reposts, shares, clicks, avgWatchTimeSec`.
- [ ] **Step 5: Запустить** — `pnpm -F web vitest run tests/db` → PASS.
- [ ] **Step 6: Применить миграцию** к проекту `vadim-social` через Supabase MCP `apply_migration` (имя `0001_core`); проверить `list_tables`.
- [ ] **Step 7: Commit** — `chore: scaffold monorepo, drizzle schema, core migration`.

### Task 2: Время, медиана, множитель (чистые функции)

**Files:**
- Create: `apps/web/src/lib/time.ts`, `apps/web/src/lib/metrics/benchmarks.ts`, `apps/web/src/lib/metrics/multiplier.ts`
- Test: `apps/web/tests/metrics/time.test.ts`, `tests/metrics/benchmarks.test.ts`, `tests/metrics/multiplier.test.ts`

**Interfaces:**
- Produces: `chisinauDate(d: Date): string /* YYYY-MM-DD */`; `dayIndex(publishedAt: Date, now: Date): number` (целые дни между локальными датами); `SNAPSHOT_DAYS = [1,3,7,11,30]`; `shouldSnapshot(dayIdx: number, existing: number[]): boolean` (true для дней из списка и для каждого 7-го после 30, если такого `dayIdx` ещё нет); `median(values: number[]): number | null`; `computeBenchmark(day11Views: (number|null)[]): number | null` (null при < 5 валидных); `snapshotForDay(snaps: {dayIndex:number, views:number|null}[], maxDay=11)`; `multiplier(views: number|null, benchmark: number|null): number | null`.

- [ ] **Step 1: Тесты времени** — `dayIndex(2026-10-19T20:30Z /*23:30 Кишинёв*/, 2026-10-20T05:00Z)` → `1`; `dayIndex(x, x)` → `0`; `shouldSnapshot(11,[1,3,7])` → true; `shouldSnapshot(11,[1,3,7,11])` → false; `shouldSnapshot(37,[30])` → true; `shouldSnapshot(36,[30])` → false.
- [ ] **Step 2: Запустить** → FAIL (модули не найдены).
- [ ] **Step 3: Реализовать `time.ts`** через `Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Chisinau'})`, без внешних зависимостей.
- [ ] **Step 4: Тесты метрик** — `median([1,2,3,4])` → 2.5; `median([])` → null; `computeBenchmark([100,200,null,300,400])` → null (4 валидных); `computeBenchmark([100,200,300,400,1000])` → 300; `snapshotForDay([{dayIndex:1,views:10},{dayIndex:7,views:50},{dayIndex:30,views:90}])` → снимок дня 7; `multiplier(1200, 470)` → 2.55 (округление до сотых); `multiplier(null,470)` → null; `multiplier(100,null)` → null; `multiplier(100,0)` → null.
- [ ] **Step 5: Реализовать** `benchmarks.ts`, `multiplier.ts`.
- [ ] **Step 6: Запустить** `pnpm -F web vitest run tests/metrics` → PASS.
- [ ] **Step 7: Commit** — `feat(metrics): chisinau day index, median benchmark, multiplier`.

### Task 3: Шифрование токенов и адаптер Threads

**Files:**
- Create: `apps/web/src/lib/crypto.ts`, `apps/web/src/lib/adapters/types.ts`, `apps/web/src/lib/adapters/meta-http.ts`, `apps/web/src/lib/adapters/threads.ts`
- Test: `tests/crypto.test.ts`, `tests/adapters/threads.test.ts`, фикстуры `tests/fixtures/threads/*.json`

**Interfaces:**
- Produces: `encryptToken(plain: string): string` / `decryptToken(enc: string): string` (формат `base64(iv).base64(tag).base64(ct)`); `MetaApiError extends Error { status: number; code?: number; isAuth: boolean }`; `fetchJson<T>(url: string, init?: RequestInit, retries=3): Promise<T>` (429/5xx — экспоненциальная пауза, 401/190 — `MetaApiError{isAuth:true}` без ретрая); типы `NormalizedPost { externalId; format; publishedAt: Date; text: string|null; mediaUrl: string|null; permalink: string|null }`, `NormalizedPostMetrics { views; likes; comments; saves; reposts; shares; clicks; reach; avgWatchTimeSec }` (все `number|null`), `NormalizedAccountMetrics { followers: number|null; profileViews: number|null; reach: number|null }`; интерфейс `Adapter { listPosts(since: Date): Promise<NormalizedPost[]>; postMetrics(externalId: string): Promise<NormalizedPostMetrics>; accountMetrics(): Promise<NormalizedAccountMetrics>; refreshToken(): Promise<{token: string; expiresAt: Date}> }`; `new ThreadsAdapter({ userId, token })`.

- [ ] **Step 1: Тест crypto** — round-trip; два шифрования одного текста дают разные строки; `decryptToken` на испорченной строке бросает.
- [ ] **Step 2: Реализовать `crypto.ts`** на `node:crypto` (`aes-256-gcm`), ключ из `TOKEN_ENCRYPTION_KEY`.
- [ ] **Step 3: Фикстуры Threads** — `me_threads.json` (ответ `/{user}/threads?fields=id,media_type,text,permalink,timestamp,media_url,is_quote_post`, 3 поста, один `REPOST_FACADE`), `media_insights.json` (`views, likes, replies, reposts, quotes`), `media_insights_noviews.json` (без `views`), `user_insights.json` (`followers_count`, `views`).
- [ ] **Step 4: Тест адаптера** (fetch замокан через `vi.stubGlobal('fetch', …)`): `listPosts` возвращает 2 поста (REPOST_FACADE отброшен), `format==='thread'`, `publishedAt` — Date; `postMetrics` по `media_insights.json` → `{views:1200, likes:40, comments:12, reposts:3, shares:null, saves:null, clicks:null, reach:null, avgWatchTimeSec:null}` (quotes прибавляются к reposts); по `media_insights_noviews.json` → `views:null`; `accountMetrics` → `followers:130`; при ответе 401 с `error.code 190` → бросает `MetaApiError{isAuth:true}`.
- [ ] **Step 5: Реализовать `meta-http.ts` и `threads.ts`** — базовый URL `https://graph.threads.net/v1.0`; `refreshToken` → `GET /refresh_access_token?grant_type=th_refresh_token`.
- [ ] **Step 6: Запустить** `pnpm -F web vitest run tests/crypto tests/adapters/threads` → PASS.
- [ ] **Step 7: Commit** — `feat(adapters): token crypto, meta http client, threads adapter`.

### Task 4: Адаптер Instagram

**Files:**
- Create: `apps/web/src/lib/adapters/instagram.ts`
- Test: `tests/adapters/instagram.test.ts`, фикстуры `tests/fixtures/instagram/*.json`

**Interfaces:**
- Consumes: `fetchJson`, `MetaApiError`, типы из Task 3.
- Produces: `new InstagramAdapter({ igId, token })` реализует `Adapter`; маппинг `media_product_type`/`media_type` → `format`: `REELS→'reel'`, `CAROUSEL_ALBUM→'carousel'`, иначе `'image'`.

- [ ] **Step 1: Фикстуры** — `media.json` (`/{ig}/media?fields=id,media_type,media_product_type,caption,permalink,timestamp,thumbnail_url,media_url`), `reel_insights.json` (`views, reach, likes, comments, saved, shares, reposts, ig_reels_avg_watch_time`), `image_insights.json` (без reels-метрик), `user.json` (`followers_count`), `user_insights.json` (`profile_views, reach` за день).
- [ ] **Step 2: Тест** — форматы маппятся верно; `postMetrics` для рила → `avgWatchTimeSec = ig_reels_avg_watch_time/1000` (API отдаёт мс), `saves` из `saved`; для картинки `avgWatchTimeSec:null`; `accountMetrics.followers` из `user.json`; ошибка `(#100) ... metric` на старом посте → адаптер повторяет запрос без reels-метрик и возвращает `views:null` вместо исключения.
- [ ] **Step 3: Реализовать** — базовый URL `https://graph.instagram.com/v26.0`; `refreshToken` → `GET /refresh_access_token?grant_type=ig_refresh_token`.
- [ ] **Step 4: Запустить** → PASS. **Step 5: Commit** — `feat(adapters): instagram adapter`.

### Task 5: Оркестратор синка и снимки

**Files:**
- Create: `apps/web/src/lib/sync/snapshots.ts`, `apps/web/src/lib/sync/run.ts`
- Test: `tests/sync/run.test.ts` (БД — `pglite` через `drizzle-orm/pglite` с миграцией `0001_core.sql`)

**Interfaces:**
- Consumes: `Adapter`, `db`, `dayIndex`, `shouldSnapshot`, `decryptToken`.
- Produces: `runSync(accountId: string, now = new Date()): Promise<SyncResult>` где `SyncResult { accountId; postsUpserted: number; snapshotsWritten: number; status: 'ok'|'error'; error?: string }`; `adapterFor(account): Adapter`; `writeSnapshot(postId, dayIndex, metrics)`; запись в `sync_runs` при каждом вызове; при `MetaApiError.isAuth` — `accounts.status='token_invalid'` + строка в `signals(type='token_expired')`.

- [ ] **Step 1: Тест** с фейковым адаптером: первый `runSync` на 2 постах (опубликованы 1 и 11 дней назад) → `postsUpserted=2`, `snapshotsWritten=2` (day 1 и day 11), `account_metrics_daily` за сегодня 1 строка; второй `runSync` тем же `now` → `postsUpserted=2` (upsert), `snapshotsWritten=0`; `runSync` c адаптером, бросающим `MetaApiError{isAuth:true}` → `status:'error'`, в `signals` одна строка `token_expired`, посты из первого прогона на месте.
- [ ] **Step 2: Реализовать** — `listPosts(since = now − 90 дней)` → upsert; для каждого поста `dayIdx = dayIndex(publishedAt, now)`; снимок только если `shouldSnapshot(dayIdx, existingDays)`; метрики аккаунта — upsert по дате Кишинёва; всё в одной транзакции на аккаунт, `sync_runs` пишется вне транзакции.
- [ ] **Step 3: Запустить** → PASS. **Step 4: Commit** — `feat(sync): sync orchestrator with append-only snapshots`.

### Task 6: Роуты cron, health, расписание pg_cron

**Files:**
- Create: `apps/web/src/app/api/cron/sync/route.ts`, `api/cron/benchmarks/route.ts`, `api/health/route.ts`, `supabase/migrations/0002_cron.sql`
- Test: `tests/api/cron.test.ts`

**Interfaces:**
- Consumes: `runSync`, `computeBenchmark`.
- Produces: `POST /api/cron/sync` (Bearer `CRON_SECRET`) → `{ results: SyncResult[] }` по всем `accounts.status='active'` платформ threads/instagram; `POST /api/cron/benchmarks` → пересчёт `benchmarks` по каждому `(account, format)` за 90 дней; `GET /api/health` → `{ accounts: [{id, platform, lastOkSyncAt, status}] }`, код 503, если у любого активного аккаунта `lastOkSyncAt` старше 13 часов.
- `0002_cron.sql`: `cron.schedule('sync-6h','0 */6 * * *', net.http_post(url:='https://<DOMAIN>/api/cron/sync', headers:='{"Authorization":"Bearer <SECRET>"}'))`, `benchmarks` — `15 3 1 * *` и ежедневно `15 4 * * *`; секрет хранится в Vault и подставляется через `vault.decrypted_secrets`.

- [ ] **Step 1: Тест** — запрос без заголовка → 401; с верным секретом и замоканным `runSync` → 200 и массив результатов; `/api/health` при свежем синке → 200, при устаревшем → 503.
- [ ] **Step 2: Реализовать** роуты (`runtime='nodejs'`, `maxDuration=300`).
- [ ] **Step 3: Запустить** → PASS. **Step 4: Commit** — `feat(api): cron sync/benchmarks routes, health, pg_cron migration`.

### Task 7: Токены — OAuth Threads, продление, настройки аккаунтов

**Files:**
- Create: `apps/web/src/lib/sync/tokens.ts`, `api/cron/token-refresh/route.ts`, `api/auth/threads/start/route.ts`, `api/auth/threads/callback/route.ts`, `src/app/(dashboard)/settings/accounts/page.tsx` (+ server actions `addAccount`, `setGoal`)
- Test: `tests/sync/tokens.test.ts`

**Interfaces:**
- Consumes: `encryptToken`, адаптеры (`refreshToken`).
- Produces: `refreshIfNeeded(account, now): Promise<'skipped'|'refreshed'|'failed'>` — обновляет, если до `token_expires_at` < 10 дней; при провале → `signals(type='token_expiring')`; `addAccount({platform, handle, externalUserId, language, role, token, expiresAt})` шифрует и сохраняет; OAuth Threads: `start` редиректит на `https://threads.net/oauth/authorize` со scope из спеки, `callback` меняет code → short → long-lived и вызывает `addAccount`.

- [ ] **Step 1: Тест** — аккаунт с истечением через 30 дней → `'skipped'`; через 5 дней и успешный `refreshToken` → `'refreshed'`, `token_enc` изменился, `token_expires_at` ≈ now+60д; `refreshToken` бросает → `'failed'` + сигнал.
- [ ] **Step 2: Реализовать** `tokens.ts`, роут `token-refresh` (ежедневно, добавить в `0002_cron.sql`), OAuth-роуты, страницу настроек (форма: платформа, хендл, язык, роль, токен — поле `type=password`; таблица аккаунтов без токенов; поле «цель месяца» для подписчиков → `goals`).
- [ ] **Step 3: Запустить** тесты → PASS; вручную: добавить Instagram-токен из Meta Dashboard, пройти OAuth Threads, вызвать `/api/cron/sync` с секретом локально → в БД появились посты.
- [ ] **Step 4: Commit** — `feat(accounts): token refresh, threads oauth, accounts settings`.

### Task 8: Воркер Telegram (Railway)

**Files:**
- Create: `worker/pyproject.toml`, `worker/Dockerfile`, `worker/main.py`, `worker/tg/collector.py`, `worker/tg/normalize.py`, `worker/tg/sink.py`, `worker/tg/schedule.py`
- Test: `worker/tests/test_normalize.py`

**Interfaces:**
- Produces: `normalize_message(msg) -> dict` с ключами `external_id, published_at, text, views, forwards, reactions, permalink`; `normalize_channel(full) -> dict` `{followers, can_view_stats}`; `collect_once(client, channel) -> CollectResult(posts:int, snapshots:int)`; `sink.upsert_posts(account_id, rows)`, `sink.write_snapshot(post_id, day_index, metrics)`, `sink.upsert_account_daily(account_id, date, followers)` — через Supabase REST с `service_role`; те же правила дней снимков и Кишинёва (`zoneinfo`).
- Env: `TG_API_ID, TG_API_HASH, TG_SESSION (StringSession), TG_CHANNEL (@username), TG_ACCOUNT_ID (uuid из accounts), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TG_BOT_TOKEN, TG_REPORT_CHAT_IDS`.

- [ ] **Step 1: Тесты normalize** на `SimpleNamespace`-объектах: сообщение с `views=1500, forwards=12, reactions.results=[(❤️,30),(🔥,5)]` → `views 1500, forwards 12, reactions 35`; сообщение без `views` (служебное) → пропускается (`None`); `day_index` для публикации 23:30 Кишинёва и `now` на следующее утро → 1; `snapshot_days_due(day_index, existing)` повторяет TS-логику.
- [ ] **Step 2: Реализовать** `normalize.py`, затем `collector.py`: `GetFullChannelRequest` → followers; `iter_messages(limit за 90 дней)`; если `full_chat.can_view_stats` — `GetBroadcastStatsRequest` → сохранить `followers_graph`/источники в `account_metrics_daily.extra jsonb` (поле добавить миграцией `0003_tg_extra.sql`); `main.py` — при отсутствии `TG_SESSION` интерактивный вход и печать строки сессии; `schedule.py` — цикл: синк → sleep до следующего 00/06/12/18 по Кишинёву; три ошибки подряд → `sendMessage` в бот.
- [ ] **Step 3: Запустить** `pytest worker/tests -q` → PASS; локально `python main.py --once` с реальной сессией → строки в `posts`.
- [ ] **Step 4: Деплой на Railway** (Dockerfile, переменные), проверить лог первого прогона.
- [ ] **Step 5: Commit** — `feat(worker): telegram collector on railway`.

### Task 9: Auth и каркас дашборда

**Files:**
- Create: `apps/web/src/middleware.ts`, `src/app/(auth)/login/page.tsx`, `src/app/(dashboard)/layout.tsx`, `src/components/ui/{Card,Stat,Chip,Table}.tsx`, `src/app/globals.css` (токены темы)
- Test: `tests/auth/allowlist.test.ts`

**Interfaces:**
- Produces: `isAllowed(email: string): boolean` по `ALLOWED_EMAILS` (через запятую, без учёта регистра); middleware: нет сессии → `/login`; сессия с e-mail вне allowlist → `/login?denied=1`; тема: `--bg #0B0B0C`, `--fg #FFFFFF`, `--accent` = фуксия из Figma (значение уточнить у дизайнера; плейсхолдер `#FF2BD6`), шрифт — системный гротеск до поставки фирменного; бейдж `VB` в шапке.

- [ ] **Step 1: Тест allowlist** — `isAllowed('Bordian07@gmail.com')` при `ALLOWED_EMAILS=bordian07@gmail.com,ksenia@…` → true; другой e-mail → false.
- [ ] **Step 2: Реализовать** Supabase Auth (`@supabase/ssr`), magic link, middleware, layout с навигацией «Обзор · Посты · Настройки».
- [ ] **Step 3: Проверить** вручную: вход по ссылке из письма, чужой e-mail — отказ. **Step 4: Commit** — `feat(auth): magic link + allowlist, dashboard shell`.

### Task 10: Обзор — карточки, цели, график прироста

**Files:**
- Create: `src/app/(dashboard)/page.tsx`, `src/lib/queries/overview.ts`, `src/components/charts/GrowthChart.tsx`
- Test: `tests/queries/overview.test.ts` (pglite)

**Interfaces:**
- Produces: `getOverview(period: 7|30|90): Promise<{ accounts: AccountCard[]; growth: {date: string; [accountId: string]: number|string}[] }>` где `AccountCard { accountId; platform; handle; followers; deltaYesterday; deltaToday; goal: {target, progressPct}|null; periodViews; periodReactions; comment: string|null }`; «накопленный прирост» = подписчики на дату − подписчики на первый день периода.
- Консумирует `account_metrics_daily`, `goals`, `post_metrics_snapshots` (последний снимок каждого поста за период для просмотров/реакций).

- [ ] **Step 1: Тест** — три дня метрик (100, 110, 125) → `deltaYesterday=10`, `deltaToday=15`, growth = [0,10,25]; цель 1000 при 125 → `progressPct=12.5`; аккаунт без цели → `goal=null`.
- [ ] **Step 2: Реализовать** запросы и страницу: переключатель периода (7/30/90) в URL `?period=`, карточки по платформам в цветах платформ, Recharts `LineChart` с линией на аккаунт, тёмная тема.
- [ ] **Step 3: Запустить** тесты → PASS; визуально проверить на реальных данных после первого синка. **Step 4: Commit** — `feat(overview): account cards, goals, cumulative growth chart`.

### Task 11: Посты — таблица, множитель, метки, карточка поста

**Files:**
- Create: `src/app/(dashboard)/posts/page.tsx`, `src/app/(dashboard)/posts/[id]/page.tsx`, `src/lib/queries/posts.ts`, server action `setLabel`
- Test: `tests/queries/posts.test.ts`

**Interfaces:**
- Produces: `listPosts(filter: {accountId?, format?, language?, label?, from?, to?}, sort: 'date'|'multiplier'): Promise<PostRow[]>` где `PostRow { id; platform; handle; format; publishedAt; text; permalink; day11Views: number|null; benchmark: number|null; multiplier: number|null; label; comments; saves }`; `getPost(id)` → пост + снимки по дням; `setLabel(postId, label: Label)`.

- [ ] **Step 1: Тест** — пост с day-11 views 1200 и бенчмарком 470 → `multiplier 2.55`; формат с 3 постами → `benchmark null`, `multiplier null`; сортировка по множителю ставит `null` в конец; `setLabel` меняет метку и видна в `listPosts`.
- [ ] **Step 2: Реализовать** страницу: фильтры-чипы (платформа, формат, язык, метка), колонки «Дата · Площадка · Формат · Текст · Просм. д11 · ×Медиана · Комм. · Сохр. · Метка», метка редактируется в строке (три кнопки «залетело / мимо / странно»), множитель окрашен: ≥2 — акцент, <0.5 — приглушён, null — «мало данных»; карточка поста: таблица снимков по дням + ссылка на оригинал.
- [ ] **Step 3: Запустить** → PASS; проверить вручную. **Step 4: Commit** — `feat(posts): posts table with multipliers and labels`.

### Task 12: Автокомментарий к целям (Claude) и уведомления в бот

**Files:**
- Create: `src/lib/claude/goal-comment.ts`, `api/cron/goal-comments/route.ts`, `src/lib/telegram/notify.ts`
- Test: `tests/claude/goal-comment.test.ts`

**Interfaces:**
- Produces: `generateGoalComment(input: {platform, handle, followers, target, daysLeft, deltaYesterday, avgDaily7}, client = anthropic): Promise<string>` — 1–2 предложения в голосе Вадима (системный промпт: выжимка «Голоса Вадима» §3 и §4; факты только из `input`; без эмодзи, кроме одного в начале, как у Жени); `sendBotMessage(chatId: string, text: string)`; роут раз в день 08:00 Кишинёва пишет `goals.comment` для каждого аккаунта с целью; при `signals` новых за сутки — одно сообщение в бот со списком.

- [ ] **Step 1: Тест** с замоканным клиентом: промпт содержит все числа из `input`; результат ≤ 240 символов; при ошибке API возвращает `null`, не бросает.
- [ ] **Step 2: Реализовать** (`@anthropic-ai/sdk`, модель из env `CLAUDE_MODEL`), роут, `notify.ts` (`fetch https://api.telegram.org/bot<token>/sendMessage`); расписание в `0002_cron.sql`.
- [ ] **Step 3: Запустить** → PASS. **Step 4: Commit** — `feat: daily goal comments via claude, telegram notifications`.

### Task 13: Деплой и приёмка этапа 1

**Files:**
- Modify: `README.md` (запуск, переменные, порядок применения миграций), `supabase/migrations/0002_cron.sql` (подставить домен)

- [ ] **Step 1: Vercel** — импорт репозитория, env по `.env.example`, домен (`social.vadim.bio` или `*.vercel.app`), первый деплой зелёный; `/api/health` отвечает.
- [ ] **Step 2: Supabase** — применить `0002_cron.sql` с реальным доменом и секретом из Vault; убедиться, что `cron.job` содержит 4 задания; дождаться первого автоматического синка.
- [ ] **Step 3: Railway** — воркер запущен, первый прогон записал подписчиков и посты Telegram.
- [ ] **Step 4: Данные** — добавить аккаунты (IG RU, Threads RU, TG), цели месяца; запустить `/api/cron/benchmarks` вручную (на старте медианы могут быть `null` — норма до накопления снимков дня 11; для старых постов снимок дня 11 не восстановить, поэтому **первые бенчмарки считаются по текущим просмотрам постов возрастом ≥ 11 дней** — флаг `benchmarks.provisional=true`, снимается автоматически через 30 дней).
- [ ] **Step 5: Приёмка (критерии спеки §10)** — 48 часов без ручного вмешательства; сверка цифр с нативной статистикой (±5%); множители у всех постов старше 11 дней; e-mail Ксении в allowlist и вход работает.
- [ ] **Step 6: Commit/tag** — `v0.1.0-stage1`; первый ролик «Social Board, день 1» из сезона build in public.

---

## Этап 2 и 3 — ориентир (детальные планы после приёмки этапа 1)

**Этап 2 (дни 5–8):** таблицы `replies, drafts, pillars, bricks`; сборщик комментариев Threads/IG; страница «Ответы» с черновиком от Claude и публикацией (Threads reply API, IG comment reply); «Черновики»: pillar → пакет (4 Reels, 5 Threads, карусель, 2 сторис) по «Сторителлингу» и «Голосу Вадима», EN-адаптация кнопкой; MCP-сервер (`get_overview, list_posts, get_post, top_posts, list_replies, create_draft, update_label, add_brick`); ручной ввод LinkedIn; импорт срезов Virale.

**Этап 3 (дни 9–12):** «Расписание» и публикация в Threads/IG (Supabase Storage → публичный URL → API) и Telegram (бот); сигналы (×3 за 24 ч, повтор вопроса, просадка, 11-й день, токен); пятничный отчёт в бот; разбор топ-10% месяца с предложением «кирпичей»; TikTok/VK после одобрения API.

---

## Self-review (выполнен)

- Покрытие спеки §5 «Этап 1»: сборщики (T3–T5, T8), снимки (T2, T5), Обзор (T10), Посты (T11), бенчмарки (T2, T6), вход (T9), автокомментарий (T12), health/наблюдаемость (T6, T12), токены (T7), приёмка (T13). Не покрыто сознательно: Virale, LinkedIn ручной ввод — этап 2 по спеке.
- Типы согласованы: `Adapter`, `NormalizedPostMetrics`, `SyncResult`, `Label`, `PostRow` используются с одинаковыми именами в T3–T11.
- Review Focus: все пять пунктов привязаны к тестам (T7, T3/T4, T2, T2/T11, T5).
- Пропорция: план короче спеки по коду; тела функций не выписаны, кроме правил, которые тесты не определяют (дни снимков, provisional-бенчмарк).
