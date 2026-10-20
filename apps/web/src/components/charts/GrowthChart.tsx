"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface GrowthSeries {
  key: string;
  label: string;
  color: string;
}

type Row = { date: string } & Record<string, number | string>;

const fmtDate = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
const fmtVal = (v: unknown) => `${Number(v) >= 0 ? "+" : ""}${new Intl.NumberFormat("ru-RU").format(Number(v))}`;

/** Direct end-labels for ≤4 series (legend only beyond that); 2px lines; theme-aware via CSS vars. */
export function GrowthChart({ data, series, height = 288 }: { data: Row[]; series: GrowthSeries[]; height?: number }) {
  if (data.length === 0) return <p className="py-10 text-center text-sm text-muted">Данных пока нет — появятся после первого синка.</p>;
  const lastIndex = (key: string) => {
    for (let i = data.length - 1; i >= 0; i--) if (typeof data[i][key] === "number") return i;
    return -1;
  };
  const direct = series.length <= 4;
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: direct ? 104 : 16, bottom: 0, left: 0 }}>
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
          {series.map((s) => {
            const li = lastIndex(s.key);
            return (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                connectNulls
                isAnimationActive={false}
                label={
                  direct
                    ? (p: { x?: number | string; y?: number | string; index?: number }) => {
                        const x = Number(p.x);
                        const y = Number(p.y);
                        return p.index === li && Number.isFinite(x) && Number.isFinite(y) ? (
                          <text x={x + 8} y={y + 4} fill={s.color} fontSize={12} fontWeight={600}>
                            {s.label}
                          </text>
                        ) : <g />;
                      }
                    : undefined
                }
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
