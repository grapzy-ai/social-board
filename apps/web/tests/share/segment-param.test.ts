import { describe, it, expect, vi } from "vitest";

const getShareStats = vi.fn(async (_db: unknown, _language: unknown) => ({ handle: "x", from: "2026-10-01", to: "2026-10-02", days: 2, totalDelta: null, totalPct: null, totalViews: 0, perPlatform: [], series: [], hasData: false }));
vi.mock("@/lib/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/share/query", () => ({ getShareStats: (db: unknown, language: unknown) => getShareStats(db, language) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "ru" }) }) }));

import { GET } from "@/app/api/share/route";

describe("share route segment", () => {
  it("prefers an explicit seg param over the cookie", async () => {
    await GET(new Request("http://x/api/share?format=square&theme=light&seg=en"));
    expect(getShareStats.mock.calls.at(-1)?.[1]).toBe("en");
    await GET(new Request("http://x/api/share?format=square&theme=light"));
    expect(getShareStats.mock.calls.at(-1)?.[1]).toBe("ru");
  }, 30000);
});
