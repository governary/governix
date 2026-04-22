import path from "path";

import dotenv from "dotenv";
import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { appEnvSchema } from "@governix/shared/env";

import * as schema from "./schema";

let database: PostgresJsDatabase<typeof schema> | null = null;
let sqlClient: postgres.Sql | null = null;

function getDatabaseUrl() {
  dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
  const env = appEnvSchema.parse(process.env);
  return env.DATABASE_URL;
}

export function getSqlClient() {
  if (!sqlClient) {
    sqlClient = postgres(getDatabaseUrl(), {
      max: 1
    });
  }

  return sqlClient;
}

export function getDb() {
  if (!database) {
    database = drizzle(getSqlClient(), { schema });
  }

  return database;
}

export async function withTransaction<T>(callback: (tx: PostgresJsDatabase<typeof schema>) => Promise<T>) {
  return getDb().transaction(async (tx) => callback(tx as PostgresJsDatabase<typeof schema>));
}
