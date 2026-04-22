import "server-only";

import path from "path";

import dotenv from "dotenv";

import { appEnvSchema } from "@governix/shared/env";

let cachedEnv: ReturnType<typeof appEnvSchema.parse> | null = null;

export function getAppEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
  cachedEnv = appEnvSchema.parse(process.env);
  return cachedEnv;
}
