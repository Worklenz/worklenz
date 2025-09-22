import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import db from "../config/db";

export default class TeamManagementController {
  public static async assignManager(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    try {
      const { teamMemberId, managerId } = req.body;

      if (!teamMemberId || !managerId) {
        return res.status(400).send(new ServerResponse(false, null, "Invalid parameters"));
      }

      const q = `
        UPDATE team_members
        SET reports_to_member_id = $1::UUID
        WHERE id = $2::UUID
      `;

      await db.query(q, [managerId, teamMemberId]);

      return res.send(new ServerResponse(true, null, "Manager assigned successfully"));
    } catch (error) {
      return res.status(500).send(new ServerResponse(false, null, error instanceof Error ? error.message : "Unknown error"));
    }
  }
}
