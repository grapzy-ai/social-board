import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ThreadsAdapter } from "@/lib/adapters/threads";
import { MetaApiError } from "@/lib/adapters/meta-http";

const fx = (n: string) => JSON.parse(readFileSync(path.join(__dirname, "../fixtures/threads", n), "utf8"));

function mockFetch(router: (url: string) => { status?: number; body: unknown }) {
  const f = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const { status = 200, body } = router(url);
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  });
  vi.stubGlobal("fetch", f);
  return f;
}

describe("ThreadsAdapter", () => {
  let adapter: ThreadsAdapter;
  beforeEach(() => {
    adapter = new ThreadsAdapter({ userId: "me", token: "TOKEN" });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("lists posts, dropping REPOST_FACADE, as normalized threads", async () => {
    mockFetch((url) => (url.includes("/me/threads") ? { body: fx("me_threads.json") } : { status: 404, body: {} }));
    const posts = await adapter.listPosts(new Date("2026-09-01T00:00:00Z"));
    expect(posts).toHaveLength(2);
    expect(posts[0]).toMatchObject({ externalId: "1001", format: "thread", permalink: "https://www.threads.net/@vadim.bordian/post/A1" });
    expect(posts[0].publishedAt).toBeInstanceOf(Date);
    expect(posts[0].publishedAt.toISOString()).toBe("2026-10-10T09:00:00.000Z");
    expect(posts[1].mediaUrl).toBe("https://cdn.example/1002.jpg");
  });

  it("maps media insights into the normalized metric set (quotes folded into reposts)", async () => {
    mockFetch(() => ({ body: fx("media_insights.json") }));
    const m = await adapter.postMetrics("1001");
    expect(m).toEqual({ views: 1200, likes: 40, comments: 12, reposts: 3, shares: null, saves: null, clicks: null, reach: null, avgWatchTimeSec: null });
  });

  it("returns views: null when the views metric is absent", async () => {
    mockFetch(() => ({ body: fx("media_insights_noviews.json") }));
    const m = await adapter.postMetrics("1002");
    expect(m.views).toBeNull();
    expect(m.likes).toBe(5);
  });

  it("reads follower count from user insights", async () => {
    mockFetch(() => ({ body: fx("user_insights.json") }));
    const a = await adapter.accountMetrics();
    expect(a.followers).toBe(130);
    expect(a.profileViews).toBe(450);
  });

  it("throws MetaApiError with isAuth on a 401 / code 190 response", async () => {
    mockFetch(() => ({ status: 401, body: { error: { message: "Invalid OAuth access token", code: 190 } } }));
    await expect(adapter.accountMetrics()).rejects.toMatchObject({ isAuth: true, status: 401 });
    await expect(adapter.accountMetrics()).rejects.toBeInstanceOf(MetaApiError);
  });

  it("sends the token as a bearer header, never in the query string", async () => {
    const f = mockFetch(() => ({ body: fx("user_insights.json") }));
    await adapter.accountMetrics();
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain("TOKEN");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer TOKEN");
  });
});
