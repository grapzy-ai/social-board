import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ShareStats } from "@/lib/share/compute";

const fixture: ShareStats & { handle: string } = {
  handle: "vadimbordian",
  from: "2026-09-21",
  to: "2026-10-20",
  days: 30,
  totalDelta: 1234,
  totalPct: 18.2,
  totalViews: 456_000,
  perPlatform: [
    { accountId: "a", platform: "telegram", language: "ru", handle: "vadimbordian", delta: 400, pct: 22, color: "#3987e5" },
    { accountId: "b", platform: "instagram", language: "ru", handle: "vadim.bordian", delta: 834, pct: 15.1, color: "#d55181" },
  ],
  series: Array.from({ length: 30 }, (_, i) => ({ date: `2026-10-${String((i % 28) + 1).padStart(2, "0")}`, stacked: [i * 13, i * 13 + i * 28] })),
  hasData: true,
};

vi.mock("@/lib/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/share/query", () => ({ getShareStats: async () => fixture }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "ru" }) }) }));

import { shareCard } from "@/lib/share/card";
import { GET } from "@/app/api/share/route";

describe("share card", () => {
  it("renders the handle, the headline number, the period and every platform", () => {
    const html = renderToStaticMarkup(shareCard(fixture, { format: "story", theme: "dark" }));
    expect(html).toContain("@vadimbordian");
    expect(html).toContain("1 234");
    expect(html).toContain("за 30 дней");
    expect(html).toContain("Telegram");
    expect(html).toContain("Instagram");
    expect(html).toContain("456 тыс.");
  });
  it("says there is no data instead of showing zeros", () => {
    const html = renderToStaticMarkup(shareCard({ ...fixture, hasData: false, totalDelta: null, totalPct: null }, { format: "square", theme: "light" }));
    expect(html).toContain("пока нет данных");
    expect(html).not.toContain("+0");
  });
  it("rejects unknown format or theme with 400", async () => {
    const r1 = await GET(new Request("http://x/api/share?format=poster&theme=light"));
    expect(r1.status).toBe(400);
    const r2 = await GET(new Request("http://x/api/share?format=square&theme=neon"));
    expect(r2.status).toBe(400);
  });
  it("returns a PNG for a valid request", async () => {
    const r = await GET(new Request("http://x/api/share?format=square&theme=light&period=30"));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/^image\/png/);
    const buf = Buffer.from(await r.arrayBuffer());
    expect(buf.subarray(1, 4).toString()).toBe("PNG");
  }, 30000);
});

describe("share card negatives and segment param", () => {
  it("renders a decline honestly: no '+-' and no green up-arrow", () => {
    const neg = { ...fixture, totalDelta: -12, totalPct: -12, perPlatform: [{ ...fixture.perPlatform[0], delta: -12, pct: -12 }] };
    const html = renderToStaticMarkup(shareCard(neg, { format: "square", theme: "light" }));
    expect(html).not.toContain("+-");
    expect(html).toContain("−12");
    expect(html).toContain("↘");
    expect(html).not.toContain("↗");
  });
  it("separates stacked layers with a surface-coloured stroke", () => {
    const html = renderToStaticMarkup(shareCard(fixture, { format: "square", theme: "light" }));
    expect(html).toContain('stroke="#fcfcfb"');
  });
});
