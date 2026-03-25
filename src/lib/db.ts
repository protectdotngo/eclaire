import pg from "pg";

declare global {
    var pgPool: pg.Pool | undefined;
}

const { Pool } = pg;

const poolConfig = {
    host: import.meta.env.SCW_DB_HOST,
    user: import.meta.env.SCW_DB_USER,
    password: import.meta.env.SCW_DB_PASS,
    database: import.meta.env.SCW_DB_NAME,
    port: import.meta.env.SCW_DB_PORT,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
};

export const pool = globalThis.pgPool || new Pool(poolConfig);
