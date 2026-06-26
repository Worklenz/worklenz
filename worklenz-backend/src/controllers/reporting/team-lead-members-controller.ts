import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import db from "../../config/db";
import ReportingControllerBase from "./reporting-controller-base";

export default class TeamLeadMembersController extends ReportingControllerBase {

  /**
   * Get all Team Leads with their managed members for reporting purposes
   * Used by Admins/Owners to filter members by Team Lead in reporting
   */
  public static async getTeamLeadsWithManagedMembers(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    try {
      const teamId = req.user?.team_id;
      const userId = req.user?.id;

      if (!teamId || !userId) {
        return res.status(400).send(new ServerResponse(false, null, "Team ID and User ID are required"));
      }

      // Check if user is admin/owner
      const isOwner = req.user?.owner;
      const isAdmin = req.user?.is_admin;
      
      if (!isOwner && !isAdmin) {
        return res.status(403).send(new ServerResponse(false, null, "Access denied: Only Admins and Owners can access this endpoint"));
      }

      const query = `
        SELECT 
          tl.id as team_lead_id,
          tl_user.name as team_lead_name,
          tl_user.email as team_lead_email,
          tl_user.avatar_url as team_lead_avatar_url,
          COALESCE(
            JSON_AGG(
              CASE 
                WHEN tlmm.managed_member_id IS NOT NULL 
                THEN JSON_BUILD_OBJECT(
                  'member_id', tlmm.managed_member_id,
                  'member_name', tlmm.managed_member_name,
                  'member_email', tlmm.managed_member_email,
                  'member_avatar_url', managed_user.avatar_url,
                  'member_role_name', tlmm.managed_member_role_name,
                  'hierarchy_level', tlmm.level
                )
                ELSE NULL 
              END
            ) FILTER (WHERE tlmm.managed_member_id IS NOT NULL),
            '[]'::json
          ) as managed_members
        FROM team_members tl
        JOIN users tl_user ON tl.user_id = tl_user.id
        JOIN roles tl_role ON tl.role_id = tl_role.id
        LEFT JOIN team_lead_managed_members tlmm ON tl.id = tlmm.manager_id
        LEFT JOIN users managed_user ON tlmm.managed_member_user_id = managed_user.id
        WHERE tl.team_id = $1::UUID 
          AND tl.active = TRUE
          AND tl_role.name = 'Team Lead'
        GROUP BY tl.id, tl_user.name, tl_user.email, tl_user.avatar_url
        ORDER BY tl_user.name
      `;

      const result = await db.query(query, [teamId]);

      return res.send(new ServerResponse(true, result.rows));

    } catch (error) {
      console.error('Error fetching team leads with managed members:', error);
      return res.status(500).send(new ServerResponse(false, null, error instanceof Error ? error.message : "Unknown error"));
    }
  }

  /**
   * Get managed members for a specific Team Lead
   * Used when filtering by a specific Team Lead
   */
  public static async getManagedMembersByTeamLead(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    try {
      const teamId = req.user?.team_id;
      const userId = req.user?.id;
      const teamLeadId = req.params.teamLeadId;

      if (!teamId || !userId || !teamLeadId) {
        return res.status(400).send(new ServerResponse(false, null, "Team ID, User ID, and Team Lead ID are required"));
      }

      // Check if user is admin/owner
      const isOwner = req.user?.owner;
      const isAdmin = req.user?.is_admin;
      
      if (!isOwner && !isAdmin) {
        return res.status(403).send(new ServerResponse(false, null, "Access denied: Only Admins and Owners can access this endpoint"));
      }

      const query = `
        SELECT 
          tlmm.managed_member_id as member_id,
          tlmm.managed_member_name as member_name,
          tlmm.managed_member_email as member_email,
          managed_user.avatar_url as member_avatar_url,
          tlmm.managed_member_role_name as member_role_name,
          tlmm.level as hierarchy_level
        FROM team_lead_managed_members tlmm
        JOIN users managed_user ON tlmm.managed_member_user_id = managed_user.id
        WHERE tlmm.manager_id = $1::UUID 
          AND tlmm.team_id = $2::UUID
        ORDER BY tlmm.level, tlmm.managed_member_name
      `;

      const result = await db.query(query, [teamLeadId, teamId]);

      return res.send(new ServerResponse(true, result.rows));

    } catch (error) {
      console.error('Error fetching managed members by team lead:', error);
      return res.status(500).send(new ServerResponse(false, null, error instanceof Error ? error.message : "Unknown error"));
    }
  }

  /**
   * Get Team Lead hierarchy information for reporting
   * Returns Team Leads with their managed member counts
   */
  public static async getTeamLeadHierarchy(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    try {
      const teamId = req.user?.team_id;
      const userId = req.user?.id;

      if (!teamId || !userId) {
        return res.status(400).send(new ServerResponse(false, null, "Team ID and User ID are required"));
      }

      // Check if user is admin/owner
      const isOwner = req.user?.owner;
      const isAdmin = req.user?.is_admin;
      
      if (!isOwner && !isAdmin) {
        return res.status(403).send(new ServerResponse(false, null, "Access denied: Only Admins and Owners can access this endpoint"));
      }

      const query = `
        SELECT 
          tl.id as team_lead_id,
          tl_user.name as team_lead_name,
          tl_user.email as team_lead_email,
          tl_user.avatar_url as team_lead_avatar_url,
          COUNT(tlmm.managed_member_id) as managed_members_count,
          COALESCE(ARRAY_AGG(DISTINCT tlmm.level) FILTER (WHERE tlmm.level IS NOT NULL), ARRAY[]::integer[]) as hierarchy_levels
        FROM team_members tl
        JOIN users tl_user ON tl.user_id = tl_user.id
        JOIN roles tl_role ON tl.role_id = tl_role.id
        LEFT JOIN team_lead_managed_members tlmm ON tl.id = tlmm.manager_id
        WHERE tl.team_id = $1::UUID 
          AND tl.active = TRUE
          AND tl_role.name = 'Team Lead'
        GROUP BY tl.id, tl_user.name, tl_user.email, tl_user.avatar_url
        ORDER BY managed_members_count DESC, tl_user.name
      `;

      const result = await db.query(query, [teamId]);

      return res.send(new ServerResponse(true, result.rows));

    } catch (error) {
      console.error('Error fetching team lead hierarchy:', error);
      return res.status(500).send(new ServerResponse(false, null, error instanceof Error ? error.message : "Unknown error"));
    }
  }
}
