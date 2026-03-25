/**
 * Kill-Shot Spike 1c (companion): Node.js LISTEN/NOTIFY Listener
 *
 * Proves: Express/Node.js can receive PG notifications and route them
 * to Socket.IO clients (or any handler) without polling.
 *
 * This is the application-layer component of the LISTEN/NOTIFY spike.
 * It listens on the 'ppm_status_change' channel and can:
 * - Emit Socket.IO events to connected client portal users
 * - Update ppm_routing_log status to 'completed'
 * - Trigger any downstream action (email, webhook, etc.)
 */

import { Client } from "pg";
// import { Server as SocketIOServer } from "socket.io"; // Worklenz already has this

interface StatusChangePayload {
    deliverable_id: string;
    old_status: string;
    new_status: string;
    client_id: string;
    visibility: string;
    timestamp: string;
}

/**
 * Start listening for PPM status change notifications.
 * Call this once at app startup (e.g., in app.ts after DB pool is ready).
 */
export async function startPpmNotificationListener(dbConfig: any /*, io: SocketIOServer */) {
    const client = new Client(dbConfig);
    await client.connect();
    await client.query("LISTEN ppm_status_change");

    console.log("[PPM] Listening for status change notifications on ppm_status_change");

    client.on("notification", async (msg) => {
        if (msg.channel !== "ppm_status_change" || !msg.payload) return;

        const payload: StatusChangePayload = JSON.parse(msg.payload);
        console.log("[PPM] Status change:", payload);

        // SECURITY: Never route internal_only deliverable events to client rooms
        const isClientVisible = payload.visibility === "client_visible";

        // Route based on new status
        switch (payload.new_status) {
            case "client_review":
                // Task moved to client review → notify client portal users
                // Only emit to client room if deliverable is client_visible
                if (isClientVisible) {
                    console.log(`[PPM] → Notify client ${payload.client_id}: deliverable ready for review`);
                    // io.to(`client:${payload.client_id}`).emit("deliverable:review", payload);
                } else {
                    console.log(`[PPM] → Internal-only deliverable ${payload.deliverable_id} skipped for client notification`);
                }
                break;

            case "approved":
                // Client approved → notify internal team
                console.log(`[PPM] → Notify internal: deliverable ${payload.deliverable_id} approved`);
                // io.to("internal").emit("deliverable:approved", payload);
                break;

            case "revision":
                // Client rejected → create revision task for assignee
                console.log(`[PPM] → Create revision task for deliverable ${payload.deliverable_id}`);
                break;

            default:
                console.log(`[PPM] → Status change logged: ${payload.old_status} → ${payload.new_status}`);
        }
    });

    // Handle disconnection gracefully
    client.on("error", (err) => {
        console.error("[PPM] Notification listener error:", err);
        // Reconnect logic would go here
    });

    return client;
}
