// Loads .env then .env.local so Prisma CLI matches Next.js local overrides.
import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local", override: true });

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // Migrations need a Postgres URL (not Supabase anon/service keys — those are for HTTP APIs only).
  // Prefer DIRECT_URL = Session pooler :5432 on *.pooler.supabase.com if db.*.supabase.co is unreachable (IPv4).
  datasource: {
    url: env("DIRECT_URL"),
  },
});
