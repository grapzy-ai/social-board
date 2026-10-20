# Social Board — Stage 2, Day 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the stage-1 skeleton into the stage-2 shell: RU/EN segment switch, left sidebar, light/dark theme (light default), dataviz-grade Overview and Posts, "Обновить" and "Поделиться" (share card 1:1 and 9:16), manual LinkedIn metrics.

**Architecture:** Two cookies (`sb_segment`, `sb_theme`) resolved by pure helpers on the server; every query takes an optional `language` filter derived from the segment. Theme = CSS custom properties on `:root[data-theme]`, exposed to Tailwind v4 via `@theme inline` so components use semantic classes (`bg-surface`, `text-muted`, `border-line`). Share card = `next/og` `ImageResponse` rendered from a pure `computeShare()` result with Inter (cyrillic+latin woff) embedded.

**Tech Stack:** Next.js 16 (App Router, server actions, `next/og`), Tailwind 4 `@theme inline`, Recharts 3, Drizzle + pglite tests (vitest), `@fontsource/inter` for Satori fonts.

**Spec:** `docs/superpowers/specs/2026-10-20-social-board-stage2.md` (copy of «Спека — Social Board, этап 2»), sections 1, 2 (Обзор, Посты, Настройки), 3 (LinkedIn), 4 (День 1).

## Global Constraints

- Language: UI copy in Russian; code identifiers English.
- Default theme **light**; default segment **ru**; segments never mix in one card/row except in the explicit «Все» view.
- Palette: 6 categorical colors `#3987e5,#d95926,#199e70,#c98500,#d55181,#9085e9` (validated light+dark by `dataviz/scripts/validate_palette.js`; `#c98500` has contrast WARN → direct labels are mandatory wherever it is used). Color follows the account; never the rank. Max 6 series per chart; «Все» may collide on color → direct labels + language chip disambiguate.
- Charts: one axis, 2px lines, no legend when ≤4 series (direct end-labels instead), grid recessive, tooltip on hover.
- No brand logos drawn: platforms shown as colored dot + name (share card too).
- Nothing publishes anywhere; nothing in this plan writes to social networks.
- Secrets never logged or rendered.
- Tests: `pnpm -F web exec vitest run` must stay green; `pnpm -F web exec tsc --noEmit -p .` and `pnpm -F web exec next build` clean before the final commit.

## Review Focus

1. Garbage or missing cookie values (`sb_segment=xx`, `sb_theme=`) → defaults `ru` / `light`, never a crash. (Task 1, Task 3 tests.)
2. Segment with zero accounts (EN today) → Overview/Posts render empty states; `/api/share` returns 200 with an honest "нет данных" card, not 500. (Task 3, Task 9 tests.)
3. Gaps in `account_metrics_daily` (worker missed a day) → sparkline and growth series carry `null`, cumulative sum skips, no NaN. (Task 6 test.)
4. Custom period with `from > to`, or a single day → swapped / `days=1`, percent growth shows `—` instead of `Infinity`. (Task 3, Task 9 tests.)
5. Manual LinkedIn entry for a date that already exists → upsert, both `manual_metrics` and `account_metrics_daily` reflect the latest value. (Task 11 test.)

---

### Task 1: Theme tokens, cookie, toggle

**Files:**
- Create: `apps/web/src/lib/ui/theme.ts`, `apps/web/src/components/ui/ThemeToggle.tsx`, `apps/web/src/app/actions/prefs.ts`
- Modify: `apps/web/src/app/globals.css`, `apps/web/src/app/layout.tsx`
- Test: `apps/web/tests/ui/theme.test.ts`

**Interfaces:**
- Produces: `type Theme = "light" | "dark" | "system"`; `THEME_COOKIE = "sb_theme"`; `resolveTheme(raw: string | undefined): Theme` (default `"light"`); `htmlThemeAttr(t: Theme): string | undefined` (`"system"` → `undefined`, else `t`); server action `setThemeAction(formData)` writes cookie (1 year, `sameSite: "lax"`) and `revalidatePath("/", "layout")`.
- CSS tokens on `:root[data-theme="light"]`, `:root[data-theme="dark"]`, and `@media (prefers-color-scheme: dark) :root:not([data-theme])`: `--surface`, `--card`, `--line`, `--fg`, `--muted`, `--accent` (`#ff2bd6`), `--accent-fg` (`#000` dark / `#fff` light), `--good` (`#199e70`), `--bad` (`#d95926`). Light: surface `#fcfcfb`, card `#ffffff`, line `#e7e7ea`, fg `#0b0b0c`, muted `#6b7280`. Dark: surface `#0b0b0c`, card `#141416`, line `#1f1f23`, fg `#ffffff`, muted `#9ca3af`.
- Tailwind: `@theme inline { --color-surface: var(--surface); --color-card: var(--card); --color-line: var(--line); --color-fg: var(--fg); --color-muted: var(--muted); --color-accent: var(--accent); --color-accent-fg: var(--accent-fg); --color-good: var(--good); --color-bad: var(--bad); }` → classes `bg-surface`, `bg-card`, `border-line`, `text-fg`, `text-muted`, `bg-accent`, `text-accent-fg`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/ui/theme.test.ts
import { describe, it, expect } from "vitest";
import { resolveTheme, htmlThemeAttr } from "@/lib/ui/theme";
describe("theme", () => {
  it("defaults to light for missing or garbage cookie", () => {
    expect(resolveTheme(undefined)).toBe("light");
    expect(resolveTheme("")).toBe("light");
    expect(resolveTheme("neon")).toBe("light");
  });
  it("accepts light/dark/system and maps system to no attribute", () => {
    expect(resolveTheme("dark")).toBe("dark");
    expect(htmlThemeAttr("system")).toBeUndefined();
    expect(htmlThemeAttr("dark")).toBe("dark");
  });
});
```

- [ ] **Step 2: Run** `pnpm exec vitest run tests/ui/theme` → FAIL (module not found)
- [ ] **Step 3: Implement** `src/lib/ui/theme.ts` per Interfaces; `setThemeAction` in `src/app/actions/prefs.ts` (`"use server"`, `requireAllowedUser()` first, `cookies().set(THEME_COOKIE, resolveTheme(formData.get("theme")), {maxAge: 31536000, sameSite: "lax", path: "/"})`); `ThemeToggle.tsx` = three-button segmented control (☀ / ☾ / авто) posting to the action; `layout.tsx` reads cookie → `<html lang="ru" data-theme={htmlThemeAttr(theme)}>`, remove `className="dark"`; rewrite `globals.css` tokens + `@theme inline` + `.card` using `bg-card border-line`, `.vb-badge` using accent tokens, `body { background: var(--surface); color: var(--fg) }`.
- [ ] **Step 4: Run** `pnpm exec vitest run tests/ui/theme` → PASS
- [ ] **Step 5: Replace hardcoded colors** in `(auth)/login/page.tsx`, `(dashboard)/layout.tsx`, `(dashboard)/page.tsx`, `posts/page.tsx`, `posts/[id]/page.tsx`, `settings/accounts/page.tsx`, `components/ui/*.tsx`: `neutral-900/800` borders → `border-line`, `bg-neutral-900` → `bg-card`, `text-neutral-400/500` → `text-muted`, `text-white` → `text-fg`, `bg-[var(--accent)]` → `bg-accent text-accent-fg`, `bg-neutral-100 text-black` (active chip) → `bg-fg text-surface`. Verify with `grep -rn "neutral-" src | wc -l` → `0`.
- [ ] **Step 6:** `pnpm exec tsc --noEmit -p . && pnpm exec next build` → clean
- [ ] **Step 7: Commit** `feat(ui): light/dark theme tokens, cookie and toggle (light default)`

---

### Task 2: Palette and platform slots per segment

**Files:**
- Modify: `apps/web/src/lib/ui/platform.ts`
- Test: `apps/web/tests/ui/platform.test.ts`

**Interfaces:**
- Produces: `PLATFORM_LABEL` extended with `x: "X"`; `SEGMENT_SLOTS: Record<"ru"|"en", Partial<Record<Platform, number>>>` — ru: `telegram 0, threads 1, tiktok 2, instagram 4, youtube 5, vk 3`; en: `instagram 4, threads 1, x 0, linkedin 3, tiktok 2, youtube 5`; `accountColor(platform: Platform, language: "ru"|"en", indexWithinPlatform = 0): string` (slot from the language map, fallback `PLATFORM_SLOT`, `+3*index mod 6`); `platformDot(platform, language)` not needed — callers use `accountColor`.
- Schema note: `PLATFORMS` gains `"x"` (Task 2 edits `schema.ts` enum + `0006_platform_x.sql` is NOT needed: `platform` is `text`, no CHECK).

- [ ] **Step 1: Write the failing test**

```ts
// tests/ui/platform.test.ts
import { describe, it, expect } from "vitest";
import { accountColor, SERIES_COLORS, PLATFORM_LABEL } from "@/lib/ui/platform";
describe("platform colors", () => {
  it("gives every RU platform a distinct color and every EN platform a distinct color", () => {
    const ru = ["telegram","threads","tiktok","instagram","youtube","vk"] as const;
    const en = ["instagram","threads","x","linkedin","tiktok","youtube"] as const;
    expect(new Set(ru.map((p) => accountColor(p, "ru"))).size).toBe(6);
    expect(new Set(en.map((p) => accountColor(p, "en"))).size).toBe(6);
  });
  it("keeps the same platform the same color in both segments where it exists", () => {
    expect(accountColor("instagram", "ru")).toBe(accountColor("instagram", "en"));
    expect(accountColor("threads", "ru")).toBe(accountColor("threads", "en"));
  });
  it("palette has exactly 6 validated colors and labels X", () => {
    expect(SERIES_COLORS).toHaveLength(6);
    expect(PLATFORM_LABEL.x).toBe("X");
  });
});
```

- [ ] **Step 2: Run** → FAIL (`x` missing / signature)
- [ ] **Step 3: Implement**; add `"x"` to `PLATFORMS` in `schema.ts`; update the two existing callers of `accountColor` (overview page) to the new signature.
- [ ] **Step 4: Run** `pnpm exec vitest run tests/ui/platform tests/db` → PASS
- [ ] **Step 5: Validate palette** (record both outputs in the commit body):
  `node /tmp/claude-0/bundled-skills/2.1.303/de16c103aa7fc6b21c103c8158179ac5/dataviz/scripts/validate_palette.js "#3987e5,#d95926,#199e70,#c98500,#d55181,#9085e9" --mode light` → ALL CHECKS PASS (1 WARN contrast `#c98500`); same with `--mode dark` → PASS.
- [ ] **Step 6: Commit** `feat(ui): per-segment platform color slots; X platform`

---

### Task 3: Segment (RU / EN / Все) and period resolution

**Files:**
- Create: `apps/web/src/lib/ui/segment.ts`, `apps/web/src/lib/ui/period.ts`, `apps/web/src/components/ui/SegmentSwitch.tsx`
- Modify: `apps/web/src/app/actions/prefs.ts`, `apps/web/src/lib/queries/overview.ts`, `apps/web/src/lib/queries/posts.ts` (no change needed — already filters `language`), `apps/web/src/app/(dashboard)/page.tsx`, `posts/page.tsx`, `settings/accounts/page.tsx`
- Test: `apps/web/tests/ui/segment.test.ts`, `apps/web/tests/ui/period.test.ts`, `apps/web/tests/queries/overview.test.ts` (extend)

**Interfaces:**
- Produces: `type Segment = "ru" | "en" | "all"`; `SEGMENT_COOKIE = "sb_segment"`; `resolveSegment(raw): Segment` (default `"ru"`); `segmentLanguage(s: Segment): "ru" | "en" | undefined`; `setSegmentAction(formData)`.
- `type PeriodSpec = { days: number; from: string; to: string; preset: 7|14|30|90|null }`; `resolvePeriod(sp: {period?: string; from?: string; to?: string}, today: string): PeriodSpec` — preset wins when valid; custom `from/to` (YYYY-MM-DD) swapped if reversed, clamped to `to ≤ today`, `days = diff+1` (min 1); default preset 30.
- `getOverview(db, spec: PeriodSpec, now?: Date, language?: "ru"|"en")` — replaces `(db, period, now)`; `Overview.period` becomes `PeriodSpec`.

- [ ] **Step 1: Write failing tests**

```ts
// tests/ui/segment.test.ts
expect(resolveSegment(undefined)).toBe("ru"); expect(resolveSegment("xx")).toBe("ru");
expect(segmentLanguage("all")).toBeUndefined(); expect(segmentLanguage("en")).toBe("en");
// tests/ui/period.test.ts
const T = "2026-10-20";
expect(resolvePeriod({}, T)).toMatchObject({ days: 30, preset: 30, to: T, from: "2026-09-21" });
expect(resolvePeriod({ period: "14" }, T).preset).toBe(14);
expect(resolvePeriod({ from: "2026-10-18", to: "2026-10-10" }, T)).toMatchObject({ from: "2026-10-10", to: "2026-10-18", days: 9, preset: null });
expect(resolvePeriod({ from: "2026-10-20", to: "2026-10-20" }, T).days).toBe(1);
expect(resolvePeriod({ from: "bad", to: "2026-10-20" }, T).preset).toBe(30);
// tests/queries/overview.test.ts — add:
it("filters accounts by language when a segment is set and returns empty for a segment without accounts", ...)
// insert telegram(ru) + instagram(en) accounts with one daily row each; getOverview(db, spec, now, "ru").accounts → 1 telegram; (…,"en") → 1 instagram; after deleting the en account → accounts [] and growth [].
```

- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** helpers, action, `SegmentSwitch` (three chips RU · EN · Все, posts action, current from cookie), thread `language` into `getOverview` (`accounts` query `where(eq(accounts.language, language))` when set) and into the pages (`segmentLanguage(resolveSegment(cookie))`); settings table gets a «Сегмент» column (RU/EN chip) and is filtered the same way; posts page passes `language` from the segment instead of `sp.lang` (keep `sp.lang` override for «Все»).
- [ ] **Step 4: Run** `pnpm exec vitest run` → all PASS
- [ ] **Step 5: Commit** `feat: RU/EN/all segment cookie and period resolver; overview filtered by segment`

---

### Task 4: App shell — sidebar + top bar

**Files:**
- Create: `apps/web/src/lib/ui/nav.ts`, `apps/web/src/components/shell/Sidebar.tsx`, `apps/web/src/components/shell/TopBar.tsx`, `apps/web/src/components/ui/PeriodPicker.tsx`
- Modify: `apps/web/src/app/(dashboard)/layout.tsx`
- Test: `apps/web/tests/ui/nav.test.ts`

**Interfaces:**
- Produces: `NAV_SECTIONS: Array<{title: string; items: Array<{href: string; label: string; ready: boolean}>}>` — «Аналитика»: Обзор `/`, Посты `/posts`, Аудитория `/audience` (ready false), Источники `/sources` (false), Люди `/people` (false); «Работа»: Ответы `/replies` (false), Сигналы `/signals` (false), Черновики `/drafts` (false), Расписание `/schedule` (false), Челленджи `/challenges` (false); «Управление»: Цели `/goals` (false), Поделиться `/share` (true, Task 10), Настройки `/settings/accounts` (true). `isActive(pathname: string, href: string): boolean` — exact for `/`, prefix otherwise.
- `PeriodPicker` props `{spec: PeriodSpec; basePath: string}` → links `?period=7|14|30|90` + a `<details>` with two date inputs submitting `from/to` via GET.
- `TopBar` props `{segment: Segment; spec: PeriodSpec; theme: Theme; email: string | null; basePath: string; actions?: React.ReactNode}` → left: page title slot; right: SegmentSwitch · PeriodPicker · `actions` (Refresh/Share buttons from pages) · ThemeToggle · email/выйти.
- Layout: `grid grid-cols-[220px_1fr] min-h-screen`; sidebar sticky; items with `ready:false` rendered muted with chip «скоро», not links.

- [ ] **Step 1: Write failing test** `tests/ui/nav.test.ts`: `isActive("/", "/")` true; `isActive("/posts/abc", "/posts")` true; `isActive("/posts", "/")` false; `NAV_SECTIONS.flatMap(s=>s.items).filter(i=>i.ready).map(i=>i.href)` equals `["/", "/posts", "/share", "/settings/accounts"]`.
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** `nav.ts`, `Sidebar` (server component; uses `headers()` `x-pathname`? — no: make `Sidebar` a client component using `usePathname()`), `TopBar`, `PeriodPicker`; rewrite `(dashboard)/layout.tsx` to the grid shell; pages pass their title/actions via a tiny context? **Decision:** keep it simple — `TopBar` is rendered by each page (Overview, Posts, Share, Settings) under a shared `PageHeader` helper `renderTopBar({title, spec, actions})` in `components/shell/PageHeader.tsx` that reads cookies itself. Layout renders only sidebar + `<main>`.
- [ ] **Step 4: Run** `pnpm exec vitest run tests/ui` → PASS; `pnpm exec next build` → clean
- [ ] **Step 5: Commit** `feat(shell): left sidebar with sections, top bar with segment/period/theme`

---

### Task 5: «Обновить» — sync the segment on demand

**Files:**
- Create: `apps/web/src/lib/sync/segment.ts`, `apps/web/src/components/ui/RefreshButton.tsx`
- Modify: `apps/web/src/app/(dashboard)/settings/accounts/actions.ts` (add `syncSegmentAction`)
- Test: `apps/web/tests/sync/segment.test.ts`

**Interfaces:**
- Produces: `syncSegment(db: AnyDb, language: "ru"|"en"|undefined, opts?: {now?: Date; runner?: typeof runSync}): Promise<{results: SyncResult[]; skipped: Array<{accountId: string; platform: Platform; reason: "worker" | "paused" | "no_api"}>}>` — targets `status = active` and `platform in (threads, instagram)`; telegram → skipped `"worker"`; paused → `"paused"`; others → `"no_api"`.
- `syncSegmentAction(formData)` → `requireAllowedUser()`, reads segment cookie, calls `syncSegment`, `revalidatePath("/")`, `revalidatePath("/posts")`, redirects back to `formData.get("back") ?? "/"` with `?refreshed=<ok>/<total>`.
- `RefreshButton` props `{back: string}` — form button «Обновить», `useFormStatus` spinner text «Обновляю…».

- [ ] **Step 1: Write failing test** (pglite): insert telegram(ru, active), instagram(ru, active, token), threads(en, active), instagram(ru, paused). With `runner` stub returning `{status:"ok"}`: `syncSegment(db,"ru",{runner})` → `results.length 1` (the active ru instagram), skipped contains telegram `"worker"` and paused instagram `"paused"`; `syncSegment(db, undefined, {runner})` → results 2.
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement**; wire `RefreshButton` into Overview and Posts top bar `actions`; show `sp.refreshed` as a muted toast line under the header.
- [ ] **Step 4: Run** `pnpm exec vitest run tests/sync` → PASS
- [ ] **Step 5: Commit** `feat: Refresh button syncs the current segment's API accounts`

---

### Task 6: Overview data — sparkline, top/anti-top, signals feed

**Files:**
- Modify: `apps/web/src/lib/queries/overview.ts`
- Test: `apps/web/tests/queries/overview.test.ts`

**Interfaces:**
- `AccountCard` gains `spark: Array<number | null>` (cumulative follower delta per calendar day for the last 7 days ending `spec.to`, `null` where no row), `pace: { needPerDay: number | null; actualPerDay7: number | null; forecastEnd: number | null } | null` (null when no goal).
- `Overview` gains `top: PostBrief[]` and `bottom: PostBrief[]` (≤3 each, by `multiplier` desc/asc among posts published inside the period with non-null multiplier) where `PostBrief = { id; platform; language; text: string | null; multiplier: number; views: number | null }`, and `signals: Array<{ id; type; createdAt; handle: string | null }>` (latest 5 with status `new`, in-segment accounts only).
- `pace`: `needPerDay = (target - followers) / daysLeftInMonth` (daysLeft ≥ 1), `actualPerDay7 = (followers - followers 7 days ago)/7` when both exist, `forecastEnd = followers + actualPerDay7 * daysLeft`.

- [ ] **Step 1: Write failing tests**: (a) daily rows for days −6..0 with a gap at −3 → `spark` length 7, index 3 is `null`, last value = total delta; (b) goal 400, followers 345, 11 days left, 7-day delta +14 → `pace.needPerDay` 5, `actualPerDay7` 2, `forecastEnd` 367; (c) three posts with multipliers 3.2, 0.4, 1.0 inside period and one outside → `top[0].multiplier 3.2`, `bottom[0].multiplier 0.4`, outside excluded; (d) two `new` signals for a ru account and one for an en account → `signals` under `"ru"` has 2.
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** in `getOverview` (reuse `pickMultiplierSnapshot` + `latestBenchmarks` for `top/bottom`).
- [ ] **Step 4: Run** `pnpm exec vitest run tests/queries` → PASS
- [ ] **Step 5: Commit** `feat(overview): sparkline, goal pace, top/anti-top posts, signals feed`

---

### Task 7: Overview UI + GrowthChart redesign

**Files:**
- Create: `apps/web/src/components/charts/Sparkline.tsx`, `apps/web/src/components/ui/PlatformChip.tsx`, `apps/web/src/components/ui/Delta.tsx`
- Modify: `apps/web/src/app/(dashboard)/page.tsx`, `apps/web/src/components/charts/GrowthChart.tsx`
- Test: build + visual check (screenshot in both themes); `tests/ui/platform.test.ts` already covers colors.

**Interfaces:**
- `Sparkline` props `{values: Array<number|null>; color: string; width?: number (default 96); height?: number (default 28)}` — pure SVG polyline, skips nulls, 2px stroke, last point 3px dot.
- `PlatformChip` props `{platform; language; handle?: string; color: string}` → dot + label (+ «EN» chip when `language === "en"` and the segment is «Все» — pass `showLang: boolean`).
- `Delta` props `{value: number | null; suffix?: string}` → `+12` in `text-good`, `−3` in `text-bad`, `—` muted; tabular-nums.
- `GrowthChart` props unchanged shape; behaviour: `Legend` only when `series.length > 4`; otherwise a custom `<Label>` at the last non-null point of each line with the series label in its color; `strokeWidth 2`; grid `var(--line)`; ticks `var(--muted)`; tooltip background `var(--card)`; theme-aware via CSS vars (no hardcoded hex); X axis every date formatted `dd.MM`, `minTickGap 32`.
- Page layout: header (TopBar with Refresh + «Поделиться» link); cards grid `md:grid-cols-2 xl:grid-cols-3`: card = PlatformChip · followers (3xl) · Sparkline · deltas row (вчера/сегодня/за период) · goal bar + pace line («нужно +5/день · идёшь +2/день · прогноз 367») · Claude comment; then Growth chart; then two-column: «Топ периода» / «Мимо» lists (text 2 lines, multiplier badge, views) and «Сигналы» list.

- [ ] **Step 1:** implement components and page; **Step 2:** `pnpm exec tsc --noEmit -p . && pnpm exec next build` → clean; **Step 3:** `pnpm exec next start -p 3100` with a `.env.local` pointing at… (no DB locally) → **skip runtime**, rely on Vercel preview after push; **Step 4: Commit** `feat(overview): redesigned cards with sparklines and pace, direct-labelled growth chart`

---

### Task 8: Posts UI redesign

**Files:**
- Modify: `apps/web/src/app/(dashboard)/posts/page.tsx`, `apps/web/src/app/(dashboard)/posts/[id]/page.tsx`
- Test: build + visual.

- [ ] **Step 1:** table row = 40×40 thumbnail (`mediaUrl` → `<img>` with `object-cover rounded`, fallback a format glyph square), `PlatformChip` (dot+name, EN chip in «Все»), format as muted chip, date `dd.MM`, text 2 lines, views, `Multiplier` badge (`≥2` good tint, `≤0.5` bad tint, young post `<11d` muted with «д7» suffix), comments, saves, `LabelButtons`. Filters row uses `bg-fg text-surface` active chips. Top bar with segment/period; period filters `from/to` on `listPosts`.
- [ ] **Step 2:** `[id]` page: header with PlatformChip, permalink button, media preview (image or video poster), snapshot table + small `GrowthChart`-like line of views by dayIndex (reuse `Sparkline` at 320×80).
- [ ] **Step 3:** build clean; **Step 4: Commit** `feat(posts): thumbnails, chips, period filter, theme tokens`

---

### Task 9: Share stats (pure + query)

**Files:**
- Create: `apps/web/src/lib/share/compute.ts`, `apps/web/src/lib/share/query.ts`
- Test: `apps/web/tests/share/compute.test.ts`, `apps/web/tests/share/query.test.ts`

**Interfaces:**
- `type ShareInput = { accounts: Array<{id; platform; language; handle}>; daily: Array<{accountId; date; followers: number | null}>; views: Array<{accountId; views: number}>; from: string; to: string }`
- `computeShare(i: ShareInput): ShareStats` where `ShareStats = { from; to; days: number; totalDelta: number | null; totalPct: number | null; totalViews: number; perPlatform: Array<{platform; language; handle; delta: number | null; pct: number | null; color: string}>; series: Array<{date: string; stacked: number[]}> (cumulative delta per account in `perPlatform` order, stacked = running sums for area fill), hasData: boolean }`. Rules: delta = last followers in range − first followers in range (per account, `null` if <2 rows); pct = delta / first × 100 rounded 1dp, `null` when first is 0/null; totals sum non-null; `hasData` false when no account has ≥2 rows.
- `getShareStats(db, language, spec): Promise<ShareStats & {handle: string}>` — `handle` = `"vadimbordian"` for ru, `"vadim.bordian"` for en, «Все» → `"vadim.bordian"`; views = sum of latest-snapshot views of posts published in range.

- [ ] **Step 1: Write failing tests**: (a) two accounts, 5 days, one with a gap → deltas correct, `series` length 5, `stacked[1] = acc1+acc2`; (b) single-day range → `pct null`, `delta null`, `hasData false`; (c) first followers 0 → `pct null`; (d) query test on pglite: ru-only filter excludes en account.
- [ ] **Step 2: Run** → FAIL; **Step 3: Implement**; **Step 4: Run** → PASS; **Step 5: Commit** `feat(share): share statistics computed per segment and period`

---

### Task 10: Share card image + /share page

**Files:**
- Create: `apps/web/src/app/api/share/route.tsx`, `apps/web/src/lib/share/card.tsx`, `apps/web/src/app/(dashboard)/share/page.tsx`
- Modify: `apps/web/package.json` (add `@fontsource/inter`)
- Test: `apps/web/tests/share/route.test.ts`

**Interfaces:**
- `pnpm add @fontsource/inter`; fonts read at request time: `node_modules/@fontsource/inter/files/inter-cyrillic-{400,700}-normal.woff` and `inter-latin-{400,700}-normal.woff` via `fs.readFile` + `path.join(process.cwd(), "node_modules", …)` (works on Vercel because the files are traced; add `outputFileTracingIncludes: { "/api/share": ["./node_modules/@fontsource/inter/files/inter-*-{400,700}-normal.woff"] }` in `next.config.ts`).
- `shareCard(stats: ShareStats & {handle}, opts: {format: "square"|"story"; theme: "light"|"dark"}): React.ReactElement` — pure JSX for Satori (flex only). Layout: top row `VB` badge + `@handle` left, `from — to` right, year chip `2026`; big `+N` (or `—`) in 160px/700 weight; line «новых подписчиков за N дней»; two chips «↗ +X% к аудитории» (good color) and «N просмотров»; stacked area chart drawn as SVG `<path>`s from `series.stacked` (fill = color at 28% opacity, 2px stroke, no gradients, no glow); bottom row: one column per platform: dot + name, `+N`, `+X%`. Square 1080×1080, story 1080×1920 (same blocks, chart taller, bottom columns stacked 2 per row). Colors from theme tokens: light surface `#fcfcfb` fg `#0b0b0c`, dark surface `#0b0b0c` fg `#ffffff`, accent `#ff2bd6` only on badge and the big number's «+».
- `GET /api/share?format=square|story&theme=light|dark&period=…&from=…&to=…` → reads segment cookie, `getShareStats`, `new ImageResponse(shareCard(...), {width, height, fonts})`, `Cache-Control: no-store`. Invalid `format`/`theme` → 400 JSON. `hasData false` → still 200 with the card showing «пока нет данных за период».
- `/share` page: TopBar (segment/period), two previews (`<img src="/api/share?format=square…">` and story), theme radio light/dark applied to the image URLs, «Скачать PNG» links (`download` attribute).

- [ ] **Step 1: Write failing test** `tests/share/route.test.ts`: mock `@/lib/db/client`, `@/lib/share/query` (`getShareStats` → fixture with 2 platforms) and `next/headers` cookies; `GET(new Request("http://x/api/share?format=square&theme=light"))` → `status 200`, `content-type` startsWith `image/png`; `format=poster` → 400. Also `shareCard(fixture, {format:"story", theme:"dark"})` renders (via `renderToStaticMarkup` from `react-dom/server`) markup containing `@vadimbordian`, `+1 234`, `за 30 дней`, and each platform label.
- [ ] **Step 2: Run** → FAIL; **Step 3: Implement**; **Step 4: Run** → PASS (if `ImageResponse` cannot run under vitest/node, keep the 400 and markup assertions and ledger a ruling; verify PNG on Vercel preview instead); **Step 5:** build clean; **Step 6: Commit** `feat(share): PNG share card (1:1, 9:16, light/dark) and /share page`

---

### Task 11: Manual LinkedIn metrics

**Files:**
- Create: `apps/web/src/lib/metrics/manual.ts`
- Modify: `apps/web/src/app/(dashboard)/settings/accounts/actions.ts`, `settings/accounts/page.tsx`
- Test: `apps/web/tests/metrics/manual.test.ts`

**Interfaces:**
- `recordManualMetrics(db, input: {accountId: string; date: string; followers: number | null; views: number | null; note?: string | null}, now?: Date): Promise<void>` — upsert `manual_metrics (account_id,date)`; mirror `followers` into `account_metrics_daily (account_id,date)` (`captured_at = now`, `extra` untouched via `onConflictDoUpdate` setting only `followers`, `capturedAt`); set `accounts.last_ok_sync_at = now`.
- `manualMetricsAction(formData)` → `requireAllowedUser()`, zod `{accountId uuid, date YYYY-MM-DD, followers int ≥0 optional, views int ≥0 optional, note ≤200 optional}`, revalidate `/`, `/settings/accounts`.
- Settings page: for accounts whose platform is `linkedin` (and any account with `role` manual later), a compact inline form «Подписчики · Просмотры · Дата (default today) · Сохранить» in the row; last 5 manual entries listed under the table.

- [ ] **Step 1: Write failing test** (pglite): linkedin account; `recordManualMetrics(…, {date:"2026-10-20", followers: 1200, views: 5400})` → `manual_metrics` 1 row, `account_metrics_daily` followers 1200; call again same date with followers 1250 → still 1 row each, followers 1250; `accounts.last_ok_sync_at` not null.
- [ ] **Step 2: Run** → FAIL; **Step 3: Implement**; **Step 4: Run** → PASS; **Step 5: Commit** `feat: manual LinkedIn metrics feed the overview`

---

### Task 12: Verify, push, preview

- [ ] **Step 1:** `pnpm exec vitest run` → all green (record N/N); `pnpm exec tsc --noEmit -p .` clean; `pnpm exec next build` clean; `grep -rn "neutral-" src | wc -l` → 0.
- [ ] **Step 2:** `git push origin main`; wait for Vercel; open `https://social.vadim.bio/` in both themes and `/share` — screenshot each; check `/api/share?format=square&theme=light` returns a PNG with Cyrillic rendered (no tofu boxes).
- [ ] **Step 3:** Record in ledger any visual defect as a follow-up; send screenshots to Vadim.
