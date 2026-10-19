import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync } from "node:fs";
import path from "node:path";
import * as schema from "@/lib/db/schema";

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

/** Fresh in-memory Postgres with the real migration applied (RLS block stripped — pglite has no `authenticated` role). */
export async function makeTestDb(): Promise<{ db: TestDb; client: PGlite }> {
  const client = new PGlite();
  const sql = readFileSync(path.join(__dirname, "../../../../supabase/migrations/0001_core.sql"), "utf8");
  const ddl = sql.split("-- Row Level Security")[0];
  await client.exec(ddl);
  const db = drizzle(client, { schema });
  return { db, client };
}
