import db from "../config/db";
import {log_error} from "../shared/utils";

export class AuthorizationService {
  /**
   * Check if user's team owns a project
   */
  static async canAccessProject(
    teamId: string,
    projectId: string
  ): Promise<boolean> {
    try {
      const q = `SELECT 1 FROM projects WHERE id = $1 AND team_id = $2 LIMIT 1;`;
      const result = await db.query(q, [projectId, teamId]);
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      log_error(error);
      return false;
    }
  }

  /**
   * Check if user's team owns a task
   */
  static async canAccessTask(
    teamId: string,
    taskId: string
  ): Promise<boolean> {
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
   * Check if user is a member of a project
   */
  static async isProjectMember(
    userId: string,
    teamId: string,
    projectId: string
  ): Promise<boolean> {
    try {
      const q = `
        SELECT 1
        FROM project_members pm
        INNER JOIN team_members tm ON pm.team_member_id = tm.id
        WHERE pm.project_id = $1 
          AND tm.user_id = $2 
          AND tm.team_id = $3
        LIMIT 1;
      `;
      const result = await db.query(q, [projectId, userId, teamId]);
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      log_error(error);
      return false;
    }
  }

  /**
   * Bulk check task access
   */
  static async canAccessTasks(
    teamId: string,
    taskIds: string[]
  ): Promise<{authorized: string[], unauthorized: string[]}> {
    try {
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
   * Check if user's team owns a project template
   */
  static async canAccessProjectTemplate(
    teamId: string,
    templateId: string
  ): Promise<boolean> {
    try {
      const q = `SELECT 1 FROM project_templates WHERE id = $1 AND team_id = $2 LIMIT 1;`;
      const result = await db.query(q, [templateId, teamId]);
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      log_error(error);
      return false;
    }
  }
}
