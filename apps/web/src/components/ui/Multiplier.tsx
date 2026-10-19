export function Multiplier({ value, provisional }: { value: number | null; provisional?: boolean }) {
  if (value === null) return <span className="text-xs text-neutral-600">мало данных</span>;
  const cls = value >= 2 ? "text-[var(--accent)] font-semibold" : value < 0.5 ? "text-neutral-500" : "text-neutral-200";
  return (
    <span className={`tabular-nums ${cls}`} title={provisional ? "бенчмарк предварительный (мало снимков 11-го дня)" : undefined}>
      ×{value.toFixed(2)}
      {provisional && <span className="text-neutral-600">*</span>}
    </span>
  );
}
