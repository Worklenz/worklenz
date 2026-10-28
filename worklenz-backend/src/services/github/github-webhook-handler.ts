import { Request, Response } from "express";
import db from "../../config/db";
import { GithubAppService } from "./github-app.service";
import { verifyGithubSignature } from "./github-webhook-signature";

/**
 * POST /webhook/github
 * Verifies the signature over the raw body, stores the event (idempotent by delivery id) and
 * acknowledges immediately. Processing happens in the background worker.
 */
export async function githubWebhookHandler(req: Request & { rawBodyBuffer?: Buffer }, res: Response) {
  const config = GithubAppService.getConfig();
  if (!config) return res.status(404).json({ done: false, message: "GitHub integration is not configured" });

  const signature = req.headers["x-hub-signature-256"] as string | undefined;
  const raw = req.rawBodyBuffer;
  if (!raw || !verifyGithubSignature(raw, signature, config.webhookSecret)) {
    return res.status(401).json({ done: false, message: "Invalid signature" });
  }

  const deliveryId = req.headers["x-github-delivery"] as string | undefined;
  const eventType = req.headers["x-github-event"] as string | undefined;
  if (!deliveryId || !eventType) {
    return res.status(400).json({ done: false, message: "Missing GitHub headers" });
  }

  if (eventType === "ping") return res.status(200).json({ done: true });

  const payload = req.body;
  try {
    await db.query(
      `INSERT INTO github_webhook_events (delivery_id, event_type, installation_id, payload)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (delivery_id) DO NOTHING`,
      [deliveryId, eventType, payload?.installation?.id ?? null, JSON.stringify(payload)],
    );
  } catch (error) {
    console.error("[GitHub Webhook] Failed to enqueue event", error);
    return res.status(500).json({ done: false, message: "Failed to enqueue" });
  }
  return res.status(202).json({ done: true });
}
