import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { accounts, POST_FORMATS, type Label, type PostFormat } from "@/lib/db/schema";
import { listPosts, type PostSort } from "@/lib/queries/posts";
import { LabelButtons } from "@/components/ui/LabelButtons";
import { Multiplier } from "@/components/ui/Multiplier";
import { fmtInt, PLATFORM_LABEL } from "@/lib/ui/platform";

export const dynamic = "force-dynamic";

const FORMAT_TEXT: Record<PostFormat, string> = { reel: "Reels", carousel: "Карусель", image: "Фото", thread: "Thread", tg_post: "TG-пост", short: "Shorts", tiktok: "TikTok" };

export default async function PostsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const db = getDb();
  const accs = await db.select({ id: accounts.id, platform: accounts.platform, handle: accounts.handle, language: accounts.language }).from(accounts);
  const format = (POST_FORMATS as readonly string[]).includes(sp.format ?? "") ? (sp.format as PostFormat) : undefined;
  const label = (["hit", "miss", "odd"] as const).includes(sp.label as never) ? (sp.label as Exclude<Label, null>) : undefined;
  const language = sp.lang === "ru" || sp.lang === "en" ? sp.lang : undefined;
  const accountId = accs.some((a) => a.id === sp.account) ? sp.account : undefined;
  const sort: PostSort = sp.sort === "multiplier" ? "multiplier" : "date";
  const rows = await listPosts(db, { accountId, format, label, language }, sort);

  const link = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { account: accountId, format, label, lang: language, sort, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    return `/posts?${q.toString()}`;
  };
  const chip = (active: boolean) => `rounded-full px-3 py-1 text-xs ${active ? "bg-neutral-100 text-black" : "border border-neutral-800 text-neutral-400 hover:text-white"}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Посты <span className="text-base font-normal text-neutral-500">{rows.length}</span></h1>
        <div className="flex gap-1 rounded-lg border border-neutral-800 p-1 text-sm">
          <Link href={link({ sort: "date" })} className={`rounded-md px-3 py-1 ${sort === "date" ? "bg-neutral-800" : "text-neutral-400"}`}>по дате</Link>
          <Link href={link({ sort: "multiplier" })} className={`rounded-md px-3 py-1 ${sort === "multiplier" ? "bg-neutral-800" : "text-neutral-400"}`}>по множителю</Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={link({ account: undefined })} className={chip(!accountId)}>все площадки</Link>
        {accs.map((a) => (
          <Link key={a.id} href={link({ account: a.id })} className={chip(accountId === a.id)}>{PLATFORM_LABEL[a.platform]}{a.language === "en" ? " EN" : ""}</Link>
        ))}
        <span className="mx-1 text-neutral-700">|</span>
        {POST_FORMATS.map((f) => (
          <Link key={f} href={link({ format: format === f ? undefined : f })} className={chip(format === f)}>{FORMAT_TEXT[f]}</Link>
        ))}
        <span className="mx-1 text-neutral-700">|</span>
        {(["hit", "miss", "odd"] as const).map((l) => (
          <Link key={l} href={link({ label: label === l ? undefined : l })} className={chip(label === l)}>{{ hit: "залетело", miss: "мимо", odd: "странно" }[l]}</Link>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr className="border-b border-neutral-800">
              <th className="px-4 py-3">Дата</th>
              <th className="px-2 py-3">Площадка</th>
              <th className="px-2 py-3">Формат</th>
              <th className="px-2 py-3">Текст</th>
              <th className="px-2 py-3 text-right">Просм. д11</th>
              <th className="px-2 py-3 text-right">×Медиана</th>
              <th className="px-2 py-3 text-right">Комм.</th>
              <th className="px-2 py-3 text-right">Сохр.</th>
              <th className="px-4 py-3">Метка</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-neutral-900 hover:bg-neutral-900/40">
                <td className="whitespace-nowrap px-4 py-2 text-neutral-400">{r.publishedAt.toISOString().slice(0, 10)}</td>
                <td className="px-2 py-2">{PLATFORM_LABEL[r.platform]}{r.language === "en" ? " EN" : ""}</td>
                <td className="px-2 py-2 text-neutral-400">{FORMAT_TEXT[r.format]}</td>
                <td className="max-w-md px-2 py-2">
                  <Link href={`/posts/${r.id}`} className="line-clamp-2 hover:text-[var(--accent)]">{r.text ?? "—"}</Link>
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {fmtInt(r.day11Views)}
                  {r.day11Index !== null && r.day11Index !== 11 && <span className="ml-1 text-[10px] text-neutral-600">д{r.day11Index}</span>}
                </td>
                <td className="px-2 py-2 text-right"><Multiplier value={r.multiplier} provisional={r.benchmarkProvisional} /></td>
                <td className="px-2 py-2 text-right tabular-nums">{fmtInt(r.comments)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{fmtInt(r.saves)}</td>
                <td className="px-4 py-2"><LabelButtons postId={r.id} current={r.label} /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-neutral-500">Постов нет — проверь фильтры или дождись синка.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-600">×Медиана = просмотры на последнем снимке до 11-го дня ÷ медиана формата за 90 дней. * — бенчмарк предварительный.</p>
    </div>
  );
}
