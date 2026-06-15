import { config } from "dotenv";
import path from "node:path";
import { defineConfig } from "prisma/config";

config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

function withAppSchema(url: string) {
  if (!url) return url;
  if (url.includes("schema=")) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}schema=neural_ops`;
}

// Resolve the direct (non-pooled) connection URL from any of the names the
// Supabase integration may provide. Fall back to an empty string so that
// `prisma generate` (which only needs the schema, not a live connection)
// never throws during a build where the env var is absent.
const directUrl =
  process.env.DIRECT_URL ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  "";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: withAppSchema(directUrl),
  },
});
