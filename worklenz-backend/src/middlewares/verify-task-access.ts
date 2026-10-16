import {NextFunction} from "express";
import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";
import {IPassportSession} from "../interfaces/passport-session";
import {ServerResponse} from "../models/server-response";
import db from "../config/db";
import {log_error} from "../shared/utils";
import {NON_GUEST_ACCESS_JOIN, NON_GUEST_ACCESS_PREDICATE} from "../shared/guest-access-sql";
import {
  canUserAccessTaskDetail,
  canUserEditTask,
  TASK_ASSIGNEE_READONLY_CODE,
  TASK_ASSIGNEE_RESTRICTED_CODE,
} from "../shared/assignee-task-scope";
import {userHasProjectAccessInTeam} from "./verify-project-access";

export interface VerifyTaskAccessOptions {
  /**
   * When true (task detail /info), notification exception requires from=notification|mention.
   * Other task APIs allow notification/mention proof without that query param so the drawer works.
   */
  requireNotificationLink?: boolean;
}

const getNotificationLinkFrom = (req: IWorkLenzRequest): string | null => {
  const fromQuery = req.query?.from;
  if (typeof fromQuery === "string") return fromQuery;
  const fromBody = (req.body as { from?: unknown } | undefined)?.from;
  if (typeof fromBody === "string") return fromBody;
  return null;
};

const denyAssigneeRestricted = (res: IWorkLenzResponse) =>
  res.status(403).send(
    new ServerResponse(
      false,
      { code: TASK_ASSIGNEE_RESTRICTED_CODE },
      "You do not have permission to access this task"
    )
  );

const denyAssigneeReadonly = (res: IWorkLenzResponse) =>
  res.status(403).send(
    new ServerResponse(
      false,
      { code: TASK_ASSIGNEE_READONLY_CODE },
      "This task is read-only. You can view it for context but cannot edit it."
    )
  );

const isReadOnlyHttpMethod = (method: string | undefined): boolean => {
  const m = (method || "GET").toUpperCase();
  return m === "GET" || m === "HEAD" || m === "OPTIONS";
};

/**
 * Role fields for the task's team, used to evaluate assignee-scope before
 * `activate_team` persists a workspace switch.
 */
interface TaskProjectTeamContext {
  projectTeamId: string;
  teamMemberId: string;
  owner: boolean;
  /** Session is_admin: Owner or Admin role. Team Lead's admin_role flag is separate. */
  isAdmin: boolean;
  roleName: string | null;
  isGuest: boolean;
}

/**
 * Resolve membership and project access on the task's team without changing
 * the user's active team. Assignee-scope exemptions must use this context,
 * not the currently active workspace role.
 */
const resolveTaskProjectTeamContext = async (
  userId: string,
  projectId: string,
  projectTeamId: string
): Promise<TaskProjectTeamContext | null> => {
  const userTeamAccessResult = await db.query(
    `
    SELECT tm.id, r.owner, r.admin_role, r.name, tm.is_guest
    FROM team_members tm
    INNER JOIN roles r ON tm.role_id = r.id
    WHERE tm.user_id = $1 AND tm.team_id = $2 AND tm.active = TRUE
    LIMIT 1;
    `,
    [userId, projectTeamId]
  );

  if (!userTeamAccessResult.rowCount) {
    return null;
  }

  const userTeamRole = userTeamAccessResult.rows[0];
  const isOwnerOfProjectTeam = !!userTeamRole.owner;
  const isAdminOfProjectTeam = !!userTeamRole.admin_role;

  const hasProjectAccessInTeam = await userHasProjectAccessInTeam(
    projectId,
    userId,
    projectTeamId,
    isOwnerOfProjectTeam,
    isAdminOfProjectTeam
  );

  if (!hasProjectAccessInTeam) {
    return null;
  }

  return {
    projectTeamId,
    teamMemberId: userTeamRole.id,
    owner: isOwnerOfProjectTeam,
    // Match deserialize_user: is_admin is Admin role (or owner), not Team Lead's admin_role flag
    isAdmin:
      isOwnerOfProjectTeam ||
      String(userTeamRole.name || "").toLowerCase() === "admin",
    roleName: userTeamRole.name ?? null,
    isGuest: !!userTeamRole.is_guest,
  };
};

const sessionForTaskProjectTeam = (
  user: IPassportSession,
  context: TaskProjectTeamContext
): IPassportSession => ({
  ...user,
  team_id: context.projectTeamId,
  team_member_id: context.teamMemberId,
  owner: context.owner,
  is_admin: context.isAdmin,
  role_name: context.roleName ?? undefined,
  is_guest: context.isGuest,
});

const activateTaskProjectTeam = async (
  req: IWorkLenzRequest,
  userId: string,
  context: TaskProjectTeamContext
): Promise<void> => {
  await db.query(`SELECT activate_team($1, $2)`, [context.projectTeamId, userId]);

  if (req.user) {
    req.user.team_id = context.projectTeamId;
    req.user.team_member_id = context.teamMemberId;
    req.user.owner = context.owner;
    req.user.is_admin = context.isAdmin;
    req.user.role_name = context.roleName ?? undefined;
    req.user.is_guest = context.isGuest;
  }
};

/**
 * Middleware to verify that the authenticated user has access to a specific task.
 * This prevents IDOR (Insecure Direct Object Reference) attacks by ensuring users
 * can only access tasks that belong to projects in their team.
 *
 * Also enforces projects.restrict_tasks_to_assignee (TVR-11) with a
 * notification/mention deep-link exception (TVR-12).
 *
 * When the task belongs to another team the user can access, assignee-scope is
 * evaluated with that team's role context first. The team is activated only
 * after detail access (and edit access, for mutations) is allowed, so an
 * unauthorized deep link does not change the active workspace.
 *
 * Usage:
 * - For task ID in URL params: verifyTaskAccess('params', 'id')
 * - For task ID in request body: verifyTaskAccess('body', 'task_id')
 * - For task ID in query params: verifyTaskAccess('query', 'task_id')
 * - Detail deep links: verifyTaskAccess('query', 'task_id', { requireNotificationLink: true })
 *
 * @param location - Where to find the task ID ('params', 'body', or 'query')
 * @param fieldName - The name of the field containing the task ID
 */
export default function verifyTaskAccess(
  location: 'params' | 'body' | 'query' = 'params',
  fieldName: string = 'id',
  options?: VerifyTaskAccessOptions
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
      // Resolve the task's project + team (needed for auto team-switch)
      const taskLookup = await db.query(
        `
        SELECT t.project_id, p.team_id AS project_team_id
        FROM tasks t
        INNER JOIN projects p ON t.project_id = p.id
        WHERE t.id = $1
        LIMIT 1;
        `,
        [taskId]
      );

      if (!taskLookup.rowCount) {
        return res.status(403).send(
          new ServerResponse(false, null, "You do not have permission to access this task")
        );
      }

      const {project_id: projectId, project_team_id: projectTeamId} = taskLookup.rows[0];

      let pendingTeam: TaskProjectTeamContext | null = null;

      if (projectTeamId !== teamId) {
        try {
          pendingTeam = await resolveTaskProjectTeamContext(
            userId,
            projectId,
            projectTeamId
          );
          if (!pendingTeam) {
            return res.status(403).send(
              new ServerResponse(false, null, "You do not have permission to access this task")
            );
          }
        } catch (switchError) {
          log_error(switchError);
          console.error(
            `[AUTO_TEAM_SWITCH] Failed to resolve team ${projectTeamId} for user ${userId} and task ${taskId}:`,
            switchError
          );
          return res.status(500).send(
            new ServerResponse(false, null, "Failed to switch teams. Please try again.")
          );
        }
      }

      const accessUser =
        pendingTeam && req.user
          ? sessionForTaskProjectTeam(req.user, pendingTeam)
          : req.user;

      const mayAccess = await canUserAccessTaskDetail(userId, taskId, accessUser, {
        requireNotificationLink: options?.requireNotificationLink === true,
        notificationLinkFrom: getNotificationLinkFrom(req),
      });

      if (!mayAccess) {
        return denyAssigneeRestricted(res);
      }

      // TVR-13: parent-context (and other non-assignee) viewers may not mutate
      if (!isReadOnlyHttpMethod(req.method)) {
        const mayEdit = await canUserEditTask(userId, taskId, accessUser);
        if (!mayEdit) {
          return denyAssigneeReadonly(res);
        }
      }

      if (pendingTeam) {
        try {
          await activateTaskProjectTeam(req, userId, pendingTeam);
        } catch (switchError) {
          log_error(switchError);
          console.error(
            `[AUTO_TEAM_SWITCH] Failed to switch user ${userId} to team ${projectTeamId} for task ${taskId}:`,
            switchError
          );
          return res.status(500).send(
            new ServerResponse(false, null, "Failed to switch teams. Please try again.")
          );
        }
      }

      return next();
    } catch (error) {
      log_error(error);
      return res.status(500).send(
        new ServerResponse(false, null, "An error occurred while verifying task access")
      );
    }
  };
}

export function verifyNonGuestTaskAccess(
  location: 'params' | 'body' | 'query' = 'params',
  fieldName: string = 'id'
) {
  return async (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) => {
    const userId = req.user?.id;
    const teamId = req.user?.team_id;
    const taskId = req[location]?.[fieldName];

    if (!taskId) {
      return res.status(400).send(new ServerResponse(false, null, "Task ID is required"));
    }

    if (!userId || !teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Authentication required"));
    }

    try {
      const q = `
        SELECT 1
        FROM tasks t
        INNER JOIN projects p ON t.project_id = p.id
        ${NON_GUEST_ACCESS_JOIN('$2')}
        WHERE t.id = $1
          AND ${NON_GUEST_ACCESS_PREDICATE}
        LIMIT 1;
      `;
      const result = await db.query(q, [taskId, userId]);

      if (result.rowCount && result.rowCount > 0) return next();

      return res.status(403).send(
        new ServerResponse(
          false,
          null,
          "You do not have permission to modify this task. Only non-guest members of the task's team can make changes."
        )
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
 * For mutations (POST/PUT/DELETE), enforces assignee-scope restrictions via canUserEditTask.
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
        SELECT tc.task_id
        FROM task_comments tc
        INNER JOIN tasks t ON tc.task_id = t.id
        INNER JOIN projects p ON t.project_id = p.id
        WHERE tc.id = $1 AND p.team_id = $2
        LIMIT 1;
      `;

      const result = await db.query(q, [commentId, teamId]);

      if (result.rowCount && result.rowCount > 0) {
        const taskId = result.rows[0].task_id;

        // For mutations, enforce assignee-scope restrictions
        if (!isReadOnlyHttpMethod(req.method)) {
          const mayEdit = await canUserEditTask(userId, taskId, req.user);
          if (!mayEdit) {
            return denyAssigneeReadonly(res);
          }
        }

        return next();
      }

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
 * For mutations (POST/PUT/DELETE), enforces assignee-scope restrictions via canUserEditTask.
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
        SELECT twl.task_id
        FROM task_work_log twl
        INNER JOIN tasks t ON twl.task_id = t.id
        INNER JOIN projects p ON t.project_id = p.id
        WHERE twl.id = $1 AND p.team_id = $2
        LIMIT 1;
      `;
      
      const result = await db.query(q, [workLogId, teamId]);
      
      if (result.rowCount && result.rowCount > 0) {
        const taskId = result.rows[0].task_id;
        
        // For mutations, enforce assignee-scope restrictions
        if (!isReadOnlyHttpMethod(req.method)) {
          const mayEdit = await canUserEditTask(userId, taskId, req.user);
          if (!mayEdit) {
            return denyAssigneeReadonly(res);
          }
        }
        
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
 * For mutations (POST/PUT/DELETE), enforces assignee-scope restrictions via canUserEditTask.
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
        SELECT ta.task_id
        FROM task_attachments ta
        INNER JOIN tasks t ON ta.task_id = t.id
        INNER JOIN projects p ON t.project_id = p.id
        WHERE ta.id = $1 AND p.team_id = $2
        LIMIT 1;
      `;
      
      const result = await db.query(q, [attachmentId, teamId]);
      
      if (result.rowCount && result.rowCount > 0) {
        const taskId = result.rows[0].task_id;
        
        // For mutations, enforce assignee-scope restrictions
        if (!isReadOnlyHttpMethod(req.method)) {
          const mayEdit = await canUserEditTask(userId, taskId, req.user);
          if (!mayEdit) {
            return denyAssigneeReadonly(res);
          }
        }
        
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
 * Middleware to verify task access via comment attachment ID.
 * Comment attachments live in task_comment_attachments, not task_attachments.
 * For mutations (POST/PUT/DELETE), enforces assignee-scope restrictions via canUserEditTask.
 *
 * @param location - Where to find the attachment ID ('params', 'body', or 'query')
 * @param fieldName - The name of the field containing the attachment ID
 */
export function verifyTaskAccessViaCommentAttachment(
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
      const q = `
        SELECT tca.task_id
        FROM task_comment_attachments tca
        INNER JOIN tasks t ON tca.task_id = t.id
        INNER JOIN projects p ON t.project_id = p.id
        WHERE tca.id = $1 AND p.team_id = $2
        LIMIT 1;
      `;

      const result = await db.query(q, [attachmentId, teamId]);

      if (result.rowCount && result.rowCount > 0) {
        const taskId = result.rows[0].task_id;
        
        // For mutations, enforce assignee-scope restrictions
        if (!isReadOnlyHttpMethod(req.method)) {
          const mayEdit = await canUserEditTask(userId, taskId, req.user);
          if (!mayEdit) {
            return denyAssigneeReadonly(res);
          }
        }
        
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
 * Same as verifyTaskAccessViaAttachment, but additionally rejects guests
 * (project_members.access_level = GUEST) — for endpoints like attachment
 * deletion that guests must not be able to perform.
 *
 * @param location - Where to find the attachment ID ('params', 'body', or 'query')
 * @param fieldName - The name of the field containing the attachment ID
 */
export function verifyNonGuestTaskAccessViaAttachment(
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
      const q = `
        SELECT 1
        FROM task_attachments ta
        INNER JOIN tasks t ON ta.task_id = t.id
        INNER JOIN projects p ON t.project_id = p.id
        ${NON_GUEST_ACCESS_JOIN('$2')}
        WHERE ta.id = $1
          AND ${NON_GUEST_ACCESS_PREDICATE}
        LIMIT 1;
      `;

      const result = await db.query(q, [attachmentId, userId]);

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
 * For mutations (POST/PUT/DELETE), enforces assignee-scope restrictions via canUserEditTask.
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
        SELECT td.task_id
        FROM task_dependencies td
        INNER JOIN tasks t ON td.task_id = t.id
        INNER JOIN projects p ON t.project_id = p.id
        WHERE td.id = $1 AND p.team_id = $2
        LIMIT 1;
      `;

      const result = await db.query(q, [dependencyId, teamId]);

      if (result.rowCount && result.rowCount > 0) {
        const taskId = result.rows[0].task_id;
        
        // For mutations, enforce assignee-scope restrictions
        if (!isReadOnlyHttpMethod(req.method)) {
          const mayEdit = await canUserEditTask(userId, taskId, req.user);
          if (!mayEdit) {
            return denyAssigneeReadonly(res);
          }
        }
        
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
 * For mutations (POST/PUT/DELETE), enforces assignee-scope restrictions via canUserEditTask.
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
        SELECT t.id as task_id
        FROM tasks t
        INNER JOIN projects p ON t.project_id = p.id
        WHERE t.schedule_id = $1 AND p.team_id = $2
        LIMIT 1;
      `;

      const result = await db.query(q, [scheduleId, teamId]);

      if (result.rowCount && result.rowCount > 0) {
        const taskId = result.rows[0].task_id;
        
        // For mutations, enforce assignee-scope restrictions
        if (!isReadOnlyHttpMethod(req.method)) {
          const mayEdit = await canUserEditTask(userId, taskId, req.user);
          if (!mayEdit) {
            return denyAssigneeReadonly(res);
          }
        }
        
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

