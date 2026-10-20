import { describe, it, expect } from "vitest";
import { NAV_SECTIONS, isActive } from "@/lib/ui/nav";

describe("nav", () => {
  it("matches the root exactly and other routes by prefix", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/posts", "/")).toBe(false);
    expect(isActive("/posts/abc", "/posts")).toBe(true);
    expect(isActive("/settings/accounts", "/settings/accounts")).toBe(true);
  });
  it("exposes exactly the ready routes", () => {
    const ready = NAV_SECTIONS.flatMap((s) => s.items).filter((i) => i.ready).map((i) => i.href);
    expect(ready).toEqual(["/", "/posts", "/inbox", "/drafts", "/share", "/settings/accounts"]);
  });
});
