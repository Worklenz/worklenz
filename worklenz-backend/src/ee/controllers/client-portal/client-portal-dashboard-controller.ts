import ClientPortalControllerBase from "./client-portal-base";
import { AuthenticatedClientRequest } from "../../../middlewares/client-auth-middleware";
import { IWorkLenzResponse } from "../../../interfaces/worklenz-response";
import { ServerResponse } from "../../../models/server-response";
import db from "../../../config/db";

export default class ClientPortalDashboardController extends ClientPortalControllerBase {

  static async getDashboard(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { clientId } = req;
      const { organizationId } = req;

      // Get request statistics
      const requestStatsQuery = `
        SELECT
          COUNT(*) as total_requests,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_requests,
          COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_requests,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_requests,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_requests,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_requests
        FROM client_portal_requests
        WHERE client_id = $1 AND organization_team_id = $2
      `;

      const requestStatsResult = await db.query(requestStatsQuery, [
        clientId,
        organizationId,
      ]);
      const requestStats = requestStatsResult.rows[0];

      // Get project statistics - verify both client_id AND team_id
      const projectStatsQuery = `
        SELECT
          COUNT(*) as total_projects,
          COUNT(CASE WHEN sps.name = 'Active' THEN 1 END) as active_projects,
          COUNT(CASE WHEN sps.name = 'Completed' THEN 1 END) as completed_projects
        FROM projects p
        LEFT JOIN sys_project_statuses sps ON p.status_id = sps.id
        WHERE p.client_id = $1 AND p.team_id = $2
      `;

      const projectStatsResult = await db.query(projectStatsQuery, [clientId, organizationId]);
      const projectStats = projectStatsResult.rows[0];

      // Get invoice statistics
      const invoiceStatsQuery = `
        SELECT
          COUNT(*) as total_invoices,
          COUNT(CASE WHEN status != 'paid' THEN 1 END) as unpaid_invoices,
          COALESCE(SUM(CASE WHEN status != 'paid' THEN amount END), 0) as unpaid_amount
        FROM client_portal_invoices
        WHERE client_id = $1 AND organization_team_id = $2
      `;

      const invoiceStatsResult = await db.query(invoiceStatsQuery, [
        clientId,
        organizationId,
      ]);
      const invoiceStats = invoiceStatsResult.rows[0];

      // Get team members count
      // First verify the client and team relationship
      const clientTeamQuery = `
        SELECT c.id as client_id, c.team_id, t.name as team_name
        FROM clients c
        JOIN teams t ON c.team_id = t.id
        WHERE c.id = $1
      `;
      const clientTeamResult = await db.query(clientTeamQuery, [clientId]);

      // Handle case where client is not found
      if (clientTeamResult.rows.length === 0) {
        return res
          .status(404)
          .json(
            new ServerResponse(false, null, "Client not found")
          );
      }

      const clientTeam = clientTeamResult.rows[0];
      const teamId = clientTeam.team_id;

      // Authorization check: verify organizationId matches client's team_id
      if (organizationId !== teamId) {
        return res
          .status(403)
          .json(
            new ServerResponse(
              false,
              null,
              "Access denied: Organization mismatch"
            )
          );
      }

      const teamMembersQuery = `
        SELECT COUNT(*) as team_members_count
        FROM team_members
        WHERE team_id = $1 AND active = true
      `;

      const teamMembersResult = await db.query(teamMembersQuery, [teamId]);
      const teamMembersStats = teamMembersResult.rows[0];

      const dashboardData = {
        totalProjects: parseInt(projectStats.total_projects || "0"),
        activeProjects: parseInt(projectStats.active_projects || "0"),
        completedProjects: parseInt(projectStats.completed_projects || "0"),
        totalRequests: parseInt(requestStats.total_requests || "0"),
        pendingRequests: parseInt(requestStats.pending_requests || "0"),
        acceptedRequests: parseInt(requestStats.accepted_requests || "0"),
        inProgressRequests: parseInt(requestStats.in_progress_requests || "0"),
        completedRequests: parseInt(requestStats.completed_requests || "0"),
        rejectedRequests: parseInt(requestStats.rejected_requests || "0"),
        totalInvoices: parseInt(invoiceStats.total_invoices || "0"),
        unpaidInvoices: parseInt(invoiceStats.unpaid_invoices || "0"),
        unpaidAmount: parseFloat(invoiceStats.unpaid_amount || "0"),
        teamMembers: parseInt(teamMembersStats.team_members_count || "0"),
      };

      return res.json(
        new ServerResponse(
          true,
          dashboardData,
          "Dashboard data retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to retrieve dashboard data")
        );
    }
  }

}
