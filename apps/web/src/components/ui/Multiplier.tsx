export function Multiplier({ value, provisional }: { value: number | null; provisional?: boolean }) {
  if (value === null) return <span className="text-xs text-muted">мало данных</span>;
  const cls = value >= 2 ? "text-accent font-semibold" : value < 0.5 ? "text-muted" : "text-fg";
  return (
    <span className={`tabular-nums ${cls}`} title={provisional ? "бенчмарк предварительный (мало снимков 11-го дня)" : undefined}>
      ×{value.toFixed(2)}
      {provisional && <span className="text-muted">*</span>}
    </span>
  );
}
