import { fmtDelta } from "@/lib/ui/platform";

export function Delta({ value, suffix, className = "" }: { value: number | null | undefined; suffix?: string; className?: string }) {
  const tone = value === null || value === undefined || value === 0 ? "text-muted" : value > 0 ? "text-good" : "text-bad";
  return (
    <span className={`tabular-nums ${tone} ${className}`}>
      {fmtDelta(value)}
      {suffix && <span className="ml-1 text-muted">{suffix}</span>}
    </span>
  );
}
