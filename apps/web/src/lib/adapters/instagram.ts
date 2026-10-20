import { fetchJson, qs, insightsToMap, MetaApiError } from "./meta-http";
import type { Adapter, NormalizedPost, NormalizedPostMetrics, NormalizedAccountMetrics, TokenRefresh } from "./types";
import { EMPTY_METRICS } from "./types";
import type { PostFormat } from "@/lib/db/schema";

const BASE = "https://graph.instagram.com/v26.0";

interface IgMedia {
  id: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_product_type?: "FEED" | "REELS" | "STORY" | "AD";
  caption?: string;
  permalink?: string;
  timestamp: string;
  media_url?: string;
  thumbnail_url?: string;
}

interface Paged<T> {
  data: T[];
  paging?: { next?: string };
}

export function igFormat(m: Pick<IgMedia, "media_type" | "media_product_type">): PostFormat {
  if (m.media_product_type === "REELS") return "reel";
  if (m.media_type === "CAROUSEL_ALBUM") return "carousel";
  return "image";
}

const BASE_METRICS = ["views", "reach", "likes", "comments", "saved", "shares", "reposts"];
const REEL_METRICS = [...BASE_METRICS, "ig_reels_avg_watch_time"];
const FALLBACK_METRICS = ["likes", "comments", "saved", "shares"];

export class InstagramAdapter implements Adapter {
  private igId: string;
  private token: string;
  constructor(opts: { igId: string; token: string }) {
    this.igId = opts.igId;
    this.token = opts.token;
  }

  async listPosts(since: Date): Promise<NormalizedPost[]> {
    const out: NormalizedPost[] = [];
    let url: string | undefined = `${BASE}/${this.igId}/media?${qs({
      fields: "id,media_type,media_product_type,caption,permalink,timestamp,thumbnail_url,media_url",
      since: Math.floor(since.getTime() / 1000),
      limit: 100,
    })}`;
    while (url) {
      const page: Paged<IgMedia> = await fetchJson<Paged<IgMedia>>(url, { token: this.token });
      for (const m of page.data ?? []) {
        if (m.media_product_type === "STORY") continue;
        out.push({
          externalId: m.id,
          format: igFormat(m),
          publishedAt: new Date(m.timestamp),
          text: m.caption ?? null,
          mediaUrl: m.thumbnail_url ?? m.media_url ?? null,
          permalink: m.permalink ?? null,
        });
      }
      url = page.paging?.next;
    }
    return out;
  }

  private async insights(externalId: string, metrics: string[]): Promise<Record<string, number>> {
    const url = `${BASE}/${externalId}/insights?${qs({ metric: metrics.join(",") })}`;
    const res = await fetchJson<{ data: Parameters<typeof insightsToMap>[0] }>(url, { token: this.token });
    return insightsToMap(res.data);
  }

  async postMetrics(externalId: string, format: PostFormat = "image"): Promise<NormalizedPostMetrics> {
    let m: Record<string, number>;
    try {
      m = await this.insights(externalId, format === "reel" ? REEL_METRICS : BASE_METRICS);
    } catch (e) {
      // (#100) — metric not supported for this media (older posts); retry with the safe subset.
      if (e instanceof MetaApiError && e.code === 100) m = await this.insights(externalId, FALLBACK_METRICS);
      else throw e;
    }
    const num = (k: string) => (typeof m[k] === "number" ? m[k] : null);
    const watchMs = num("ig_reels_avg_watch_time");
    return {
      ...EMPTY_METRICS,
      views: num("views"),
      reach: num("reach"),
      likes: num("likes"),
      comments: num("comments"),
      saves: num("saved"),
      shares: num("shares"),
      reposts: num("reposts"),
      avgWatchTimeSec: watchMs === null ? null : Math.round(watchMs / 10) / 100,
    };
  }

  async accountMetrics(): Promise<NormalizedAccountMetrics> {
    const user = await fetchJson<{ followers_count?: number }>(`${BASE}/${this.igId}?${qs({ fields: "id,username,followers_count" })}`, { token: this.token });
    let profileViews: number | null = null;
    let reach: number | null = null;
    try {
      const res = await fetchJson<{ data: Parameters<typeof insightsToMap>[0] }>(
        `${BASE}/${this.igId}/insights?${qs({ metric: "profile_views,reach", period: "day", metric_type: "total_value" })}`,
        { token: this.token },
      );
      const m = insightsToMap(res.data);
      profileViews = typeof m.profile_views === "number" ? m.profile_views : null;
      reach = typeof m.reach === "number" ? m.reach : null;
    } catch (e) {
      if (!(e instanceof MetaApiError) || e.isAuth) throw e;
    }
    return { followers: typeof user.followers_count === "number" ? user.followers_count : null, profileViews, reach };
  }

  async refreshToken(): Promise<TokenRefresh> {
    const res = await fetchJson<{ access_token: string; expires_in: number }>(
      `${BASE}/refresh_access_token?${qs({ grant_type: "ig_refresh_token" })}`,
      { token: this.token },
    );
    return { token: res.access_token, expiresAt: new Date(Date.now() + res.expires_in * 1000) };
  }
}
