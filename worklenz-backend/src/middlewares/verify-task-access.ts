import {NextFunction} from "express";
import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";
import {ServerResponse} from "../models/server-response";
import db from "../config/db";
import {log_error} from "../shared/utils";

/**
 * Middleware to verify that the authenticated user has access to a specific task.
 * This prevents IDOR (Insecure Direct Object Reference) attacks by ensuring users
 * can only access tasks that belong to projects in their team.
 * 
 * Usage:
 * - For task ID in URL params: verifyTaskAccess('params', 'id')
 * - For task ID in request body: verifyTaskAccess('body', 'task_id')
 * - For task ID in query params: verifyTaskAccess('query', 'task_id')
 * 
 * @param location - Where to find the task ID ('params', 'body', or 'query')
 * @param fieldName - The name of the field containing the task ID
 */
export default function verifyTaskAccess(
  location: 'params' | 'body' | 'query' = 'params',
  fieldName: string = 'id'
) {
  return async (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) => {
    const userId = req.user?.id;
    const teamId = req.user?.team_id;
    
    // Get task ID from the specified location
    const taskId = req[location]?.[fieldName];

    if (!taskId) {
      return res.status(400).send(
        new ServerResponse(false, null, "Task ID is required")
      );
    }

    if (!userId || !teamId) {
      return res.status(401).send(
        new ServerResponse(false, null, "Authentication required")
      );
    }

    try {
      // Verify that the task belongs to a project in the user's team
      const q = `
        SELECT 1
        FROM tasks t
        INNER JOIN projects p ON t.project_id = p.id
        WHERE t.id = $1 AND p.team_id = $2
        LIMIT 1;
      `;
      
      const result = await db.query(q, [taskId, teamId]);
      
      if (result.rowCount && result.rowCount > 0) {
        // User has access to this task
        return next();
      }
      
      // Task not found or user doesn't have access
      return res.status(403).send(
        new ServerResponse(false, null, "You do not have permission to access this task")
      );
    } catch (error) {
      log_error(error);
      return res.status(500).send(
        new ServerResponse(false, null, "An error occurred while verifying task access")
      );
    }
  };
}

/**
 * Helper function to verify task access programmatically (without middleware)
 * Useful for bulk operations or custom authorization logic
 * 
 * @param taskId - The task ID to check
 * @param teamId - The user's team ID
 * @returns Promise<boolean> - True if user has access, false otherwise
 */
export async function hasTaskAccess(taskId: string, teamId: string): Promise<boolean> {
  try {
    const q = `
      SELECT 1
      FROM tasks t
      INNER JOIN projects p ON t.project_id = p.id
      WHERE t.id = $1 AND p.team_id = $2
      LIMIT 1;
    `;
    
    const result = await db.query(q, [taskId, teamId]);
    return result.rowCount ? result.rowCount > 0 : false;
  } catch (error) {
    log_error(error);
    return false;
  }
}

/**
 * Verify access to multiple tasks at once
 * Useful for bulk operations
 * 
 * @param taskIds - Array of task IDs to check
 * @param teamId - The user's team ID
 * @returns Promise<{authorized: string[], unauthorized: string[]}> - Object with authorized and unauthorized task IDs
 */
export async function verifyBulkTaskAccess(
  taskIds: string[],
  teamId: string
): Promise<{authorized: string[], unauthorized: string[]}> {
  try {
    if (!taskIds || taskIds.length === 0) {
      return {authorized: [], unauthorized: []};
    }

    const q = `
      SELECT t.id
      FROM tasks t
      INNER JOIN projects p ON t.project_id = p.id
      WHERE t.id = ANY($1::UUID[]) AND p.team_id = $2;
    `;
    
    const result = await db.query(q, [taskIds, teamId]);
    const authorized = result.rows.map((row: any) => row.id);
    const unauthorized = taskIds.filter(id => !authorized.includes(id));
    
    return {authorized, unauthorized};
  } catch (error) {
    log_error(error);
    return {authorized: [], unauthorized: taskIds};
  }
}

/**
 * Middleware to verify bulk task access
 * This ensures users can only perform bulk operations on tasks in their team
 * 
 * @param location - Where to find the tasks array ('body', 'query')
 * @param fieldName - The name of the field containing the tasks array
 */
export function verifyBulkTaskAccessMiddleware(
  location: 'body' | 'query' = 'body',
  fieldName: string = 'tasks'
) {
  return async (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) => {
    const teamId = req.user?.team_id;

    if (!teamId) {
      return res.status(401).send(
        new ServerResponse(false, null, "Authentication required")
      );
    }

    // Get tasks array from the specified location
    const tasks = req[location]?.[fieldName];

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).send(
        new ServerResponse(false, null, "Tasks array is required")
      );
    }

    try {
      // Extract task IDs from the tasks array
      // Tasks can be either strings (task IDs) or objects with an 'id' property
      const taskIds = tasks.map((task: any) => 
        typeof task === 'string' ? task : task.id
      ).filter(Boolean);

      if (taskIds.length === 0) {
        return res.status(400).send(
          new ServerResponse(false, null, "No valid task IDs provided")
        );
      }

      // Verify access to all tasks
      const {authorized, unauthorized} = await verifyBulkTaskAccess(taskIds, teamId);

      if (unauthorized.length > 0) {
        return res.status(403).send(
          new ServerResponse(
            false, 
            null, 
            `You do not have permission to access ${unauthorized.length} task(s)`
          )
        );
      }

      // All tasks are authorized, continue
      return next();
    } catch (error) {
      log_error(error);
      return res.status(500).send(
        new ServerResponse(false, null, "An error occurred while verifying task access")
      );
    }
  };
}

/**
 * Middleware to verify task access via comment ID
 * This is useful for endpoints that operate on comments but need to verify task access
 * 
 * @param location - Where to find the comment ID ('params', 'body', or 'query')
 * @param fieldName - The name of the field containing the comment ID
 */
export function verifyTaskAccessViaComment(
  location: 'params' | 'body' | 'query' = 'params',
  fieldName: string = 'id'
) {
  return async (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) => {
    const userId = req.user?.id;
    const teamId = req.user?.team_id;
    
    // Get comment ID from the specified location
    const commentId = req[location]?.[fieldName];

    if (!commentId) {
      return res.status(400).send(
        new ServerResponse(false, null, "Comment ID is required")
      );
    }

    if (!userId || !teamId) {
      return res.status(401).send(
        new ServerResponse(false, null, "Authentication required")
      );
    }

    try {
      // Verify that the comment belongs to a task in a project in the user's team
      const q = `
        SELECT 1
        FROM task_comments tc
        INNER JOIN tasks t ON tc.task_id = t.id
        INNER JOIN projects p ON t.project_id = p.id
        WHERE tc.id = $1 AND p.team_id = $2
        LIMIT 1;
      `;
      
      const result = await db.query(q, [commentId, teamId]);
      
      if (result.rowCount && result.rowCount > 0) {
        // User has access to this comment's task
        return next();
      }
      
      // Comment not found or user doesn't have access
      return res.status(403).send(
        new ServerResponse(false, null, "You do not have permission to access this comment")
      );
    } catch (error) {
      log_error(error);
      return res.status(500).send(
        new ServerResponse(false, null, "An error occurred while verifying comment access")
      );
    }
  };
}

/**
 * Middleware to verify task access via work log ID
 * This is useful for endpoints that operate on work logs but need to verify task access
 * 
 * @param location - Where to find the work log ID ('params', 'body', or 'query')
 * @param fieldName - The name of the field containing the work log ID
 */
export function verifyTaskAccessViaWorkLog(
  location: 'params' | 'body' | 'query' = 'params',
  fieldName: string = 'id'
) {
  return async (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) => {
    const userId = req.user?.id;
    const teamId = req.user?.team_id;
    
    const workLogId = req[location]?.[fieldName];

    if (!workLogId) {
      return res.status(400).send(
        new ServerResponse(false, null, "Work log ID is required")
      );
    }

    if (!userId || !teamId) {
      return res.status(401).send(
        new ServerResponse(false, null, "Authentication required")
      );
    }

    try {
      // Verify that the work log belongs to a task in a project in the user's team
      const q = `
        SELECT 1
        FROM task_work_log twl
        INNER JOIN tasks t ON twl.task_id = t.id
        INNER JOIN projects p ON t.project_id = p.id
        WHERE twl.id = $1 AND p.team_id = $2
        LIMIT 1;
      `;
      
      const result = await db.query(q, [workLogId, teamId]);
      
      if (result.rowCount && result.rowCount > 0) {
        return next();
      }
      
      return res.status(403).send(
        new ServerResponse(false, null, "You do not have permission to access this work log")
      );
    } catch (error) {
      log_error(error);
      return res.status(500).send(
        new ServerResponse(false, null, "An error occurred while verifying work log access")
      );
    }
  };
}

/**
 * Middleware to verify task access via attachment ID
 * This is useful for endpoints that operate on attachments but need to verify task access
 * 
 * @param location - Where to find the attachment ID ('params', 'body', or 'query')
 * @param fieldName - The name of the field containing the attachment ID
 */
export function verifyTaskAccessViaAttachment(
  location: 'params' | 'body' | 'query' = 'params',
  fieldName: string = 'id'
) {
  return async (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) => {
    const userId = req.user?.id;
    const teamId = req.user?.team_id;
    
    const attachmentId = req[location]?.[fieldName];

    if (!attachmentId) {
      return res.status(400).send(
        new ServerResponse(false, null, "Attachment ID is required")
      );
    }

    if (!userId || !teamId) {
      return res.status(401).send(
        new ServerResponse(false, null, "Authentication required")
      );
    }

    try {
      // Verify that the attachment belongs to a task in a project in the user's team
      const q = `
        SELECT 1
        FROM task_attachments ta
        INNER JOIN tasks t ON ta.task_id = t.id
        INNER JOIN projects p ON t.project_id = p.id
        WHERE ta.id = $1 AND p.team_id = $2
        LIMIT 1;
      `;
      
      const result = await db.query(q, [attachmentId, teamId]);
      
      if (result.rowCount && result.rowCount > 0) {
        return next();
      }
      
      return res.status(403).send(
        new ServerResponse(false, null, "You do not have permission to access this attachment")
      );
    } catch (error) {
      log_error(error);
      return res.status(500).send(
        new ServerResponse(false, null, "An error occurred while verifying attachment access")
      );
    }
  };
}

/**
 * Middleware to verify task access via dependency ID
 * This is useful for endpoints that operate on dependencies but need to verify task access
 *
 * @param location - Where to find the dependency ID ('params', 'body', or 'query')
 * @param fieldName - The name of the field containing the dependency ID
 */
export function verifyTaskAccessViaDependency(
  location: 'params' | 'body' | 'query' = 'params',
  fieldName: string = 'id'
) {
  return async (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) => {
    const userId = req.user?.id;
    const teamId = req.user?.team_id;

    const dependencyId = req[location]?.[fieldName];

    if (!dependencyId) {
      return res.status(400).send(
        new ServerResponse(false, null, "Dependency ID is required")
      );
    }

    if (!userId || !teamId) {
      return res.status(401).send(
        new ServerResponse(false, null, "Authentication required")
      );
    }

    try {
      // Verify that the dependency involves tasks in projects in the user's team
      const q = `
        SELECT 1
        FROM task_dependencies td
        INNER JOIN tasks t ON td.task_id = t.id
        INNER JOIN projects p ON t.project_id = p.id
        WHERE td.id = $1 AND p.team_id = $2
        LIMIT 1;
      `;

      const result = await db.query(q, [dependencyId, teamId]);

      if (result.rowCount && result.rowCount > 0) {
        return next();
      }

      return res.status(403).send(
        new ServerResponse(false, null, "You do not have permission to access this dependency")
      );
    } catch (error) {
      log_error(error);
      return res.status(500).send(
        new ServerResponse(false, null, "An error occurred while verifying dependency access")
      );
    }
  };
}

/**
 * Middleware to verify task access via recurring schedule ID
 * This is useful for endpoints that operate on recurring schedules but need to verify task access
 *
 * @param location - Where to find the schedule ID ('params', 'body', or 'query')
 * @param fieldName - The name of the field containing the schedule ID
 */
export function verifyTaskAccessViaSchedule(
  location: 'params' | 'body' | 'query' = 'params',
  fieldName: string = 'id'
) {
  return async (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) => {
    const userId = req.user?.id;
    const teamId = req.user?.team_id;

    const scheduleId = req[location]?.[fieldName];

    if (!scheduleId) {
      return res.status(400).send(
        new ServerResponse(false, null, "Schedule ID is required")
      );
    }

    if (!userId || !teamId) {
      return res.status(401).send(
        new ServerResponse(false, null, "Authentication required")
      );
    }

    try {
      // Verify that the schedule belongs to a task in a project in the user's team
      const q = `
        SELECT 1
        FROM tasks t
        INNER JOIN projects p ON t.project_id = p.id
        WHERE t.schedule_id = $1 AND p.team_id = $2
        LIMIT 1;
      `;

      const result = await db.query(q, [scheduleId, teamId]);

      if (result.rowCount && result.rowCount > 0) {
        return next();
      }

      return res.status(403).send(
        new ServerResponse(false, null, "You do not have permission to access this schedule")
      );
    } catch (error) {
      log_error(error);
      return res.status(500).send(
        new ServerResponse(false, null, "An error occurred while verifying schedule access")
      );
    }
  };
}

