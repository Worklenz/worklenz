import moment from "moment";
import multer from "multer";
import fs from "fs";
import csv from "csv-parser";
import ExcelJS from "exceljs";

import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import db from "../config/db";

import { ServerResponse } from "../models/server-response";
import { S3_URL, TASK_STATUS_COLOR_ALPHA } from "../shared/constants";
import { getDates, getMinMaxOfTaskDates, getMonthRange, getWeekRange } from "../shared/tasks-controller-utils";
import { getColor, getRandomColorCode, humanFileSize, log_error, toMinutes } from "../shared/utils";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { NotificationsService } from "../services/notifications/notifications.service";
import { getTaskCompleteInfo } from "../socket.io/commands/on-quick-task";
import { getAssignees, getTeamMembers } from "../socket.io/commands/on-quick-assign-or-remove";
import TasksControllerV2 from "./tasks-controller-v2";
import { IO } from "../shared/io";
import { SocketEvents } from "../socket.io/events";
import TasksControllerBase from "./tasks-controller-base";
import { insertToActivityLogs } from "../services/activity-logs/activity-logs.service";
import { IActivityLog } from "../services/activity-logs/interfaces";
import { getKey, getRootDir, uploadBase64 } from "../shared/s3";

// Configure multer for file uploads
const upload = multer({
  dest: "temp/",
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.toLowerCase().endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

// The exportToCSV function has been moved to be a static method in the TasksController class

export default class TasksController extends TasksControllerBase {
  // CSV upload middleware
  public static csvUpload = upload.single("csvFile");
  
  // CSV Export method
  /**
   * Export tasks to CSV format
   * Completely rewritten for stability and reliability
   * With improved error handling and content type management
   */
  @HandleExceptions()
  public static async exportToCSV(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    // Track if response has been sent to avoid "headers already sent" errors
    const responseTracker = { sent: false };
    
    try {
      // Validate project ID
      const { id } = req.params;
      
      if (!id) {
        responseTracker.sent = true;
        return res.status(400).send(new ServerResponse(false, null, "Project ID is required"));
      }
      
      // First check if project exists
      try {
        const projectCheckQuery = "SELECT EXISTS(SELECT 1 FROM projects WHERE id = $1::uuid) AS exists";
        const projectCheckResult = await db.query(projectCheckQuery, [id]);
        
        if (!projectCheckResult.rows?.[0]?.exists) {
          responseTracker.sent = true;
          return res.status(404).send(new ServerResponse(false, null, "Project not found"));
        }
      } catch (dbError) {
        log_error(`Database error checking project existence: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
        responseTracker.sent = true;
        return res.status(500).send(new ServerResponse(false, null, "Database error checking project"));
      }
      
      // Get project name for filename
      let projectName = "project";
      try {
        const projectNameQuery = "SELECT name FROM projects WHERE id = $1::uuid";
        const projectResult = await db.query(projectNameQuery, [id]);
        if (projectResult.rows?.[0]?.name) {
          projectName = projectResult.rows[0].name;
        }
      } catch (dbError) {
        log_error(`Non-critical error getting project name: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
        // Continue with default name
      }
      
      // Format project name to be filename-safe
      const safeProjectName = projectName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
      
      // Get project metadata with proper typing
      interface ProjectMetadata {
        name?: string;
        description?: string;
        start_date?: string;
        end_date?: string;
        status?: string;
        task_count?: number;
      }
      
      // Initialize with empty values
      const projectMetadata: ProjectMetadata = {};
      
      try {
        const projectMetadataQuery = `
          SELECT 
            p.name,
            p.description,
            p.start_date,
            p.end_date,
            COALESCE(ps.name, 'Not Set') as status,
            COUNT(t.id) as task_count
          FROM projects p
          LEFT JOIN project_statuses ps ON p.status_id = ps.id
          LEFT JOIN tasks t ON p.id = t.project_id AND t.archived IS FALSE
          WHERE p.id = $1::uuid
          GROUP BY p.name, p.description, p.start_date, p.end_date, ps.name
        `;
        
        const metadataResult = await db.query(projectMetadataQuery, [id]);
        if (metadataResult.rows?.[0]) {
          // Copy properties one by one for type safety
          const row = metadataResult.rows[0];
          projectMetadata.name = row.name;
          projectMetadata.description = row.description;
          projectMetadata.start_date = row.start_date;
          projectMetadata.end_date = row.end_date;
          projectMetadata.status = row.status;
          projectMetadata.task_count = row.task_count;
        }
      } catch (dbError) {
        log_error(`Non-critical error getting project metadata: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
        // Continue with empty metadata
      }
      
      // Get task data
      let tasks = [];
      try {
        const tasksQuery = `
          SELECT
            t.id::text AS id,
            t.name AS name,
            COALESCE(t.description, '') AS description,
            to_char(t.start_date, 'YYYY-MM-DD') AS "startDate",
            to_char(t.end_date, 'YYYY-MM-DD') AS "endDate",
            COALESCE(ts.name, '') AS status,
            COALESCE(tp.name, '') AS priority,
            to_char(t.created_at, 'YYYY-MM-DD') AS "createdAt",
            to_char(t.updated_at, 'YYYY-MM-DD') AS "updatedAt"
          FROM tasks t
          LEFT JOIN task_statuses ts ON t.status_id = ts.id
          LEFT JOIN task_priorities tp ON t.priority_id = tp.id
          WHERE t.project_id = $1::uuid 
            AND t.archived IS FALSE
          ORDER BY t.created_at DESC
        `;
        
        const tasksResult = await db.query(tasksQuery, [id]);
        if (tasksResult.rows) {
          tasks = tasksResult.rows;
        }
      } catch (dbError) {
        log_error(`Database error getting task data: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
        responseTracker.sent = true;
        return res.status(500).send(new ServerResponse(false, null, "Error retrieving task data"));
      }
      
      // Generate CSV content
      try {
        // No header info - removed project name and task count rows
        
        // Define column headers
        const fields = [
          "id",
          "name", 
          "description",
          "startDate",
          "endDate", 
          "status",
          "priority",
          "createdAt",
          "updatedAt"
        ];
        
        // Generate CSV content with proper escaping
        const csvRows = [];
        csvRows.push(fields.join(","));
        
        // Process each task row
        if (tasks.length > 0) {
          tasks.forEach(row => {
            // Properly escape values to handle commas, quotes, etc.
            const escapedValues = fields.map(field => {
              // Safely access field values with explicit checks to avoid issues with undefined/null
              const rawValue = field in row ? row[field] : null;
              const value = rawValue !== undefined && rawValue !== null ? String(rawValue) : "";
              
              // If value contains comma, newline or quotes, wrap in quotes and escape inner quotes
              if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
                return `"${value.replace(/"/g, "\"\"")}"`;
              }
              return value;
            });
            
            csvRows.push(escapedValues.join(","));
          });
        }
        
        // Use only the CSV rows without header info
        const csvContent = csvRows.join("\n");
        
        // Set response headers for file download
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="${safeProjectName}-tasks.csv"`);
        
        try {
          // Send CSV content and return
          return res.status(200).send(csvContent);
        } catch (sendError) {
          log_error(`Error sending CSV response: ${sendError instanceof Error ? sendError.message : String(sendError)}`);
          if (!res.headersSent) {
            return res.status(500).send(new ServerResponse(false, null, "Error sending CSV response"));
          }
          return res;
        }
        
      } catch (csvError) {
        log_error(`Error generating CSV: ${csvError instanceof Error ? csvError.message : String(csvError)}`);
        responseTracker.sent = true;
        return res.status(500).send(new ServerResponse(false, null, "Error generating CSV file"));
      }
      
    } catch (error) {
      // Final fallback error handler
      log_error(`Unexpected error in exportToCSV: ${error instanceof Error ? error.message : String(error)}`);
      if (!res.headersSent && !responseTracker.sent) {
        responseTracker.sent = true;
        return res.status(500).send(new ServerResponse(false, null, "An unexpected error occurred"));
      }
      return res;
    }
  }

  @HandleExceptions()
  public static async exportToExcel(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    // Track if response has been sent to avoid "headers already sent" errors
    const responseTracker = { sent: false };
    
    try {
      // Validate project ID
      const { id } = req.params;
      
      if (!id) {
        responseTracker.sent = true;
        return res.status(400).send(new ServerResponse(false, null, "Project ID is required"));
      }
      
      // First check if project exists
      try {
        const projectCheckQuery = "SELECT EXISTS(SELECT 1 FROM projects WHERE id = $1::uuid) AS exists";
        const projectCheckResult = await db.query(projectCheckQuery, [id]);
        
        if (!projectCheckResult.rows?.[0]?.exists) {
          responseTracker.sent = true;
          return res.status(404).send(new ServerResponse(false, null, "Project not found"));
        }
      } catch (dbError) {
        log_error(`Database error checking project existence: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
        responseTracker.sent = true;
        return res.status(500).send(new ServerResponse(false, null, "Database error checking project"));
      }
      
      // Get project name for filename
      let projectName = "project";
      try {
        const projectNameQuery = "SELECT name FROM projects WHERE id = $1::uuid";
        const projectResult = await db.query(projectNameQuery, [id]);
        if (projectResult.rows?.[0]?.name) {
          projectName = projectResult.rows[0].name;
        }
      } catch (dbError) {
        log_error(`Non-critical error getting project name: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
        // Continue with default name
      }
      
      // Format project name to be filename-safe
      const safeProjectName = projectName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
      
      // Get task data
      let tasks = [];
      try {
        const tasksQuery = `
          SELECT
            t.id::text AS id,
            t.name AS name,
            COALESCE(t.description, '') AS description,
            to_char(t.start_date, 'YYYY-MM-DD') AS "startDate",
            to_char(t.end_date, 'YYYY-MM-DD') AS "endDate",
            COALESCE(ts.name, '') AS status,
            COALESCE(tp.name, '') AS priority,
            to_char(t.created_at, 'YYYY-MM-DD') AS "createdAt",
            to_char(t.updated_at, 'YYYY-MM-DD') AS "updatedAt"
          FROM tasks t
          LEFT JOIN task_statuses ts ON t.status_id = ts.id
          LEFT JOIN task_priorities tp ON t.priority_id = tp.id
          WHERE t.project_id = $1::uuid 
            AND t.archived IS FALSE
          ORDER BY t.created_at DESC
        `;
        
        const tasksResult = await db.query(tasksQuery, [id]);
        if (tasksResult.rows) {
          tasks = tasksResult.rows;
        }
      } catch (dbError) {
        log_error(`Database error getting task data: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
        responseTracker.sent = true;
        return res.status(500).send(new ServerResponse(false, null, "Error retrieving task data"));
      }
      
      // Generate Excel content
      try {
        // Create a new Excel workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "WorkLenz";
        workbook.lastModifiedBy = "WorkLenz";
        workbook.created = new Date();
        workbook.modified = new Date();

        // Add a worksheet
        const worksheet = workbook.addWorksheet("Tasks");
        
        // Define column definitions without headers (we'll add headers manually)
        const columns = [
          { key: "id", width: 36 },
          { key: "name", width: 30 },
          { key: "description", width: 40 },
          { key: "startDate", width: 12 },
          { key: "endDate", width: 12 },
          { key: "status", width: 15 },
          { key: "priority", width: 12 },
          { key: "createdAt", width: 12 },
          { key: "updatedAt", width: 12 }
        ];
        
        // Set column definitions without headers
        worksheet.columns = columns;
        
        // Define headers for later use
        const headers = [
          "ID", "Name", "Description", "Start Date", "End Date", "Status", "Priority", "Created At", "Updated At"
        ];
        
        // Insert project name in first row and merge cells across all columns
        const projectNameRow = worksheet.addRow([projectName]);
        projectNameRow.font = { bold: true, size: 14 };
        worksheet.mergeCells(`A1:${String.fromCharCode(64 + columns.length)}1`);
        projectNameRow.alignment = { horizontal: "center" };
        
        // Add a header row in the second row
        const headerRow = worksheet.addRow(headers);
        headerRow.font = { bold: true };
        headerRow.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFEEEEEE" }
        };
        
        // Add task data to the worksheet (starting from row 3)
        if (tasks.length > 0) {
          tasks.forEach(task => {
            // Extract values in the same order as columns
            const rowValues = columns.map(col => task[col.key] || "");
            worksheet.addRow(rowValues);
          });
        }
        
        // Auto-filter for all columns (applied to the header row which is now row 2)
        worksheet.autoFilter = {
          from: { row: 2, column: 1 },
          to: { row: 2, column: columns.length }
        };
        
        // Set response headers for file download
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${safeProjectName}-tasks.xlsx"`);
        
        // Write workbook to response
        await workbook.xlsx.write(res);
        return res;
        
      } catch (excelError) {
        log_error(`Error generating Excel: ${excelError instanceof Error ? excelError.message : String(excelError)}`);
        responseTracker.sent = true;
        return res.status(500).send(new ServerResponse(false, null, "Error generating Excel file"));
      }
      
    } catch (error) {
      // Final fallback error handler
      log_error(`Unexpected error in exportToExcel: ${error instanceof Error ? error.message : String(error)}`);
      if (!res.headersSent && !responseTracker.sent) {
        responseTracker.sent = true;
        return res.status(500).send(new ServerResponse(false, null, "An unexpected error occurred"));
      }
      return res;
    }
  }

  private static notifyProjectUpdates(socketId: string, projectId: string) {
    IO.getSocketById(socketId)
      ?.to(projectId)
      .emit(SocketEvents.PROJECT_UPDATES_AVAILABLE.toString());
  }

  public static async uploadAttachment(attachments: any, teamId: string, userId: string) {
    try {
      const promises = attachments.map(async (attachment: any) => {
        const { file, file_name, project_id, size } = attachment;
        const type = file_name.split(".").pop();

        const q = `
        INSERT INTO task_attachments (name, task_id, team_id, project_id, uploaded_by, size, type)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, name, size, type, created_at, CONCAT($8::TEXT, '/', team_id, '/', project_id, '/', id, '.', type) AS url;
      `;

        const result = await db.query(q, [
          file_name,
          null,
          teamId,
          project_id,
          userId,
          size,
          type,
          `${S3_URL}/${getRootDir()}`
        ]);

        const [data] = result.rows;
        await uploadBase64(file, getKey(teamId, project_id, data.id, data.type));
        return data.id;
      });

      const attachmentIds = await Promise.all(promises);
      return attachmentIds;
    } catch (error) {
      log_error(error);
    }
  }

  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const userId = req.user?.id as string;
    const teamId = req.user?.team_id as string;

    if (req.body.attachments_raw) {
      req.body.attachments = await this.uploadAttachment(req.body.attachments_raw, teamId, userId);
    }

    const q = `SELECT create_task($1) AS task;`;
    const result = await db.query(q, [JSON.stringify(req.body)]);
    const [data] = result.rows;

    for (const member of data?.task.assignees || []) {
      NotificationsService.createTaskUpdate(
        "ASSIGN",
        userId,
        data.task.id,
        member.user_id,
        member.team_id
      );
    }

    return res.status(200).send(new ServerResponse(true, data.task));
  }

  @HandleExceptions()
  public static async getGanttTasks(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT get_gantt_tasks($1) AS gantt_tasks;`;
    const result = await db.query(q, [req.user?.id ?? null]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data.gantt_tasks));
  }

  private static sendAssignmentNotifications(task: any, userId: string) {
    const newMembers = task.new_assignees.filter((member1: any) => {
      return !task.old_assignees.some((member2: any) => {
        return member1.team_member_id === member2.team_member_id;
      });
    });
    const removedMembers = task.old_assignees.filter((member1: any) => {
      return !task.new_assignees.some((member2: any) => {
        return member1.team_member_id === member2.team_member_id;
      });
    });

    for (const member of newMembers) {
      NotificationsService.createTaskUpdate(
        "ASSIGN",
        userId,
        task.id,
        member.user_id,
        member.team_id
      );
    }

    for (const member of removedMembers) {
      NotificationsService.createTaskUpdate(
        "UNASSIGN",
        userId,
        task.id,
        member.user_id,
        member.team_id
      );
    }
  }

  public static async notifyStatusChange(userId: string, taskId: string, statusId: string) {
    try {
      const q2 = "SELECT handle_on_task_status_change($1, $2, $3) AS res;";
      const results1 = await db.query(q2, [userId, taskId, statusId]);
      const [d] = results1.rows;
      const changeResponse = d.res;

      // notify to all task members of the change
      for (const member of changeResponse.members || []) {
        if (member.user_id === userId) continue;
        NotificationsService.createNotification({
          userId: member.user_id,
          teamId: member.team_id,
          socketId: member.socket_id,
          message: changeResponse.message,
          taskId,
          projectId: changeResponse.project_id
        });
      }
    } catch (error) {
      log_error(error);
    }
  }

  @HandleExceptions()
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const userId = req.user?.id as string;

    await this.notifyStatusChange(userId, req.body.id, req.body.status_id);

    const q = `SELECT update_task($1) AS task;`;
    const result = await db.query(q, [JSON.stringify(req.body)]);
    const [data] = result.rows;
    const task = data.task || null;

    if (task) {
      this.sendAssignmentNotifications(task, userId);
    }

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async updateDuration(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const { start, end } = req.body;

    const q = `
      UPDATE tasks
      SET start_date = ($1)::TIMESTAMP,
          end_date   = ($2)::TIMESTAMP
      WHERE id = ($3)::UUID
      RETURNING id;
    `;
    const result = await db.query(q, [start, end, id]);
    const [data] = result.rows;
    if (data?.id)
      return res.status(200).send(new ServerResponse(true, {}));
    return res.status(200).send(new ServerResponse(false, {}, "Task update failed!"));
  }

  @HandleExceptions()
  public static async updateStatus(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { status_id, task_id } = req.params;
    const { project_id, from_index, to_index } = req.body;

    const q = `SELECT update_task_status($1, $2, $3, $4, $5) AS status;`;
    const result = await db.query(q, [task_id, project_id, status_id, from_index, to_index]);
    const [data] = result.rows;
    if (data?.status) return res.status(200).send(new ServerResponse(true, {}));

    return res.status(200).send(new ServerResponse(false, {}, "Task update failed!"));
  }

  @HandleExceptions()
  public static async getTasksByProject(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const q = `SELECT get_project_gantt_tasks($1) AS gantt_tasks;`;
    const result = await db.query(q, [id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data?.gantt_tasks));
  }

  @HandleExceptions()
  public static async getTasksBetweenRange(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { project_id, start_date, end_date } = req.query;
    const q = `
      SELECT pm.id,
             (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]' ::JSON)
              FROM (SELECT t.id,
                           t.name,
                           t.start_date,
                           t.project_id,
                           t.priority_id,
                           t.done,
                           t.end_date,
                           (SELECT color_code
                            FROM projects
                            WHERE projects.id = t.project_id) AS color_code,
                           (SELECT name FROM task_statuses WHERE id = t.status_id) AS status
                    FROM tasks_assignees ta,
                         tasks t
                    WHERE t.archived IS FALSE
                      AND ta.project_member_id = pm.id
                      AND t.id = ta.task_id
                      AND start_date IS NOT NULL
                      AND end_date IS NOT NULL
                    ORDER BY start_date) rec) AS tasks
      FROM project_members pm
      WHERE project_id = $1;
    `;
    const result = await db.query(q, [project_id]);
    const obj: any = {};

    const minMaxDates: { min_date: string, max_date: string } = await getMinMaxOfTaskDates(project_id as string);

    const dates = await getDates(minMaxDates.min_date || start_date as string, minMaxDates.max_date || end_date as string);
    const months = await getWeekRange(dates);

    for (const element of result.rows) {
      obj[element.id] = element.tasks;
      for (const task of element.tasks) {
        const min: number = dates.findIndex((date) => moment(task.start_date).isSame(date.date, "days"));
        const max: number = dates.findIndex((date) => moment(task.end_date).isSame(date.date, "days"));
        task.min = min + 1;
        task.max = max > 0 ? max + 2 : max;
      }
    }

    return res.status(200).send(new ServerResponse(true, { tasks: [obj], dates, months }));
  }

  @HandleExceptions()
  public static async getGanttTasksByProject(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT id,
             name,
             start_date,
             project_id,
             priority_id,
             done,
             end_date,
             (SELECT color_code
              FROM projects
              WHERE projects.id = project_id) AS color_code,
             (SELECT name FROM task_statuses WHERE id = tasks.status_id) AS status,
             parent_task_id,
             parent_task_id IS NOT NULL AS is_sub_task,
             (SELECT name FROM tasks WHERE id = tasks.parent_task_id) AS parent_task_name,
             (SELECT COUNT('*')::INT FROM tasks WHERE parent_task_id = tasks.id) AS sub_tasks_count
      FROM tasks
      WHERE archived IS FALSE
        AND project_id = $1
        AND parent_task_id IS NULL
      ORDER BY start_date;
    `;
    const result = await db.query(q, [req.query.project_id]);

    const minMaxDates: {
      min_date: string,
      max_date: string
    } = await getMinMaxOfTaskDates(req.query.project_id as string);

    if (!minMaxDates.max_date && !minMaxDates.min_date) {
      minMaxDates.min_date = moment().format();
      minMaxDates.max_date = moment().add(45, "days").format();
    }

    const dates = await getDates(minMaxDates.min_date, minMaxDates.max_date);
    const weeks = await getWeekRange(dates);
    const months = await getMonthRange(dates);

    for (const task of result.rows) {
      const min: number = dates.findIndex((date) => moment(task.start_date).isSame(date.date, "days"));
      const max: number = dates.findIndex((date) => moment(task.end_date).isSame(date.date, "days"));
      task.show_sub_tasks = false;
      task.sub_tasks = [];
      task.min = min + 1;
      task.max = max > 0 ? max + 2 : max;
    }

    return res.status(200).send(new ServerResponse(true, { tasks: result.rows, dates, weeks, months }));
  }

  @HandleExceptions()
  public static async getProjectTasksByTeam(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT get_resource_gantt_tasks($1) AS gantt_tasks;`;
    const result = await db.query(q, [req.user?.id ?? null]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data?.gantt_tasks));
  }

  @HandleExceptions()
  public static async getSelectedTasksByProject(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT get_selected_tasks($1) AS tasks`;
    const result = await db.query(q, [req.params.id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data?.tasks));
  }

  @HandleExceptions()
  public static async getUnselectedTasksByProject(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT get_unselected_tasks($1) AS tasks`;
    const result = await db.query(q, [req.params.id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data?.tasks));
  }

  /** Should migrate getProjectTasksByStatus to this */
  @HandleExceptions()
  public static async getProjectTasksByStatusV2(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {

    // Get all statuses
    const q1 = `
      SELECT task_statuses.id, task_statuses.name, stsc.color_code
      FROM task_statuses
             INNER JOIN sys_task_status_categories stsc ON task_statuses.category_id = stsc.id
      WHERE project_id = $1
        AND team_id = $2
      ORDER BY task_statuses.sort_order;
    `;
    const result1 = await db.query(q1, [req.query.project, req.user?.team_id]);
    const statuses = result1.rows;

    const dataset = [];

    // Query tasks of statuses
    for (const status of statuses) {
      const q2 = `SELECT get_tasks_by_status($1, $2) AS tasks`;
      const result2 = await db.query(q2, [req.params.id, status]);
      const [data] = result2.rows;

      for (const task of data.tasks) {
        task.name_color = getColor(task.name);
        task.names = this.createTagList(task.assignees);
        task.names.map((a: any) => a.color_code = getColor(a.name));
      }
      dataset.push(data);
    }

    return res.status(200).send(new ServerResponse(true, dataset));
  }

  @HandleExceptions()
  public static async getProjectTasksByStatus(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT get_tasks_by_status($1,$2) AS tasks`;
    const result = await db.query(q, [req.params.id, req.query.status]);
    const [data] = result.rows;

    for (const task of data.tasks) {
      task.name_color = getColor(task.name);
      task.names = this.createTagList(task.assignees);
      task.all_labels = task.labels;
      task.labels = this.createTagList(task.labels, 3);
      task.names.map((a: any) => a.color_code = getColor(a.name));
    }

    return res.status(200).send(new ServerResponse(true, data?.tasks));
  }

  @HandleExceptions()
  public static async deleteById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `DELETE
               FROM tasks
               WHERE id = $1;`;
    const result = await db.query(q, [req.params.id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT get_task_form_view_model($1, $2, $3, $4) AS view_model;`;
    const result = await db.query(q, [req.user?.id ?? null, req.user?.team_id ?? null, req.query.task_id ?? null, (req.query.project_id as string) || null]);
    const [data] = result.rows;

    const default_model = {
      task: {},
      priorities: [],
      projects: [],
      statuses: [],
      team_members: [],
    };

    const task = data.view_model.task || null;

    if (!task)
      return res.status(200).send(new ServerResponse(true, default_model));

    if (data.view_model && task) {
      task.assignees.map((a: any) => {
        a.color_code = getColor(a.name);
        return a;
      });

      task.names = WorklenzControllerBase.createTagList(task.assignees);

      const totalMinutes = task.total_minutes;
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      task.total_hours = hours;
      task.total_minutes = minutes;
      task.assignees = (task.assignees || []).map((i: any) => i.team_member_id);

      task.timer_start_time = moment(task.timer_start_time).valueOf();

      task.status_color = task.status_color + TASK_STATUS_COLOR_ALPHA;
    }

    for (const member of (data.view_model?.team_members || [])) {
      member.color_code = getColor(member.name);
    }

    const t = await getTaskCompleteInfo(task);
    const info = await TasksControllerV2.getTaskCompleteRatio(t.parent_task_id || t.id);

    if (info) {
      t.complete_ratio = info.ratio;
      t.completed_count = info.total_completed;
      t.total_tasks_count = info.total_tasks;
    }

    data.view_model.task = t;

    return res.status(200).send(new ServerResponse(true, data.view_model || default_model));
  }

  @HandleExceptions()
  public static async createQuickTask(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT create_quick_task($1) AS task_id;`;
    req.body.reporter_id = req.user?.id ?? null;
    req.body.team_id = req.user?.team_id ?? null;
    req.body.total_minutes = toMinutes(req.body.total_hours, req.body.total_minutes);
    const result = await db.query(q, [JSON.stringify(req.body)]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async createHomeTask(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT create_home_task($1);`;
    let endDate = req.body.end_date;
    switch (endDate) {
      case "Today":
        endDate = moment().format();
        break;
      case "Tomorrow":
        endDate = moment().add(1, "days").format();
        break;
      case "Next Week":
        endDate = moment().add(1, "weeks").endOf("isoWeek").format();
        break;
      case "Next Month":
        endDate = moment().add(1, "months").endOf("month").format();
        break;
      case "No Due Date":
        endDate = null;
        break;
      default:
        endDate = null;
    }
    req.body.end_date = endDate;
    req.body.reporter_id = req.user?.id ?? null;
    req.body.team_id = req.user?.team_id ?? null;
    const result = await db.query(q, [JSON.stringify(req.body)]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data.create_home_task.task));
  }

  @HandleExceptions()
  public static async bulkChangeStatus(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT bulk_change_tasks_status($1, $2) AS task;`;
    const result = await db.query(q, [JSON.stringify(req.body), req.user?.id]);
    const [data] = result.rows;

    TasksController.notifyProjectUpdates(req.user?.socket_id as string, req.query.project as string);

    return res.status(200).send(new ServerResponse(true, { failed_tasks: data.task }));
  }

  @HandleExceptions()
  public static async bulkChangePriority(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT bulk_change_tasks_priority($1, $2) AS task;`;
    const result = await db.query(q, [JSON.stringify(req.body), req.user?.id]);
    const [data] = result.rows;

    TasksController.notifyProjectUpdates(req.user?.socket_id as string, req.query.project as string);

    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async bulkChangePhase(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT bulk_change_tasks_phase($1, $2) AS task;`;
    const result = await db.query(q, [JSON.stringify(req.body), req.user?.id]);
    const [data] = result.rows;

    TasksController.notifyProjectUpdates(req.user?.socket_id as string, req.query.project as string);

    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async bulkDelete(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const deletedTasks = req.body.tasks.map((t: any) => t.id);

    const result: any = { deleted_tasks: deletedTasks };

    const q = `SELECT bulk_delete_tasks($1) AS task;`;
    await db.query(q, [JSON.stringify(req.body)]);
    TasksController.notifyProjectUpdates(req.user?.socket_id as string, req.query.project as string);
    return res.status(200).send(new ServerResponse(true, result));
  }

  @HandleExceptions()
  public static async bulkArchive(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT bulk_archive_tasks($1) AS task;`;
    req.body.type = req.query.type;
    await db.query(q, [JSON.stringify(req.body)]);
    const tasks = req.body.tasks.map((t: any) => t.id);
    TasksController.notifyProjectUpdates(req.user?.socket_id as string, req.query.project as string);
    return res.status(200).send(new ServerResponse(true, tasks));
  }

  @HandleExceptions()
  public static async bulkAssignMe(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {

    req.body.team_id = req.user?.team_id;
    req.body.user_id = req.user?.id;

    const [task] = req.body.tasks || [];

    const q = `SELECT bulk_assign_to_me($1) AS task;`;
    await db.query(q, [JSON.stringify(req.body)]);

    const assignees = await getAssignees(task.id);
    const members = await getTeamMembers(req.body.team_id);
    // for inline display
    const names = WorklenzControllerBase.createTagList(assignees);

    const data = { id: task.id, members, assignees, names };

    const activityLog: IActivityLog = {
      task_id: task.id,
      attribute_type: "assignee",
      user_id: req.user?.id,
      log_type: "assign",
      old_value: null,
      new_value: req.user?.id,
      next_string: req.user?.name
    };

    insertToActivityLogs(activityLog);

    TasksController.notifyProjectUpdates(req.user?.socket_id as string, req.query.project as string);
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async bulkAssignLabel(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {

    if (req.body.text) {
      const q0 = `SELECT bulk_assign_or_create_label($1) AS label;`;

      req.body.team_id = req.user?.team_id;
      req.body.color = getRandomColorCode();

      await db.query(q0, [JSON.stringify(req.body)]);
    } else {
      const q = `SELECT bulk_assign_label($1, $2) AS task;`;
      await db.query(q, [JSON.stringify(req.body), req.user?.id as string]);
    }

    TasksController.notifyProjectUpdates(req.user?.socket_id as string, req.query.project as string);
    return res.status(200).send(new ServerResponse(true, null));
  }

  @HandleExceptions()
  public static async bulkAssignMembers(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { tasks, members, project_id } = req.body;
    try {
      for (const task of tasks) {
        for (const member of members) {
          await TasksController.createTaskBulkAssignees(member.id, project_id, task.id, req.user?.id as string);
        }
      }
      TasksController.notifyProjectUpdates(req.user?.socket_id as string, project_id as string);
      return res.status(200).send(new ServerResponse(true, null));
    } catch (error) {
      return res.status(500).send(new ServerResponse(false, "An error occurred"));
    }
  }

  public static async createTaskAssignee(memberId: string, projectId: string, taskId: string, userId: string) {
    const q = `SELECT create_task_assignee($1,$2,$3,$4)`;
    const result = await db.query(q, [memberId, projectId, taskId, userId]);
    return result.rows;
  }

  public static async createTaskBulkAssignees(memberId: string, projectId: string, taskId: string, userId: string) {
    const q = `SELECT create_bulk_task_assignees($1,$2,$3,$4)`;
    const result = await db.query(q, [memberId, projectId, taskId, userId]);
    return result.rows;
  }

  @HandleExceptions()
  public static async getProjectTaskAssignees(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT project_members.team_member_id AS id,
             tmiv.name,
             tmiv.email,
             tmiv.avatar_url
      FROM project_members
             LEFT JOIN team_member_info_view tmiv ON project_members.team_member_id = tmiv.team_member_id
      WHERE project_id = $1
        AND EXISTS(SELECT 1 FROM tasks_assignees WHERE project_member_id = project_members.id);
    `;
    const result = await db.query(q, [req.params.id]);

    for (const member of result.rows) {
      member.color_code = getColor(member.name);
    }

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async importFromCSV(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { id: projectId } = req.params;
    const userId = req.user?.id;
    const teamId = req.user?.team_id;

    console.log("=== CSV Import Debug Info ===");
    console.log("Project ID:", projectId);
    console.log("User ID:", userId);
    console.log("Team ID:", teamId);
    console.log("File info:", {
      filename: req.file?.filename,
      originalname: req.file?.originalname,
      size: req.file?.size,
      path: req.file?.path
    });

    if (!req.file) {
      return res.status(400).send(new ServerResponse(false, null, "No file uploaded"));
    }

    if (!projectId || !userId || !teamId) {
      return res.status(400).send(new ServerResponse(false, null, "Missing required parameters"));
    }

    try {
      const results: any[] = [];
      const errors: string[] = [];
      let processed = 0;
      let skipped = 0;

      console.log("Reading CSV file from:", req.file.path);

      // Parse CSV file
      await new Promise<void>((resolve, reject) => {
        fs.createReadStream(req.file!.path)
          .pipe(csv())
          .on("data", (row) => {
            console.log("Parsed CSV row:", row);
            
            // Handle different possible delimiters and BOM
            const keys = Object.keys(row);
            if (keys.length === 1 && keys[0].includes(";")) {
              // Looks like semicolon-delimited data in a single column
              const [singleColumn] = keys;
              const singleValue = row[singleColumn];
              
              // Split by semicolon
              const parts = singleValue.split(";");
              const headerParts = singleColumn.split(";");
              
              if (headerParts.length >= 2 && parts.length >= 2) {
                // Clean BOM and create proper row object
                const cleanRow: Record<string, string> = {};
                cleanRow[headerParts[0].replace(/^\uFEFF/, "").trim()] = parts[0].trim();
                cleanRow[headerParts[1].trim()] = parts[1].trim();
                console.log("Converted row:", cleanRow);
                results.push(cleanRow);
                return;
              }
            }
            
            // Clean BOM from column names
            const cleanRow: Record<string, string> = {};
            for (const [key, value] of Object.entries(row)) {
              const cleanKey = key.replace(/^\uFEFF/, "").trim();
              cleanRow[cleanKey] = value as string;
            }
            console.log("Cleaned row:", cleanRow);
            results.push(cleanRow);
          })
          .on("end", () => {
            console.log("CSV parsing complete. Total rows:", results.length);
            resolve();
          })
          .on("error", (error) => {
            console.error("CSV parsing error:", error);
            reject(error);
          });
      });

      console.log("Raw CSV results:", results);

      // Get default task status for the project
      const statusQuery = `
        SELECT id FROM task_statuses 
        WHERE project_id = $1 AND team_id = $2 
        ORDER BY sort_order LIMIT 1
      `;
      console.log("Status query:", statusQuery, "with params:", [projectId, teamId]);
      const statusResult = await db.query(statusQuery, [projectId, teamId]);
      console.log("Status query result:", statusResult.rows);
      const defaultStatusId = statusResult.rows[0]?.id;

      if (!defaultStatusId) {
        throw new Error("No task statuses found for this project");
      }

      console.log("Default status ID:", defaultStatusId);

      // Process each row
      for (const [index, row] of results.entries()) {
        try {
          console.log(`\n--- Processing row ${index + 2} ---`);
          console.log("Row data:", row);
          
          // Map CSV column names to expected field names
          const taskTitle = row["Task Title"] || row.name || "";
          const description = row["Description"] || row.description || "";
          
          // Validate required fields
          if (!taskTitle || taskTitle.trim() === "") {
            console.log("Skipping row - no task title");
            errors.push(`Row ${index + 2}: Task title is required`);
            skipped++;
            continue;
          }

          // Prepare task data
          const taskData = {
            name: taskTitle.trim(),
            description: description || "",
            project_id: projectId,
            reporter_id: userId,
            team_id: teamId,
            status_id: defaultStatusId,
            priority_id: null,
            start: row.start || null,
            end: row.end || null,
            total_minutes: 0,
            assignees: []
          };

          console.log("Task data to create:", JSON.stringify(taskData, null, 2));

          // Create task using the database function
          const createQuery = `SELECT create_task($1) AS task;`;
          console.log("Creating task with query:", createQuery);
          console.log("Task data being sent:", JSON.stringify(taskData));
          
          const result = await db.query(createQuery, [JSON.stringify(taskData)]);
          console.log("Task creation result:", result.rows);
          
          if (result.rows && result.rows[0]?.task) {
            processed++;
            console.log(`Task created successfully with ID: ${result.rows[0].task.id}`);
          } else {
            console.log("Task creation failed - no task returned");
            errors.push(`Row ${index + 2}: Failed to create task`);
            skipped++;
          }
        } catch (error) {
          console.error(`Error processing row ${index + 2}:`, error);
          errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : "Unknown error"}`);
          skipped++;
        }
      }

      // Clean up uploaded file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log("Cleaned up file:", req.file.path);
      }

      console.log("\n=== CSV Import Summary ===");
      console.log("Processed:", processed);
      console.log("Skipped:", skipped);
      console.log("Total:", results.length);
      console.log("Errors:", errors.length);

      const responseData = {
        processed,
        skipped,
        total: results.length,
        errors: errors.slice(0, 10) // Limit errors to prevent response bloat
      };

      return res.status(200).send(new ServerResponse(true, responseData));
    } catch (error) {
      console.error("CSV import error:", error);
      
      // Clean up file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(500).send(new ServerResponse(false, null, error instanceof Error ? error.message : "CSV import failed"));
    }
  }
}
