import ClientPortalControllerBase from "./client-portal-base";
import { AuthenticatedClientRequest } from "../../middlewares/client-auth-middleware";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import db from "../../config/db";

export default class ClientPortalProfileController extends ClientPortalControllerBase {

  static async getClientProfile(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { clientId } = req;
      const { clientEmail } = req;

      // The login is one row shared by every team it belongs to; `client_users.client_id` only names
      // the first one. Match the login by email and take the company from the team in the token, so
      // the profile (which the app uses to validate a session) works after switching teams too.
      const query = `
        SELECT cu.*, c.name as client_name, c.company_name
        FROM client_users cu
        JOIN clients c ON c.id = $1
        WHERE LOWER(cu.email) = LOWER($2)
      `;

      const result = await db.query(query, [clientId, clientEmail]);

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client profile not found"));
      }

      const clientUser = result.rows[0];

      return res.json(
        new ServerResponse(
          true,
          {
            id: clientUser.id,
            email: clientUser.email,
            name: clientUser.name,
            role: clientUser.role,
            clientId,
            clientName: clientUser.client_name,
            companyName: clientUser.company_name,
            createdAt: clientUser.created_at,
            lastLogin: clientUser.last_login,
          },
          "Client profile retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching client profile:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to retrieve client profile")
        );
    }
  }

  static async updateClientProfile(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { clientEmail } = req;
      const { name } = req.body;

      if (!name) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Name is required"));
      }

      // Get current client user
      const currentUser = await db.query(
        "SELECT * FROM client_users WHERE LOWER(email) = LOWER($1)",
        [clientEmail]
      );

      if (currentUser.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client user not found"));
      }

      const user = currentUser.rows[0];
      const updateFields = ["name = $1", "updated_at = NOW()"];
      const updateValues = [name];
      let paramIndex = 2;

      // Update the user
      updateValues.push(user.id);
      const updateQuery = `
        UPDATE client_users
        SET ${updateFields.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING id, email, name, role, updated_at
      `;

      const result = await db.query(updateQuery, updateValues);
      const updatedUser = result.rows[0];

      return res.json(
        new ServerResponse(
          true,
          {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            role: updatedUser.role,
            updatedAt: updatedUser.updated_at,
          },
          "Profile updated successfully"
        )
      );
    } catch (error) {
      console.error("Error updating client profile:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to update profile"));
    }
  }

}
