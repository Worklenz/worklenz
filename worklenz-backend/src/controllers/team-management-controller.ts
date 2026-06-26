import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import db from "../config/db";
import {
  canAssignManagerRelationship,
  canManageTargetRole,
  getTeamMemberRoleName,
} from "../shared/team-permissions";

export default class TeamManagementController {
  public static async assignManager(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    try {
      const { teamMemberId, managerId } = req.body;
      const teamId = req.user?.team_id;

      if (!teamMemberId || !managerId) {
        return res.status(400).send(new ServerResponse(false, null, "Invalid parameters"));
      }

      if (!teamId) {
        return res.status(400).send(new ServerResponse(false, null, "Team context is required"));
      }

      // Validate that the member being assigned doesn't have a higher role
      const roleCheck = `
        SELECT tm.id, u.name, r.name as role_name, tm.reports_to_member_id
        FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        JOIN roles r ON tm.role_id = r.id
        WHERE tm.id = $1::UUID AND tm.team_id = $2::UUID AND tm.active = TRUE
      `;
      
      const memberResult = await db.query(roleCheck, [teamMemberId, teamId]);
      
      if (memberResult.rows.length === 0) {
        return res.status(200).send(new ServerResponse(false, null, "Team member not found or inactive"));
      }

      const [member] = memberResult.rows;
      if (!canManageTargetRole(req.user, member.role_name)) {
        return res.status(200).send(new ServerResponse(false, null, "You are not authorized to manage this team member."));
      }

      // Allow reassignment - no need to check if already assigned to another manager
      // The frontend allows direct reassignment via dropdown change

      // Verify the target manager is actually a Team Lead
      const managerRoleCheck = `
        SELECT tm.id, u.name, r.name as role_name
        FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        JOIN roles r ON tm.role_id = r.id
        WHERE tm.id = $1::UUID AND tm.team_id = $2::UUID AND tm.active = TRUE
      `;
      
      const managerResult = await db.query(managerRoleCheck, [managerId, teamId]);
      
      if (managerResult.rows.length === 0) {
        return res.status(400).send(new ServerResponse(false, null, "Target manager not found or inactive"));
      }

      const [manager] = managerResult.rows;
      if (!canAssignManagerRelationship(req.user, member.role_name, manager.role_name)) {
        return res.status(400).send(new ServerResponse(false, null, `Cannot assign member to ${manager.role_name}. Only Team Leads can manage team members.`));
      }

      const q = `
        UPDATE team_members
        SET reports_to_member_id = $1::UUID, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2::UUID
      `;

      await db.query(q, [managerId, teamMemberId]);

      return res.send(new ServerResponse(true, null, "Manager assigned successfully"));
    } catch (error) {
      return res.status(500).send(new ServerResponse(false, null, error instanceof Error ? error.message : "Unknown error"));
    }
  }

  public static async bulkAssignMembers(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    try {
      const { teamLeadId, memberIds } = req.body;
      const userId = req.user?.id;
      const teamId = req.user?.team_id;

      // Validation
      if (!teamLeadId || !memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
        return res.status(400).send(new ServerResponse(false, null, "Invalid parameters. Team Lead ID and member IDs are required."));
      }

      if (!userId || !teamId) {
        return res.status(400).send(new ServerResponse(false, null, "User context is required"));
      }

      // Verify team lead exists and is actually a Team Lead
      const teamLeadCheck = `
        SELECT tm.id, r.name as role_name, tm.user_id
        FROM team_members tm
        JOIN roles r ON tm.role_id = r.id
        WHERE tm.id = $1::UUID AND tm.team_id = $2::UUID AND tm.active = TRUE
      `;
      
      const teamLeadResult = await db.query(teamLeadCheck, [teamLeadId, teamId]);
      
      if (teamLeadResult.rows.length === 0) {
        return res.status(400).send(new ServerResponse(false, null, "Team Lead not found or inactive"));
      }

      const [teamLeadData] = teamLeadResult.rows;
      if (teamLeadData.role_name !== "Team Lead") {
        return res.status(400).send(new ServerResponse(false, null, "Selected member is not a Team Lead"));
      }

      // Verify all member IDs exist and belong to the same team
      const memberCheck = `
        SELECT tm.id, tm.user_id, u.name, r.name as role_name, tm.reports_to_member_id
        FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        JOIN roles r ON tm.role_id = r.id
        WHERE tm.id = ANY($1::UUID[]) AND tm.team_id = $2::UUID AND tm.active = TRUE
      `;
      
      const memberResult = await db.query(memberCheck, [memberIds, teamId]);
      
      if (memberResult.rows.length !== memberIds.length) {
        return res.status(400).send(new ServerResponse(false, null, "Some members not found or inactive"));
      }

      // Check if any of the members have roles that shouldn't report to Team Leads
      const invalidRoles = memberResult.rows.filter(member => 
        !canAssignManagerRelationship(req.user, member.role_name, teamLeadData.role_name)
      );
      
      if (invalidRoles.length > 0) {
        const invalidNames = invalidRoles.map(member => `${member.name} (${member.role_name})`).join(", ");
        return res.status(400).send(new ServerResponse(false, null, `Cannot assign higher-level roles to Team Lead: ${invalidNames}`));
      }

      // Check if any members are already assigned to other team leads
      const alreadyAssignedMembers = memberResult.rows.filter(member => 
        member.reports_to_member_id && member.reports_to_member_id !== teamLeadId
      );
      
      if (alreadyAssignedMembers.length > 0) {
        const assignedNames = alreadyAssignedMembers.map(member => member.name).join(", ");
        return res.status(400).send(new ServerResponse(false, null, `The following members are already assigned to other Team Leads: ${assignedNames}. Please remove their current assignments first.`));
      }

      // Check for circular references - prevent assigning team lead to themselves
      if (memberIds.includes(teamLeadId)) {
        return res.status(400).send(new ServerResponse(false, null, "Cannot assign Team Lead to report to themselves"));
      }

      // Check for potential circular references in the hierarchy
      const circularCheck = `
        WITH RECURSIVE hierarchy AS (
          -- Start from the team lead
          SELECT id, reports_to_member_id, 1 as level, ARRAY[id] as path
          FROM team_members 
          WHERE id = $1::UUID
          
          UNION
          
          -- Follow the reporting chain upward
          SELECT tm.id, tm.reports_to_member_id, h.level + 1, h.path || tm.id
          FROM team_members tm
          JOIN hierarchy h ON tm.id = h.reports_to_member_id
          WHERE h.level < 10 AND NOT (tm.id = ANY(h.path))
        )
        SELECT COUNT(*) as circular_count
        FROM hierarchy h
        WHERE h.id = ANY($2::UUID[])
      `;

      const circularResult = await db.query(circularCheck, [teamLeadId, memberIds]);
      
      if (circularResult.rows[0].circular_count > 0) {
        return res.status(400).send(new ServerResponse(false, null, "Cannot create circular reporting relationship"));
      }

      // Perform bulk assignment
      const bulkAssignQuery = `
        UPDATE team_members
        SET reports_to_member_id = $1::UUID, updated_at = CURRENT_TIMESTAMP
        WHERE id = ANY($2::UUID[]) AND team_id = $3::UUID
        RETURNING id, (SELECT name FROM users WHERE id = user_id) as member_name
      `;

      const assignmentResult = await db.query(bulkAssignQuery, [teamLeadId, memberIds, teamId]);
      
      const assignedMembers = assignmentResult.rows;
      const teamLeadName = (await db.query(
        "SELECT u.name FROM team_members tm JOIN users u ON tm.user_id = u.id WHERE tm.id = $1",
        [teamLeadId]
      )).rows[0]?.name;

      // TODO: Add audit logging when team_member_assignment_log table is created

      return res.send(new ServerResponse(
        true, 
        {
          assignedCount: assignedMembers.length,
          teamLeadName,
          assignedMembers
        },
        `Successfully assigned ${assignedMembers.length} members to ${teamLeadName}`
      ));

    } catch (error) {
      return res.status(500).send(new ServerResponse(false, null, error instanceof Error ? error.message : "Unknown error"));
    }
  }

  public static async removeManagerAssignment(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    try {
      const { teamMemberId } = req.body;
      const userId = req.user?.id;
      const teamId = req.user?.team_id;

      if (!teamMemberId) {
        return res.status(400).send(new ServerResponse(false, null, "Team member ID is required"));
      }

      if (!userId || !teamId) {
        return res.status(400).send(new ServerResponse(false, null, "User context is required"));
      }

      // Verify member exists and belongs to the team
      const memberCheck = `
        SELECT tm.id, u.name, tm.reports_to_member_id
        FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        WHERE tm.id = $1::UUID AND tm.team_id = $2::UUID AND tm.active = TRUE
      `;
      
      const memberResult = await db.query(memberCheck, [teamMemberId, teamId]);
      
      if (memberResult.rows.length === 0) {
        return res.status(400).send(new ServerResponse(false, null, "Team member not found or inactive"));
      }

      const [member] = memberResult.rows;

      const memberRoleName = await getTeamMemberRoleName(teamMemberId, teamId);

      if (!memberRoleName || !canManageTargetRole(req.user, memberRoleName)) {
        return res.status(400).send(new ServerResponse(false, null, "You are not authorized to manage this team member."));
      }
      
      if (!member.reports_to_member_id) {
        return res.status(400).send(new ServerResponse(false, null, "Member is not currently assigned to any Team Lead"));
      }

      // Remove the manager assignment
      const removeQuery = `
        UPDATE team_members
        SET reports_to_member_id = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1::UUID
        RETURNING id, (SELECT name FROM users WHERE id = user_id) as member_name
      `;

      const result = await db.query(removeQuery, [teamMemberId]);

      if (result.rows.length === 0) {
        return res.status(500).send(new ServerResponse(false, null, "Failed to remove manager assignment"));
      }

      return res.send(new ServerResponse(true, { member: result.rows[0] }, "Manager assignment removed successfully"));
    } catch (error) {
      return res.status(500).send(new ServerResponse(false, null, error instanceof Error ? error.message : "Unknown error"));
    }
  }

  public static async getTeamHierarchy(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    try {
      const teamId = req.user?.team_id;

      if (!teamId) {
        return res.status(400).send(new ServerResponse(false, null, "Team ID is required"));
      }

      const hierarchyQuery = `
        WITH RECURSIVE team_hierarchy AS (
          -- Root level (members with no manager)
          SELECT 
            tm.id,
            tm.user_id,
            u.name,
            u.email,
            r.name as role_name,
            tm.reports_to_member_id,
            0 as level,
            ARRAY[tm.id] as path,
            tm.id::TEXT as hierarchy_path
          FROM team_members tm
          JOIN users u ON tm.user_id = u.id
          JOIN roles r ON tm.role_id = r.id
          WHERE tm.team_id = $1::UUID 
          AND tm.active = TRUE
          AND tm.reports_to_member_id IS NULL
          
          UNION
          
          -- Child levels (members with managers)
          SELECT 
            tm.id,
            tm.user_id,
            u.name,
            u.email,
            r.name as role_name,
            tm.reports_to_member_id,
            th.level + 1,
            th.path || tm.id,
            th.hierarchy_path || ' > ' || tm.id::TEXT
          FROM team_members tm
          JOIN users u ON tm.user_id = u.id
          JOIN roles r ON tm.role_id = r.id
          JOIN team_hierarchy th ON tm.reports_to_member_id = th.id
          WHERE tm.team_id = $1::UUID 
          AND tm.active = TRUE
          AND NOT (tm.id = ANY(th.path))
          AND th.level < 10
        )
        SELECT * FROM team_hierarchy
        ORDER BY level, name
      `;

      const result = await db.query(hierarchyQuery, [teamId]);

      return res.send(new ServerResponse(true, result.rows));
    } catch (error) {
      return res.status(500).send(new ServerResponse(false, null, error instanceof Error ? error.message : "Unknown error"));
    }
  }
}
