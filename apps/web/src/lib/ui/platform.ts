import type { Platform } from "@/lib/db/schema";

/** Categorical palette validated for the dark surface (#141416). Fixed order; color follows the account, never its rank. */
export const SERIES_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#9085e9"] as const;

export const PLATFORM_SLOT: Record<Platform, number> = {
  telegram: 0,
  threads: 1,
  tiktok: 2,
  linkedin: 3,
  instagram: 4,
  youtube: 5,
  vk: 5,
};

export const PLATFORM_LABEL: Record<Platform, string> = {
  threads: "Threads",
  instagram: "Instagram",
  telegram: "Telegram",
  tiktok: "TikTok",
  vk: "VK",
  youtube: "YouTube",
  linkedin: "LinkedIn",
};

/** Stable color per account: platform slot, shifted for a 2nd account of the same platform (e.g. EN). */
export function accountColor(platform: Platform, indexWithinPlatform = 0): string {
  const slot = (PLATFORM_SLOT[platform] + indexWithinPlatform * 3) % SERIES_COLORS.length;
  return SERIES_COLORS[slot];
}

export const fmtInt = (n: number | null | undefined) => (n === null || n === undefined ? "—" : new Intl.NumberFormat("ru-RU").format(n));
export const fmtDelta = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${n > 0 ? "+" : ""}${new Intl.NumberFormat("ru-RU").format(n)}`);
