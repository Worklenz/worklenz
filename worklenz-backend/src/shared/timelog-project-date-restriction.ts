import momentTime from "moment-timezone";
import db from "../config/db";

interface ProjectStartDateViolationOptions {
  taskId?: string | null;
  workLogId?: string | null;
  formattedStart?: string | null;
  userId?: string | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates that a proposed time log date/time (`formattedStart`) does not fall
 * before the task's project start date (`projects.start_date`).
 *
 * Rules:
 * 1. If the project has no `start_date`, no restriction is applied (returns null).
 * 2. Comparisons are performed on calendar days in the logging user's timezone.
 * 3. In edit mode (`workLogId`), an entry whose date is left unchanged remains
 *    allowed through (exemption parity with the backdate limit), unless reassigned
 *    to a different task/project.
 * 4. Fails open on transient errors so DB hiccups do not block legitimate logging.
 */
export async function getProjectStartDateViolation({
  taskId,
  workLogId,
  formattedStart,
  userId,
}: ProjectStartDateViolationOptions): Promise<string | null> {
  if (!formattedStart) return null;

  try {
    let projectStartDate: string | null = null;
    let existingCreatedAt: string | null = null;
    let timezone = "UTC";

    // 1. If an existing work log id is provided (an edit):
    if (workLogId && UUID_REGEX.test(workLogId)) {
      const q = `
        SELECT
          twl.created_at,
          twl.task_id,
          p.start_date AS project_start_date,
          COALESCE((SELECT tz.name FROM timezones tz WHERE tz.id = u.timezone_id), 'UTC') AS timezone
        FROM task_work_log twl
        INNER JOIN tasks t ON t.id = twl.task_id
        INNER JOIN projects p ON p.id = t.project_id
        LEFT JOIN users u ON u.id = $2
        WHERE twl.id = $1::uuid
        LIMIT 1;
      `;
      const result = await db.query(q, [workLogId, userId || null]);
      const row = result.rows[0];
      if (row) {
        existingCreatedAt = row.created_at;
        projectStartDate = row.project_start_date;
        timezone = row.timezone || "UTC";

        // If the task was changed to a different task during edit, check that target task's project
        if (taskId && UUID_REGEX.test(taskId) && taskId !== row.task_id) {
          const newQ = `
            SELECT p.start_date AS project_start_date
            FROM tasks t
            INNER JOIN projects p ON p.id = t.project_id
            WHERE t.id = $1::uuid
            LIMIT 1;
          `;
          const newResult = await db.query(newQ, [taskId]);
          if (newResult.rows[0]) {
            projectStartDate = newResult.rows[0].project_start_date;
          }
        } else {
          // If the entry's date was not changed in this edit, keep it allowed
          if (existingCreatedAt) {
            const existingDay = momentTime.tz(existingCreatedAt, timezone).startOf("day");
            const logDay = momentTime.tz(formattedStart, timezone).startOf("day");
            if (existingDay.isValid() && logDay.isValid() && existingDay.isSame(logDay)) {
              return null;
            }
          }
        }
      }
    } else if (taskId && UUID_REGEX.test(taskId)) {
      // 2. New time log: fetch from task
      const q = `
        SELECT
          p.start_date AS project_start_date,
          COALESCE((SELECT tz.name FROM timezones tz WHERE tz.id = u.timezone_id), 'UTC') AS timezone
        FROM tasks t
        INNER JOIN projects p ON p.id = t.project_id
        LEFT JOIN users u ON u.id = $2
        WHERE t.id = $1::uuid
        LIMIT 1;
      `;
      const result = await db.query(q, [taskId, userId || null]);
      const row = result.rows[0];
      if (row) {
        projectStartDate = row.project_start_date;
        timezone = row.timezone || "UTC";
      }
    }

    if (!projectStartDate) return null;

    const projectStartDay = momentTime.tz(projectStartDate, timezone).startOf("day");
    const logDay = momentTime.tz(formattedStart, timezone).startOf("day");

    if (!projectStartDay.isValid() || !logDay.isValid()) return null;

    if (logDay.isBefore(projectStartDay)) {
      return `Time cannot be logged before the project start date (${projectStartDay.format("MMM DD, YYYY")}).`;
    }

    return null;
  } catch (error) {
    return null;
  }
}
