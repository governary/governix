import "dotenv/config";

import type { Config } from "drizzle-kit";

import { appEnvSchema } from "@governix/shared/env";

const env = appEnvSchema.parse(process.env);

export default {
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL
  }
} satisfies Config;
