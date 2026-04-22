import "dotenv/config";

import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { getSqlClient } from "./client";

async function main() {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  const migrationPath = path.resolve(currentDir, "../drizzle/0000_init.sql");
  const migrationSql = await readFile(migrationPath, "utf8");
  await getSqlClient().unsafe(migrationSql);
  await getSqlClient().end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
