// PPM Phase 1: LISTEN/NOTIFY listener for task status changes
// Listens on ppm_status_change channel and logs events.
// Phase 2 will add routing logic (Master → Internal → Client visibility).

import { Client, Notification } from "pg";
import dbConfig from "../../config/db-config";

interface PpmStatusChangePayload {
  task_id: string;
  project_id: string;
  old_status_id: string;
  new_status_id: string;
  updated_at: string;
}

export default class PpmStatusChangeListener {
  private static connected = false;
  private static client: Client | null = null;

  public static async connect() {
    try {
      this.client = new Client(dbConfig);
      await this.client.connect();

      await this.client.query("UNLISTEN ppm_status_change");
      await this.client.query("LISTEN ppm_status_change");

      this.client.on("notification", (notification: Notification) => {
        if (notification.channel === "ppm_status_change" && notification.payload) {
          try {
            const payload: PpmStatusChangePayload = JSON.parse(notification.payload);
            console.info("[PPM] Status change:", payload);
            // Phase 2: Route to client portal, trigger webhooks, update ppm_routing_log
          } catch (err) {
            console.error("[PPM] Failed to parse status change payload:", err);
          }
        }
      });

      this.client.on("error", (err: Error) => {
        this.error(err);
        // Reconnect after 5 seconds
        setTimeout(() => void this.connect(), 5000);
      });

      this.connected = true;
      console.info("[PPM] PpmStatusChangeListener connected.");
    } catch (err: any) {
      this.error(err);
      // Retry connection after 5 seconds
      setTimeout(() => void this.connect(), 5000);
    }
  }

  public static disconnect() {
    if (!this.connected || !this.client) return;
    this.client.end().catch(() => {});
    this.connected = false;
    console.info("[PPM] PpmStatusChangeListener disconnected.");
  }

  private static error(err: Error) {
    this.connected = false;
    console.error("[PPM] PpmStatusChangeListener error:", err.message);
  }
}
