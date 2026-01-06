import db from "../config/db";
import { Socket } from "socket.io";
import { getLoggedInUserIdFromSocket } from "./util";
import { log_error } from "../shared/utils";

/**
 * Verify user has access to a task via their team
 * @param socket - Socket.IO socket instance
 * @param taskId - Task UUID to verify
 * @returns Promise<boolean> - True if user has access
 */
export async function verifyTaskAccessSocket(
  socket: Socket,
  taskId: string
): Promise<boolean> {
  const userId = getLoggedInUserIdFromSocket(socket);
  const teamId = socket.data?.team_id;

  if (!userId || !teamId || !taskId) {
    log_error(`Missing required data for task access check: userId=${userId}, teamId=${teamId}, taskId=${taskId}`);
    return false;
  }

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
    log_error(`Error verifying task access: ${error}`);
    return false;
  }
}

/**
 * Verify user has access to a project via their team
 * @param socket - Socket.IO socket instance
 * @param projectId - Project UUID to verify
 * @returns Promise<boolean> - True if user has access
 */
export async function verifyProjectAccessSocket(
  socket: Socket,
  projectId: string
): Promise<boolean> {
  const teamId = socket.data?.team_id;

  if (!teamId || !projectId) {
    log_error(`Missing required data for project access check: teamId=${teamId}, projectId=${projectId}`);
    return false;
  }

  try {
    const q = `
      SELECT 1
      FROM projects
      WHERE id = $1 AND team_id = $2
      LIMIT 1;
    `;
    const result = await db.query(q, [projectId, teamId]);
    return result.rowCount ? result.rowCount > 0 : false;
  } catch (error) {
    log_error(`Error verifying project access: ${error}`);
    return false;
  }
}

/**
 * Verify user has access to a phase via project ownership
 * @param socket - Socket.IO socket instance
 * @param phaseId - Phase UUID to verify
 * @returns Promise<boolean> - True if user has access
 */
export async function verifyPhaseAccessSocket(
  socket: Socket,
  phaseId: string
): Promise<boolean> {
  const teamId = socket.data?.team_id;

  if (!teamId || !phaseId) {
    return false;
  }

  try {
    const q = `
      SELECT 1
      FROM task_phases tp
      INNER JOIN projects p ON tp.project_id = p.id
      WHERE tp.id = $1 AND p.team_id = $2
      LIMIT 1;
    `;
    const result = await db.query(q, [phaseId, teamId]);
    return result.rowCount ? result.rowCount > 0 : false;
  } catch (error) {
    log_error(`Error verifying phase access: ${error}`);
    return false;
  }
}

/**
 * Verify user has access to a project template via team ownership
 * @param socket - Socket.IO socket instance
 * @param templateId - Template UUID to verify
 * @returns Promise<boolean> - True if user has access
 */
export async function verifyProjectTemplateAccessSocket(
  socket: Socket,
  templateId: string
): Promise<boolean> {
  const teamId = socket.data?.team_id;

  if (!teamId || !templateId) {
    return false;
  }

  try {
    const q = `
      SELECT 1
      FROM project_templates
      WHERE id = $1 AND team_id = $2
      LIMIT 1;
    `;
    const result = await db.query(q, [templateId, teamId]);
    return result.rowCount ? result.rowCount > 0 : false;
  } catch (error) {
    log_error(`Error verifying project template access: ${error}`);
    return false;
  }
}

/**
 * Log unauthorized access attempts for security monitoring
 */
export function logUnauthorizedSocketAccess(
  socket: Socket,
  event: string,
  resourceType: string,
  resourceId: string
): void {
  const userId = getLoggedInUserIdFromSocket(socket);
  const teamId = socket.data?.team_id;
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    severity: "SECURITY_WARNING",
    type: "UNAUTHORIZED_SOCKET_ACCESS",
    userId,
    teamId,
    socketId: socket.id,
    event,
    resourceType,
    resourceId,
    ip: socket.handshake.address
  };
  
  console.error("[SECURITY]", JSON.stringify(logEntry));
}
