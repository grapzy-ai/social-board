export type PeriodPreset = 7 | 14 | 30 | 90;
export const PERIOD_PRESETS: readonly PeriodPreset[] = [7, 14, 30, 90];

export interface PeriodSpec {
  /** Inclusive number of calendar days in the range. */
  days: number;
  from: string;
  to: string;
  preset: PeriodPreset | null;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);
}

const isYmd = (v: string | undefined): v is string => !!v && YMD.test(v) && !Number.isNaN(Date.parse(v + "T00:00:00Z"));

/**
 * Period from query params. A valid preset wins; else a valid custom range (reversed bounds are swapped,
 * the end is clamped to today, a single day is allowed); else the 30-day preset.
 */
export function resolvePeriod(sp: { period?: string; from?: string; to?: string }, today: string): PeriodSpec {
  const preset = Number(sp.period);
  if (PERIOD_PRESETS.includes(preset as PeriodPreset)) {
    return { days: preset, from: addDays(today, -(preset - 1)), to: today, preset: preset as PeriodPreset };
  }
  if (isYmd(sp.from) && isYmd(sp.to)) {
    let [from, to] = sp.from <= sp.to ? [sp.from, sp.to] : [sp.to, sp.from];
    if (to > today) to = today;
    if (from > to) from = to;
    return { days: diffDays(from, to) + 1, from, to, preset: null };
  }
  return { days: 30, from: addDays(today, -29), to: today, preset: 30 };
}
