import moment from "moment";
import Excel from "exceljs";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { formatDuration, formatLogText, getColor } from "../shared/utils";

export default class ActivitylogsController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const q = `SELECT get_activity_logs_by_task($1) AS activity_logs;`;
    const result = await db.query(q, [id]);
    const [data] = result.rows;

    for (const log of data.activity_logs.logs) {
      if (log.attribute_type === "estimation") {
        log.previous = formatDuration(moment.duration(log.previous, "minutes"));
        log.current = formatDuration(moment.duration(log.current, "minutes"));
      }
      if (log.assigned_user) log.assigned_user.color_code = getColor(log.assigned_user.name);
      log.done_by.color_code = getColor(log.done_by.name);
      log.log_text = await formatLogText(log);
      log.attribute_type = log.attribute_type?.replace(/_/g, " ");
    }
    data.activity_logs.color_code = getColor(data.activity_logs.name);

    return res.status(200).send(new ServerResponse(true, data.activity_logs));
  }

  @HandleExceptions()
  public static async getByProjectId(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    try {
      console.log("Received request for project activity logs:", req.params, req.query);
      const projectId = req.params.id;
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 20;
      const offset = (page - 1) * size;
      const filterType = req.query.filter as string || "all";

      // Add filter conditions
      let filterClause = "";
      const filterParams = [projectId];
      let paramIndex = 2;

      if (filterType && filterType !== "all") {
        filterClause = ` AND tal.attribute_type = $${paramIndex}`;
        filterParams.push(filterType);
        paramIndex++;
      }

      // Defensive UUID regex for safe casting
      const uuidRegex = "'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'";

      const q = `
        SELECT 
          tal.id,
          tal.task_id,
          tal.attribute_type,
          tal.log_type,
          tal.old_value,
          tal.new_value,
          tal.prev_string,
          tal.next_string,
          tal.created_at,
          
          -- Task details
          (SELECT name FROM tasks WHERE id = tal.task_id) AS task_name,
          (SELECT task_no FROM tasks WHERE id = tal.task_id) AS task_no,
          CONCAT((SELECT key FROM projects WHERE id = $1), '-', (SELECT task_no FROM tasks WHERE id = tal.task_id)) AS task_key,
          
          -- User details
          (SELECT ROW_TO_JSON(user_data) FROM (
            SELECT 
              u.id,
              u.name,
              u.avatar_url,
              u.email
            FROM users u 
            WHERE u.id = tal.user_id
          ) user_data) AS done_by,
          
          -- Status details for status changes (safe UUID cast)
          CASE 
            WHEN tal.attribute_type = 'status' AND tal.old_value ~ ${uuidRegex} THEN
              (SELECT ROW_TO_JSON(status_data) FROM (
                SELECT 
                  ts.name
                FROM task_statuses ts 
                WHERE ts.id = tal.old_value::UUID
              ) status_data)
            ELSE NULL
          END AS previous_status,

          CASE 
            WHEN tal.attribute_type = 'status' AND tal.new_value ~ ${uuidRegex} THEN
              (SELECT ROW_TO_JSON(status_data) FROM (
                SELECT 
                  ts.name
                FROM task_statuses ts 
                WHERE ts.id = tal.new_value::UUID
              ) status_data)
            ELSE NULL
          END AS next_status,
          
          -- Priority details for priority changes (safe UUID cast)
          CASE 
            WHEN tal.attribute_type = 'priority' AND tal.old_value ~ ${uuidRegex} THEN
              (SELECT ROW_TO_JSON(priority_data) FROM (
                SELECT 
                  tp.name
                FROM task_priorities tp 
                WHERE tp.id = tal.old_value::UUID
              ) priority_data)
            ELSE NULL
          END AS previous_priority,

          CASE 
            WHEN tal.attribute_type = 'priority' AND tal.new_value ~ ${uuidRegex} THEN
              (SELECT ROW_TO_JSON(priority_data) FROM (
                SELECT 
                  tp.name
                FROM task_priorities tp 
                WHERE tp.id = tal.new_value::UUID
              ) priority_data)
            ELSE NULL
          END AS next_priority,
          
          -- Assigned user details for assignee changes (safe UUID cast)
          CASE 
            WHEN tal.attribute_type = 'assignee' AND tal.new_value ~ ${uuidRegex} THEN
              (SELECT ROW_TO_JSON(user_data) FROM (
                SELECT 
                  u.id,
                  u.name,
                  u.avatar_url,
                  u.email
                FROM users u 
                WHERE u.id = tal.new_value::UUID
              ) user_data)
            ELSE NULL
          END AS assigned_user

        FROM task_activity_logs tal
        WHERE tal.project_id = $1${filterClause}
        ORDER BY tal.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      const countQuery = `
        SELECT COUNT(*) as total
        FROM task_activity_logs 
        WHERE project_id = $1${filterClause}
      `;

      const [result, countResult] = await Promise.all([
        db.query(q, [...filterParams, size, offset]),
        db.query(countQuery, filterType && filterType !== "all" ? [projectId, filterType] : [projectId])
      ]);

      const total = parseInt(countResult.rows[0]?.total || "0");

      // Format the logs
      for (const log of result.rows) {
        if (log.attribute_type === "estimation") {
          log.previous = formatDuration(moment.duration(log.old_value, "minutes"));
          log.current = formatDuration(moment.duration(log.new_value, "minutes"));
        } else {
          log.previous = log.old_value;
          log.current = log.new_value;
        }

        // Add color to users
        if (log.assigned_user) {
          log.assigned_user.color_code = getColor(log.assigned_user.name);
        }
        
        if (log.done_by) {
          log.done_by.color_code = getColor(log.done_by.name);
        }

        // Add default colors for status and priority since table doesn't have color_code
        if (log.previous_status) {
          log.previous_status.color_code = "#d9d9d9"; // Default gray color
        }
        if (log.next_status) {
          log.next_status.color_code = "#1890ff"; // Default blue color
        }
        if (log.previous_priority) {
          log.previous_priority.color_code = "#d9d9d9"; // Default gray color
        }
        if (log.next_priority) {
          log.next_priority.color_code = "#ff4d4f"; // Default red color for priority
        }
        
        // Generate log text
        log.log_text = await formatLogText(log);
        log.attribute_type = log.attribute_type?.replace(/_/g, " ");
      }

      const response = {
        logs: result.rows,
        pagination: {
          current: page,
          pageSize: size,
          total,
          totalPages: Math.ceil(total / size)
        }
      };

      return res.status(200).send(new ServerResponse(true, response));
    } catch (error: any) {
      console.error("❌ Error in getByProjectId:", error);
      return res.status(500).send(new ServerResponse(false, null, `Internal server error: ${error.message}`));
    }
  }

  @HandleExceptions()
  public static async exportProjectActivityLogs(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<void> {
    // ...keep your export logic as is...
  }
}