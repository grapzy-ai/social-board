/** Tiny SVG trend: skips nulls, 2px stroke, 3px dot on the last point. Pure, server-renderable. */
export function Sparkline({ values, color, width = 96, height = 28 }: { values: Array<number | null>; color: string; width?: number; height?: number }) {
  const pts = values.map((v, i) => (v === null ? null : { i, v }));
  const known = pts.filter((p): p is { i: number; v: number } => p !== null);
  if (known.length < 2) return <svg width={width} height={height} aria-hidden />;
  const min = Math.min(...known.map((p) => p.v));
  const max = Math.max(...known.map((p) => p.v));
  const span = max - min || 1;
  const x = (i: number) => 2 + (i / (values.length - 1)) * (width - 4);
  const y = (v: number) => height - 3 - ((v - min) / span) * (height - 6);
  const d = known.map((p, k) => `${k === 0 ? "M" : "L"}${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  const last = known[known.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(last.i)} cy={y(last.v)} r={3} fill={color} />
    </svg>
  );
}
