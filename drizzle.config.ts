import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle',
  schema: './src/db/test.ts',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.SCW_DB_HOST!,
    port: Number(process.env.SCW_DB_PORT),
    user: process.env.SCW_DB_USER!,
    password: process.env.SCW_DB_PASS!,
    database: process.env.SCW_DB_NAME!,
    ssl: "require",
  },
  schemaFilter:["test"],
});
