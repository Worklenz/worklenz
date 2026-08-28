import ClientPortalControllerBase from "./client-portal-base";
import { AuthenticatedClientRequest } from "../../../middlewares/client-auth-middleware";
import { IWorkLenzRequest } from "../../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../../interfaces/worklenz-response";
import { ServerResponse } from "../../../models/server-response";
import db from "../../../config/db";
import SqlHelper from "../../../shared/sql-helpers";

export default class ClientPortalInvoicesController extends ClientPortalControllerBase {

  private static async getClientPortalInvoiceFinanceSelectClause() {
    const financeColumns = [
      "tax_rate",
      "tax_amount",
      "discount_type",
      "discount_value",
      "discount_amount",
      "subtotal",
    ];

    const result = await db.query(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'client_portal_invoices'
          AND column_name = ANY($1::text[])
      `,
      [financeColumns]
    );

    const availableColumns = new Set(
      result.rows.map((row: { column_name: string }) => row.column_name)
    );

    return financeColumns
      .map(column => {
        if (availableColumns.has(column)) {
          return `i.${column}`;
        }

        if (column === "discount_type") {
          return `NULL::text AS ${column}`;
        }

        return `0::numeric AS ${column}`;
      })
      .join(",\n          ");
  }

  static async getInvoices(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { clientId } = req;
      const { organizationId } = req;
      const { page = 1, limit = 10, status, search } = req.query;

      // Build query with pagination and filtering
      let query = `
        SELECT
          i.id,
          i.invoice_no,
          i.amount,
          i.currency,
          i.status,
          i.due_date,
          i.sent_at,
          i.paid_at,
          i.created_at,
          i.updated_at,
          r.req_no as request_number,
          s.name as service_name
        FROM client_portal_invoices i
        LEFT JOIN client_portal_requests r ON i.request_id = r.id
        LEFT JOIN client_portal_services s ON r.service_id = s.id
        WHERE i.client_id = $1 AND i.organization_team_id = $2
      `;

      const queryParams = [clientId, organizationId];
      let paramIndex = 3;

      // Add status filter if provided
      if (status) {
        query += ` AND i.status = $${paramIndex}`;
        queryParams.push(String(status));
        paramIndex++;
      }

      // Add search filter if provided
      if (search) {
        query += ` AND (i.invoice_no ILIKE $${paramIndex} OR s.name ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM client_portal_invoices i
        LEFT JOIN client_portal_requests r ON i.request_id = r.id
        LEFT JOIN client_portal_services s ON r.service_id = s.id
        WHERE i.client_id = $1 AND i.organization_team_id = $2
        ${status ? `AND i.status = $${status ? 3 : 3}` : ""}
        ${
          search
            ? `AND (i.invoice_no ILIKE $${status ? 4 : 3} OR s.name ILIKE $${
                status ? 4 : 3
              })`
            : ""
        }
      `;
      const countParams =
        status && search
          ? [clientId, organizationId, status, `%${search}%`]
          : status
          ? [clientId, organizationId, status]
          : search
          ? [clientId, organizationId, `%${search}%`]
          : [clientId, organizationId];
      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0]?.total || "0");

      // Add pagination
      const offset = (Number(page) - 1) * Number(limit);
      query += ` ORDER BY i.created_at DESC LIMIT $${paramIndex} OFFSET $${
        paramIndex + 1
      }`;
      queryParams.push(String(Number(limit)), String(offset));

      const result = await db.query(query, queryParams);
      const invoices = result.rows.map((row: any) => ({
        id: row.id,
        invoiceNumber: row.invoice_no,
        amount: parseFloat(row.amount || "0"),
        currency: row.currency,
        status: row.status,
        dueDate: row.due_date,
        sentAt: row.sent_at,
        paidAt: row.paid_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        requestNumber: row.request_number,
        serviceName: row.service_name,
        isOverdue:
          row.due_date &&
          new Date(row.due_date) < new Date() &&
          row.status !== "paid",
      }));

      return res.json(
        new ServerResponse(
          true,
          {
            invoices,
            total,
            page: Number(page),
            limit: Number(limit),
          },
          "Invoices retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching invoices:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to retrieve invoices"));
    }
  }

  static async getInvoicesByRequest(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { requestId } = req.params;
      const organizationId = req.user?.team_id;

      if (!organizationId) {
        return res
          .status(401)
          .json(new ServerResponse(false, null, "Unauthorized"));
      }

      if (!requestId) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Request ID is required"));
      }

      // Get all invoices for this request
      const query = `
        SELECT
          i.id,
          i.invoice_no,
          i.amount,
          i.currency,
          i.status,
          i.due_date,
          i.sent_at,
          i.paid_at,
          i.created_at,
          i.updated_at,
          r.req_no as request_number,
          s.name as service_name,
          c.name as client_name
        FROM client_portal_invoices i
        LEFT JOIN client_portal_requests r ON i.request_id = r.id
        LEFT JOIN client_portal_services s ON r.service_id = s.id
        LEFT JOIN clients c ON i.client_id = c.id
        WHERE i.request_id = $1 AND i.organization_team_id = $2
        ORDER BY i.created_at DESC
      `;

      const result = await db.query(query, [requestId, organizationId]);

      const invoices = result.rows.map((invoice: any) => ({
        id: invoice.id,
        invoiceNo: invoice.invoice_no,
        amount: parseFloat(invoice.amount),
        currency: invoice.currency,
        status: invoice.status,
        dueDate: invoice.due_date,
        sentAt: invoice.sent_at,
        paidAt: invoice.paid_at,
        createdAt: invoice.created_at,
        updatedAt: invoice.updated_at,
        requestNumber: invoice.request_number,
        serviceName: invoice.service_name,
        clientName: invoice.client_name,
      }));

      return res.json(
        new ServerResponse(true, { invoices, count: invoices.length }, "Invoices retrieved successfully")
      );
    } catch (error) {
      console.error("Error fetching invoices by request:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to retrieve invoices"));
    }
  }

  static async getOrganizationInvoices(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const organizationId = req.user?.team_id;
      const { page = 1, limit = 10, status, search, clientId } = req.query;

      if (!organizationId) {
        return res
          .status(401)
          .json(new ServerResponse(false, null, "Unauthorized"));
      }

      // Build query with pagination and filtering
      let query = `
        SELECT
          i.id,
          i.invoice_no,
          i.amount,
          i.currency,
          i.status,
          i.due_date,
          i.sent_at,
          i.paid_at,
          i.created_at,
          i.updated_at,
          r.req_no as request_number,
          s.name as service_name,
          c.name as client_name
        FROM client_portal_invoices i
        LEFT JOIN client_portal_requests r ON i.request_id = r.id
        LEFT JOIN client_portal_services s ON r.service_id = s.id
        LEFT JOIN clients c ON i.client_id = c.id
        WHERE i.organization_team_id = $1
      `;

      const queryParams: (string | number)[] = [organizationId];
      let paramIndex = 2;

      // Add client filter if provided
      if (clientId) {
        query += ` AND i.client_id = $${paramIndex}`;
        queryParams.push(String(clientId));
        paramIndex++;
      }

      // Add status filter if provided
      if (status) {
        query += ` AND i.status = $${paramIndex}`;
        queryParams.push(String(status));
        paramIndex++;
      }

      // Add search filter if provided
      if (search) {
        query += ` AND (i.invoice_no ILIKE $${paramIndex} OR s.name ILIKE $${paramIndex} OR c.name ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      // Get total count
      let countQuery = `
        SELECT COUNT(*) as total
        FROM client_portal_invoices i
        LEFT JOIN client_portal_requests r ON i.request_id = r.id
        LEFT JOIN client_portal_services s ON r.service_id = s.id
        LEFT JOIN clients c ON i.client_id = c.id
        WHERE i.organization_team_id = $1
      `;
      const countParams: (string | number)[] = [organizationId];
      let countParamIndex = 2;

      if (clientId) {
        countQuery += ` AND i.client_id = $${countParamIndex}`;
        countParams.push(String(clientId));
        countParamIndex++;
      }
      if (status) {
        countQuery += ` AND i.status = $${countParamIndex}`;
        countParams.push(String(status));
        countParamIndex++;
      }
      if (search) {
        countQuery += ` AND (i.invoice_no ILIKE $${countParamIndex} OR s.name ILIKE $${countParamIndex} OR c.name ILIKE $${countParamIndex})`;
        countParams.push(`%${search}%`);
        countParamIndex++;
      }

      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0]?.total || "0");

      // Add pagination
      const offset = (Number(page) - 1) * Number(limit);
      query += ` ORDER BY i.created_at DESC LIMIT $${paramIndex} OFFSET $${
        paramIndex + 1
      }`;
      queryParams.push(Number(limit), offset);

      const result = await db.query(query, queryParams);
      const invoices = result.rows.map((row: any) => ({
        id: row.id,
        invoiceNumber: row.invoice_no,
        amount: parseFloat(row.amount || "0"),
        currency: row.currency,
        status: row.status,
        dueDate: row.due_date,
        sentAt: row.sent_at,
        paidAt: row.paid_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        requestNumber: row.request_number,
        serviceName: row.service_name,
        clientName: row.client_name,
        isOverdue:
          row.due_date &&
          new Date(row.due_date) < new Date() &&
          row.status !== "paid",
      }));

      return res.json(
        new ServerResponse(
          true,
          {
            invoices,
            total,
            page: Number(page),
            limit: Number(limit),
          },
          "Invoices retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching organization invoices:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to retrieve invoices"));
    }
  }

  static async createInvoice(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const { 
        requestId, 
        amount, 
        currency = "USD", 
        dueDate, 
        notes, 
        status = "draft",
        taxRate = 0,
        discountType = 'percentage',
        discountValue = 0,
        subtotal,
        taxAmount,
        discountAmount
      } = req.body;
      const organizationId = req.user?.team_id;
      const createdBy = req.user?.id;

      if (!requestId) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Request ID is required"));
      }

      if (!amount || amount <= 0) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Valid amount is required"));
      }

      // Verify request exists and get client info
      const requestQuery = `
        SELECT r.id, r.client_id, r.service_id, r.status, c.name as client_name, s.name as service_name
        FROM client_portal_requests r
        LEFT JOIN clients c ON r.client_id = c.id
        LEFT JOIN client_portal_services s ON r.service_id = s.id
        WHERE r.id = $1 AND r.organization_team_id = $2
      `;
      const requestResult = await db.query(requestQuery, [
        requestId,
        organizationId,
      ]);

      if (requestResult.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Request not found"));
      }

      const request = requestResult.rows[0];

      // Generate invoice number
      const invoiceNo = `INV-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 7)
        .toUpperCase()}`;

      // Create invoice
      // If status is 'sent', set sent_at timestamp
      const sentAt = status === 'sent' ? new Date() : null;
      const insertQuery = `
        INSERT INTO client_portal_invoices (
          invoice_no, request_id, client_id, organization_team_id,
          amount, currency, status, due_date, notes, created_by_user_id, sent_at, created_at, updated_at,
          tax_rate, tax_amount, discount_type, discount_value, discount_amount, subtotal
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW(), $12, $13, $14, $15, $16, $17)
        RETURNING id, invoice_no, amount, currency, status, due_date, sent_at, created_at, tax_rate, tax_amount, discount_type, discount_value, discount_amount, subtotal
      `;

      const result = await db.query(insertQuery, [
        invoiceNo,
        requestId,
        request.client_id,
        organizationId,
        amount,
        currency,
        status,
        dueDate || null,
        notes || null,
        createdBy,
        sentAt,
        taxRate || 0,
        taxAmount || 0,
        discountType || 'percentage',
        discountValue || 0,
        discountAmount || 0,
        subtotal || amount
      ]);

      const newInvoice = result.rows[0];

      // Create notification for the client about new invoice
      if (request.client_id && organizationId) {
        await this.createNotification(
          request.client_id,
          organizationId,
          "invoice_created",
          "New Invoice",
          `New invoice ${newInvoice.invoice_no} for ${currency} ${amount}`,
          newInvoice.id,
          newInvoice.invoice_no,
          {
            amount: parseFloat(newInvoice.amount),
            currency: newInvoice.currency,
            dueDate: newInvoice.due_date,
            serviceName: request.service_name
          }
        );
      }

      return res.json(new ServerResponse(true, {
        id: newInvoice.id,
        invoiceNumber: newInvoice.invoice_no,
        amount: parseFloat(newInvoice.amount),
        currency: newInvoice.currency,
        status: newInvoice.status,
        dueDate: newInvoice.due_date,
        createdAt: newInvoice.created_at,
        clientName: request.client_name,
        serviceName: request.service_name,
        taxRate: parseFloat(newInvoice.tax_rate || "0"),
        taxAmount: parseFloat(newInvoice.tax_amount || "0"),
        discountType: newInvoice.discount_type,
        discountValue: parseFloat(newInvoice.discount_value || "0"),
        discountAmount: parseFloat(newInvoice.discount_amount || "0"),
        subtotal: parseFloat(newInvoice.subtotal || "0")
      }, "Invoice created successfully"));
    } catch (error) {
      console.error("Error creating invoice:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to create invoice"));
    }
  }

  static async getInvoiceDetails(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { clientId } = req;
      const { organizationId } = req;
      const financeSelectClause =
        await ClientPortalInvoicesController.getClientPortalInvoiceFinanceSelectClause();

      // Get invoice details with related information
      const query = `
        SELECT
          i.id,
          i.invoice_no,
          i.amount,
          i.currency,
          i.status,
          i.due_date,
          i.sent_at,
          i.paid_at,
          i.created_at,
          i.updated_at,
          i.payment_proof_url,
          ${financeSelectClause},
          r.id as request_id,
          r.req_no as request_number,
          r.request_data,
          r.notes as request_notes,
          s.id as service_id,
          s.name as service_name,
          s.description as service_description,
          c.name as client_name,
          c.company_name,
          c.email as client_email,
          u.name as created_by_name
        FROM client_portal_invoices i
        LEFT JOIN client_portal_requests r ON i.request_id = r.id
        LEFT JOIN client_portal_services s ON r.service_id = s.id
        LEFT JOIN clients c ON i.client_id = c.id
        LEFT JOIN users u ON i.created_by_user_id = u.id
        WHERE i.id = $1 AND i.client_id = $2 AND i.organization_team_id = $3
      `;

      const result = await db.query(query, [id, clientId, organizationId]);

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Invoice not found"));
      }

      const invoice = result.rows[0];

      const invoiceDetails = {
        id: invoice.id,
        invoiceNumber: invoice.invoice_no,
        amount: parseFloat(invoice.amount || "0"),
        currency: invoice.currency,
        status: invoice.status,
        dueDate: invoice.due_date,
        sentAt: invoice.sent_at,
        paidAt: invoice.paid_at,
        createdAt: invoice.created_at,
        updatedAt: invoice.updated_at,
        paymentProofUrl: invoice.payment_proof_url || null,
        taxRate: parseFloat(invoice.tax_rate || "0"),
        taxAmount: parseFloat(invoice.tax_amount || "0"),
        discountType: invoice.discount_type,
        discountValue: parseFloat(invoice.discount_value || "0"),
        discountAmount: parseFloat(invoice.discount_amount || "0"),
        subtotal: parseFloat(invoice.subtotal || "0"),
        isOverdue:
          invoice.due_date &&
          new Date(invoice.due_date) < new Date() &&
          invoice.status !== "paid",
        request: invoice.request_id
          ? {
              id: invoice.request_id,
              requestNumber: invoice.request_number,
              requestData: invoice.request_data,
              notes: invoice.request_notes,
              service: {
                id: invoice.service_id,
                name: invoice.service_name,
                description: invoice.service_description,
              },
            }
          : null,
        client: {
          name: invoice.client_name,
          companyName: invoice.company_name,
          email: invoice.client_email,
        },
        createdBy: invoice.created_by_name
          ? {
              name: invoice.created_by_name,
            }
          : null,
      };

      return res.json(
        new ServerResponse(
          true,
          invoiceDetails,
          "Invoice details retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching invoice details:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to retrieve invoice details")
        );
    }
  }

  static async getOrganizationInvoiceDetails(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.team_id;

      if (!organizationId) {
        return res
          .status(401)
          .json(new ServerResponse(false, null, "Unauthorized"));
      }

      const financeSelectClause =
        await ClientPortalInvoicesController.getClientPortalInvoiceFinanceSelectClause();

      // Get invoice details with related information (without client_id filter)
      const query = `
        SELECT
          i.id,
          i.invoice_no,
          i.amount,
          i.currency,
          i.status,
          i.due_date,
          i.sent_at,
          i.paid_at,
          i.created_at,
          i.updated_at,
          i.notes,
          i.payment_proof_url,
          ${financeSelectClause},
          r.id as request_id,
          r.req_no as request_number,
          r.request_data,
          r.notes as request_notes,
          s.id as service_id,
          s.name as service_name,
          s.description as service_description,
          c.id as client_id,
          c.name as client_name,
          c.company_name,
          c.email as client_email,
          c.phone as client_phone,
          c.address as client_address,
          c.contact_person as client_contact_person,
          u.name as created_by_name
        FROM client_portal_invoices i
        LEFT JOIN client_portal_requests r ON i.request_id = r.id
        LEFT JOIN client_portal_services s ON r.service_id = s.id
        LEFT JOIN clients c ON i.client_id = c.id
        LEFT JOIN users u ON i.created_by_user_id = u.id
        WHERE i.id = $1 AND i.organization_team_id = $2
      `;

      const result = await db.query(query, [id, organizationId]);

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Invoice not found"));
      }

      const invoice = result.rows[0];

      // Get organization settings and team name for company details
      const orgQuery = `
        SELECT
          t.name as organization_name,
          cps.logo_url,
          cps.primary_color,
          cps.contact_email,
          cps.contact_phone,
          cps.company_name,
          cps.address_line_1,
          cps.address_line_2,
          cps.invoice_footer_message
        FROM teams t
        LEFT JOIN client_portal_settings cps ON cps.organization_team_id = t.id
        WHERE t.id = $1
      `;
      const orgResult = await db.query(orgQuery, [organizationId]);
      const orgSettings = orgResult.rows[0] || {};

      const invoiceDetails = {
        id: invoice.id,
        invoiceNumber: invoice.invoice_no,
        amount: parseFloat(invoice.amount || "0"),
        currency: invoice.currency,
        status: invoice.status,
        dueDate: invoice.due_date,
        sentAt: invoice.sent_at,
        paidAt: invoice.paid_at,
        createdAt: invoice.created_at,
        updatedAt: invoice.updated_at,
        notes: invoice.notes,
        paymentProofUrl: invoice.payment_proof_url || null,
        taxRate: parseFloat(invoice.tax_rate || "0"),
        taxAmount: parseFloat(invoice.tax_amount || "0"),
        discountType: invoice.discount_type,
        discountValue: parseFloat(invoice.discount_value || "0"),
        discountAmount: parseFloat(invoice.discount_amount || "0"),
        subtotal: parseFloat(invoice.subtotal || "0"),
        isOverdue:
          invoice.due_date &&
          new Date(invoice.due_date) < new Date() &&
          invoice.status !== "paid",
        request: invoice.request_id
          ? {
              id: invoice.request_id,
              requestNumber: invoice.request_number,
              requestData: invoice.request_data,
              notes: invoice.request_notes,
              service: {
                id: invoice.service_id,
                name: invoice.service_name,
                description: invoice.service_description,
              },
            }
          : null,
        client: {
          id: invoice.client_id,
          name: invoice.client_name,
          companyName: invoice.company_name,
          email: invoice.client_email,
          phone: invoice.client_phone,
          address: invoice.client_address,
          contactPerson: invoice.client_contact_person,
        },
        createdBy: invoice.created_by_name
          ? {
              name: invoice.created_by_name,
            }
          : null,
        organization: {
          name:
            orgSettings.company_name || orgSettings.organization_name || null,
          logoUrl: orgSettings.logo_url || null,
          primaryColor: orgSettings.primary_color || null,
          email: orgSettings.contact_email || null,
          phone: orgSettings.contact_phone || null,
          addressLine1: orgSettings.address_line_1 || null,
          addressLine2: orgSettings.address_line_2 || null,
          invoiceFooterMessage: orgSettings.invoice_footer_message || null,
        },
      };

      return res.json(
        new ServerResponse(
          true,
          invoiceDetails,
          "Invoice details retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching organization invoice details:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to retrieve invoice details")
        );
    }
  }

  static async payInvoice(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { clientId } = req;
      const { organizationId } = req;
      const { paymentMethod, transactionId, notes } = req.body;

      // Verify invoice exists and belongs to client
      const invoiceCheck = await db.query(
        "SELECT id, status, amount FROM client_portal_invoices WHERE id = $1 AND client_id = $2 AND organization_team_id = $3",
        [id, clientId, organizationId]
      );

      if (invoiceCheck.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Invoice not found"));
      }

      const invoice = invoiceCheck.rows[0];

      // Check if invoice is already paid
      if (invoice.status === "paid") {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Invoice is already paid"));
      }

      // Update invoice status to paid, store payment proof URL, and save notes
      const updateQuery = `
        UPDATE client_portal_invoices
        SET status = 'paid', paid_at = NOW(), updated_at = NOW(), payment_proof_url = $2, notes = COALESCE($3, notes)
        WHERE id = $1
        RETURNING id, invoice_no, amount, currency, status, paid_at, updated_at, payment_proof_url, notes
      `;

      const result = await db.query(updateQuery, [id, transactionId || null, notes || null]);
      const updatedInvoice = result.rows[0];

      return res.json(
        new ServerResponse(
          true,
          {
            id: updatedInvoice.id,
            invoiceNumber: updatedInvoice.invoice_no,
            amount: parseFloat(updatedInvoice.amount || "0"),
            currency: updatedInvoice.currency,
            status: updatedInvoice.status,
            paidAt: updatedInvoice.paid_at,
            updatedAt: updatedInvoice.updated_at,
            paymentProofUrl: updatedInvoice.payment_proof_url,
            notes: updatedInvoice.notes,
          },
          "Invoice paid successfully"
        )
      );
    } catch (error) {
      console.error("Error paying invoice:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to pay invoice"));
    }
  }

  static async downloadInvoice(
    req: AuthenticatedClientRequest | IWorkLenzRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      
      // Determine if this is a client request or admin request
      const isClientRequest = 'clientId' in req && req.clientId;
      const clientId = isClientRequest ? (req as AuthenticatedClientRequest).clientId : null;
      const organizationId = isClientRequest 
        ? (req as AuthenticatedClientRequest).organizationId 
        : (req as IWorkLenzRequest).user?.team_id;

      if (!organizationId) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Organization ID is required"));
      }

      // Build query based on request type
      let invoiceQuery: string;
      let queryParams: any[];

      if (isClientRequest && clientId) {
        // Client-side: verify invoice belongs to client
        invoiceQuery = `
          SELECT
            i.id,
            i.invoice_no,
            i.amount,
            i.currency,
            i.status,
            i.due_date,
            i.created_at,
            i.notes,
            c.id as client_id,
            c.name as client_name,
            c.company_name,
            c.email as client_email,
            c.phone as client_phone,
            c.address as client_address,
            r.req_no as request_number,
            s.name as service_name,
            s.description as service_description,
            t.name as organization_name,
            cps.logo_url as organization_logo_url,
            cps.primary_color as organization_primary_color,
            cps.contact_email as organization_email,
            cps.contact_phone as organization_phone,
            cps.address_line_1 as organization_address_line_1,
            cps.address_line_2 as organization_address_line_2,
            cps.invoice_footer_message as organization_invoice_footer_message
          FROM client_portal_invoices i
          LEFT JOIN clients c ON i.client_id = c.id
          LEFT JOIN client_portal_requests r ON i.request_id = r.id
          LEFT JOIN client_portal_services s ON r.service_id = s.id
          LEFT JOIN teams t ON i.organization_team_id = t.id
          LEFT JOIN client_portal_settings cps ON cps.organization_team_id = t.id
          WHERE i.id = $1 AND i.client_id = $2 AND i.organization_team_id = $3
        `;
        queryParams = [id, clientId, organizationId];
      } else {
        // Admin-side: verify invoice belongs to organization
        invoiceQuery = `
          SELECT
            i.id,
            i.invoice_no,
            i.amount,
            i.currency,
            i.status,
            i.due_date,
            i.created_at,
            i.notes,
            c.id as client_id,
            c.name as client_name,
            c.company_name,
            c.email as client_email,
            c.phone as client_phone,
            c.address as client_address,
            r.req_no as request_number,
            s.name as service_name,
            s.description as service_description,
            t.name as organization_name,
            cps.logo_url as organization_logo_url,
            cps.primary_color as organization_primary_color,
            cps.contact_email as organization_email,
            cps.contact_phone as organization_phone,
            cps.address_line_1 as organization_address_line_1,
            cps.address_line_2 as organization_address_line_2,
            cps.invoice_footer_message as organization_invoice_footer_message
          FROM client_portal_invoices i
          LEFT JOIN clients c ON i.client_id = c.id
          LEFT JOIN client_portal_requests r ON i.request_id = r.id
          LEFT JOIN client_portal_services s ON r.service_id = s.id
          LEFT JOIN teams t ON i.organization_team_id = t.id
          LEFT JOIN client_portal_settings cps ON cps.organization_team_id = t.id
          WHERE i.id = $1 AND i.organization_team_id = $2
        `;
        queryParams = [id, organizationId];
      }

      const result = await db.query(invoiceQuery, queryParams);

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Invoice not found"));
      }

      const invoice = result.rows[0];

      // Check if due date has passed
      const isOverdue = invoice.due_date && new Date(invoice.due_date) < new Date() && invoice.status !== 'paid';

      // Prepare invoice data for template generator
      const invoiceData = {
        invoiceNumber: invoice.invoice_no,
        status: invoice.status,
        createdAt: invoice.created_at,
        dueDate: invoice.due_date,
        amount: parseFloat(invoice.amount || "0"),
        currency: invoice.currency,
        isOverdue,
        client: {
          name: invoice.client_name,
          companyName: invoice.company_name,
          email: invoice.client_email,
          phone: invoice.client_phone,
          address: invoice.client_address,
        },
        request: invoice.request_number ? {
          requestNumber: invoice.request_number,
          service: {
            name: invoice.service_name,
            description: invoice.service_description,
          },
        } : null,
        notes: invoice.notes,
        organization: {
          name: invoice.organization_name,
          logoUrl: invoice.organization_logo_url,
          primaryColor: invoice.organization_primary_color,
          email: invoice.organization_email,
          phone: invoice.organization_phone,
          addressLine1: invoice.organization_address_line_1,
          addressLine2: invoice.organization_address_line_2,
          invoiceFooterMessage: invoice.organization_invoice_footer_message,
        },
      };

      // Generate PDF using puppeteer
      const puppeteer = require('puppeteer');
      const { InvoiceTemplateGenerator } = require('../../../shared/invoice-template-generator');

      try {
        const html = InvoiceTemplateGenerator.generateInvoiceHTML(invoiceData);
        const browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '20mm',
            right: '20mm',
            bottom: '20mm',
            left: '20mm',
          },
        });

        await browser.close();

        // Set response headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoice_no}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);

        return res.end(pdfBuffer, 'binary');
      } catch (pdfError) {
        console.error('PDF generation error:', pdfError);
        return res
          .status(500)
          .json(new ServerResponse(false, null, "Failed to generate PDF. Please try again later."));
      }
    } catch (error) {
      console.error("Error downloading invoice:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to download invoice"));
    }
  }

  static async updateInvoice(
    req: AuthenticatedClientRequest | IWorkLenzRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { amount, currency, dueDate, notes, taxRate, taxAmount, discountType, discountValue, discountAmount, subtotal } = req.body;
      
      // Determine if this is a client request or admin request
      const isClientRequest = 'clientId' in req && req.clientId;
      const clientId = isClientRequest ? (req as AuthenticatedClientRequest).clientId : null;
      const organizationId = isClientRequest 
        ? (req as AuthenticatedClientRequest).organizationId 
        : (req as IWorkLenzRequest).user?.team_id;

      if (!organizationId) {
        return res
          .status(401)
          .json(new ServerResponse(false, null, "Unauthorized"));
      }

      // Build query based on request type
      let checkQuery: string;
      let queryParams: any[];

      if (isClientRequest && clientId) {
        // Client-side: verify invoice belongs to client and check if paid
        checkQuery = `
          SELECT id, status as current_status FROM client_portal_invoices
          WHERE id = $1 AND client_id = $2 AND organization_team_id = $3
        `;
        queryParams = [id, clientId, organizationId];
      } else {
        // Admin-side: verify invoice belongs to organization
        checkQuery = `
          SELECT id, status as current_status FROM client_portal_invoices
          WHERE id = $1 AND organization_team_id = $2
        `;
        queryParams = [id, organizationId];
      }

      const checkResult = await db.query(checkQuery, queryParams);

      if (checkResult.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Invoice not found"));
      }

      const currentInvoice = checkResult.rows[0];
      const currentStatus = currentInvoice.current_status;

      // Prevent editing paid invoices
      if (currentStatus === "paid") {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Paid invoices cannot be edited"));
      }

      // Build SET clause for fields to update
      const setFields: Record<string, any> = {};

      if (amount !== undefined) {
        setFields.amount = amount;
      }

      if (currency !== undefined) {
        setFields.currency = currency;
      }

      if (dueDate !== undefined) {
        setFields.due_date = dueDate;
      }

      if (notes !== undefined) {
        setFields.notes = notes;
      }

      if (taxRate !== undefined) {
        setFields.tax_rate = taxRate;
      }

      if (taxAmount !== undefined) {
        setFields.tax_amount = taxAmount;
      }

      if (discountType !== undefined) {
        setFields.discount_type = discountType;
      }

      if (discountValue !== undefined) {
        setFields.discount_value = discountValue;
      }

      if (discountAmount !== undefined) {
        setFields.discount_amount = discountAmount;
      }

      if (subtotal !== undefined) {
        setFields.subtotal = subtotal;
      }

      if (Object.keys(setFields).length === 0) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "No valid fields to update"));
      }

      // Build secure UPDATE query using SqlHelper for parameterized fields
      const params: any[] = [];
      let paramIndex = 1;

      const setClauses = Object.entries(setFields).map(([field, value]) => {
        params.push(value);
        return `${field} = $${paramIndex++}`;
      });

      // Build WHERE clause using SqlHelper for security
      const { where: whereClause, params: whereParams } = SqlHelper.buildWhereClause([
        { field: "id", operator: "=", value: id },
        { field: "organization_team_id", operator: "=", value: organizationId, conjunction: "AND" }
      ], paramIndex);

      // Add client_id filter for client requests
      if (isClientRequest && clientId) {
        whereParams.push(clientId);
        const finalWhereClause = `${whereClause} AND client_id = $${whereParams.length + 2}`;
        params.push(...whereParams, clientId);
      } else {
        params.push(...whereParams);
      }

      // Always update the updated_at timestamp
      setClauses.push("updated_at = NOW()");

      // Build final query
      const updateQuery = `
        UPDATE client_portal_invoices
        SET ${setClauses.join(", ")}
        WHERE ${isClientRequest && clientId ? `${whereClause} AND client_id = $${params.length + 1}` : whereClause}
        RETURNING id, invoice_no, amount, currency, status, due_date, sent_at, paid_at, updated_at, tax_rate, tax_amount, discount_type, discount_value, discount_amount, subtotal
      `;

      const result = await db.query(updateQuery, params);

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Invoice not found"));
      }

      return res.json(
        new ServerResponse(true, result.rows[0], "Invoice updated successfully")
      );
    } catch (error) {
      console.error("Error updating invoice:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to update invoice"));
    }
  }

  static async deleteInvoice(
    req: AuthenticatedClientRequest | IWorkLenzRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const isClientRequest = "clientId" in req && !!req.clientId;
      const clientId = isClientRequest ? (req as AuthenticatedClientRequest).clientId : null;
      const organizationId = isClientRequest
        ? (req as AuthenticatedClientRequest).organizationId
        : (req as IWorkLenzRequest).user?.team_id;

      if (!organizationId) {
        return res
          .status(401)
          .json(new ServerResponse(false, null, "Unauthorized"));
      }

      const checkQuery = isClientRequest
        ? `
        SELECT id, status FROM client_portal_invoices
        WHERE id = $1 AND client_id = $2 AND organization_team_id = $3
      `
        : `
        SELECT id, status FROM client_portal_invoices
        WHERE id = $1 AND organization_team_id = $2
      `;
      const checkParams = isClientRequest ? [id, clientId, organizationId] : [id, organizationId];
      const checkResult = await db.query(checkQuery, checkParams);

      if (checkResult.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Invoice not found"));
      }

      if (checkResult.rows[0].status === "paid") {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Cannot delete paid invoices"));
      }

      const deleteQuery = isClientRequest
        ? `
        DELETE FROM client_portal_invoices
        WHERE id = $1 AND client_id = $2 AND organization_team_id = $3
      `
        : `
        DELETE FROM client_portal_invoices
        WHERE id = $1 AND organization_team_id = $2
      `;
      const deleteParams = isClientRequest ? [id, clientId, organizationId] : [id, organizationId];
      await db.query(deleteQuery, deleteParams);

      return res.json(
        new ServerResponse(true, null, "Invoice deleted successfully")
      );
    } catch (error) {
      console.error("Error deleting invoice:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to delete invoice"));
    }
  }

  static async sendInvoice(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.team_id;

      if (!organizationId) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Organization ID is required"));
      }

      // Verify invoice exists and belongs to organization
      const checkQuery = `
        SELECT i.id, i.status, i.client_id, c.email as client_email, c.name as client_name
        FROM client_portal_invoices i
        LEFT JOIN clients c ON i.client_id = c.id
        WHERE i.id = $1 AND i.organization_team_id = $2
      `;
      const checkResult = await db.query(checkQuery, [id, organizationId]);

      if (checkResult.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Invoice not found"));
      }

      const invoice = checkResult.rows[0];

      // Update invoice status to 'sent' if it's 'draft', otherwise keep current status
      // Set sent_at timestamp when sending
      const updateQuery = `
        UPDATE client_portal_invoices
        SET
          status = CASE WHEN status = 'draft' THEN 'sent' ELSE status END,
          sent_at = CASE WHEN status = 'draft' THEN NOW() ELSE sent_at END,
          updated_at = NOW()
        WHERE id = $1
        RETURNING id, invoice_no, status, sent_at
      `;

      const result = await db.query(updateQuery, [id]);

      // Create notification for the client
      if (invoice.client_id) {
        await this.createNotification(
          invoice.client_id,
          organizationId,
          "invoice_sent",
          "Invoice Sent",
          `Invoice ${result.rows[0].invoice_no} has been sent to you`,
          id,
          result.rows[0].invoice_no,
          {
            status: result.rows[0].status,
            sentAt: result.rows[0].sent_at,
          }
        );
      }

      return res.json(
        new ServerResponse(true, result.rows[0], "Invoice sent successfully")
      );
    } catch (error) {
      console.error("Error sending invoice:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to send invoice"));
    }
  }

  static async markInvoiceAsPaid(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.team_id;

      if (!organizationId) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Organization ID is required"));
      }

      // Verify invoice exists and belongs to organization
      const checkQuery = `
        SELECT i.id, i.status, i.client_id, i.invoice_no
        FROM client_portal_invoices i
        WHERE i.id = $1 AND i.organization_team_id = $2
      `;
      const checkResult = await db.query(checkQuery, [id, organizationId]);

      if (checkResult.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Invoice not found"));
      }

      const invoice = checkResult.rows[0];

      // Check if invoice is already paid
      if (invoice.status === 'paid') {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Invoice is already paid"));
      }

      // Only allow marking as paid if invoice status is 'sent'
      if (invoice.status !== 'sent') {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Only sent invoices can be marked as paid"));
      }

      // Update invoice status to 'paid' and set paid_at timestamp
      const updateQuery = `
        UPDATE client_portal_invoices
        SET
          status = 'paid',
          paid_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
        RETURNING id, invoice_no, status, paid_at
      `;

      const result = await db.query(updateQuery, [id]);

      // Create notification for the client
      if (invoice.client_id) {
        await this.createNotification(
          invoice.client_id,
          organizationId,
          "invoice_paid",
          "Invoice Paid",
          `Invoice ${invoice.invoice_no} has been marked as paid`,
          id,
          invoice.invoice_no,
          {
            status: "paid",
            paidAt: result.rows[0].paid_at,
          }
        );
      }

      return res.json(
        new ServerResponse(
          true,
          result.rows[0],
          "Invoice marked as paid successfully"
        )
      );
    } catch (error) {
      console.error("Error marking invoice as paid:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to mark invoice as paid"));
    }
  }

}
