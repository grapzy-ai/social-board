export const MULTIPLIER_DAY = 11;

export interface DaySnapshot {
  dayIndex: number;
  views: number | null;
}

/** Latest snapshot whose dayIndex <= maxDay, or null. */
export function snapshotForDay<T extends DaySnapshot>(snaps: T[], maxDay = MULTIPLIER_DAY): T | null {
  let best: T | null = null;
  for (const s of snaps) {
    if (s.dayIndex <= maxDay && (best === null || s.dayIndex > best.dayIndex)) best = s;
  }
  return best;
}

/** views / benchmark, rounded to hundredths; null when either side is missing or benchmark is 0. */
export function multiplier(views: number | null, benchmark: number | null): number | null {
  if (views === null || benchmark === null || benchmark <= 0) return null;
  return Math.round((views / benchmark) * 100) / 100;
}
