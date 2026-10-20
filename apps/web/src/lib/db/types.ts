import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/** Any Drizzle Postgres database over our schema (postgres-js in prod, pglite in tests). */
export type AnyDb = PgDatabase<PgQueryResultHKT, typeof schema>;
