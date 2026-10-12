import ClientPortalControllerBase from "./client-portal-base";
import { AuthenticatedClientRequest } from "../../middlewares/client-auth-middleware";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { ServerResponse } from "../../models/server-response";
import db from "../../config/db";
import { uploadBase64, getClientPortalLogoKey, deleteObject } from "../../shared/storage";
import { log_error } from "../../shared/utils";
import { getClientPortalBaseUrl } from "../../cron_jobs/helpers";

/** `portal_theme` / `invoice_template_style` are stored as free TEXT with a DB CHECK constraint — validate here too so a bad value fails fast with a clear message instead of a raw constraint-violation error. */
const PORTAL_THEMES = ["light", "dark"];
const INVOICE_TEMPLATE_STYLES = ["classic", "modern"];

/** Visibility/notification/POC fields are all booleans coming from JSON `req.body` — coerce rather than trust the client sent an actual boolean. */
const toBool = (value: unknown, fallback: boolean): boolean =>
  value === undefined ? fallback : Boolean(value);

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
               city, state, zip_code, country,
               invoice_footer_message, portal_title, portal_theme,
               visible_project_plan, visible_gantt_timeline, visible_files_documents,
               visible_invoices, visible_feedback_forms, visible_team_members,
               visible_project_updates, visible_chat,
               notify_new_message, notify_task_status_change, notify_file_uploaded,
               poc_can_add_users, poc_can_remove_users,
               invoice_template_style, invoice_show_logo,
               created_at, updated_at
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
        city: null,
        state: null,
        zip_code: null,
        country: null,
        invoice_footer_message: null,
        portal_title: null,
        portal_theme: "light",
        visible_project_plan: true,
        visible_gantt_timeline: true,
        visible_files_documents: true,
        visible_invoices: false,
        visible_feedback_forms: false,
        visible_team_members: true,
        visible_project_updates: true,
        visible_chat: true,
        notify_new_message: true,
        notify_task_status_change: true,
        notify_file_uploaded: false,
        poc_can_add_users: false,
        poc_can_remove_users: false,
        invoice_template_style: "classic",
        invoice_show_logo: true,
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
        city,
        state,
        zip_code,
        country,
        invoice_footer_message,
        portal_title,
      } = req.body;

      const portal_theme = PORTAL_THEMES.includes(req.body.portal_theme)
        ? req.body.portal_theme
        : "light";
      const invoice_template_style = INVOICE_TEMPLATE_STYLES.includes(req.body.invoice_template_style)
        ? req.body.invoice_template_style
        : "classic";

      const visible_project_plan = toBool(req.body.visible_project_plan, true);
      const visible_gantt_timeline = toBool(req.body.visible_gantt_timeline, true);
      const visible_files_documents = toBool(req.body.visible_files_documents, true);
      const visible_invoices = toBool(req.body.visible_invoices, false);
      const visible_feedback_forms = toBool(req.body.visible_feedback_forms, false);
      const visible_team_members = toBool(req.body.visible_team_members, true);
      const visible_project_updates = toBool(req.body.visible_project_updates, true);
      const visible_chat = toBool(req.body.visible_chat, true);
      const notify_new_message = toBool(req.body.notify_new_message, true);
      const notify_task_status_change = toBool(req.body.notify_task_status_change, true);
      const notify_file_uploaded = toBool(req.body.notify_file_uploaded, false);
      const poc_can_add_users = toBool(req.body.poc_can_add_users, false);
      const poc_can_remove_users = toBool(req.body.poc_can_remove_users, false);
      const invoice_show_logo = toBool(req.body.invoice_show_logo, true);

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
              city = $11, state = $12, zip_code = $13, country = $14,
              invoice_footer_message = $15, portal_title = $16, portal_theme = $17,
              visible_project_plan = $18, visible_gantt_timeline = $19, visible_files_documents = $20,
              visible_invoices = $21, visible_feedback_forms = $22, visible_team_members = $23,
              visible_project_updates = $24, visible_chat = $25,
              notify_new_message = $26, notify_task_status_change = $27, notify_file_uploaded = $28,
              poc_can_add_users = $29, poc_can_remove_users = $30,
              invoice_template_style = $31, invoice_show_logo = $32,
              updated_at = CURRENT_TIMESTAMP
          WHERE organization_team_id = $33
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
          city,
          state,
          zip_code,
          country,
          invoice_footer_message,
          portal_title,
          portal_theme,
          visible_project_plan,
          visible_gantt_timeline,
          visible_files_documents,
          visible_invoices,
          visible_feedback_forms,
          visible_team_members,
          visible_project_updates,
          visible_chat,
          notify_new_message,
          notify_task_status_change,
          notify_file_uploaded,
          poc_can_add_users,
          poc_can_remove_users,
          invoice_template_style,
          invoice_show_logo,
          organizationTeamId,
        ]);
      } else {
        // Create new settings
        const insertQ = `
          INSERT INTO client_portal_settings
          (team_id, organization_team_id, logo_url, primary_color, welcome_message,
           contact_email, contact_phone, terms_of_service, privacy_policy, company_name,
           address_line_1, address_line_2, city, state, zip_code, country,
           invoice_footer_message, portal_title, portal_theme,
           visible_project_plan, visible_gantt_timeline, visible_files_documents,
           visible_invoices, visible_feedback_forms, visible_team_members,
           visible_project_updates, visible_chat,
           notify_new_message, notify_task_status_change, notify_file_uploaded,
           poc_can_add_users, poc_can_remove_users,
           invoice_template_style, invoice_show_logo)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                  $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31,
                  $32, $33, $34)
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
          city,
          state,
          zip_code,
          country,
          invoice_footer_message,
          portal_title,
          portal_theme,
          visible_project_plan,
          visible_gantt_timeline,
          visible_files_documents,
          visible_invoices,
          visible_feedback_forms,
          visible_team_members,
          visible_project_updates,
          visible_chat,
          notify_new_message,
          notify_task_status_change,
          notify_file_uploaded,
          poc_can_add_users,
          poc_can_remove_users,
          invoice_template_style,
          invoice_show_logo,
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
               city, state, zip_code, country,
               invoice_footer_message, portal_title, portal_theme,
               visible_project_plan, visible_gantt_timeline, visible_files_documents,
               visible_invoices, visible_feedback_forms, visible_team_members,
               visible_project_updates, visible_chat,
               created_at, updated_at
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
        city: null,
        state: null,
        zip_code: null,
        country: null,
        invoice_footer_message: null,
        portal_title: null,
        portal_theme: "light",
        visible_project_plan: true,
        visible_gantt_timeline: true,
        visible_files_documents: true,
        visible_invoices: false,
        visible_feedback_forms: false,
        visible_team_members: true,
        visible_project_updates: true,
        visible_chat: true,
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
