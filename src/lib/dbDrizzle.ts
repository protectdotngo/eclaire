import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";

const encodedPass = encodeURIComponent(process.env.SCW_DB_PASS || "");

const dbUrl = `postgresql://${process.env.SCW_DB_USER}:${encodedPass}@${process.env.SCW_DB_HOST}:${process.env.SCW_DB_PORT}/${process.env.SCW_DB_NAME}?sslmode=no-verify`;

export const db = drizzle(dbUrl);
