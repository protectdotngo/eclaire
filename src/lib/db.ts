import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  host: import.meta.env.SCW_DB_HOST,
  user: import.meta.env.SCW_DB_USER,
  password: import.meta.env.SCW_DB_PASS,
  database: import.meta.env.SCW_DB_NAME,
  port: import.meta.env.SCW_DB_PORT,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
});
