import type { ShareStats } from "./compute";
import { PLATFORM_LABEL } from "@/lib/ui/platform";

export type ShareFormat = "square" | "story";
export type ShareTheme = "light" | "dark";

export const SHARE_SIZE: Record<ShareFormat, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
};

const THEME = {
  light: { surface: "#fcfcfb", card: "#ffffff", line: "#e7e7ea", fg: "#0b0b0c", muted: "#6b7280" },
  dark: { surface: "#0b0b0c", card: "#141416", line: "#26262b", fg: "#ffffff", muted: "#9ca3af" },
} as const;
const ACCENT = "#ff2bd6";
const GOOD = "#199e70";

const nf0 = new Intl.NumberFormat("ru-RU");
/** ru-RU uses U+202F as the group separator; plain spaces render the same and keep the text searchable. */
const nf = { format: (n: number) => nf0.format(n).replace(/[\u00a0\u202f]/g, " ") };
const fmtInt = (n: number | null) => (n === null ? "—" : nf.format(Math.abs(n)));
const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");
const fmtDelta = (n: number | null) => (n === null ? "—" : `${sign(n)}${nf.format(Math.abs(n))}`);
const fmtPct = (n: number | null) => (n === null ? null : `${sign(n)}${nf.format(Math.abs(n))}%`);
const arrow = (n: number | null) => (n !== null && n < 0 ? "↘" : "↗");
const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const fmtDay = (ymd: string) => `${Number(ymd.slice(8, 10))} ${MONTHS[Number(ymd.slice(5, 7)) - 1]}`;
const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};
const fmtViews = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2).replace(".", ",")} млн` : n >= 10_000 ? `${nf.format(Math.round(n / 1000))} тыс.` : nf.format(n));

/** Stacked cumulative-growth area chart as plain SVG paths (flat fills, no gradients). */
function Chart({ s, width, height, theme }: { s: ShareStats; width: number; height: number; theme: ShareTheme }) {
  const t = THEME[theme];
  const n = s.series.length;
  const max = Math.max(1, ...s.series.flatMap((r) => r.stacked));
  const x = (i: number) => (n <= 1 ? width : (i / (n - 1)) * width);
  const y = (v: number) => height - (Math.max(0, v) / max) * (height - 8);
  const layers = s.perPlatform.map((p, li) => {
    const upper = s.series.map((r, i) => `${x(i).toFixed(1)},${y(r.stacked[li]).toFixed(1)}`);
    const lower = s.series.map((r, i) => `${x(i).toFixed(1)},${y(li === 0 ? 0 : r.stacked[li - 1]).toFixed(1)}`).reverse();
    return { color: p.color, area: `M${upper.join(" L")} L${lower.join(" L")} Z`, line: `M${upper.join(" L")}` };
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={0} x2={width} y1={y(max * f)} y2={y(max * f)} stroke={t.line} strokeWidth={1} strokeDasharray="4 6" />
      ))}
      {layers.map((l, i) => (
        <path key={`a${i}`} d={l.area} fill={l.color} fillOpacity={0.28} />
      ))}
      {layers.map((l, i) => (
        <path key={`s${i}`} d={l.line} fill="none" stroke={t.surface} strokeWidth={7} strokeLinejoin="round" />
      ))}
      {layers.map((l, i) => (
        <path key={`l${i}`} d={l.line} fill="none" stroke={l.color} strokeWidth={3} strokeLinejoin="round" />
      ))}
    </svg>
  );
}

/** Pure JSX for Satori (flexbox only, every <div> with display:flex). */
export function shareCard(s: ShareStats & { handle: string }, opts: { format: ShareFormat; theme: ShareTheme }) {
  const t = THEME[opts.theme];
  const { width, height } = SHARE_SIZE[opts.format];
  const story = opts.format === "story";
  const pad = 72;
  const inner = width - pad * 2;
  const chartH = story ? 520 : 300;
  const year = s.to.slice(0, 4);
  const pct = fmtPct(s.totalPct);
  const cols = s.perPlatform.length;
  const colW = story && cols > 2 ? (inner - 24) / 2 : cols ? (inner - 24 * (cols - 1)) / cols : inner;
  const base: React.CSSProperties = { display: "flex" };
  const chip = (text: string, color: string): React.ReactElement => (
    <div style={{ ...base, alignItems: "center", border: `2px solid ${t.line}`, borderRadius: 999, padding: "14px 26px", fontSize: 30, color, fontWeight: 600 }}>{text}</div>
  );

  return (
    <div style={{ ...base, flexDirection: "column", width, height, background: t.surface, color: t.fg, padding: pad, fontFamily: "Inter", justifyContent: "space-between" }}>
      <div style={{ ...base, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ ...base, alignItems: "center", gap: 18 }}>
          <div style={{ ...base, alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: 14, background: ACCENT, color: opts.theme === "light" ? "#fff" : "#000", fontSize: 28, fontWeight: 700 }}>VB</div>
          <div style={{ ...base, fontSize: 38, fontWeight: 600 }}>@{s.handle}</div>
        </div>
        <div style={{ ...base, alignItems: "center", gap: 16, color: t.muted, fontSize: 30 }}>
          <div style={{ ...base, border: `2px solid ${t.line}`, borderRadius: 8, padding: "6px 14px", fontSize: 24, fontWeight: 600, letterSpacing: 1 }}>{year}</div>
          <div style={base}>{fmtDay(s.from)} — {fmtDay(s.to)}</div>
        </div>
      </div>

      <div style={{ ...base, flexDirection: "column", gap: 10 }}>
        {s.hasData ? (
          <div style={{ ...base, flexDirection: "column", gap: 10 }}>
            <div style={{ ...base, alignItems: "baseline" }}>
              <div style={{ ...base, fontSize: story ? 200 : 168, fontWeight: 700, letterSpacing: -8, lineHeight: 1, color: (s.totalDelta ?? 0) < 0 ? t.muted : ACCENT }}>{sign(s.totalDelta ?? 0) || "±"}</div>
              <div style={{ ...base, fontSize: story ? 200 : 168, fontWeight: 700, letterSpacing: -8, lineHeight: 1 }}>{fmtInt(s.totalDelta)}</div>
            </div>
            <div style={{ ...base, fontSize: 40, color: t.muted }}>
              {(s.totalDelta ?? 0) < 0 ? plural(Math.abs(s.totalDelta ?? 0), "подписчик ушёл", "подписчика ушли", "подписчиков ушли") : plural(s.totalDelta ?? 0, "новый подписчик", "новых подписчика", "новых подписчиков")} за {s.days} {plural(s.days, "день", "дня", "дней")}
            </div>
            <div style={{ ...base, gap: 16, marginTop: 18, alignItems: "flex-start" }}>
              {pct && chip(`${arrow(s.totalPct)} ${pct} к аудитории`, (s.totalPct ?? 0) < 0 ? t.muted : GOOD)}
              {s.totalViews > 0 && chip(`${fmtViews(s.totalViews)} просмотров`, t.fg)}
            </div>
          </div>
        ) : (
          <div style={{ ...base, flexDirection: "column", gap: 12 }}>
            <div style={{ ...base, fontSize: 64, fontWeight: 700, letterSpacing: -2 }}>пока нет данных</div>
            <div style={{ ...base, fontSize: 34, color: t.muted }}>за выбранный период цифры ещё собираются</div>
          </div>
        )}
      </div>

      <div style={{ ...base, flexDirection: "column" }}>
        {s.hasData && <Chart s={s} width={inner} height={chartH} theme={opts.theme} />}
        <div style={{ ...base, justifyContent: "space-between", color: t.muted, fontSize: 24, marginTop: 10 }}>
          <div style={base}>{fmtDay(s.from)}</div>
          <div style={base}>{fmtDay(s.to)}</div>
        </div>
      </div>

      <div style={{ ...base, flexWrap: "wrap", gap: 24, borderTop: `2px solid ${t.line}`, paddingTop: 34 }}>
        {s.perPlatform.map((p) => (
          <div key={p.accountId} style={{ ...base, flexDirection: "column", width: colW, gap: 8 }}>
            <div style={{ ...base, alignItems: "center", gap: 12, color: t.muted, fontSize: 28 }}>
              <div style={{ ...base, width: 16, height: 16, borderRadius: 999, background: p.color }} />
              <div style={base}>{PLATFORM_LABEL[p.platform]}{p.language === "en" ? " EN" : ""}</div>
            </div>
            <div style={{ ...base, fontSize: 60, fontWeight: 700, letterSpacing: -2 }}>{fmtDelta(p.delta)}</div>
            {fmtPct(p.pct) && <div style={{ ...base, fontSize: 28, color: (p.pct ?? 0) < 0 ? t.muted : GOOD, fontWeight: 600 }}>{arrow(p.pct)} {fmtPct(p.pct)}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
