import Link from "next/link";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { accounts, POST_FORMATS, type Label, type PostFormat } from "@/lib/db/schema";
import { listPosts, type PostSort } from "@/lib/queries/posts";
import { resolveSegment, segmentLanguage, SEGMENT_COOKIE } from "@/lib/ui/segment";
import { resolvePeriod } from "@/lib/ui/period";
import { chisinauDate, dayIndex } from "@/lib/time";
import { accountColor, fmtInt, FORMAT_GLYPH, FORMAT_TEXT, PLATFORM_LABEL } from "@/lib/ui/platform";
import { PageHeader } from "@/components/shell/PageHeader";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { LabelButtons } from "@/components/ui/LabelButtons";
import { Multiplier } from "@/components/ui/Multiplier";
import { PlatformChip } from "@/components/ui/PlatformChip";

export const dynamic = "force-dynamic";


export default async function PostsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const db = getDb();
  const segment = resolveSegment((await cookies()).get(SEGMENT_COOKIE)?.value);
  const segLang = segmentLanguage(segment);
  const showLang = segment === "all";
  const now = new Date();
  const spec = resolvePeriod(sp, chisinauDate(now));
  const accs = await db
    .select({ id: accounts.id, platform: accounts.platform, handle: accounts.handle, language: accounts.language })
    .from(accounts)
    .where(segLang ? eq(accounts.language, segLang) : undefined);
  const format = (POST_FORMATS as readonly string[]).includes(sp.format ?? "") ? (sp.format as PostFormat) : undefined;
  const label = (["hit", "miss", "odd"] as const).includes(sp.label as never) ? (sp.label as Exclude<Label, null>) : undefined;
  const language = segLang ?? (sp.lang === "ru" || sp.lang === "en" ? sp.lang : undefined);
  const accountId = accs.some((a) => a.id === sp.account) ? sp.account : undefined;
  const sort: PostSort = sp.sort === "multiplier" ? "multiplier" : "date";
  const rows = await listPosts(
    db,
    { accountId, format, label, language, from: new Date(spec.from + "T00:00:00+03:00"), to: new Date(spec.to + "T23:59:59+03:00") },
    sort,
  );

  const perPlatformIndex = new Map<string, number>();
  const colorOf: Record<string, string> = {};
  for (const a of accs) {
    const key = `${a.platform}:${a.language}`;
    const i = perPlatformIndex.get(key) ?? 0;
    perPlatformIndex.set(key, i + 1);
    colorOf[a.id] = accountColor(a.platform, a.language, i);
  }
  const colorForRow = (platform: string, handle: string) => colorOf[accs.find((a) => a.platform === platform && a.handle === handle)?.id ?? ""] ?? "var(--muted)";

  const link = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { account: accountId, format, label, lang: showLang ? sp.lang : undefined, sort, period: spec.preset ? String(spec.preset) : undefined, from: spec.preset ? undefined : spec.from, to: spec.preset ? undefined : spec.to, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    return `/posts?${q.toString()}`;
  };
  const chip = (active: boolean) => `rounded-full px-3 py-1 text-xs ${active ? "bg-fg text-surface" : "border border-line text-muted hover:text-fg"}`;
  const fmtDate = (d: Date) => new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "Europe/Chisinau" }).format(d);

  return (
    <div className="space-y-5">
      <PageHeader
        title={<>Посты <span className="text-base font-normal text-muted">{rows.length}</span></>}
        spec={spec}
        basePath="/posts"
        actions={
          <>
            <RefreshButton back={link({})} />
            <div className="flex gap-0.5 rounded-lg border border-line p-0.5 text-xs">
              <Link href={link({ sort: "date" })} className={`rounded-md px-2.5 py-1 ${sort === "date" ? "bg-fg text-surface" : "text-muted hover:text-fg"}`}>по дате</Link>
              <Link href={link({ sort: "multiplier" })} className={`rounded-md px-2.5 py-1 ${sort === "multiplier" ? "bg-fg text-surface" : "text-muted hover:text-fg"}`}>по множителю</Link>
            </div>
          </>
        }
      />
      {sp.refreshed && <p className="-mt-3 text-xs text-muted">Обновлено: {sp.refreshed} аккаунтов синхронизировано.</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Link href={link({ account: undefined })} className={chip(!accountId)}>все площадки</Link>
        {accs.map((a) => (
          <Link key={a.id} href={link({ account: a.id })} className={chip(accountId === a.id)}>
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: colorOf[a.id] }} />
            {PLATFORM_LABEL[a.platform]}
            {showLang && a.language === "en" ? " EN" : ""}
          </Link>
        ))}
        <span className="mx-1 text-line">|</span>
        {POST_FORMATS.map((f) => (
          <Link key={f} href={link({ format: format === f ? undefined : f })} className={chip(format === f)}>{FORMAT_TEXT[f]}</Link>
        ))}
        <span className="mx-1 text-line">|</span>
        {(["hit", "miss", "odd"] as const).map((l) => (
          <Link key={l} href={link({ label: label === l ? undefined : l })} className={chip(label === l)}>{{ hit: "залетело", miss: "мимо", odd: "странно" }[l]}</Link>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-muted">
            <tr className="border-b border-line">
              <th className="px-4 py-3" colSpan={2}>Пост</th>
              <th className="px-2 py-3">Площадка</th>
              <th className="px-2 py-3">Формат</th>
              <th className="px-2 py-3">Дата</th>
              <th className="px-2 py-3 text-right">Просмотры</th>
              <th className="px-2 py-3 text-right">×Медиана</th>
              <th className="px-2 py-3 text-right">Комм.</th>
              <th className="px-2 py-3 text-right">Сохр.</th>
              <th className="px-4 py-3">Метка</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const age = dayIndex(r.publishedAt, now);
              return (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-surface">
                  <td className="w-12 py-2 pl-4 pr-0">
                    <Link href={`/posts/${r.id}`} className="block h-10 w-10 overflow-hidden rounded-md border border-line bg-surface">
                      {r.mediaUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.mediaUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-sm text-muted">{FORMAT_GLYPH[r.format]}</span>
                      )}
                    </Link>
                  </td>
                  <td className="max-w-md px-3 py-2">
                    <Link href={`/posts/${r.id}`} className="line-clamp-2 leading-snug hover:text-accent">{r.text ?? "—"}</Link>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2"><PlatformChip platform={r.platform} language={r.language} color={colorForRow(r.platform, r.handle)} showLang={showLang} size="sm" /></td>
                  <td className="px-2 py-2"><span className="whitespace-nowrap rounded border border-line px-1.5 py-0.5 text-[11px] text-muted">{FORMAT_TEXT[r.format]}</span></td>
                  <td className="whitespace-nowrap px-2 py-2 text-muted tabular-nums">{fmtDate(r.publishedAt)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {fmtInt(r.latestViews ?? r.day11Views)}
                    {r.day11Index !== null && r.day11Index !== 11 && <span className="ml-1 text-[10px] text-muted">д{r.day11Index}</span>}
                  </td>
                  <td className="px-2 py-2 text-right"><Multiplier value={r.multiplier} provisional={r.benchmarkProvisional} young={age < 11} /></td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmtInt(r.comments)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmtInt(r.saves)}</td>
                  <td className="px-4 py-2"><LabelButtons postId={r.id} current={r.label} /></td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-muted">Постов нет за период — расширь диапазон, проверь фильтры или дождись синка.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">×Медиана = просмотры на последнем снимке до 11-го дня ÷ медиана формата за 90 дней. * — бенчмарк предварительный; бледный — пост моложе 11 дней.</p>
    </div>
  );
}
