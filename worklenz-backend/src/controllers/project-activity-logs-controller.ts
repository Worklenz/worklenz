import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import moment from "moment";
import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";

// --- Helpers -------------------------------------------------------------

function formatDuration(duration: moment.Duration | null): string {
  if (!duration) return "0m";
  const hours = Math.floor(duration.asHours());
  const minutes = duration.minutes();
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function generateLogText(attributeType: string): string {
  const map: Record<string,string> = {
    name:        "updated task name",
    status:      "changed status",
    priority:    "changed priority",
    assignee:    "updated assignee",
    end_date:    "changed due date",
    start_date:  "changed start date",
    estimation:  "updated time estimation",
    description: "updated description",
    phase:       "changed phase",
    labels:      "updated labels",
  };
  return map[attributeType] || "made changes to";
}

function isValidUuid(id?: string): boolean {
  return !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// Get a consistent color for a user based on their name
function getColorFromName(name: string): string {
  if (!name) return "#1890ff";
  
  const colors = [
    "#f56a00", "#7265e6", "#ffbf00", "#00a2ae",
    "#1890ff", "#52c41a", "#eb2f96", "#faad14",
    "#722ed1", "#13c2c2", "#fa8c16", "#a0d911"
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

// --- Controller ----------------------------------------------------------

export default class ProjectActivityLogsController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async getByProjectId(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    // 1) Extract & validate inputs
    const projectId = req.params.id; 
    if (!isValidUuid(projectId)) {
      return res
        .status(400)
        .json({ done: false, body: null, error: "Invalid project ID." });
    }

    const page       = parseInt(req.query.page  as string, 10) || 1;
    const size       = parseInt(req.query.size  as string, 10) || 20;
    const offset     = (page - 1) * size;
    const filterType = (req.query.filter as string) || "all";
    const allowedFilters = [
      "all","name","status","priority","assignee",
      "end_date","start_date","estimation","description","phase"
    ];
    if (!allowedFilters.includes(filterType)) {
      return res
        .status(400)
        .json({ done: false, body: null, error: "Invalid filter type." });
    }

    // 2) Build parameterized SQL
    let mainQuery = `
      SELECT
        tal.id,
        tal.task_id,
        tal.user_id,
        tal.attribute_type,
        tal.log_type,
        tal.old_value,
        tal.new_value,
        tal.prev_string,
        tal.next_string,
        tal.created_at,
        t.name    AS task_name,
        t.task_no AS task_no,
        p.key     AS project_key,
        
        -- Include user details directly
        u.id       AS user_id,
        u.name     AS user_name,
        u.email    AS user_email,
        u.avatar_url AS user_avatar_url
      FROM task_activity_logs tal
      LEFT JOIN tasks   t ON tal.task_id    = t.id
      LEFT JOIN projects p ON tal.project_id = p.id
      LEFT JOIN users u ON tal.user_id = u.id
      WHERE tal.project_id = $1
    `;

    const queryParams: any[] = [projectId];
    if (filterType !== "all") {
      mainQuery += ` AND tal.attribute_type = $2`;
      queryParams.push(filterType);
    }
    mainQuery += ` ORDER BY tal.created_at DESC`;
    // placeholders for LIMIT / OFFSET
    const limitIdx  = queryParams.length + 1;
    const offsetIdx = queryParams.length + 2;
    mainQuery += ` LIMIT $${limitIdx} OFFSET $${offsetIdx}`;
    queryParams.push(size, offset);

    // Count query
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM task_activity_logs tal
      WHERE tal.project_id = $1
    `;
    const countParams = filterType !== "all"
      ? [projectId, filterType]
      : [projectId];

    try {
      // 3) Execute SQL
      const [dataResult, countResult] = await Promise.all([
        db.query(mainQuery, queryParams),
        db.query(
          countQuery + (filterType !== "all" ? ` AND tal.attribute_type = $2` : ""),
          countParams
        ),
      ]);

      const total = parseInt(countResult.rows[0]?.total || "0", 10);

      // 4) Transform rows
      const rows = dataResult.rows;
      const logs = await Promise.all(rows.map(async (r: any) => {
        const log: any = { ...r };
        // Correctly structure user information
        log.done_by = {
          id: r.user_id || "",
          name: r.user_name || "Unknown User",
          avatar_url: r.user_avatar_url,
          email: r.user_email || "",
          color_code: r.user_name ? getColorFromName(r.user_name) : "#1890ff"
        };
        // task key
        log.task_key = r.project_key && r.task_no ? 
          `${r.project_key}-${r.task_no}` : 
          `TASK-${r.task_id?.substring(0, 8) || "unknown"}`;
          
        // duration / estimation formatting
        if (log.attribute_type === "estimation") {
          const oldMin = parseInt(log.old_value, 10);
          const newMin = parseInt(log.new_value, 10);
          log.previous = !isNaN(oldMin)
            ? formatDuration(moment.duration(oldMin, "minutes"))
            : log.old_value;
          log.current  = !isNaN(newMin)
            ? formatDuration(moment.duration(newMin, "minutes"))
            : log.new_value;
        } else {
          log.previous = log.old_value;
          log.current  = log.new_value;
        }
        // human‐friendly action
        log.log_text = generateLogText(r.attribute_type);

        // Handle status changes
        if (log.attribute_type === "status" && log.old_value && isValidUuid(log.old_value)) {
          try {
            const prevStatus = await db.query(
              `SELECT name, color_code FROM task_statuses WHERE id = $1`,
              [log.old_value]
            );
            if (prevStatus.rows.length > 0) {
              log.previous_status = {
                name: prevStatus.rows[0].name,
                color_code: prevStatus.rows[0].color_code || "#d9d9d9"
              };
            }
          } catch (err) {
            console.error("Error fetching previous status:", err);
          }
        }
        
        if (log.attribute_type === "status" && log.new_value && isValidUuid(log.new_value)) {
          try {
            const nextStatus = await db.query(
              `SELECT name, color_code FROM task_statuses WHERE id = $1`,
              [log.new_value]
            );
            if (nextStatus.rows.length > 0) {
              log.next_status = {
                name: nextStatus.rows[0].name,
                color_code: nextStatus.rows[0].color_code || "#1890ff"
              };
            }
          } catch (err) {
            console.error("Error fetching next status:", err);
          }
        }
        // Handle priority changes
        if (log.attribute_type === "priority" && log.old_value && isValidUuid(log.old_value)) {
          try {
            const prevPriority = await db.query(
              `SELECT name, color_code FROM task_priorities WHERE id = $1`,
              [log.old_value]
            );
            if (prevPriority.rows.length > 0) {
              log.previous_priority = {
                name: prevPriority.rows[0].name,
                color_code: prevPriority.rows[0].color_code || "#d9d9d9"
              };
            }
          } catch (err) {
            console.error("Error fetching previous priority:", err);
          }
        }
        
        if (log.attribute_type === "priority" && log.new_value && isValidUuid(log.new_value)) {
          try {
            const nextPriority = await db.query(
              `SELECT name, color_code FROM task_priorities WHERE id = $1`,
              [log.new_value]
            );
            if (nextPriority.rows.length > 0) {
              log.next_priority = {
                name: nextPriority.rows[0].name,
                color_code: nextPriority.rows[0].color_code || "#ff4d4f"
              };
            }
          } catch (err) {
            console.error("Error fetching next priority:", err);
          }
        }
// Handle assignee changes
        if (log.attribute_type === "assignee" && log.new_value && isValidUuid(log.new_value)) {
          try {
            const assignedUser = await db.query(
              `SELECT id, name, avatar_url, email FROM users WHERE id = $1`,
              [log.new_value]
            );
            if (assignedUser.rows.length > 0) {
              log.assigned_user = {
                ...assignedUser.rows[0],
                color_code: getColorFromName(assignedUser.rows[0].name)
              };
            }
          } catch (err) {
            console.error("Error fetching assigned user:", err);
          }
        }

        return log;
      }));

      // 5) Send back a clean response
      const response = {
        logs,
        pagination: {
          current:    page,
          pageSize:   size,
          total,
          totalPages: Math.ceil(total / size),
        }
      };
      
      return res.status(200).send(new ServerResponse(true, response));
    } catch (err) {
      console.error("🔥 getByProjectId error:", err);
      return res.status(500).send(
        new ServerResponse(false, null, "Internal server error fetching logs.")
      );
    }
  }
}