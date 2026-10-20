import { describe, it, expect } from "vitest";
import { accountColor, SERIES_COLORS, PLATFORM_LABEL } from "@/lib/ui/platform";

describe("platform colors", () => {
  it("gives every RU platform a distinct color and every EN platform a distinct color", () => {
    const ru = ["telegram", "threads", "tiktok", "instagram", "youtube", "vk"] as const;
    const en = ["instagram", "threads", "x", "linkedin", "tiktok", "youtube"] as const;
    expect(new Set(ru.map((p) => accountColor(p, "ru"))).size).toBe(6);
    expect(new Set(en.map((p) => accountColor(p, "en"))).size).toBe(6);
  });
  it("keeps the same platform the same color in both segments where it exists", () => {
    expect(accountColor("instagram", "ru")).toBe(accountColor("instagram", "en"));
    expect(accountColor("threads", "ru")).toBe(accountColor("threads", "en"));
    expect(accountColor("tiktok", "ru")).toBe(accountColor("tiktok", "en"));
  });
  it("shifts a second account of the same platform to a different color", () => {
    expect(accountColor("instagram", "ru", 1)).not.toBe(accountColor("instagram", "ru", 0));
  });
  it("palette has exactly 6 validated colors and labels X", () => {
    expect(SERIES_COLORS).toHaveLength(6);
    expect(PLATFORM_LABEL.x).toBe("X");
  });
});
