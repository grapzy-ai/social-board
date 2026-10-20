export const TIMEZONE = "Europe/Chisinau";

const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar date (YYYY-MM-DD) of an instant in Europe/Chisinau. */
export function chisinauDate(d: Date): string {
  return fmt.format(d);
}

function dateToDays(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Whole local days between the publish date and `now` (0 on the publish day). */
export function dayIndex(publishedAt: Date, now: Date): number {
  return dateToDays(chisinauDate(now)) - dateToDays(chisinauDate(publishedAt));
}

export const SNAPSHOT_DAYS = [1, 3, 7, 11, 30] as const;

/** True when `dayIdx` is a snapshot day that has not been captured yet. */
export function shouldSnapshot(dayIdx: number, existing: readonly number[]): boolean {
  if (existing.includes(dayIdx)) return false;
  if ((SNAPSHOT_DAYS as readonly number[]).includes(dayIdx)) return true;
  return dayIdx > 30 && (dayIdx - 30) % 7 === 0;
}

/** UTC instants bounding one Chisinau calendar day, DST-aware (EET/EEST). */
export function chisinauDayBounds(ymd: string): { start: Date; end: Date } {
  const [y, m, d] = ymd.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  // Try both possible offsets; the right one is the instant whose previous millisecond is still the previous day.
  for (const off of ["+03:00", "+02:00"]) {
    const start = new Date(`${ymd}T00:00:00.000${off}`);
    if (chisinauDate(start) === ymd && chisinauDate(new Date(start.getTime() - 1)) === prev) {
      const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
      let end: Date | null = null;
      for (const off2 of ["+03:00", "+02:00"]) {
        const cand = new Date(`${next}T00:00:00.000${off2}`);
        if (chisinauDate(cand) === next && chisinauDate(new Date(cand.getTime() - 1)) === ymd) end = new Date(cand.getTime() - 1);
      }
      return { start, end: end ?? new Date(start.getTime() + 86_400_000 - 1) };
    }
  }
  const start = new Date(`${ymd}T00:00:00.000+03:00`);
  return { start, end: new Date(start.getTime() + 86_400_000 - 1) };
}
