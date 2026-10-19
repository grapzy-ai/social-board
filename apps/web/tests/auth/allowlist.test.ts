import { describe, it, expect, beforeEach } from "vitest";
import { isAllowed } from "@/lib/auth/allowlist";

describe("isAllowed", () => {
  beforeEach(() => {
    process.env.ALLOWED_EMAILS = "bordian07@gmail.com, ksenia@influencio.ru";
  });
  it("matches allowlisted emails case-insensitively and ignoring spaces", () => {
    expect(isAllowed("Bordian07@gmail.com")).toBe(true);
    expect(isAllowed("ksenia@influencio.ru")).toBe(true);
  });
  it("rejects anyone else and empty input", () => {
    expect(isAllowed("someone@else.com")).toBe(false);
    expect(isAllowed("")).toBe(false);
    expect(isAllowed(undefined)).toBe(false);
  });
  it("rejects everyone when the allowlist is empty", () => {
    process.env.ALLOWED_EMAILS = "";
    expect(isAllowed("bordian07@gmail.com")).toBe(false);
  });
});
