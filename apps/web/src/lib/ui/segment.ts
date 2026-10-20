export type Segment = "ru" | "en" | "all";
export const SEGMENT_COOKIE = "sb_segment";
const SEGMENTS: readonly Segment[] = ["ru", "en", "all"];

/** Cookie → segment. Unknown → ru (the focus segment). */
export function resolveSegment(raw: string | undefined | null): Segment {
  return SEGMENTS.includes(raw as Segment) ? (raw as Segment) : "ru";
}

/** Language filter for queries; «Все» = no filter. */
export function segmentLanguage(s: Segment): "ru" | "en" | undefined {
  return s === "all" ? undefined : s;
}

export const SEGMENT_LABEL: Record<Segment, string> = { ru: "RU", en: "EN", all: "Все" };
