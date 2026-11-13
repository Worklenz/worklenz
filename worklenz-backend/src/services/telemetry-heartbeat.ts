import { randomInt } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import axios from "axios";
import db from "../config/db";
import { isSelfHostedDeployment } from "../shared/deployment-mode";

const ENDPOINT = "https://telemetry.worklenz.com/v1/heartbeat";
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

export async function sendTelemetryHeartbeat(): Promise<void> {
  if (process.env.WORKLENZ_TELEMETRY_ENABLED !== "true" || !isSelfHostedDeployment()) return;
  try {
    // The atomic reservation prevents concurrent replicas from sending more than once a week.
    const result = await db.query(`
      INSERT INTO self_hosted_telemetry_state (singleton, last_attempt_at)
      VALUES (TRUE, NOW())
      ON CONFLICT (singleton) DO UPDATE SET last_attempt_at = NOW()
        WHERE self_hosted_telemetry_state.last_attempt_at < NOW() - INTERVAL '7 days'
      RETURNING installation_id
    `);
    if (!result.rowCount) return;
    const packageJson = JSON.parse(readFileSync(path.join(__dirname, "../../package.json"), "utf8")) as { version: string };
    await axios.post(ENDPOINT, {
      event: "installation_active",
      installation_id: result.rows[0].installation_id,
      version: packageJson.version,
    }, { timeout: 5000, maxRedirects: 0 });
  } catch {
    // Telemetry must never affect application startup or availability.
    console.warn("[telemetry] Heartbeat failed; it will be retried after the next weekly interval.");
  }
}

export function startTelemetryHeartbeat(): void {
  if (process.env.WORKLENZ_TELEMETRY_ENABLED !== "true" || !isSelfHostedDeployment()) return;
  const timer = setTimeout(() => {
    void sendTelemetryHeartbeat();
    const interval = setInterval(() => void sendTelemetryHeartbeat(), CHECK_INTERVAL_MS);
    interval.unref();
  }, randomInt(CHECK_INTERVAL_MS));
  timer.unref();
}
