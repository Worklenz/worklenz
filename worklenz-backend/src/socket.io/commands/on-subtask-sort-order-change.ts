import { Server, Socket } from "socket.io";
import db from "../../config/db";
import { SocketEvents } from "../events";
import { getLoggedInUserIdFromSocket, log_error } from "../util";
import { verifyNonGuestTaskAccessSocket, logUnauthorizedSocketAccess } from "../authorization";
import { canUserEditTask } from "../../shared/assignee-task-scope";
import { ISocketSession } from "../../interfaces/socket-session";
import { IPassportSession } from "../../interfaces/passport-session";

interface SubtaskSortUpdate {
  task_id: string;
  sort_order: number;
}

interface SubtaskSortOrderChangeRequest {
  parent_task_id: string;
  subtask_updates: SubtaskSortUpdate[];
}

/**
 * Persists a subtask reorder, keeping all six sort-order columns in sync.
 *
 * Why all six columns?
 * ────────────────────
 * tasks-controller-v2 (getTasksV3) orders subtasks by status_sort_order,
 * priority_sort_order, or phase_sort_order depending on the active groupBy.
 * sub-tasks-controller orders by sort_order.  If only sort_order is updated
 * the drawer reflects the new order but the task list reverts on refresh.
 *
 * Collision avoidance — two-pass + SET CONSTRAINTS ALL DEFERRED
 * ─────────────────────────────────────────────────────────────
 * tasks_sort_order_unique constrains (project_id, sort_order) as
 * DEFERRABLE INITIALLY DEFERRED, but pg pool clients need an explicit
 * SET CONSTRAINTS ALL DEFERRED inside the transaction for the deferral to
 * activate.  We also use two passes so mid-transaction duplicates never occur:
 *   Pass 1 – move subtasks to guaranteed-free temp positions
 *             (project_max + 10_000_000 + i)
 *   Pass 2 – move subtasks to final positions
 *             (project_max + 1 + client_index)
 * Both passes run inside one BEGIN/COMMIT so constraints are checked once.
 *
 * Access control
 * ──────────────
 * Parent may be assignee-scope read-only (TVR-13). View access on the parent
 * is enough; each reordered subtask must still be editable by the requester.
 * Every UPDATE is also scoped to AND parent_task_id = $3, so a tampered
 * subtask UUID from another project simply matches no rows.
 */
export async function on_subtask_sort_order_change(
  _io: Server,
  socket: Socket,
  data: SubtaskSortOrderChangeRequest
): Promise<void> {
  const client = await db.connect();
  try {
    const { parent_task_id, subtask_updates } = data;

    if (!parent_task_id || !subtask_updates || subtask_updates.length === 0) {
      socket.emit(SocketEvents.SUBTASK_SORT_ORDER_CHANGE.toString(), { done: false });
      return;
    }

    // ── Access control ────────────────────────────────────────────────────────
    // Guests cannot reorder subtasks (they cannot mutate tasks at all).
    // For non-guests: parent must be viewable and editable; each moved subtask must be editable.
    const hasParentAccess = await verifyNonGuestTaskAccessSocket(socket, parent_task_id);
    if (!hasParentAccess) {
      logUnauthorizedSocketAccess(socket, "SUBTASK_SORT_ORDER_CHANGE", "task", parent_task_id);
      socket.emit(SocketEvents.SUBTASK_SORT_ORDER_CHANGE.toString(), { done: false });
      return;
    }

    const userId = getLoggedInUserIdFromSocket(socket);
    const { session } = socket.request as ISocketSession;
    const sessionUser = session?.passport?.user as IPassportSession | undefined;

    // Each moved subtask must be editable (assigned / exempt)
    for (const update of subtask_updates) {
      const mayEditSubtask = await canUserEditTask(userId, update.task_id, sessionUser);
      if (!mayEditSubtask) {
        logUnauthorizedSocketAccess(socket, "SUBTASK_SORT_ORDER_CHANGE", "task", update.task_id);
        socket.emit(SocketEvents.SUBTASK_SORT_ORDER_CHANGE.toString(), { done: false });
        return;
      }
    }

    // ── Determine safe sort_order values ──────────────────────────────────────
    // Lock the subtask rows and find the true project-wide max of sort_order.
    // We assign new values starting at (projectMax + 1) for the subtasks being
    // reordered.  The unique constraint only covers (project_id, sort_order) so
    // we only need to avoid conflicts on that single column.
    const maxResult = await client.query(
      `SELECT COALESCE(MAX(sort_order), 0) AS max_order
       FROM tasks
       WHERE project_id = (SELECT project_id FROM tasks WHERE id = $1 LIMIT 1)
         AND id <> ALL($2::UUID[])`,   // exclude the subtasks we are about to move
      [parent_task_id, subtask_updates.map(u => u.task_id)]
    );
    const maxOrder: number = parseInt(maxResult.rows[0]?.max_order ?? "0", 10);

    // Final values: maxOrder+1, maxOrder+2, … (one slot per subtask in desired order).
    // Excluding the moving rows from the MAX ensures these slots are genuinely free.
    const tmpBase   = maxOrder + 10_000_000;  // temp range used in Pass 1
    const finalBase = maxOrder + 1;            // final range starts right after max

    await client.query("BEGIN");
    // Activate deferred constraint checking so uniqueness is only enforced at COMMIT
    await client.query("SET CONSTRAINTS ALL DEFERRED");

    // ── Pass 1: move to guaranteed-free temporary positions ───────────────────
    for (let i = 0; i < subtask_updates.length; i++) {
      await client.query(
        `UPDATE tasks
         SET sort_order          = $1,
             status_sort_order   = $1,
             priority_sort_order = $1,
             phase_sort_order    = $1,
             member_sort_order   = $1,
             roadmap_sort_order  = $1
         WHERE id = $2::UUID AND parent_task_id = $3::UUID`,
        [tmpBase + i, subtask_updates[i].task_id, parent_task_id]
      );
    }

    // ── Pass 2: move to final positions ───────────────────────────────────────
    // finalBase + client_index preserves drag order and sits above every
    // existing task in the project so there are no sibling collisions.
    for (let i = 0; i < subtask_updates.length; i++) {
      await client.query(
        `UPDATE tasks
         SET sort_order          = $1,
             status_sort_order   = $1,
             priority_sort_order = $1,
             phase_sort_order    = $1,
             member_sort_order   = $1,
             roadmap_sort_order  = $1
         WHERE id = $2::UUID AND parent_task_id = $3::UUID`,
        [finalBase + subtask_updates[i].sort_order, subtask_updates[i].task_id, parent_task_id]
      );
    }

    await client.query("COMMIT");

    socket.emit(SocketEvents.SUBTASK_SORT_ORDER_CHANGE.toString(), { done: true, parent_task_id });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => { /* ignore rollback errors */ });
    log_error(error);
    socket.emit(SocketEvents.SUBTASK_SORT_ORDER_CHANGE.toString(), { done: false });
  } finally {
    client.release();
  }
}
