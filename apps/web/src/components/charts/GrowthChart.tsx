"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

export interface GrowthSeries {
  key: string;
  label: string;
  color: string;
}

export function GrowthChart({ data, series }: { data: Array<{ date: string } & Record<string, number | string>>; series: GrowthSeries[] }) {
  if (data.length === 0) return <p className="py-10 text-center text-sm text-muted">Данных пока нет — появятся после первого синка.</p>;
  const fmtDate = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#222226" vertical={false} />
          <XAxis dataKey="date" tickFormatter={fmtDate} stroke="#3a3a40" tick={{ fill: "#9ca3af", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis stroke="#3a3a40" tick={{ fill: "#9ca3af", fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
          <Tooltip
            contentStyle={{ background: "#141416", border: "1px solid #2a2a30", borderRadius: 10, fontSize: 12 }}
            labelStyle={{ color: "#9ca3af" }}
            labelFormatter={(d) => String(d)}
            formatter={(v, name) => [`${Number(v) >= 0 ? "+" : ""}${v}`, name]}
          />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: "#9ca3af" }} />}
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#141416" }} connectNulls isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
