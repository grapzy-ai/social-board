import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { InstagramAdapter } from "@/lib/adapters/instagram";

const fx = (n: string) => JSON.parse(readFileSync(path.join(__dirname, "../fixtures/instagram", n), "utf8"));

function mockFetch(router: (url: string, n: number) => { status?: number; body: unknown }) {
  let n = 0;
  const f = vi.fn(async (input: RequestInfo | URL) => {
    n += 1;
    const { status = 200, body } = router(String(input), n);
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  });
  vi.stubGlobal("fetch", f);
  return f;
}

describe("InstagramAdapter", () => {
  let adapter: InstagramAdapter;
  beforeEach(() => {
    adapter = new InstagramAdapter({ igId: "17841400000000000", token: "TOKEN" });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("maps media product types to formats", async () => {
    mockFetch(() => ({ body: fx("media.json") }));
    const posts = await adapter.listPosts(new Date("2026-09-01T00:00:00Z"));
    expect(posts.map((p) => p.format)).toEqual(["reel", "carousel", "image"]);
    expect(posts[0].mediaUrl).toBe("https://cdn.example/9001.jpg");
    expect(posts[0].text).toContain("1200 кампаний");
  });

  it("maps reel insights incl. avg watch time in seconds and saves", async () => {
    mockFetch(() => ({ body: fx("reel_insights.json") }));
    const m = await adapter.postMetrics("9001", "reel");
    expect(m).toEqual({ views: 2090, reach: 1800, likes: 60, comments: 4, saves: 15, shares: 7, reposts: 1, clicks: null, avgWatchTimeSec: 8.4 });
  });

  it("requests feed metrics without reel-only fields and leaves avgWatchTimeSec null", async () => {
    const f = mockFetch(() => ({ body: fx("image_insights.json") }));
    const m = await adapter.postMetrics("9003", "image");
    expect(m.avgWatchTimeSec).toBeNull();
    expect(m.views).toBe(638);
    expect(String(f.mock.calls[0][0])).not.toContain("ig_reels_avg_watch_time");
  });

  it("falls back to a reduced metric set when the API rejects a metric (#100) and sets views null", async () => {
    mockFetch((url, n) =>
      n === 1
        ? { status: 400, body: { error: { message: "(#100) metric[0] must be one of ...", code: 100 } } }
        : { body: { data: [{ name: "likes", values: [{ value: 21 }] }, { name: "comments", values: [{ value: 2 }] }] } },
    );
    const m = await adapter.postMetrics("9001", "reel");
    expect(m.views).toBeNull();
    expect(m.likes).toBe(21);
  });

  it("reads followers from the user endpoint and profile views from user insights", async () => {
    mockFetch((url) => (url.includes("/insights") ? { body: fx("user_insights.json") } : { body: fx("user.json") }));
    const a = await adapter.accountMetrics();
    expect(a).toEqual({ followers: 693, profileViews: 42, reach: 1500 });
  });
});
