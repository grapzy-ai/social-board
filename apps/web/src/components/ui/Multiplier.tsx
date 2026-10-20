/** ×median badge: ≥2 good tint, ≤0.5 bad tint, otherwise neutral. `young` marks posts not yet at day 11. */
export function Multiplier({ value, provisional, young }: { value: number | null; provisional?: boolean; young?: boolean }) {
  if (value === null) return <span className="rounded border border-line px-1.5 py-0.5 text-[11px] text-muted">мало данных</span>;
  const tone = value >= 2 ? "border-good/40 bg-good/10 text-good" : value <= 0.5 ? "border-bad/40 bg-bad/10 text-bad" : "border-line text-fg";
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${young ? "opacity-60" : ""} ${tone}`}
      title={[provisional ? "бенчмарк предварительный (мало снимков 11-го дня)" : null, young ? "пост моложе 11 дней — цифра ещё вырастет" : null].filter(Boolean).join("; ") || undefined}
    >
      ×{value.toFixed(2)}
      {provisional && <span className="font-normal opacity-70">*</span>}
    </span>
  );
}
