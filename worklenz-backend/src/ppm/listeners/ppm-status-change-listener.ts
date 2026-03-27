// PPM Phase 1+2: LISTEN/NOTIFY listener for task status changes and new task creation
// Channels:
//   ppm_task_status_change — Worklenz task status changes (Phase 1)
//   ppm_status_change — deliverable status changes (Phase 1)
//   ppm_task_created — new portal task submissions (Phase 2)

import { Client, Notification } from "pg";
import dbConfig from "../../config/db-config";
import db from "../../config/db";
import { sendEmail, EmailRequest } from "../../shared/email";
import { log_error } from "../../shared/utils";

/** Escape HTML special characters to prevent XSS in email bodies */
function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

interface PpmTaskStatusChangePayload {
  task_id: string;
  project_id: string;
  old_status_id: string;
  new_status_id: string;
  updated_at: string;
}

interface PpmTaskCreatedPayload {
  deliverable_id: string;
  task_id: string;
  project_id: string;
  client_id: string;
  title: string;
}

interface PpmDeliverableStatusChangePayload {
  deliverable_id: string;
  old_status: string;
  new_status: string;
  client_id: string;
}

const TASK_CHANNEL = "ppm_task_status_change";
const DELIVERABLE_CHANNEL = "ppm_status_change";
const TASK_CREATED_CHANNEL = "ppm_task_created";
const BASE_RECONNECT_MS = 5000;
const MAX_RECONNECT_MS = 60000;

export default class PpmStatusChangeListener {
  private static connected = false;
  private static client: Client | null = null;
  private static reconnectAttempts = 0;

  public static async connect() {
    try {
      this.client = new Client(dbConfig);
      await this.client.connect();

      await this.client.query(`LISTEN ${TASK_CHANNEL}`);
      await this.client.query(`LISTEN ${DELIVERABLE_CHANNEL}`);
      await this.client.query(`LISTEN ${TASK_CREATED_CHANNEL}`);

      this.client.on("notification", (notification: Notification) => {
        if (!notification.payload) return;
        try {
          if (notification.channel === TASK_CHANNEL) {
            const payload: PpmTaskStatusChangePayload = JSON.parse(notification.payload);
            console.info("[PPM] Task status change:", payload);
            void this.handleTaskStatusChange(payload);
          } else if (notification.channel === DELIVERABLE_CHANNEL) {
            const payload: PpmDeliverableStatusChangePayload = JSON.parse(notification.payload);
            console.info("[PPM] Deliverable status change:", payload);
            void this.handleDeliverableStatusChange(payload);
          } else if (notification.channel === TASK_CREATED_CHANNEL) {
            const payload: PpmTaskCreatedPayload = JSON.parse(notification.payload);
            console.info("[PPM] New task created:", payload);
            void this.handleTaskCreated(payload);
          }
        } catch (err) {
          console.error("[PPM] Failed to parse notification payload:", err);
        }
      });

      this.client.on("error", (err: Error) => {
        this.error(err);
        this.scheduleReconnect();
      });

      this.connected = true;
      this.reconnectAttempts = 0;
      console.info("[PPM] PpmStatusChangeListener connected (3 channels).");
    } catch (err: any) {
      this.error(err);
      this.scheduleReconnect();
    }
  }

  public static disconnect() {
    if (!this.connected || !this.client) return;
    this.client.end().catch(() => {});
    this.connected = false;
    console.info("[PPM] PpmStatusChangeListener disconnected.");
  }

  // Phase 2 (F1): Email partner(s) when a client submits a new task
  private static async handleTaskCreated(payload: PpmTaskCreatedPayload) {
    try {
      // Find partner(s) linked to this client
      const result = await db.query(
        `SELECT DISTINCT u.email, u.name
         FROM ppm_client_partners cp
         JOIN ppm_internal_users iu ON iu.user_id = cp.user_id
         JOIN users u ON u.id = cp.user_id
         WHERE cp.client_id = $1`,
        [payload.client_id]
      );

      if (!result.rows.length) return;

      // Get client name for the email
      const clientResult = await db.query(
        `SELECT name FROM ppm_clients WHERE id = $1`,
        [payload.client_id]
      );
      const clientName = clientResult.rows[0]?.name || "A client";

      const emails = result.rows
        .map((r: any) => r.email)
        .filter((e: string) => !!e);

      if (!emails.length) return;

      const safeTitle = escapeHtml(payload.title);
      const safeClientName = escapeHtml(clientName);

      const email = new EmailRequest(
        emails,
        `New Task Submitted: ${payload.title}`,
        `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0061FF;">New Task Submission</h2>
          <p><strong>${safeClientName}</strong> submitted a new task that needs your review:</p>
          <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0; font-size: 16px; font-weight: 600;">${safeTitle}</p>
          </div>
          <p>Log in to the admin dashboard to review and approve or return this task.</p>
          <p style="color: #8c8c8c; font-size: 13px; margin-top: 24px;">— PPM TaskFlow</p>
        </div>`
      );

      await sendEmail(email);
      console.info(`[PPM] Sent new-task email to ${emails.length} partner(s)`);
    } catch (err) {
      log_error(err);
      console.error("[PPM] Failed to send new-task email:", err);
    }
  }

  // Phase 2 (F3): Email client when deliverable moves to client_review
  private static async handleDeliverableStatusChange(payload: PpmDeliverableStatusChangePayload) {
    try {
      if (payload.new_status !== "client_review") return;

      // Get client users' emails
      const result = await db.query(
        `SELECT cu.email
         FROM ppm_client_users cu
         WHERE cu.client_id = $1 AND cu.deactivated_at IS NULL`,
        [payload.client_id]
      );

      if (!result.rows.length) return;

      // Get deliverable title
      const delResult = await db.query(
        `SELECT title FROM ppm_deliverables WHERE id = $1`,
        [payload.deliverable_id]
      );
      const title = delResult.rows[0]?.title || "A deliverable";

      const emails = result.rows
        .map((r: any) => r.email)
        .filter((e: string) => !!e);

      if (!emails.length) return;

      const safeTitle = escapeHtml(title);

      const email = new EmailRequest(
        emails,
        `Ready for Review: ${title}`,
        `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0061FF;">Ready for Your Review</h2>
          <p>A deliverable is ready for your review:</p>
          <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0; font-size: 16px; font-weight: 600;">${safeTitle}</p>
          </div>
          <p>Log in to the client portal to review, approve, or request revisions.</p>
          <p style="color: #8c8c8c; font-size: 13px; margin-top: 24px;">— PPM TaskFlow</p>
        </div>`
      );

      await sendEmail(email);
      console.info(`[PPM] Sent client-review email to ${emails.length} client user(s)`);
    } catch (err) {
      log_error(err);
      console.error("[PPM] Failed to send client-review email:", err);
    }
  }

  // Phase 2: Log task status changes (future: webhook dispatch)
  private static async handleTaskStatusChange(payload: PpmTaskStatusChangePayload) {
    try {
      console.info("[PPM] Task status change processed:", payload.task_id);
      // Future: webhook dispatch, Slack notifications, etc.
    } catch (err) {
      log_error(err);
    }
  }

  private static scheduleReconnect() {
    const delay = Math.min(
      BASE_RECONNECT_MS * Math.pow(2, this.reconnectAttempts),
      MAX_RECONNECT_MS
    );
    this.reconnectAttempts++;
    console.info(`[PPM] PpmStatusChangeListener reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`);
    setTimeout(() => void this.connect(), delay);
  }

  private static error(err: Error) {
    this.connected = false;
    console.error("[PPM] PpmStatusChangeListener error:", err.message);
  }
}
