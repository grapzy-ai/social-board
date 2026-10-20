import { describe, it, expect } from "vitest";
import { resolveTheme, htmlThemeAttr } from "@/lib/ui/theme";

describe("theme", () => {
  it("defaults to light for missing or garbage cookie", () => {
    expect(resolveTheme(undefined)).toBe("light");
    expect(resolveTheme("")).toBe("light");
    expect(resolveTheme("neon")).toBe("light");
  });
  it("accepts light/dark/system and maps system to no attribute", () => {
    expect(resolveTheme("dark")).toBe("dark");
    expect(resolveTheme("system")).toBe("system");
    expect(htmlThemeAttr("system")).toBeUndefined();
    expect(htmlThemeAttr("dark")).toBe("dark");
  });
});
