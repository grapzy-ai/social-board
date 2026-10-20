"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, useCartesianScale } from "recharts";
import { directLabelsFor, placeEndLabels } from "@/lib/ui/chart-labels";

export interface GrowthSeries {
  key: string;
  label: string;
  color: string;
}

type Row = { date: string } & Record<string, number | string>;

const fmtDate = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
const fmtVal = (v: unknown) => `${Number(v) >= 0 ? "+" : ""}${new Intl.NumberFormat("ru-RU").format(Number(v))}`;
const LABEL_GAP = 14;

/** One label per series at its last known point; positions come from the chart scales, collisions are nudged apart. */
function EndLabel({ x, y, label, color }: { x: number; y: number; label: string; color: string }) {
  return (
    <text x={x + 8} y={y + 4} fill={color} fontSize={12} fontWeight={600}>
      {label}
    </text>
  );
}

type Coord = { x: number; y: number };

/** Measures one series' last point through the chart scales and reports it up; renders nothing itself. */
function EndLabelProbe({ id, x, y, onCoord }: { id: string; x: string; y: number; onCoord: (id: string, c: Coord | undefined) => void }) {
  const c = useCartesianScale({ x, y });
  const cx = c?.x;
  const cy = c?.y;
  useEffect(() => {
    onCoord(id, cx === undefined || cy === undefined ? undefined : { x: cx, y: cy });
  }, [id, cx, cy, onCoord]);
  return null;
}

function EndLabels({ data, series, lastIndex }: { data: Row[]; series: GrowthSeries[]; lastIndex: (key: string) => number }) {
  const [coords, setCoords] = useState<Record<string, Coord | undefined>>({});
  const onCoord = (id: string, c: Coord | undefined) =>
    setCoords((prev) => (prev[id]?.x === c?.x && prev[id]?.y === c?.y ? prev : { ...prev, [id]: c }));
  const points = series.map((s) => ({ s, li: lastIndex(s.key) })).filter((p) => p.li >= 0);
  const placed = placeEndLabels(points.filter((p) => coords[p.s.key]).map((p) => ({ key: p.s.key, y: coords[p.s.key]!.y })), LABEL_GAP);
  return (
    <g>
      {points.map((p) => (
        <EndLabelProbe key={`probe-${p.s.key}`} id={p.s.key} x={data[p.li].date} y={data[p.li][p.s.key] as number} onCoord={onCoord} />
      ))}
      {points.map((p) => {
        const c = coords[p.s.key];
        if (!c) return null;
        return <EndLabel key={p.s.key} x={c.x} y={placed.find((q) => q.key === p.s.key)?.y ?? c.y} label={p.s.label} color={p.s.color} />;
      })}
    </g>
  );
}

/** Direct end-labels (nudged apart) for up to 6 series — colour alone never carries identity; legend only beyond that. */
export function GrowthChart({ data, series, height = 288 }: { data: Row[]; series: GrowthSeries[]; height?: number }) {
  if (data.length === 0) return <p className="py-10 text-center text-sm text-muted">Данных пока нет — появятся после первого синка.</p>;
  const direct = directLabelsFor(series.length);
  const lastIndex = (key: string) => {
    for (let i = data.length - 1; i >= 0; i--) if (typeof data[i][key] === "number") return i;
    return -1;
  };

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: direct ? 112 : 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={fmtDate} stroke="var(--line)" tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={32} />
          <YAxis stroke="var(--line)" tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => fmtVal(v)} />
          <Tooltip
            cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
            contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12, color: "var(--fg)" }}
            labelStyle={{ color: "var(--muted)" }}
            labelFormatter={(d) => fmtDate(String(d))}
            formatter={(v, name) => [fmtVal(v), name]}
          />
          {!direct && <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} />}
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} connectNulls isAnimationActive={false} />
          ))}
          {direct && <EndLabels data={data} series={series} lastIndex={lastIndex} />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
