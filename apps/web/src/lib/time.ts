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
