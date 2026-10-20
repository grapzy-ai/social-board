import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchJson, MetaApiError, isRetryableMetaError } from "@/lib/adapters/meta-http";

describe("meta-http retry policy", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("treats Meta throttle codes (4, 17, 32, 613) as retryable even on HTTP 400", () => {
    expect(isRetryableMetaError(new MetaApiError("x", 400, 4))).toBe(true);
    expect(isRetryableMetaError(new MetaApiError("x", 403, 613))).toBe(true);
    expect(isRetryableMetaError(new MetaApiError("x", 400, 100))).toBe(false);
    expect(isRetryableMetaError(new MetaApiError("x", 401, 190))).toBe(false);
  });
  it("retries a throttled call and succeeds", async () => {
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      n += 1;
      return n === 1
        ? new Response(JSON.stringify({ error: { message: "rate", code: 4 } }), { status: 400 })
        : new Response(JSON.stringify({ ok: 1 }), { status: 200 });
    }));
    const r = await fetchJson<{ ok: number }>("http://x", { retries: 2, backoffMs: 1 });
    expect(r.ok).toBe(1);
    expect(n).toBe(2);
  });
});
