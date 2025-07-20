import db from "../config/db";
import { log_error } from "../shared/utils";

export interface PermissionCheckResult {
  hasPermission: boolean;
  reason?: string;
  projectRole?: string;
}

export class RecurringTasksPermissions {
  /**
   * Check if a user has permission to create tasks in a project
   */
  static async canCreateTasksInProject(
    userId: string,
    projectId: string
  ): Promise<PermissionCheckResult> {
    try {
      // Check if user is a member of the project
      const memberQuery = `
        SELECT pm.role_id, pr.name as role_name, pr.permissions
        FROM project_members pm
        JOIN project_member_roles pr ON pm.role_id = pr.id
        WHERE pm.user_id = $1 AND pm.project_id = $2
        LIMIT 1;
      `;
      
      const result = await db.query(memberQuery, [userId, projectId]);
      
      if (result.rows.length === 0) {
        return {
          hasPermission: false,
          reason: "User is not a member of the project"
        };
      }
      
      const member = result.rows[0];
      
      // Check if role has task creation permission
      if (member.permissions && member.permissions.create_tasks === false) {
        return {
          hasPermission: false,
          reason: "User role does not have permission to create tasks",
          projectRole: member.role_name
        };
      }
      
      return {
        hasPermission: true,
        projectRole: member.role_name
      };
    } catch (error) {
      log_error("Error checking project permissions:", error);
      return {
        hasPermission: false,
        reason: "Error checking permissions"
      };
    }
  }

  /**
   * Check if a template has valid permissions
   */
  static async validateTemplatePermissions(templateId: string): Promise<PermissionCheckResult> {
    try {
      const query = `
        SELECT 
          t.reporter_id,
          t.project_id,
          p.is_active as project_active,
          p.archived as project_archived,
          u.is_active as user_active
        FROM task_recurring_templates trt
        JOIN tasks t ON trt.task_id = t.id
        JOIN projects p ON t.project_id = p.id
        JOIN users u ON t.reporter_id = u.id
        WHERE trt.id = $1
        LIMIT 1;
      `;
      
      const result = await db.query(query, [templateId]);
      
      if (result.rows.length === 0) {
        return {
          hasPermission: false,
          reason: "Template not found"
        };
      }
      
      const template = result.rows[0];
      
      // Check if project is active
      if (!template.project_active || template.project_archived) {
        return {
          hasPermission: false,
          reason: "Project is not active or archived"
        };
      }
      
      // Check if reporter is still active
      if (!template.user_active) {
        return {
          hasPermission: false,
          reason: "Original task reporter is no longer active"
        };
      }
      
      // Check if reporter still has permissions in the project
      const permissionCheck = await this.canCreateTasksInProject(
        template.reporter_id,
        template.project_id
      );
      
      return permissionCheck;
    } catch (error) {
      log_error("Error validating template permissions:", error);
      return {
        hasPermission: false,
        reason: "Error validating template permissions"
      };
    }
  }

  /**
   * Get all templates with permission issues
   */
  static async getTemplatesWithPermissionIssues(): Promise<any[]> {
    try {
      const query = `
        SELECT 
          trt.id as template_id,
          trt.name as template_name,
          t.reporter_id,
          u.name as reporter_name,
          t.project_id,
          p.name as project_name,
          CASE 
            WHEN NOT p.is_active THEN 'Project inactive'
            WHEN p.archived THEN 'Project archived'
            WHEN NOT u.is_active THEN 'User inactive'
            WHEN NOT EXISTS (
              SELECT 1 FROM project_members 
              WHERE user_id = t.reporter_id AND project_id = t.project_id
            ) THEN 'User not in project'
            ELSE NULL
          END as issue
        FROM task_recurring_templates trt
        JOIN tasks t ON trt.task_id = t.id
        JOIN projects p ON t.project_id = p.id
        JOIN users u ON t.reporter_id = u.id
        WHERE 
          NOT p.is_active 
          OR p.archived 
          OR NOT u.is_active
          OR NOT EXISTS (
            SELECT 1 FROM project_members 
            WHERE user_id = t.reporter_id AND project_id = t.project_id
          );
      `;
      
      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      log_error("Error getting templates with permission issues:", error);
      return [];
    }
  }

  /**
   * Validate all assignees have permissions
   */
  static async validateAssigneePermissions(
    assignees: Array<{ team_member_id: string }>,
    projectId: string
  ): Promise<string[]> {
    const invalidAssignees: string[] = [];
    
    for (const assignee of assignees) {
      const check = await this.canCreateTasksInProject(assignee.team_member_id, projectId);
      if (!check.hasPermission) {
        invalidAssignees.push(assignee.team_member_id);
      }
    }
    
    return invalidAssignees;
  }
}