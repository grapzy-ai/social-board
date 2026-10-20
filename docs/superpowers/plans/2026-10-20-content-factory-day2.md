# Content Factory — Day 2 (Inbox, Sorter, Drafts, Telegram publishing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vadim drops voice/text/links/photos into the Telegram bot (video links from Drive), the dashboard sorts them, generates a content package in his voice as editable drafts, and publishes approved Telegram drafts to his channel through the bot — nothing goes out without «Согласовать».

**Architecture:** One Next.js webhook route receives bot updates (secret-token + chat allowlist), stores `inbox_items`, transcribes voice (OpenAI, optional), and runs the Sorter (Claude, JSON). Dashboard pages `/inbox` and `/drafts` drive generation (Claude → `drafts` rows) and status changes; approval works from the dashboard and from inline bot buttons (callback_query through the same webhook). Publishing to Telegram = Bot API `sendMessage` to the channel whose handle is the `telegram` account in `accounts`.

**Tech Stack:** Next.js 16 App Router (server actions, route handlers), Drizzle + postgres-js, Supabase Postgres (migration `0006`), `@anthropic-ai/sdk`, Telegram Bot API over `fetch`, OpenAI audio transcription REST (optional), vitest + pglite.

**Spec:** `docs/superpowers/specs/2026-10-20-content-factory-v1.md` (§1 conveyor, §2 agents 1–3, §3 data, §4 day 2). Voice rules: project doc «Голос Вадима»; storytelling frame: «Сторителлинг»; CTA policy (20.10): no selling — only code word / Telegram.

## Global Constraints

- Secrets only in env: `TG_BOT_TOKEN`, `TG_REPORT_CHAT_IDS`, `CRON_SECRET`, `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`, `APP_BASE_URL`, optional `OPENAI_API_KEY`. No new required env vars; the webhook secret token is derived: `sha256("tg-webhook:" + CRON_SECRET)` hex.
- Bot accepts updates only from chats listed in `TG_REPORT_CHAT_IDS`; everything else → 200 and ignored (never reveal existence).
- Nothing is published without `status = approved` set by Vadim (dashboard action or bot callback from an allowed chat). Publishing changes status to `published` exactly once (guard on status in the UPDATE).
- All generated copy: Russian by default, Vadim's voice, facts only from the source text; a missing number is written as `[?]`, never invented. No CTA other than «пиши «ИССЛЕДОВАНИЕ»» / «подробнее в Telegram». No hashtags.
- Route handlers that call Claude or Telegram: `export const runtime = "nodejs"`; webhook `maxDuration = 60`; generation server action pages `maxDuration = 300`.
- Tests: vitest, `tests/**/*.test.ts`, pglite via `tests/helpers/testdb.ts` (apply `0001` stripped of RLS block + `0006`). Full suite green before every commit. Existing 121 tests stay green.
- UI follows `globals.css` tokens (`bg-card border-line text-muted bg-accent …`), `PageHeader`, Sidebar nav from `lib/ui/nav.ts`.

## Review Focus

1. A Telegram update from a chat not in the allowlist (or with a wrong secret header) — must return 200 without writing anything or replying. (Task 2 tests)
2. The same message delivered twice by Telegram (retry) — exactly one inbox item, one ack. (Task 2 test on unique `(tg_chat_id, tg_message_id)`)
3. Voice message with no `OPENAI_API_KEY` — item saved with `transcript = null`, status `new`, ack says «ждёт расшифровки»; nothing throws. (Task 3 test)
4. Claude returns malformed JSON for the sorter or package — sorter falls back to neutral tags, package generation returns an error to the UI and creates zero drafts (no partial package). (Tasks 4, 6 tests)
5. «Опубликовать» pressed twice / from bot and dashboard simultaneously — second call sees `status != approved` and does nothing; Telegram failure leaves status `approved` with `publishError`. (Task 9 tests)

---

### Task 1: Migration 0006 + schema + test DB helper

**Files:**
- Create: `supabase/migrations/0006_factory.sql`
- Modify: `apps/web/src/lib/db/schema.ts` (append after `manualMetrics`)
- Modify: `apps/web/tests/helpers/testdb.ts`
- Test: `apps/web/tests/db/factory-schema.test.ts`

**Interfaces:**
- Produces (schema.ts):
  - `INBOX_SOURCES = ["bot","drive","manual"]`, `INBOX_KINDS = ["voice","text","link","photo","video","document","forward"]`, `INBOX_STATUSES = ["new","sorted","used","archived"]`
  - `DRAFT_TYPES = ["reel","threads","carousel","story","tg"]`, `DRAFT_STATUSES = ["idea","draft","ready","approved","scheduled","published","rejected"]`
  - `inboxItems` table: `id uuid pk`, `source`, `kind`, `tgChatId text`, `tgMessageId bigint` (drizzle `bigint({mode:"number"})`), `tgFileId text`, `text text`, `transcript text`, `mediaRef text`, `tags jsonb` (type `SortTags | null`), `language text enum LANGUAGES null`, `status default "new"`, `createdAt`, `updatedAt`; unique index `inbox_tg_msg_uq (tg_chat_id, tg_message_id)`.
  - `drafts` table: `id`, `inboxItemId uuid → inbox_items.id on delete set null`, `pillarId uuid → pillars.id set null`, `accountId uuid → accounts.id set null`, `type`, `language default "ru"`, `title text not null`, `body jsonb not null` (type `DraftBody`), `status default "draft"`, `assets jsonb`, `scheduledAt timestamptz`, `approvedAt timestamptz`, `publishedAt timestamptz`, `publishedUrl text`, `publishedPostId uuid → posts.id set null`, `publishError text`, `createdAt`, `updatedAt`; index `drafts_status_idx (status)`, `drafts_inbox_idx (inbox_item_id)`.
  - Types: `export type SortTags = { pillar: "influence"|"build"|"life"|"market"|null; format: "reel"|"threads"|"carousel"|"story"|"tg"|"tiktok_life"|null; kind: "raw"|"idea"|"reference"|"trend"; language: "ru"|"en"; summary: string; hooks: string[] }`
  - `export type DraftBody = { text: string } | { script: string; hooks: string[]; cover: string } | { slides: string[]; caption: string }`
  - `export type InboxItem`, `export type Draft` (`$inferSelect`).
- SQL mirrors the schema 1:1; both tables `enable row level security`; no policies (service_role gets default privileges from `0004`).

- [ ] **Step 1: Write the failing test** `tests/db/factory-schema.test.ts`

```ts
it("creates inbox_items and drafts with defaults and the tg dedupe index", async () => {
  const { db } = await makeTestDb();
  const [item] = await db.insert(inboxItems).values({ source: "bot", kind: "text", tgChatId: "1", tgMessageId: 10, text: "идея" }).returning();
  expect(item.status).toBe("new");
  await expect(db.insert(inboxItems).values({ source: "bot", kind: "text", tgChatId: "1", tgMessageId: 10, text: "дубль" })).rejects.toThrow();
  const [d] = await db.insert(drafts).values({ inboxItemId: item.id, type: "threads", title: "t", body: { text: "x" } }).returning();
  expect(d.status).toBe("draft");
  expect(d.language).toBe("ru");
});
```

- [ ] **Step 2: Run** `pnpm vitest run tests/db/factory-schema.test.ts` → Expected: FAIL (`inboxItems` not exported / relation does not exist)
- [ ] **Step 3: Write `0006_factory.sql`, append tables + types to `schema.ts`, change `makeTestDb` to apply `["0001_core.sql" (split on "-- Row Level Security"), "0006_factory.sql"]` in order**
- [ ] **Step 4: Run** the test → PASS; then `pnpm test` → Expected: 122+/122+ pass (existing suites untouched)
- [ ] **Step 5: Commit** `feat(db): inbox_items + drafts (0006)`

---

### Task 2: Telegram webhook — secret, allowlist, update parsing, inbox insert, ack

**Files:**
- Create: `apps/web/src/lib/telegram/webhook.ts`
- Create: `apps/web/src/lib/telegram/updates.ts`
- Create: `apps/web/src/app/api/telegram/webhook/route.ts`
- Modify: `apps/web/src/proxy.ts` (add `"/api/telegram/webhook"` to `PUBLIC_PREFIXES`)
- Modify: `apps/web/src/lib/telegram/notify.ts` (export `sendBotMessage(chatId, text, opts?: { replyMarkup?: unknown; parseMode?: "HTML" }): Promise<{ ok: boolean; messageId: number | null }>` — keep the boolean contract for `notifyAll` by adapting it)
- Test: `apps/web/tests/telegram/updates.test.ts`, `apps/web/tests/api/telegram-webhook.test.ts`

**Interfaces:**
- `updates.ts`:
  - `export type InboxInput = { kind: InboxKind; tgChatId: string; tgMessageId: number; text: string | null; tgFileId: string | null; mediaRef: string | null }`
  - `export type CallbackInput = { tgChatId: string; callbackId: string; data: string; messageId: number }`
  - `export function parseUpdate(update: unknown): { message: InboxInput } | { callback: CallbackInput } | null` — kind rules: `voice`/`audio` → `voice` (fileId = `voice.file_id`/`audio.file_id`); `video`/`video_note` → `video`; `photo` → `photo` (largest size's `file_id`); `document` → `document`; `forward_origin` or `forward_from_chat` present → `forward`; text containing a URL entity (`entities[].type === "url" | "text_link"`) and nothing else but whitespace → `link` with `mediaRef = url`; otherwise `text`. `text` = `message.text ?? message.caption ?? null`.
- `webhook.ts`:
  - `export function webhookSecret(cronSecret = process.env.CRON_SECRET ?? ""): string` → `sha256("tg-webhook:"+cronSecret)` hex.
  - `export function isAllowedChat(chatId: string, allow = reportChatIds()): boolean`
  - `export async function handleUpdate(db, update: unknown, deps: { sort?: Sorter; transcribe?: Transcriber; send?: typeof sendBotMessage; now?: Date }): Promise<{ action: "ignored" | "inserted" | "duplicate" | "callback"; itemId?: string }>` — Task 2 implements `ignored | inserted | duplicate` for messages; callbacks return `{action:"callback"}` without effect until Task 8.
  - Ack text (Task 2 version): `✅ Принял (${KIND_LABEL[kind]}). Открыть: ${APP_BASE_URL}/inbox/${id}`; `KIND_LABEL` = voice «голосовое», text «текст», link «ссылка», photo «фото», video «видео», document «файл», forward «пересланное».
- `route.ts`: `POST(req)` → compare header `x-telegram-bot-api-secret-token` with `webhookSecret()` via timing-safe equal → on mismatch `200 {ok:false}` (Telegram keeps retrying on non-200; we do not want that) → `handleUpdate(getDb(), await req.json())` → `200 {ok:true, action}`. `runtime="nodejs"`, `maxDuration=60`.

- [ ] **Step 1: Write failing tests**

`tests/telegram/updates.test.ts`:
```ts
it("classifies text / link / voice / photo / forward", () => {
  expect(parseUpdate({ message: { message_id: 1, chat: { id: 5 }, text: "идея про команду" } })).toEqual({ message: { kind: "text", tgChatId: "5", tgMessageId: 1, text: "идея про команду", tgFileId: null, mediaRef: null } });
  const link = parseUpdate({ message: { message_id: 2, chat: { id: 5 }, text: "https://drive.google.com/x", entities: [{ type: "url", offset: 0, length: 26 }] } });
  expect(link).toMatchObject({ message: { kind: "link", mediaRef: "https://drive.google.com/x" } });
  expect(parseUpdate({ message: { message_id: 3, chat: { id: 5 }, voice: { file_id: "F1", duration: 12 } } })).toMatchObject({ message: { kind: "voice", tgFileId: "F1", text: null } });
  expect(parseUpdate({ message: { message_id: 4, chat: { id: 5 }, caption: "кадр", photo: [{ file_id: "s", width: 90 }, { file_id: "L", width: 1280 }] } })).toMatchObject({ message: { kind: "photo", tgFileId: "L", text: "кадр" } });
  expect(parseUpdate({ message: { message_id: 5, chat: { id: 5 }, text: "x", forward_origin: { type: "channel" } } })).toMatchObject({ message: { kind: "forward" } });
  expect(parseUpdate({ callback_query: { id: "c1", data: "approve:abc", message: { message_id: 9, chat: { id: 5 } } } })).toEqual({ callback: { tgChatId: "5", callbackId: "c1", data: "approve:abc", messageId: 9 } });
  expect(parseUpdate({ edited_message: {} })).toBeNull();
});
```

`tests/api/telegram-webhook.test.ts` (mock `@/lib/db/client` like `tests/api/cron.test.ts`; mock `@/lib/telegram/notify` `sendBotMessage` to a `vi.fn` returning `{ok:true,messageId:1}`; set `CRON_SECRET="s3cret"`, `TG_REPORT_CHAT_IDS="5"`, `APP_BASE_URL="https://sb.test"`):
```ts
it("returns 200 and writes nothing on a wrong secret", ...)            // header "nope" → status 200, body.ok false, 0 rows, send not called
it("ignores chats outside the allowlist", ...)                         // chat 777 → {ok:true, action:"ignored"}, 0 rows, send not called
it("inserts a text item and acks with the inbox link", ...)            // chat 5 → 1 row kind text, send called with "5" and text containing "/inbox/<id>"
it("is idempotent on Telegram retries", ...)                           // same update twice → 1 row, second response action "duplicate", send called once
```

- [ ] **Step 2: Run** both files → FAIL (modules missing)
- [ ] **Step 3: Implement `updates.ts`, `webhook.ts` (`handleUpdate` without sort/transcribe yet), `route.ts`, `notify.ts` change, proxy prefix**
- [ ] **Step 4: Run** both files → PASS; `pnpm test` → all green (fix `notifyAll` callers of the changed `sendBotMessage` return type — `tests/telegram.test.ts` must still pass)
- [ ] **Step 5: Commit** `feat(telegram): webhook with secret + allowlist, inbox intake`

---

### Task 3: Telegram file download + optional voice transcription

**Files:**
- Create: `apps/web/src/lib/telegram/files.ts`
- Create: `apps/web/src/lib/transcribe.ts`
- Create: `apps/web/src/app/api/telegram/file/[fileId]/route.ts` (authenticated proxy for photo previews; proxy.ts already protects non-public routes)
- Modify: `apps/web/src/lib/telegram/webhook.ts` (voice path)
- Test: `apps/web/tests/telegram/files.test.ts`, `apps/web/tests/transcribe.test.ts`, extend `tests/api/telegram-webhook.test.ts`

**Interfaces:**
- `files.ts`: `export async function getFilePath(fileId: string, f: typeof fetch = fetch): Promise<string | null>` (Bot API `getFile`), `export function fileUrl(path: string): string` → `https://api.telegram.org/file/bot${TG_BOT_TOKEN}/${path}`, `export async function downloadFile(fileId: string, f = fetch): Promise<{ buf: Buffer; path: string } | null>` (null on any failure or `file_size > 20_000_000`).
- `transcribe.ts`: `export type Transcriber = (buf: Buffer, filename: string) => Promise<string | null>`; `export const transcribeOpenAI: Transcriber` — POST multipart to `https://api.openai.com/v1/audio/transcriptions` with `model = process.env.TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe"`, `language = "ru"`; returns `null` when `OPENAI_API_KEY` is unset or on non-2xx. `export function makeTranscriber(f: typeof fetch): Transcriber` for tests.
- `webhook.ts` voice path: download → `deps.transcribe` → `transcript`; ack adds `\n📝 ${transcript.slice(0,200)}` or `\n⏳ ждёт расшифровки (нет ключа распознавания)` when null.
- `route.ts` file proxy: `GET` → `downloadFile` → `Response(buf, { headers: { "content-type": mimeFromPath(path), "cache-control": "private, max-age=3600" } })`, 404 on null.

- [ ] **Step 1: Write failing tests**
```ts
// files.test.ts
it("resolves getFile path and builds the download url", ...)   // fake fetch: getFile → {ok:true,result:{file_path:"voice/1.oga",file_size:1000}}; expect fileUrl to end with "/voice/1.oga"
it("refuses files over 20 MB", ...)                              // file_size 25_000_000 → downloadFile null, second fetch not called
// transcribe.test.ts
it("returns null without OPENAI_API_KEY and never calls fetch", ...)
it("posts multipart with model + language=ru and returns text", ...)   // fake fetch asserts FormData has model, language; returns {text:" Привет "} → "Привет"
// telegram-webhook.test.ts additions
it("stores voice with transcript when a transcriber is injected", ...) // deps.transcribe → "расшифровка"; row.transcript === "расшифровка"; ack contains "📝"
it("stores voice with null transcript when transcription is unavailable", ...) // transcriber → null; ack contains "ждёт расшифровки"
```
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** `files.ts`, `transcribe.ts`, voice path, file proxy route. In `route.ts` of the webhook pass `deps = { transcribe: transcribeOpenAI, download: downloadFile }` (add `download` to deps type so tests inject a fake).
- [ ] **Step 4: Run** → PASS; `pnpm test` green
- [ ] **Step 5: Commit** `feat(telegram): file download + optional voice transcription`

---

### Task 4: Sorter agent (Claude, JSON) wired into intake

**Files:**
- Create: `apps/web/src/lib/claude/sorter.ts`
- Modify: `apps/web/src/lib/claude/voice.ts` (add `PILLAR_LABEL`, `TARGET_LABEL` maps used by UI and ack)
- Modify: `apps/web/src/lib/telegram/webhook.ts` (after insert: `sort` → update `tags`, `language`, `status="sorted"`; ack line `→ ${PILLAR_LABEL} · ${TARGET_LABEL} · ${summary}`)
- Test: `apps/web/tests/claude/sorter.test.ts`, extend `tests/api/telegram-webhook.test.ts`

**Interfaces:**
- `export type Sorter = (input: { text: string; kind: InboxKind }) => Promise<SortTags>`
- `export const SortTagsSchema` (zod) matching `SortTags`; `hooks` max 3 strings ≤ 90 chars; `summary` ≤ 140 chars (truncate, don't fail).
- `export function buildSorterPrompt(input): string` — includes the four pillars with one-line definitions from spec v2 §2 (influence = «Инфлюенс как перформанс», build = «Строю: Influencio, Grapzy, Social Board, Caram/Mersi», life = «Жизнь фаундера — с выводом предпринимателя», market = «Рынок и споры»), the six targets, the rule «личное без профессионального вывода → format story или tiktok_life, не reel», and «ответь только JSON без пояснений».
- `export async function sortInboxItem(input, client: ClientLike = anthropicClient()): Promise<SortTags>` — `max_tokens 400`; on any error or invalid JSON returns `NEUTRAL_TAGS = { pillar: null, format: null, kind: "idea", language: "ru", summary: input.text.slice(0,140), hooks: [] }`.
- `PILLAR_LABEL`: influence «Инфлюенс», build «Строю», life «Жизнь», market «Рынок»; `TARGET_LABEL`: reel «Reels», threads «Threads», carousel «Карусель», story «Сторис», tg «Telegram», tiktok_life «TikTok life».
- Export `anthropicClient` and `ClientLike` from a new `apps/web/src/lib/claude/client.ts` (move from `goal-comment.ts`, re-export there to keep imports stable).

- [ ] **Step 1: Write failing tests**
```ts
// sorter.test.ts (fakeClient as in goal-comment.test.ts)
it("parses a valid JSON answer into tags", ...)        // reply '{"pillar":"build","format":"reel","kind":"idea","language":"ru","summary":"Еду к команде в Сочи","hooks":["a","b"]}' → equals
it("strips a ```json fence and truncates summary to 140", ...)
it("falls back to neutral tags on malformed JSON or client error", ...)  // reply "не JSON" and reply Error → NEUTRAL_TAGS shape with summary = text.slice(0,140)
it("prompt names the four pillars and demands JSON only", ...)
// telegram-webhook.test.ts addition
it("sorts a text item and acks with pillar and target", ...)  // deps.sort → {pillar:"build",format:"reel",...}; row.status "sorted", row.tags.pillar "build"; ack contains "Строю" and "Reels"
```
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** `client.ts`, `sorter.ts`, labels, webhook wiring (sorter runs for kinds text/link/forward/voice-with-transcript/photo-with-caption; items without text stay `new`).
- [ ] **Step 4: Run** → PASS; `pnpm test` green
- [ ] **Step 5: Commit** `feat(claude): sorter agent for inbox items`

---

### Task 5: Inbox pages + manual add + archive

**Files:**
- Create: `apps/web/src/lib/queries/inbox.ts`
- Create: `apps/web/src/app/(dashboard)/inbox/page.tsx`, `apps/web/src/app/(dashboard)/inbox/[id]/page.tsx`, `apps/web/src/app/(dashboard)/inbox/actions.ts`
- Create: `apps/web/src/components/ui/TagChips.tsx` (pillar/target/kind chips using `PILLAR_LABEL`/`TARGET_LABEL`)
- Modify: `apps/web/src/lib/ui/nav.ts` (insert `{ href: "/inbox", label: "Входящие", ready: true }` first in «Работа»)
- Test: `apps/web/tests/queries/inbox.test.ts`, update `tests/ui/nav.test.ts` expectation if it counts items

**Interfaces:**
- `listInbox(db, f: { language?: "ru"|"en"; status?: InboxStatus | "open" }): Promise<InboxItem[]>` — `"open"` = `new|sorted`, newest first, limit 200.
- `getInboxItem(db, id): Promise<InboxItem | null>`
- actions: `addManualItemAction(formData: { text, mediaRef? })` → insert `source:"manual"`, kind `link` if only URL else `text`, then `sortInboxItem` → update; `archiveItemAction({id})`; `resortItemAction({id})`. All call `requireAllowedUser()` first; `revalidatePath("/inbox")`.
- Page `/inbox`: `PageHeader title="Входящие"` with segment (filter by `segmentLanguage`), status tabs «открытые / использованные / архив», list rows: kind glyph · created time (Chisinau) · summary or text (2 lines) · `TagChips` · buttons «Пакет» (link to `/drafts/new?inbox=<id>`, Task 6) · «В архив». Manual add form at top (textarea + «Добавить»). Photo items show `<img src="/api/telegram/file/<fileId>">` thumbnail 64px.
- Page `/inbox/[id]`: full text, transcript, mediaRef link, tags, hooks list, buttons «Пересортировать», «Сгенерировать пакет», «В архив».

- [ ] **Step 1: Write failing test** `tests/queries/inbox.test.ts`: `listInbox` returns open items newest first and filters language; `status:"archived"` returns only archived.
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** queries, actions, pages, chips, nav.
- [ ] **Step 4: Run** → PASS; `pnpm test` green; `pnpm lint` clean
- [ ] **Step 5: Commit** `feat(inbox): pages, manual add, archive`

---

### Task 6: Content voice + package generator + drafts creation

**Files:**
- Modify: `apps/web/src/lib/claude/voice.ts` (add `VADIM_CONTENT_SYSTEM`)
- Create: `apps/web/src/lib/claude/package.ts`
- Create: `apps/web/src/lib/drafts/create.ts`
- Test: `apps/web/tests/claude/package.test.ts`, `apps/web/tests/drafts/create.test.ts`

**Interfaces:**
- `VADIM_CONTENT_SYSTEM`: condensed «Голос Вадима» §3 (structure: bold statement first line → personal entry → specifics → one-phrase conclusion → question), lexicon list, stop-list verbatim («В современном мире», «Давайте разберёмся», «Итак», «Не секрет, что», «оставьте заявку», «менеджер свяжется», «осуществляется», «в рамках», «является», «данный», «более того», «запомните», «вы должны»), «Сторителлинг» §1 (hook ≤ 2–3 s, scene not thesis, dirty middle, lesson, ONE CTA), format specs from spec v2 §3, CTA policy: «единственные CTA — «пиши «ИССЛЕДОВАНИЕ»» или «подробнее в Telegram»; никаких консультаций и продаж», facts rule: «цифры и бренды только из исходника; нет цифры — пиши [?]», «без хештегов, ≤1 эмодзи».
- `package.ts`:
  - `export const PackageSchema` (zod): `{ reels: { title: string; hooks: string[] (3–5); script: string; cover: string }[] (length 4), threads: string[] (5), carousel: { title: string; slides: string[] (10); caption: string }, stories: string[] (3), tg: { title: string; text: string } }`
  - `export type GeneratedPackage = z.infer<typeof PackageSchema>`
  - `export function buildPackagePrompt(i: { sourceText: string; summary?: string; pillar?: string | null; language: "ru"|"en" }): string`
  - `export async function generatePackage(i, client = anthropicClient()): Promise<{ ok: true; pkg: GeneratedPackage } | { ok: false; error: string }>` — `max_tokens 8000`, strips ``` fences, zod-validates; never throws.
- `drafts/create.ts`: `export async function createDraftsFromPackage(db, pkg: GeneratedPackage, ctx: { inboxItemId: string | null; language: "ru"|"en"; telegramAccountId: string | null }): Promise<Draft[]>` — rows: 4 × `reel` (`body: {script, hooks, cover}`), 5 × `threads` (`{text}`), 1 × `carousel` (`{slides, caption}`), 3 × `story` (`{text}`), 1 × `tg` (`{text}`, `accountId = telegramAccountId`); all `status "draft"`; titles: reels from `title`, threads `Threads ${n}`, carousel its title, stories `Сторис ${n}`, tg its title. Runs in one transaction; marks inbox item `status "used"`.

- [ ] **Step 1: Write failing tests**
```ts
// package.test.ts
it("returns ok with a parsed package for a valid answer", ...)          // fixture JSON with 4/5/10/3/1 → ok true, pkg.reels.length 4
it("rejects a package with 3 reels and reports the error", ...)         // ok false, error mentions "reels"
it("prompt carries the source text, the CTA policy and the [?] rule", ...)  // contains sourceText, "ИССЛЕДОВАНИЕ", "[?]"; system contains "Давайте разберёмся" (stop list present)
it("returns ok:false (not throw) when the client throws", ...)
// drafts/create.test.ts
it("creates 14 drafts linked to the inbox item and marks it used", ...)  // counts by type: reel 4, threads 5, carousel 1, story 3, tg 1; tg.accountId === telegram account; inbox status "used"
```
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** voice system, `package.ts`, `create.ts`
- [ ] **Step 4: Run** → PASS; `pnpm test` green
- [ ] **Step 5: Commit** `feat(claude): package generator in Vadim's voice + drafts creation`

---

### Task 7: Drafts pages — list, detail/edit, statuses, «Сгенерировать пакет»

**Files:**
- Create: `apps/web/src/lib/queries/drafts.ts`
- Create: `apps/web/src/app/(dashboard)/drafts/page.tsx`, `drafts/new/page.tsx`, `drafts/[id]/page.tsx`, `drafts/actions.ts`
- Create: `apps/web/src/components/ui/StatusChip.tsx`, `apps/web/src/components/drafts/DraftEditor.tsx` (client; textareas per body shape)
- Modify: `apps/web/src/lib/ui/nav.ts` (`/drafts` → `ready: true`)
- Test: `apps/web/tests/queries/drafts.test.ts`, `apps/web/tests/drafts/actions.test.ts` (pure helpers only: `bodyFromForm`, `canTransition`)

**Interfaces:**
- `queries/drafts.ts`: `listDrafts(db, f: { language?: "ru"|"en"; status?: DraftStatus; type?: DraftType; inboxItemId?: string }): Promise<Draft[]>` (newest first); `getDraft(db, id)`.
- `drafts/actions.ts` (all `requireAllowedUser()` first):
  - `generatePackageAction(formData: { inboxId?: string; sourceText?: string; language })` → source = inbox item (`transcript ?? text`, plus `mediaRef` line) or free text → `generatePackage` → on `ok:false` redirect `/drafts/new?error=<msg>`; on ok `createDraftsFromPackage` (telegramAccountId = first `telegram` account with matching language) → `notifyAll("Пакет готов: 14 черновиков → ${APP_BASE_URL}/drafts?inbox=<id>")` → redirect `/drafts?inbox=<id>`.
  - `saveDraftAction({id, title, ...bodyFields})` — `export function bodyFromForm(type: DraftType, fd: FormData): DraftBody` (reel: `script`, `hooks` split by newline, `cover`; carousel: `slides` split by `\n---\n`, `caption`; others: `text`).
  - `setDraftStatusAction({id, status})` with `export function canTransition(from: DraftStatus, to: DraftStatus): boolean` — allowed: `idea→draft`, `draft→ready`, `ready→approved|rejected|draft`, `approved→draft|published` (published only via publish action, Task 9), `rejected→draft`; anything else false. On `ready`: Task 8 sends the approval card.
- `/drafts` page: `PageHeader title="Черновики"`; filters by status (tabs: все · черновик · на согласование · согласовано · опубликовано · отклонено) and type; rows: type glyph (`FORMAT_GLYPH`-like map for draft types), title, first 120 chars of text/script, `StatusChip`, created; «Новый пакет» button → `/drafts/new`.
- `/drafts/new`: textarea «Исходник» (prefilled from `?inbox=` item text/transcript), language radio, «Сгенерировать пакет» (form action; page `maxDuration = 300`), error banner from `?error=`.
- `/drafts/[id]`: `DraftEditor` (title + body fields by type, «Сохранить»), status buttons according to `canTransition`, link back to inbox item, for `tg` type the «Опубликовать в Telegram» button (Task 9), `publishedUrl` link when published.

- [ ] **Step 1: Write failing tests**: `listDrafts` filters by status/inbox; `bodyFromForm("reel")` splits hooks by newline; `bodyFromForm("carousel")` splits slides by `---`; `canTransition` table (positive 7 cases, negative: `draft→approved`, `published→*`, `approved→ready`).
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** queries, actions, pages, editor, nav flag.
- [ ] **Step 4: Run** → PASS; `pnpm test` green; `pnpm lint` clean
- [ ] **Step 5: Commit** `feat(drafts): list/edit/status pages + package generation action`

---

### Task 8: Approval from the bot — card on `ready`, callbacks `approve|reject|publish`

**Files:**
- Create: `apps/web/src/lib/drafts/approval.ts`
- Modify: `apps/web/src/lib/telegram/webhook.ts` (callback branch), `apps/web/src/app/(dashboard)/drafts/actions.ts` (on `ready` → `sendApprovalCard`)
- Test: `apps/web/tests/drafts/approval.test.ts`, extend `tests/api/telegram-webhook.test.ts`

**Interfaces:**
- `approval.ts`:
  - `export function approvalCardText(d: Draft): string` → `📝 На согласование · ${TYPE_LABEL[d.type]}\n<b>${escapeHtml(d.title)}</b>\n\n${escapeHtml(preview(d.body, 700))}\n\n${APP_BASE_URL}/drafts/${d.id}`
  - `export function approvalKeyboard(d: Draft): { inline_keyboard: { text: string; callback_data: string }[][] }` → row 1 `[✅ Согласовать → approve:<id>] [✖ Отклонить → reject:<id>]`; after approval for `tg` type: `[🚀 Опубликовать сейчас → publish:<id>]`.
  - `export async function sendApprovalCard(d: Draft, send = sendBotMessage): Promise<NotifyResult>` → to every `reportChatIds()` with `parseMode: "HTML"` and the keyboard.
  - `export function parseCallback(data: string): { op: "approve"|"reject"|"publish"; draftId: string } | null` (uuid check).
  - `export async function applyCallback(db, cb: CallbackInput, deps: { publish?: Publisher; answer?: (callbackId: string, text: string) => Promise<void>; edit?: (chatId: string, messageId: number, text: string, markup?: unknown) => Promise<void> }): Promise<{ result: "approved"|"rejected"|"published"|"noop"|"error"; message: string }>` — `approve`: UPDATE … SET status='approved', approved_at=now WHERE id AND status='ready' → if 0 rows → `noop` «уже обработано»; then edit the card text appending `\n\n✅ Согласовано` with keyboard `[🚀 Опубликовать сейчас]` for `tg`, none otherwise. `reject` → `rejected`. `publish` → `deps.publish(db, id)` (Task 9) → edits card with the published url or the error.
- `webhook.ts` callback branch: allowlist chat → `applyCallback` → `answerCallbackQuery` via `deps.answer` (Bot API `answerCallbackQuery` added to `notify.ts` as `answerCallback(callbackId, text)` and `editMessageText(chatId, messageId, text, replyMarkup?)`).

- [ ] **Step 1: Write failing tests**
```ts
// approval.test.ts
it("builds an HTML card with title, preview and the dashboard link", ...)    // escapes "<" in title
it("keyboard has approve/reject for ready and publish-now for approved tg", ...)
it("parseCallback accepts approve:<uuid> and rejects garbage", ...)
it("approve moves ready→approved once; second approve is a noop", ...)       // db
it("reject moves ready→rejected", ...)
it("publish calls the injected publisher only when status is approved", ...) // approved → publisher called; draft status draft → noop, not called
// telegram-webhook.test.ts addition
it("handles a callback from an allowed chat and answers it", ...)             // deps.answer called with callbackId; draft approved
it("ignores callbacks from other chats", ...)
```
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** `approval.ts`, notify helpers, webhook branch, send card on `ready` in `setDraftStatusAction`.
- [ ] **Step 4: Run** → PASS; `pnpm test` green
- [ ] **Step 5: Commit** `feat(approval): bot cards with approve/reject/publish callbacks`

---

### Task 9: Telegram publishing (channel) + dashboard button + bot settings section

**Files:**
- Create: `apps/web/src/lib/publish/telegram.ts`
- Create: `apps/web/src/lib/telegram/admin.ts` (`setWebhook`, `getWebhookInfo`, `getChatMember` wrappers over fetch)
- Modify: `apps/web/src/app/(dashboard)/drafts/actions.ts` (`publishDraftAction`), `drafts/[id]/page.tsx` (button)
- Modify: `apps/web/src/app/(dashboard)/settings/accounts/page.tsx` + `actions.ts` (section «Telegram-бот»: webhook url/status, «Подключить вебхук», «Проверить права в канале» → `getChatMember(@handle, botId)` → shows `administrator`/`can_post_messages`)
- Test: `apps/web/tests/publish/telegram.test.ts`, `apps/web/tests/telegram/admin.test.ts`

**Interfaces:**
- `publish/telegram.ts`:
  - `export type Publisher = (db, draftId: string) => Promise<{ ok: true; url: string } | { ok: false; error: string }>`
  - `export function renderTelegramHtml(body: { text: string }): string` — first line wrapped in `<b>…</b>` (Vadim's bold headline), rest escaped (`& < >`), paragraphs preserved.
  - `export function makeTelegramPublisher(f: typeof fetch = fetch): Publisher` — load draft (type must be `tg`, status `approved`, `accountId` set) → account handle → `sendMessage({ chat_id: "@"+handle, text: renderTelegramHtml(body), parse_mode: "HTML", disable_web_page_preview: false })` → on ok: UPDATE drafts SET status='published', published_at, published_url=`https://t.me/${handle}/${message_id}` WHERE id AND status='approved' → `{ok:true,url}`; on Telegram error: UPDATE publish_error=<description> (status stays approved) → `{ok:false,error}`. Text over 4096 chars → `{ok:false,error:"длиннее 4096 символов"}` without calling Telegram.
- `telegram/admin.ts`: `setWebhook(url, secretToken, f)`, `getWebhookInfo(f)` → `{url, pendingUpdateCount, lastErrorMessage}`, `botId()` from token prefix before `:`, `getChatMember(chat: string, userId: number, f)` → `{status, canPost: boolean}`.
- Settings actions: `connectWebhookAction()` → `setWebhook(`${APP_BASE_URL}/api/telegram/webhook`, webhookSecret())` with `allowed_updates: ["message","callback_query"]`; `checkChannelAction({accountId})`.

- [ ] **Step 1: Write failing tests**
```ts
// publish/telegram.test.ts
it("renders the first line bold and escapes html", ...)                      // "Заголовок <x>\nтекст & ещё" → "<b>Заголовок &lt;x&gt;</b>\nтекст &amp; ещё"
it("publishes an approved tg draft to @handle and stores url/status once", ...) // fake fetch returns {ok:true,result:{message_id:42}} → url https://t.me/vadimbordian/42, status published; second call → ok:false "уже опубликовано" and fetch called once
it("keeps status approved and records publish_error on Telegram failure", ...)
it("refuses non-approved or non-tg drafts without calling Telegram", ...)
it("refuses texts over 4096 chars", ...)
// telegram/admin.test.ts
it("setWebhook posts url, secret_token and allowed_updates", ...)
it("getChatMember reports canPost for administrator with can_post_messages", ...)
```
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** publisher, admin wrappers, actions, UI button + settings section; wire `makeTelegramPublisher()` into Task 8's `applyCallback` deps in the webhook route.
- [ ] **Step 4: Run** → PASS; `pnpm test` green; `pnpm lint`
- [ ] **Step 5: Commit** `feat(publish): Telegram channel publishing after approval + bot settings`

---

### Task 10: Visual check, docs, deploy notes

**Files:**
- Modify: `apps/web/scripts/dev-db.mjs` (seed 3 inbox items + a 14-draft package so `/inbox`, `/drafts`, `/drafts/[id]` render)
- Modify: `/home/claude/brand/out/14_…деплой, чек-лист…md` → section «9. Контент-завод: бот» (steps: add bot as channel admin with «Публикация сообщений»; Settings → «Подключить вебхук»; optional `OPENAI_API_KEY`; test: send «тест» to bot → appears in /inbox); project_write the doc.
- No new tests (visual only).

- [ ] **Step 1: Build + start harness** (`next build && next start` as in Day 1), screenshot `/inbox`, `/drafts`, `/drafts/<id>` light + dark with `scripts/shot.mjs`; fix layout defects found.
- [ ] **Step 2: `pnpm test` → all green; `pnpm lint` clean; `pnpm build` ok; delete generated `AGENTS.md`**
- [ ] **Step 3: Apply `0006_factory.sql` to Supabase via MCP `apply_migration`** (name `factory`); verify `select count(*) from inbox_items` works through MCP.
- [ ] **Step 4: Commit** `chore: factory seed for visual harness + deploy notes`, then superpowers:finishing-a-development-branch (merge `stage-2-day2` → `main`, push).
