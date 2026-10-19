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

/**
 * Snapshot used for the multiplier: latest at or before day 11. When a post was first seen later
 * than day 11 (no early snapshots exist), the earliest later snapshot is used and flagged provisional.
 */
export function pickMultiplierSnapshot<T extends DaySnapshot>(snaps: T[], maxDay = MULTIPLIER_DAY): { snap: T | null; provisional: boolean } {
  const onTime = snapshotForDay(snaps, maxDay);
  if (onTime) return { snap: onTime, provisional: false };
  let earliest: T | null = null;
  for (const s of snaps) if (earliest === null || s.dayIndex < earliest.dayIndex) earliest = s;
  return { snap: earliest, provisional: earliest !== null };
}
