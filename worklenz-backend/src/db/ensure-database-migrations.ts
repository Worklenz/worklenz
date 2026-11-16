import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

export async function ensureDatabaseMigrations(): Promise<void> {
  if (process.env.SKIP_DB_MIGRATIONS === "true") {
    return;
  }

  const rootDir = path.resolve(__dirname, "../..");
  const migrationScript = path.join(rootDir, "scripts", "migrate.js");

  if (!fs.existsSync(migrationScript)) {
    return;
  }

  console.info("[db] Applying pending database migrations...");

  const result = spawnSync(process.execPath, [migrationScript, "up"], {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Database migrations failed with exit code ${result.status ?? "unknown"}.`);
  }
}
