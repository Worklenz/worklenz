import ClientPortalControllerBase from "./client-portal-base";
import { AuthenticatedClientRequest } from "../../../middlewares/client-auth-middleware";
import { IWorkLenzResponse } from "../../../interfaces/worklenz-response";
import { IWorkLenzRequest } from "../../../interfaces/worklenz-request";
import { ServerResponse } from "../../../models/server-response";
import db from "../../../config/db";
import { uploadBase64, getClientPortalLogoKey, deleteObject } from "../../../shared/storage";
import { log_error } from "../../../shared/utils";
import { getClientPortalBaseUrl } from "../../../cron_jobs/helpers";

export default class ClientPortalSettingsController extends ClientPortalControllerBase {

  static async getSettings(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const teamId = req.user?.team_id;
      if (!teamId) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Team ID not found"));
      }

      // For client portal settings, we use the team_id as organization_team_id
      const organizationTeamId = teamId;

      const q = `
        SELECT id, team_id, organization_team_id, logo_url, primary_color, 
               welcome_message, contact_email, contact_phone, terms_of_service, 
               privacy_policy, company_name, address_line_1, address_line_2, 
               invoice_footer_message, created_at, updated_at
        FROM client_portal_settings 
        WHERE organization_team_id = $1
      `;

      const result = await db.query(q, [organizationTeamId]);
      const settings = result.rows[0] || {
        organization_team_id: organizationTeamId,
        logo_url: null,
        primary_color: "#3b7ad4",
        welcome_message: null,
        contact_email: null,
        contact_phone: null,
        terms_of_service: null,
        privacy_policy: null,
        company_name: null,
        address_line_1: null,
        address_line_2: null,
        invoice_footer_message: null,
      };

      // Get organization logo if client portal logo is not set
      // This helps frontend show sync status
      let organizationLogoUrl = null;
      if (!settings.logo_url) {
        const orgQuery = `
          SELECT o.logo_url
          FROM organizations o
          INNER JOIN teams t ON (t.user_id = o.user_id OR t.organization_id = o.id)
          WHERE t.id = $1
          LIMIT 1
        `;
        const orgResult = await db.query(orgQuery, [organizationTeamId]);
        if (orgResult.rows.length > 0) {
          organizationLogoUrl = orgResult.rows[0].logo_url;
        }
      }

      // Add organization logo to response for frontend sync status
      settings.organization_logo_url = organizationLogoUrl;
      settings.is_logo_synced = !settings.logo_url && !!organizationLogoUrl;

      return res.json(new ServerResponse(true, settings, null));
    } catch (error) {
      log_error(error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to retrieve settings"));
    }
  }

  static async updateSettings(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const teamId = req.user?.team_id;

      if (!teamId) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Team ID not found"));
      }

      // For client portal settings, we use the team_id as both team_id and organization_team_id
      const organizationTeamId = teamId;

      const {
        logo_url,
        primary_color,
        welcome_message,
        contact_email,
        contact_phone,
        terms_of_service,
        privacy_policy,
        company_name,
        address_line_1,
        address_line_2,
        invoice_footer_message,
      } = req.body;

      // Check if settings exist
      const checkQ = `SELECT id FROM client_portal_settings WHERE organization_team_id = $1`;
      const existingResult = await db.query(checkQ, [organizationTeamId]);

      let result;
      if (existingResult.rows.length > 0) {
        // Update existing settings
        const updateQ = `
          UPDATE client_portal_settings 
          SET logo_url = $1, primary_color = $2, welcome_message = $3, 
              contact_email = $4, contact_phone = $5, terms_of_service = $6, 
              privacy_policy = $7, company_name = $8, address_line_1 = $9, address_line_2 = $10,
              invoice_footer_message = $11, updated_at = CURRENT_TIMESTAMP
          WHERE organization_team_id = $12
          RETURNING *
        `;
        result = await db.query(updateQ, [
          logo_url,
          primary_color,
          welcome_message,
          contact_email,
          contact_phone,
          terms_of_service,
          privacy_policy,
          company_name,
          address_line_1,
          address_line_2,
          invoice_footer_message,
          organizationTeamId,
        ]);
      } else {
        // Create new settings
        const insertQ = `
          INSERT INTO client_portal_settings 
          (team_id, organization_team_id, logo_url, primary_color, welcome_message, 
           contact_email, contact_phone, terms_of_service, privacy_policy, company_name, 
           address_line_1, address_line_2, invoice_footer_message)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *
        `;
        result = await db.query(insertQ, [
          teamId,
          organizationTeamId,
          logo_url,
          primary_color,
          welcome_message,
          contact_email,
          contact_phone,
          terms_of_service,
          privacy_policy,
          company_name,
          address_line_1,
          address_line_2,
          invoice_footer_message,
        ]);
      }

      return res.json(
        new ServerResponse(
          true,
          result.rows[0],
          "Settings updated successfully"
        )
      );
    } catch (error) {
      log_error(error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to update settings"));
    }
  }

  static async uploadLogo(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const teamId = req.user?.team_id;
      if (!teamId) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Team ID not found"));
      }

      // For client portal settings, we use the team_id as both team_id and organization_team_id
      // since client portal settings are organization-wide
      const organizationTeamId = teamId;

      const { logoData } = req.body;
      if (!logoData) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Logo data is required"));
      }

      // Extract file type from base64 data
      const mimeMatch = logoData.match(/^data:(image\/[a-z]+);base64,/);
      if (!mimeMatch) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Invalid image format"));
      }

      const mimeType = mimeMatch[1];
      const fileExtension = mimeType.split("/")[1];

      // Generate storage key
      const storageKey = getClientPortalLogoKey(
        organizationTeamId,
        fileExtension
      );

      // Upload to storage
      const logoUrl = await uploadBase64(logoData, storageKey);
      if (!logoUrl) {
        return res
          .status(500)
          .json(new ServerResponse(false, null, "Failed to upload logo"));
      }

      // Update database with logo URL
      const checkQ = `SELECT id FROM client_portal_settings WHERE organization_team_id = $1`;
      const existingResult = await db.query(checkQ, [organizationTeamId]);

      if (existingResult.rows.length > 0) {
        // Update existing settings
        const updateQ = `
          UPDATE client_portal_settings 
          SET logo_url = $1, updated_at = CURRENT_TIMESTAMP
          WHERE organization_team_id = $2
          RETURNING *
        `;
        await db.query(updateQ, [logoUrl, organizationTeamId]);
      } else {
        // Create new settings
        const insertQ = `
          INSERT INTO client_portal_settings 
          (team_id, organization_team_id, logo_url)
          VALUES ($1, $2, $3)
          RETURNING *
        `;
        await db.query(insertQ, [teamId, organizationTeamId, logoUrl]);
      }

      return res.json(
        new ServerResponse(
          true,
          { logo_url: logoUrl },
          "Logo uploaded successfully"
        )
      );
    } catch (error) {
      log_error(error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to upload logo"));
    }
  }

  // Get organization settings for client users
  static async getOrganizationSettings(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { organizationId } = req;

      if (!organizationId) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Organization ID not found"));
      }

      const q = `
        SELECT id, team_id, organization_team_id, logo_url, primary_color, 
               welcome_message, contact_email, contact_phone, terms_of_service, 
               privacy_policy, company_name, address_line_1, address_line_2, 
               invoice_footer_message, created_at, updated_at
        FROM client_portal_settings 
        WHERE organization_team_id = $1
      `;

      const result = await db.query(q, [organizationId]);
      const settings = result.rows[0] || {
        organization_team_id: organizationId,
        logo_url: null,
        primary_color: "#3b7ad4",
        welcome_message: null,
        contact_email: null,
        contact_phone: null,
        terms_of_service: null,
        privacy_policy: null,
        company_name: null,
        address_line_1: null,
        address_line_2: null,
        invoice_footer_message: null,
      };

      return res.json(new ServerResponse(true, settings, null));
    } catch (error) {
      log_error(error);
      return res
        .status(500)
        .json(
          new ServerResponse(
            false,
            null,
            "Failed to retrieve organization settings"
          )
        );
    }
  }

  static async getClientPortalBaseUrl(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const baseUrl = getClientPortalBaseUrl();
      return res.json(
        new ServerResponse(true, { baseUrl }, null)
      );
    } catch (error) {
      log_error(error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to retrieve base URL"));
    }
  }

}
