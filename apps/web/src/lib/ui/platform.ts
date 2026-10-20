import type { Platform } from "@/lib/db/schema";

/**
 * Categorical palette, fixed order. Validated with dataviz/scripts/validate_palette.js for both surfaces
 * (light #fcfcfb, dark #141416): all checks pass; #c98500 is below 3:1 contrast on light → always direct-label.
 * Color follows the account, never its rank. Max 6 series per chart.
 */
export const SERIES_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#9085e9"] as const;

/**
 * Slot per platform inside a language segment. Segments are never charted together, so a slot may be
 * reused across segments (vk/linkedin, telegram/x); platforms present in both segments keep one slot.
 */
export const SEGMENT_SLOTS: Record<"ru" | "en", Partial<Record<Platform, number>>> = {
  ru: { telegram: 0, threads: 1, tiktok: 2, vk: 3, instagram: 4, youtube: 5 },
  en: { x: 0, threads: 1, tiktok: 2, linkedin: 3, instagram: 4, youtube: 5 },
};

/** Fallback when a platform is missing from the segment map. */
const DEFAULT_SLOT: Record<Platform, number> = {
  telegram: 0, threads: 1, tiktok: 2, linkedin: 3, instagram: 4, youtube: 5, vk: 3, x: 0,
};

export const PLATFORM_LABEL: Record<Platform, string> = {
  threads: "Threads",
  instagram: "Instagram",
  telegram: "Telegram",
  tiktok: "TikTok",
  vk: "VK",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  x: "X",
};

/** Stable color per account: segment slot, shifted for a 2nd account of the same platform. */
export function accountColor(platform: Platform, language: "ru" | "en", indexWithinPlatform = 0): string {
  const slot = SEGMENT_SLOTS[language][platform] ?? DEFAULT_SLOT[platform];
  return SERIES_COLORS[(slot + indexWithinPlatform * 3) % SERIES_COLORS.length];
}

export const fmtInt = (n: number | null | undefined) => (n === null || n === undefined ? "—" : new Intl.NumberFormat("ru-RU").format(n));
export const fmtDelta = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${n > 0 ? "+" : ""}${new Intl.NumberFormat("ru-RU").format(n)}`);
