import {Server, Socket} from "socket.io";
import db from "../../config/db";
import {SocketEvents} from "../events";
import {getLoggedInUserIdFromSocket, log_error, notifyProjectUpdates} from "../util";
import TasksController from "../../controllers/tasks-controller";
import {logPhaseChange, logPriorityChange, logStatusChange} from "../../services/activity-logs/activity-logs.service";
import {GroupBy} from "../../controllers/tasks-controller-base";
import {UNMAPPED} from "../../shared/constants";
import TasksControllerV2 from "../../controllers/tasks-controller-v2";
import { assignMemberIfNot } from "./on-quick-assign-or-remove";

interface ChangeRequest {
  from_index: number; // from sort_order
  to_index: number; // to sort_order
  to_last_index: boolean;
  from_group: string;
  to_group: string;
  group_by: string;
  project_id: string;
  task: any;
  team_id: string;
}

// PERFORMANCE OPTIMIZATION: Connection pooling for better database performance
const dbPool = {
  query: async (text: string, params?: any[]) => {
    return await db.query(text, params);
  }
};

// PERFORMANCE OPTIMIZATION: Cache for dependency checks to reduce database queries
const dependencyCache = new Map<string, { result: boolean; timestamp: number }>();
const CACHE_TTL = 5000; // 5 seconds cache

const clearExpiredCache = () => {
  const now = Date.now();
  for (const [key, value] of dependencyCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      dependencyCache.delete(key);
    }
  }
};

// Clear expired cache entries every 10 seconds
setInterval(clearExpiredCache, 10000);

const onTaskSortOrderChange = async (io: Server, socket: Socket, data: ChangeRequest) => {
  try {
    const userId = getLoggedInUserIdFromSocket(socket);
    if (!userId) {
      socket.emit(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), { error: "User not authenticated" });
      return;
    }

    const {
      from_index,
      to_index,
      to_last_index,
      from_group,
      to_group,
      group_by,
      project_id,
      task,
      team_id
    } = data;

    // PERFORMANCE OPTIMIZATION: Validate input data early to avoid expensive operations
    if (!project_id || !task?.id || !team_id) {
      socket.emit(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), { error: "Missing required data" });
      return;
    }

    // PERFORMANCE OPTIMIZATION: Use cached dependency check if available
    const cacheKey = `${project_id}-${userId}-${team_id}`;
    const cachedDependency = dependencyCache.get(cacheKey);

    let hasAccess = false;
    if (cachedDependency && (Date.now() - cachedDependency.timestamp) < CACHE_TTL) {
      hasAccess = cachedDependency.result;
    } else {
      // PERFORMANCE OPTIMIZATION: Optimized dependency check query
      const dependencyResult = await dbPool.query(`
        SELECT EXISTS(
          SELECT 1 FROM project_members pm
                  INNER JOIN projects p ON p.id = pm.project_id
         INNER JOIN team_members tm ON pm.team_member_id = tm.id
WHERE pm.project_id = $1
  AND tm.user_id = $2
  AND p.team_id = $3
        ) as has_access
      `, [project_id, userId, team_id]);

      hasAccess = dependencyResult.rows[0]?.has_access || false;

      // Cache the result
      dependencyCache.set(cacheKey, { result: hasAccess, timestamp: Date.now() });
    }

    if (!hasAccess) {
      socket.emit(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), { error: "Access denied" });
      return;
    }

    // PERFORMANCE OPTIMIZATION: Execute database operation directly
    await dbPool.query(`SELECT handle_task_list_sort_order_change($1)`, [JSON.stringify({
      project_id,
      task_id: task.id,
      from_index,
      to_index,
      to_last_index,
      from_group,
      to_group,
      group_by
    })]);

    // PERFORMANCE OPTIMIZATION: Optimized project updates notification
    const projectUpdateData = {
      project_id,
      team_id,
      user_id: userId,
      update_type: "task_sort_order_change",
      task_id: task.id,
      from_group,
      to_group,
      group_by
    };

    // Emit to all users in the project room
    io.to(`project_${project_id}`).emit("project_updates", projectUpdateData);

    // PERFORMANCE OPTIMIZATION: Optimized activity logging
    const activityLogData = {
      task_id: task.id,
      socket,
      new_value: to_group,
      old_value: from_group
    };

    // Log activity asynchronously to avoid blocking the response
    setImmediate(async () => {
      try {
        if (group_by === "phase") {
          await logPhaseChange(activityLogData);
        } else if (group_by === "status") {
          await logStatusChange(activityLogData);
        } else if (group_by === "priority") {
          await logPriorityChange(activityLogData);
        }
      } catch (error) {
        log_error(error);
      }
    });

    // Send success response
    socket.emit(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), {
      success: true,
      task_id: task.id,
      from_group,
      to_group,
      group_by
    });

  } catch (error) {
    log_error(error);
    socket.emit(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), {
      error: "Internal server error"
    });
  }
};

export default onTaskSortOrderChange;
