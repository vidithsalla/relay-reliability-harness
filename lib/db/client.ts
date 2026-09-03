import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://relay:relay@localhost:5432/relay";

declare global {
  var relayPool: Pool | undefined;
}

export const pool =
  globalThis.relayPool ??
  new Pool({
    connectionString: databaseUrl
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.relayPool = pool;
}

export const db = drizzle(pool, { schema });

export async function closeDb(): Promise<void> {
  await pool.end();
  globalThis.relayPool = undefined;
}
