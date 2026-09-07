import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

// Explicit pool sizing: total connections = pods × DB_POOL_MAX, and must stay
// well under the Postgres instance's max_connections.
const pool = new pg.Pool({
  user: process.env.SCW_DB_USER,
  password: process.env.SCW_DB_PASS,
  host: process.env.SCW_DB_HOST,
  port: parseInt(process.env.SCW_DB_PORT ?? "5432", 10),
  database: process.env.SCW_DB_NAME,
  ssl: false,
  max: Number(process.env.DB_POOL_MAX) || 10,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
});

// Without a handler, an error on an idle client (e.g. DB failover) crashes the
// whole Node process.
pool.on("error", (err) => {
  console.error("Unexpected error on idle DB client:", err);
});

export const db = drizzle({ client: pool });
