import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

const globalForDb = globalThis as unknown as { __sbSql?: ReturnType<typeof postgres> };

export function getSql() {
  if (!globalForDb.__sbSql) {
    globalForDb.__sbSql = postgres(required("DATABASE_URL"), { prepare: false, max: 5 });
  }
  return globalForDb.__sbSql;
}

export type Db = ReturnType<typeof drizzle<typeof schema>>;

let _db: Db | undefined;
export function getDb(): Db {
  if (!_db) _db = drizzle(getSql(), { schema });
  return _db;
}
