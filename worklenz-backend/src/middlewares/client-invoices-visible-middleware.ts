import { NextFunction, Response } from "express";
import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import { AuthenticatedClientRequest } from "./client-auth-middleware";

/**
 * Invoices exist for a client only when the operator turned them on in Portal Settings. This is the
 * server-side half of the client app's hidden Invoices page: a typed URL or a direct API call gets the
 * same "not found" as an invoice that doesn't exist, and never says whether invoices are enabled.
 */
export const requireInvoicesVisible = async (req: AuthenticatedClientRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT visible_invoices FROM client_portal_settings WHERE organization_team_id = $1 LIMIT 1`,
      [req.organizationId]
    );
    if (result.rows[0]?.visible_invoices !== true) {
      return res.status(404).json(new ServerResponse(false, { code: "NOT_FOUND" }, "Not found"));
    }
    next();
  } catch (error) {
    console.error("[Client invoices] Could not read the invoice setting:", error);
    return res.status(500).json(new ServerResponse(false, null, "Could not load invoices"));
  }
};
