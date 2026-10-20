import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { makeTestDb } from "../helpers/testdb";

describe("0003_lockdown migration", () => {
  it("drops the authenticated read policies on every table and keeps RLS enabled", async () => {
    const { client } = await makeTestDb();
    await client.exec(`ALTER TABLE accounts ENABLE ROW LEVEL SECURITY; CREATE POLICY accounts_read_authenticated ON accounts FOR SELECT USING (true);
      ALTER TABLE posts ENABLE ROW LEVEL SECURITY; CREATE POLICY posts_read_authenticated ON posts FOR SELECT USING (true);`);
    const sql = readFileSync(path.join(__dirname, "../../../../supabase/migrations/0003_lockdown.sql"), "utf8");
    await client.exec(sql);
    const pol = await client.query<{ n: number }>("select count(*)::int as n from pg_policies where schemaname='public'");
    expect(pol.rows[0].n).toBe(0);
    const rls = await client.query<{ relname: string; relrowsecurity: boolean }>(
      "select relname, relrowsecurity from pg_class where relname in ('accounts','posts')",
    );
    expect(rls.rows.every((r) => r.relrowsecurity)).toBe(true);
  });
});
