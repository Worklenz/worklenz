import db from "../../config/db";
import { processGithubEvent } from "./github-event-processor";

const MAX_ATTEMPTS = 3;
const STALE_PROCESSING_MINUTES = 10;

class GithubWebhookWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly intervalMs = 2000;

  start() {
    if (this.timer) return;
    void this.recoverStale();
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async recoverStale() {
    try {
      await db.query(
        `UPDATE github_webhook_events SET status = 'pending'
         WHERE status = 'processing'
           AND received_at < NOW() - ($1 || ' minutes')::INTERVAL`,
        [STALE_PROCESSING_MINUTES],
      );
    } catch (error) {
      console.error("[GithubWebhookWorker] Failed to recover stale events", error);
    }
  }

  private async claim() {
    const result = await db.query(
      `WITH next_event AS (
         SELECT id FROM github_webhook_events
         WHERE status = 'pending' AND next_attempt_at <= NOW()
         ORDER BY received_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       UPDATE github_webhook_events e
       SET status = 'processing', attempts = e.attempts + 1
       FROM next_event
       WHERE e.id = next_event.id
       RETURNING e.id, e.event_type, e.payload, e.attempts`,
    );
    return result.rows[0] || null;
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      // Drain a small batch per tick so bursts clear quickly.
      for (let i = 0; i < 20; i++) {
        const event = await this.claim();
        if (!event) break;
        try {
          const outcome = await processGithubEvent(event.event_type, event.payload);
          await db.query(
            `UPDATE github_webhook_events
             SET status = $2, processed_at = NOW(), error_message = NULL WHERE id = $1`,
            [event.id, outcome],
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const final = event.attempts >= MAX_ATTEMPTS;
          await db.query(
            `UPDATE github_webhook_events
             SET status = $2, error_message = $3,
                 next_attempt_at = NOW() + ($4 || ' seconds')::INTERVAL
             WHERE id = $1`,
            [event.id, final ? "failed" : "pending", message.slice(0, 1000), String(30 * 2 ** (event.attempts - 1))],
          );
        }
      }
    } catch (error) {
      console.error("[GithubWebhookWorker] tick failed", error);
    } finally {
      this.running = false;
    }
  }
}

export default new GithubWebhookWorker();
