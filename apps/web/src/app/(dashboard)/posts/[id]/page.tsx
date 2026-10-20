import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getPost } from "@/lib/queries/posts";
import { LabelButtons } from "@/components/ui/LabelButtons";
import { Multiplier } from "@/components/ui/Multiplier";
import { fmtInt, PLATFORM_LABEL } from "@/lib/ui/platform";

export const dynamic = "force-dynamic";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getPost(getDb(), id);
  if (!p) notFound();
  return (
    <div className="space-y-6">
      <Link href="/posts" className="text-sm text-muted hover:text-fg">← Посты</Link>
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs text-muted">{PLATFORM_LABEL[p.platform]} · @{p.handle} · {p.format} · {p.publishedAt.toISOString().replace("T", " ").slice(0, 16)}</div>
            <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm">{p.text ?? "—"}</p>
            {p.permalink && <a href={p.permalink} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-accent">открыть оригинал ↗</a>}
          </div>
          <div className="text-right">
            <div className="text-3xl"><Multiplier value={p.multiplier} provisional={p.benchmarkProvisional} /></div>
            <div className="text-xs text-muted">медиана {fmtInt(p.benchmark)}</div>
            <div className="mt-3"><LabelButtons postId={p.id} current={p.label} /></div>
          </div>
        </div>
      </div>
      <div className="card p-5">
        <h2 className="mb-3 text-sm font-medium">Снимки метрик</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted">
            <tr><th className="py-1">День</th><th className="text-right">Просмотры</th><th className="text-right">Охват</th><th className="text-right">Лайки</th><th className="text-right">Комм.</th><th className="text-right">Сохр.</th><th className="text-right">Репосты</th><th className="text-right">Шеры</th><th className="text-right">Ср. просмотр, с</th></tr>
          </thead>
          <tbody>
            {p.snapshots.map((s) => (
              <tr key={s.id} className="border-t border-line tabular-nums">
                <td className="py-1">{s.dayIndex}</td>
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
            {p.snapshots.length === 0 && <tr><td colSpan={9} className="py-4 text-muted">Снимков пока нет.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
