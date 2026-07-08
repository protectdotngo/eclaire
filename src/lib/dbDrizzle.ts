import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";

export const db = drizzle({
  connection: {
    user: process.env.SCW_DB_USER,
    password: process.env.SCW_DB_PASS,
    host: process.env.SCW_DB_HOST,
    port: parseInt(process.env.SCW_DB_PORT ?? "5432", 10),
    database: process.env.SCW_DB_NAME,
    ssl: false,
  },
});
