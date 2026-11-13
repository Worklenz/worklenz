import { randomInt } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import axios from "axios";
import db from "../config/db";
import { isSelfHostedDeployment } from "../shared/deployment-mode";

const ENDPOINT = "https://telemetry.worklenz.com/v1/heartbeat";
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

function isTelemetryEnabled(): boolean {
  const setting = process.env.WORKLENZ_TELEMETRY_ENABLED;
  return (setting === undefined || setting === "true") && isSelfHostedDeployment();
}

export async function sendTelemetryHeartbeat(): Promise<void> {
  if (!isTelemetryEnabled()) return;
  let reservation: { installationId: string; attemptedAt: string } | undefined;
  try {
    // The atomic reservation coordinates all replicas sharing this database.
    const result = await db.query(`
      INSERT INTO self_hosted_telemetry_state (singleton, last_attempt_at)
      VALUES (TRUE, NOW())
      ON CONFLICT (singleton) DO UPDATE SET last_attempt_at = NOW()
        WHERE self_hosted_telemetry_state.last_attempt_at < NOW() - INTERVAL '7 days'
      RETURNING installation_id, last_attempt_at::text AS attempted_at
    `);
    if (!result.rowCount) return;
    reservation = { installationId: result.rows[0].installation_id, attemptedAt: result.rows[0].attempted_at };
    const packageJson = JSON.parse(readFileSync(path.join(__dirname, "../../package.json"), "utf8")) as { version: string };
    await axios.post(ENDPOINT, {
      event: "installation_active",
      installation_id: reservation.installationId,
      version: packageJson.version,
    }, { timeout: 5000, maxRedirects: 0 });
  } catch {
    // Allow a retry after roughly one day; never overwrite a newer replica's reservation.
    if (reservation) {
      try {
        await db.query(`UPDATE self_hosted_telemetry_state
          SET last_attempt_at = NOW() - INTERVAL '6 days'
          WHERE installation_id = $1 AND last_attempt_at = $2::timestamptz`,
        [reservation.installationId, reservation.attemptedAt]);
      } catch {
        // A failed retry reservation must not affect application availability.
      }
    }
    console.warn("[telemetry] Heartbeat failed; the next attempt will be delayed.");
  }
}

export function startTelemetryHeartbeat(): void {
  if (!isTelemetryEnabled()) return;
  console.info("[telemetry] Installation heartbeat enabled (https://telemetry.worklenz.com/v1/heartbeat). Set WORKLENZ_TELEMETRY_ENABLED=false to disable. See TELEMETRY.md.");
  const timer = setTimeout(() => {
    void sendTelemetryHeartbeat();
    const interval = setInterval(() => void sendTelemetryHeartbeat(), CHECK_INTERVAL_MS);
    interval.unref();
  }, randomInt(CHECK_INTERVAL_MS));
  timer.unref();
}
