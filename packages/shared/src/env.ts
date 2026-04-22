import { z } from "zod";

export const appEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  APP_BASE_URL: z.string().url(),
  OBJECT_STORAGE_BUCKET: z.string().default("governix-exports"),
  OBJECT_STORAGE_REGION: z.string().default("us-east-1"),
  OBJECT_STORAGE_ACCESS_KEY: z.string().default("local-access-key"),
  OBJECT_STORAGE_SECRET_KEY: z.string().default("local-secret-key"),
  OBJECT_STORAGE_ENDPOINT: z.string().url().default("http://localhost:9000"),
  EXPORT_FILE_TTL_HOURS: z.coerce.number().int().positive().default(24)
});

export type AppEnv = z.infer<typeof appEnvSchema>;

