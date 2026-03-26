// PPM Phase 1: LISTEN/NOTIFY listener for task status changes
// Listens on ppm_task_status_change channel and logs events.
// Phase 2 will add routing logic (Master -> Internal -> Client visibility).

import { Client, Notification } from "pg";
import dbConfig from "../../config/db-config";

interface PpmTaskStatusChangePayload {
  task_id: string;
  project_id: string;
  old_status_id: string;
  new_status_id: string;
  updated_at: string;
}

const TASK_CHANNEL = "ppm_task_status_change";
const DELIVERABLE_CHANNEL = "ppm_status_change";
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

      this.client.on("notification", (notification: Notification) => {
        if (!notification.payload) return;
        try {
          if (notification.channel === TASK_CHANNEL) {
            const payload: PpmTaskStatusChangePayload = JSON.parse(notification.payload);
            console.info("[PPM] Task status change:", payload);
            // Phase 2: Route to client portal, trigger webhooks
          } else if (notification.channel === DELIVERABLE_CHANNEL) {
            const payload = JSON.parse(notification.payload);
            console.info("[PPM] Deliverable status change:", payload);
            // Phase 2: Route through Master->Internal->Client visibility layers
          }
        } catch (err) {
          console.error("[PPM] Failed to parse status change payload:", err);
        }
      });

      this.client.on("error", (err: Error) => {
        this.error(err);
        this.scheduleReconnect();
      });

      this.connected = true;
      this.reconnectAttempts = 0;
      console.info("[PPM] PpmStatusChangeListener connected.");
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
