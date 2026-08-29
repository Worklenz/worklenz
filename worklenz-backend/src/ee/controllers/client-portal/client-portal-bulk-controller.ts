import ClientPortalControllerBase from "./client-portal-base";
import { AuthenticatedClientRequest } from "../../../middlewares/client-auth-middleware";
import { IWorkLenzResponse } from "../../../interfaces/worklenz-response";
import { ServerResponse } from "../../../models/server-response";
import db from "../../../config/db";

export default class ClientPortalBulkController extends ClientPortalControllerBase {

  static async bulkUpdateClients(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { client_ids, status } = req.body;
      const teamId = (req.user as any)?.team_id;

      if (
        !client_ids ||
        !Array.isArray(client_ids) ||
        client_ids.length === 0
      ) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Invalid client IDs provided"));
      }

      if (!status || !["active", "inactive", "pending"].includes(status)) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Invalid status provided"));
      }

      // Verify all clients belong to the team
      const clientCheck = await db.query(
        "SELECT id FROM clients WHERE id = ANY($1) AND team_id = $2",
        [client_ids, teamId]
      );

      if (clientCheck.rows.length !== client_ids.length) {
        return res
          .status(400)
          .json(
            new ServerResponse(
              false,
              null,
              "Some clients not found or not accessible"
            )
          );
      }

      // Update all clients status
      const updateResult = await db.query(
        "UPDATE clients SET status = $1, updated_at = NOW() WHERE id = ANY($2) AND team_id = $3",
        [status, client_ids, teamId]
      );

      // Update client_users status accordingly
      await db.query(
        "UPDATE client_users SET status = $1 WHERE client_id = ANY($2)",
        [status, client_ids]
      );

      // Update client_portal_access based on status
      const isActive = status === 'active';
      await db.query(
        "UPDATE client_portal_access SET is_active = $1, updated_at = NOW() WHERE client_id = ANY($2)",
        [isActive, client_ids]
      );

      return res.json(
        new ServerResponse(
          true,
          { updated_count: updateResult.rowCount },
          "Clients updated successfully"
        )
      );
    } catch (error) {
      console.error("Error bulk updating clients:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to update clients"));
    }
  }

  static async bulkDeleteClients(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { client_ids } = req.body;
      const teamId = (req.user as any)?.team_id;

      if (
        !client_ids ||
        !Array.isArray(client_ids) ||
        client_ids.length === 0
      ) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Invalid client IDs provided"));
      }

      // Verify all clients belong to the team
      const clientCheck = await db.query(
        "SELECT id FROM clients WHERE id = ANY($1) AND team_id = $2",
        [client_ids, teamId]
      );

      if (clientCheck.rows.length !== client_ids.length) {
        return res
          .status(400)
          .json(
            new ServerResponse(
              false,
              null,
              "Some clients not found or not accessible"
            )
          );
      }

      // Deactivate all clients instead of deleting (soft delete)
      const deactivateResult = await db.query(
        "UPDATE clients SET status = 'inactive', updated_at = NOW() WHERE id = ANY($1) AND team_id = $2",
        [client_ids, teamId]
      );

      // Also deactivate all client users for these clients
      await db.query(
        "UPDATE client_users SET status = 'inactive' WHERE client_id = ANY($1)",
        [client_ids]
      );

      // Deactivate client portal access for all clients
      await db.query(
        "UPDATE client_portal_access SET is_active = FALSE, updated_at = NOW() WHERE client_id = ANY($1)",
        [client_ids]
      );

      return res.json(new ServerResponse(true, { deactivated_count: deactivateResult.rowCount }, "Clients deactivated successfully"));
    } catch (error) {
      console.error("Error bulk deactivating clients:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to deactivate clients"));
    }
  }

}
