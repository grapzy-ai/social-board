import { fetchJson, qs, insightsToMap } from "./meta-http";
import type { Adapter, NormalizedPost, NormalizedPostMetrics, NormalizedAccountMetrics, TokenRefresh } from "./types";
import { EMPTY_METRICS } from "./types";

const BASE = "https://graph.threads.net/v1.0";

interface ThreadsMedia {
  id: string;
  media_type: string;
  text?: string;
  permalink?: string;
  timestamp: string;
  media_url?: string;
  thumbnail_url?: string;
}

interface Paged<T> {
  data: T[];
  paging?: { cursors?: { after?: string }; next?: string };
}

export class ThreadsAdapter implements Adapter {
  private userId: string;
  private token: string;
  constructor(opts: { userId: string; token: string }) {
    this.userId = opts.userId;
    this.token = opts.token;
  }

  async listPosts(since: Date): Promise<NormalizedPost[]> {
    const out: NormalizedPost[] = [];
    let url: string | undefined = `${BASE}/${this.userId}/threads?${qs({
      fields: "id,media_type,text,permalink,timestamp,media_url,thumbnail_url,is_quote_post",
      since: Math.floor(since.getTime() / 1000),
      limit: 100,
    })}`;
    while (url) {
      const page: Paged<ThreadsMedia> = await fetchJson<Paged<ThreadsMedia>>(url, { token: this.token });
      for (const m of page.data ?? []) {
        if (m.media_type === "REPOST_FACADE") continue;
        out.push({
          externalId: m.id,
          format: "thread",
          publishedAt: new Date(m.timestamp),
          text: m.text ?? null,
          mediaUrl: m.media_url ?? m.thumbnail_url ?? null,
          permalink: m.permalink ?? null,
        });
      }
      url = page.paging?.next;
    }
    return out;
  }

  async postMetrics(externalId: string): Promise<NormalizedPostMetrics> {
    const url = `${BASE}/${externalId}/insights?${qs({ metric: "views,likes,replies,reposts,quotes" })}`;
    const res = await fetchJson<{ data: Parameters<typeof insightsToMap>[0] }>(url, { token: this.token });
    const m = insightsToMap(res.data);
    const num = (k: string) => (typeof m[k] === "number" ? m[k] : null);
    const reposts = num("reposts");
    const quotes = num("quotes");
    return {
      ...EMPTY_METRICS,
      views: num("views"),
      likes: num("likes"),
      comments: num("replies"),
      reposts: reposts === null && quotes === null ? null : (reposts ?? 0) + (quotes ?? 0),
    };
  }

  async accountMetrics(): Promise<NormalizedAccountMetrics> {
    const url = `${BASE}/${this.userId}/threads_insights?${qs({ metric: "views,followers_count" })}`;
    const res = await fetchJson<{ data: Parameters<typeof insightsToMap>[0] }>(url, { token: this.token });
    const m = insightsToMap(res.data);
    return {
      followers: typeof m.followers_count === "number" ? m.followers_count : null,
      profileViews: typeof m.views === "number" ? m.views : null,
      reach: null,
    };
  }

  async refreshToken(): Promise<TokenRefresh> {
    const url = `${BASE}/refresh_access_token?${qs({ grant_type: "th_refresh_token" })}`;
    const res = await fetchJson<{ access_token: string; expires_in: number }>(url, { token: this.token });
    return { token: res.access_token, expiresAt: new Date(Date.now() + res.expires_in * 1000) };
  }
}
