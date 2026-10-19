import type { PostFormat } from "@/lib/db/schema";

export interface NormalizedPost {
  externalId: string;
  format: PostFormat;
  publishedAt: Date;
  text: string | null;
  mediaUrl: string | null;
  permalink: string | null;
}

export interface NormalizedPostMetrics {
  views: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  reposts: number | null;
  shares: number | null;
  clicks: number | null;
  reach: number | null;
  avgWatchTimeSec: number | null;
}

export interface NormalizedAccountMetrics {
  followers: number | null;
  profileViews: number | null;
  reach: number | null;
}

export interface TokenRefresh {
  token: string;
  expiresAt: Date;
}

export interface Adapter {
  listPosts(since: Date): Promise<NormalizedPost[]>;
  postMetrics(externalId: string, format?: PostFormat): Promise<NormalizedPostMetrics>;
  accountMetrics(): Promise<NormalizedAccountMetrics>;
  refreshToken(): Promise<TokenRefresh>;
}

export const EMPTY_METRICS: NormalizedPostMetrics = {
  views: null,
  likes: null,
  comments: null,
  saves: null,
  reposts: null,
  shares: null,
  clicks: null,
  reach: null,
  avgWatchTimeSec: null,
};
