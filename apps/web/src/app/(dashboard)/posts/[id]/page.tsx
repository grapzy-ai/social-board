import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getPost } from "@/lib/queries/posts";
import { LabelButtons } from "@/components/ui/LabelButtons";
import { Multiplier } from "@/components/ui/Multiplier";
import { PlatformChip } from "@/components/ui/PlatformChip";
import { Sparkline } from "@/components/charts/Sparkline";
import { PageHeader } from "@/components/shell/PageHeader";
import { accountColor, fmtInt, FORMAT_TEXT } from "@/lib/ui/platform";
import { dayIndex } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getPost(getDb(), id);
  if (!p) notFound();
  const color = accountColor(p.platform, p.language);
  const age = dayIndex(p.publishedAt, new Date());
  const when = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Chisinau" }).format(p.publishedAt);
  const viewsByDay = p.snapshots.map((s) => s.views);
  const isVideo = p.mediaUrl && /\.(mp4|mov|m3u8)(\?|$)/i.test(p.mediaUrl);

  return (
    <div className="space-y-5">
      <PageHeader title={<Link href="/posts" className="text-muted hover:text-fg">← Посты</Link>} />
      <div className={`grid items-start gap-4 ${p.mediaUrl ? "lg:grid-cols-[minmax(0,1fr)_320px]" : ""}`}>
        <div className="card p-5">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
            <PlatformChip platform={p.platform} language={p.language} handle={p.handle} color={color} showLang />
            <span className="rounded border border-line px-1.5 py-0.5">{FORMAT_TEXT[p.format]}</span>
            <span>{when}</span>
            <span>день {age}</span>
            {p.permalink && <a href={p.permalink} target="_blank" rel="noreferrer" className="ml-auto text-accent">открыть оригинал ↗</a>}
          </div>
          <p className="mt-4 max-w-3xl whitespace-pre-wrap text-[15px] leading-relaxed">{p.text ?? "—"}</p>
          <div className="mt-5 flex items-center gap-4 border-t border-line pt-4">
            <Multiplier value={p.multiplier} provisional={p.benchmarkProvisional} young={age < 11} />
            <span className="text-xs text-muted">медиана формата {fmtInt(p.benchmark)}</span>
            <div className="ml-auto"><LabelButtons postId={p.id} current={p.label} /></div>
          </div>
        </div>
        {p.mediaUrl && (
          <div className="card overflow-hidden">
            {isVideo ? (
              <video src={p.mediaUrl} controls className="aspect-[4/5] w-full bg-surface object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.mediaUrl} alt="" className="aspect-[4/5] w-full object-cover" />
            )}
          </div>
        )}
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Просмотры по дням</h2>
          {viewsByDay.length > 1 && <Sparkline values={viewsByDay} color={color} width={320} height={64} />}
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-muted">
            <tr><th className="py-1">День</th><th className="text-right">Просмотры</th><th className="text-right">Охват</th><th className="text-right">Лайки</th><th className="text-right">Комм.</th><th className="text-right">Сохр.</th><th className="text-right">Репосты</th><th className="text-right">Шеры</th><th className="text-right">Ср. просмотр, с</th></tr>
          </thead>
          <tbody>
            {p.snapshots.map((s) => (
              <tr key={s.id} className="border-t border-line tabular-nums">
                <td className="py-1.5">{s.dayIndex}</td>
                <td className="text-right">{fmtInt(s.views)}</td>
                <td className="text-right">{fmtInt(s.reach)}</td>
                <td className="text-right">{fmtInt(s.likes)}</td>
                <td className="text-right">{fmtInt(s.comments)}</td>
                <td className="text-right">{fmtInt(s.saves)}</td>
                <td className="text-right">{fmtInt(s.reposts)}</td>
                <td className="text-right">{fmtInt(s.shares)}</td>
                <td className="text-right">{s.avgWatchTimeSec ?? "—"}</td>
              </tr>
            ))}
            {p.snapshots.length === 0 && <tr><td colSpan={9} className="py-4 text-muted">Снимков пока нет — первый появится на ближайшем синке.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
