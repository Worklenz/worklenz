import { CronJob } from "cron";
import { PoolClient } from "pg";

import db from "../config/db";
import { log_error } from "../shared/utils";
import { getActiveTeamMemberCount } from "../shared/paddle-utils";

const TIME = process.env.SEAT_RECONCILIATION_INTERVAL || "0 3 * * *";
const ADVISORY_LOCK_ID = 900211;

export interface ISeatDrift {
  ownerId: string;
  quantity: number;
  members: number;
}

/**
 * Members above the purchased seats means the team is using seats it is not paying for
 * (a missed webhook, or members added while the subscription was out of sync). Fewer members than
 * seats is normal (seats are bought ahead), so only the first case is reported.
 */
export function findSeatDrift(owners: Array<{ ownerId: string; quantity: number; members: number }>): ISeatDrift[] {
  return owners.filter((owner) => owner.quantity > 0 && owner.members > owner.quantity);
}

async function onReconcileTick(): Promise<void> {
  let lockClient: PoolClient | null = null;
  let locked = false;

  try {
    lockClient = await db.pool.connect();
    const lock = await lockClient.query("SELECT pg_try_advisory_lock($1) AS acquired;", [ADVISORY_LOCK_ID]);
    locked = lock.rows[0]?.acquired === true;
    if (!locked) return;

    const subscriptions = await lockClient.query(
      `SELECT user_id, quantity::INT AS quantity
         FROM licensing_user_subscriptions
        WHERE billing_provider = 'paddle_billing'
          AND active IS TRUE
          AND COALESCE(status, '') IN ('active', 'trialing', 'past_due')
          AND quantity > 0;`
    );

    const owners = [];
    for (const row of subscriptions.rows) {
      const counted = await getActiveTeamMemberCount(row.user_id);
      owners.push({ ownerId: row.user_id, quantity: row.quantity, members: counted?.user_count ?? 0 });
    }

    const drift = findSeatDrift(owners);
    for (const item of drift) {
      console.warn(
        `[seat-reconcile] owner ${item.ownerId} has ${item.members} active members but only ${item.quantity} paid seats`
      );
    }
    console.info(`[seat-reconcile] checked ${owners.length} subscriptions, ${drift.length} over their paid seats`);
  } catch (error) {
    log_error(error);
  } finally {
    if (lockClient) {
      if (locked) {
        try {
          await lockClient.query("SELECT pg_advisory_unlock($1);", [ADVISORY_LOCK_ID]);
        } catch (error) {
          log_error(error);
        }
      }
      lockClient.release();
    }
  }
}

export function startSeatReconciliationJob(): void {
  new CronJob(TIME, () => void onReconcileTick(), null, true);
}
