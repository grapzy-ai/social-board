import { describe, it, expect } from "vitest";
import { getTableColumns } from "drizzle-orm";
import {
  accounts,
  posts,
  postMetricsSnapshots,
  accountMetricsDaily,
  benchmarks,
  goals,
  signals,
  syncRuns,
  manualMetrics,
} from "@/lib/db/schema";

describe("schema", () => {
  it("posts has the identity, taxonomy and label columns", () => {
    const cols = Object.keys(getTableColumns(posts));
    for (const c of ["externalId", "accountId", "format", "publishedAt", "pillarId", "rubric", "language", "label"]) {
      expect(cols).toContain(c);
    }
  });
  it("post snapshots carry dayIndex and the normalized metric set", () => {
    const cols = Object.keys(getTableColumns(postMetricsSnapshots));
    for (const c of ["dayIndex", "views", "reach", "likes", "comments", "saves", "reposts", "shares", "clicks", "avgWatchTimeSec"]) {
      expect(cols).toContain(c);
    }
  });
  it("accounts store encrypted token, expiry, language and role", () => {
    const cols = Object.keys(getTableColumns(accounts));
    for (const c of ["platform", "handle", "externalUserId", "language", "role", "tokenEnc", "tokenExpiresAt", "status"]) {
      expect(cols).toContain(c);
    }
  });
  it("every stage-1 table is exported", () => {
    for (const t of [accountMetricsDaily, benchmarks, goals, signals, syncRuns, manualMetrics]) {
      expect(Object.keys(getTableColumns(t)).length).toBeGreaterThan(2);
    }
  });
});
