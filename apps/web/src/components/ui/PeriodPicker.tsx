import Link from "next/link";
import { PERIOD_PRESETS, type PeriodSpec } from "@/lib/ui/period";

/** Preset links + a custom range (GET form, from/to). */
export function PeriodPicker({ spec, basePath }: { spec: PeriodSpec; basePath: string }) {
  const fmt = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
  return (
    <div className="flex items-center gap-1 rounded-lg border border-line p-0.5 text-xs">
      {PERIOD_PRESETS.map((p) => (
        <Link key={p} href={`${basePath}?period=${p}`} className={`rounded-md px-2.5 py-1 ${p === spec.preset ? "bg-fg text-surface" : "text-muted hover:text-fg"}`}>
          {p} дн
        </Link>
      ))}
      <details className="relative">
        <summary className={`cursor-pointer list-none rounded-md px-2.5 py-1 ${spec.preset === null ? "bg-fg text-surface" : "text-muted hover:text-fg"}`}>
          {spec.preset === null ? `${fmt(spec.from)}–${fmt(spec.to)}` : "период"}
        </summary>
        <form method="get" action={basePath} className="absolute right-0 z-20 mt-1 flex items-center gap-2 rounded-lg border border-line bg-card p-2 shadow-lg">
          <input type="date" name="from" defaultValue={spec.from} className="rounded border border-line bg-surface px-2 py-1" />
          <span className="text-muted">—</span>
          <input type="date" name="to" defaultValue={spec.to} className="rounded border border-line bg-surface px-2 py-1" />
          <button className="rounded bg-fg px-2 py-1 text-surface">ок</button>
        </form>
      </details>
    </div>
  );
}
