import { describe, it, expect } from "vitest";
import { resolveSegment, segmentLanguage } from "@/lib/ui/segment";

describe("segment", () => {
  it("defaults to ru for missing or garbage cookie", () => {
    expect(resolveSegment(undefined)).toBe("ru");
    expect(resolveSegment("xx")).toBe("ru");
    expect(resolveSegment("en")).toBe("en");
    expect(resolveSegment("all")).toBe("all");
  });
  it("maps segments to a language filter", () => {
    expect(segmentLanguage("all")).toBeUndefined();
    expect(segmentLanguage("en")).toBe("en");
    expect(segmentLanguage("ru")).toBe("ru");
  });
});
