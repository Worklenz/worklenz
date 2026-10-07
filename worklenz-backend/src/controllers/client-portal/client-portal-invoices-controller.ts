import ClientPortalControllerBase from "./client-portal-base";
import { AuthenticatedClientRequest } from "../../middlewares/client-auth-middleware";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import db from "../../config/db";
import SqlHelper from "../../shared/sql-helpers";
import { isValidUuid } from "../../shared/validation-helpers";
import type { PoolClient } from "pg";
import {
  uploadBase64,
  getClientPortalStorageKey,
  generateUniqueFilename,
} from "../../shared/storage";
import {
  DISCOUNT_TYPES,
  NormalizedLineItem,
  OVERDUE_SQL,
  buildInvoiceOrderBy,
  cleanText,
  clampPagination,
  computeInvoiceTotals,
  escapeLikePattern,
  isInvoiceableRequestStatus,
  isPaymentStatus,
  isSettableInvoiceStatus,
  normalizeCurrency,
  normalizeLineItems,
  parseOptionalDate,
  parseTaxAndDiscount,
  resolvePayment,
  roundMoney,
  validatePaymentProof,
} from "./client-portal-invoice-helpers";
import {
  CLIENT_SNAPSHOT_SELECT,
  ClientSnapshot,
  SNAPSHOT_COLUMNS,
  snapshotFromRow,
  snapshotParams,
} from "./client-portal-client-snapshot";

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

  /** Past its due date and not fully paid, and neither a draft nor cancelled. */
  private static isPastDue(row: {
    due_date?: string | Date | null;
    payment_status?: string;
    status?: string;
  }) {
    if (!row.due_date || row.payment_status === "paid") return false;
    if (row.status === "draft" || row.status === "cancelled") return false;
    return new Date(row.due_date) < new Date(new Date().toDateString());
  }

  /** An invoice's lines, in the order they were entered. */
  private static async getLineItems(invoiceId: string) {
    const result = await db.query(
      `SELECT id, description, quantity, rate, amount
       FROM client_portal_invoice_line_items
       WHERE invoice_id = $1
       ORDER BY position, created_at`,
      [invoiceId]
    );
    return result.rows.map((row: any) => ({
      id: row.id,
      description: row.description,
      quantity: parseFloat(row.quantity || "0"),
      rate: parseFloat(row.rate || "0"),
      amount: parseFloat(row.amount || "0"),
    }));
  }

  /** Inserts an invoice's lines in one statement; call inside the caller's transaction. */
  private static async insertLineItems(
    conn: PoolClient,
    invoiceId: string,
    items: NormalizedLineItem[]
  ) {
    const values: (string | number)[] = [];
    const rows = items.map((item, index) => {
      const base = values.length;
      values.push(invoiceId, item.description, item.quantity, item.rate, item.amount, index);
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
    });
    await conn.query(
      `INSERT INTO client_portal_invoice_line_items (invoice_id, description, quantity, rate, amount, position)
       VALUES ${rows.join(", ")}`,
      values
    );
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
          i.payment_status,
          i.paid_amount,
          i.project_name,
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
        paymentStatus: row.payment_status,
        paidAmount: parseFloat(row.paid_amount || "0"),
        projectName: row.project_name,
        dueDate: row.due_date,
        sentAt: row.sent_at,
        paidAt: row.paid_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        requestNumber: row.request_number,
        serviceName: row.service_name,
        isOverdue: ClientPortalInvoicesController.isPastDue(row),
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
          i.payment_status,
          i.paid_amount,
          i.project_name,
          i.due_date,
          i.sent_at,
          i.paid_at,
          i.created_at,
          i.updated_at,
          r.req_no as request_number,
          s.name as service_name,
          COALESCE(i.client_snapshot_name, c.name) as client_name
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
        paymentStatus: invoice.payment_status,
        paidAmount: parseFloat(invoice.paid_amount || "0"),
        projectName: invoice.project_name,
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
      const { status, paymentStatus, search, clientId, sortBy, sortOrder } = req.query;
      const { page, limit, offset } = clampPagination(req.query.page, req.query.limit);

      if (!organizationId) {
        return res
          .status(401)
          .json(new ServerResponse(false, null, "Unauthorized"));
      }

      // The client filter is compared as a UUID, so a malformed one is a bad request, not a 500.
      if (clientId && !isValidUuid(String(clientId))) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Invalid client ID"));
      }

      if (paymentStatus && !isPaymentStatus(paymentStatus)) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Invalid payment status"));
      }

      // One WHERE for the rows, the count and the stat-card totals, so they always agree.
      const conditions: string[] = ["i.organization_team_id = $1"];
      const params: (string | number)[] = [organizationId];

      if (clientId) {
        params.push(String(clientId));
        conditions.push(`i.client_id = $${params.length}`);
      }
      if (status) {
        params.push(String(status));
        conditions.push(`i.status = $${params.length}`);
      }
      if (paymentStatus) {
        params.push(String(paymentStatus));
        conditions.push(`i.payment_status = $${params.length}`);
      }
      if (search) {
        params.push(`%${escapeLikePattern(String(search))}%`);
        const at = `$${params.length}`;
        conditions.push(
          `(i.invoice_no ILIKE ${at} OR i.project_name ILIKE ${at} OR s.name ILIKE ${at} OR c.name ILIKE ${at} OR i.client_snapshot_name ILIKE ${at})`
        );
      }

      const fromClause = `
        FROM client_portal_invoices i
        LEFT JOIN client_portal_requests r ON i.request_id = r.id
        LEFT JOIN client_portal_services s ON r.service_id = s.id
        LEFT JOIN clients c ON i.client_id = c.id
        WHERE ${conditions.join(" AND ")}
      `;

      const [totalsResult, listResult] = await Promise.all([
        db.query(
          `SELECT
             COUNT(*)::int AS total,
             COALESCE(SUM(i.amount), 0) AS total_invoiced,
             COALESCE(SUM(i.paid_amount), 0) AS total_paid
           ${fromClause}`,
          params
        ),
        db.query(
          `SELECT
             i.id,
             i.client_id,
             i.invoice_no,
             i.amount,
             i.currency,
             i.status,
             i.payment_status,
             i.paid_amount,
             i.project_name,
             i.due_date,
             i.sent_at,
             i.paid_at,
             i.created_at,
             i.updated_at,
             r.req_no AS request_number,
             s.name AS service_name,
             COALESCE(i.client_snapshot_name, c.name) AS client_name,
             ${OVERDUE_SQL} AS is_overdue
           ${fromClause}
           ORDER BY ${buildInvoiceOrderBy(sortBy, sortOrder)}
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, limit, offset]
        ),
      ]);

      const totalsRow = totalsResult.rows[0] || {};
      const totalInvoiced = roundMoney(parseFloat(totalsRow.total_invoiced || "0"));
      const totalPaid = roundMoney(parseFloat(totalsRow.total_paid || "0"));

      const invoices = listResult.rows.map((row: any) => ({
        id: row.id,
        invoiceNumber: row.invoice_no,
        amount: parseFloat(row.amount || "0"),
        currency: row.currency,
        status: row.status,
        paymentStatus: row.payment_status,
        paidAmount: parseFloat(row.paid_amount || "0"),
        projectName: row.project_name,
        dueDate: row.due_date,
        sentAt: row.sent_at,
        paidAt: row.paid_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        requestNumber: row.request_number,
        serviceName: row.service_name,
        clientId: row.client_id,
        clientName: row.client_name,
        isOverdue: row.is_overdue === true,
      }));

      return res.json(
        new ServerResponse(
          true,
          {
            invoices,
            total: totalsRow.total || 0,
            page,
            limit,
            totals: {
              totalInvoiced,
              totalPaid,
              totalOutstanding: roundMoney(totalInvoiced - totalPaid),
            },
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
    const organizationId = req.user?.team_id;
    const createdBy = req.user?.id;
    const body = (req.body ?? {}) as Record<string, any>;

    if (!organizationId) {
      return res
        .status(401)
        .json(new ServerResponse(false, null, "Unauthorized"));
    }

    // ---- validate input (nothing is written until all of it is good) ----
    const requestId = body.requestId ? String(body.requestId) : null;
    const clientIdInput = body.clientId ? String(body.clientId) : null;
    const status = body.status ?? "draft";
    if (status !== "draft" && status !== "sent") {
      return res
        .status(400)
        .json(new ServerResponse(false, null, "A new invoice can only be created as draft or sent"));
    }

    const dueDate = parseOptionalDate(body.dueDate);
    if (dueDate === undefined) {
      return res
        .status(400)
        .json(new ServerResponse(false, null, "Invalid due date"));
    }

    const taxAndDiscount = parseTaxAndDiscount(body);
    if (taxAndDiscount.error !== undefined) {
      return res.status(400).json(new ServerResponse(false, null, taxAndDiscount.error));
    }

    const projectName = cleanText(body.projectName, 255);
    const notes = cleanText(body.notes, 5000);
    const currency = normalizeCurrency(body.currency);

    // Line items drive the totals. A caller that only sends `amount` (older clients) gets one line.
    let lineItems: NormalizedLineItem[];
    if (body.lineItems !== undefined) {
      const parsed = normalizeLineItems(body.lineItems);
      if (parsed.error !== undefined) {
        return res.status(400).json(new ServerResponse(false, null, parsed.error));
      }
      lineItems = parsed.items;
    } else if (Number(body.amount) > 0) {
      const rate = roundMoney(Number(body.amount));
      lineItems = [{ description: projectName || "Services", quantity: 1, rate, amount: rate }];
    } else {
      return res
        .status(400)
        .json(new ServerResponse(false, null, "At least one line item is required"));
    }

    const totals = computeInvoiceTotals(
      lineItems,
      taxAndDiscount.discountType,
      taxAndDiscount.discountValue,
      taxAndDiscount.taxRate
    );
    if (totals.total <= 0) {
      return res
        .status(400)
        .json(new ServerResponse(false, null, "Invoice total must be greater than 0"));
    }

    // ---- resolve the client: from the linked request, or picked directly ----
    let clientId: string;
    let clientName: string | null = null;
    let serviceName: string | null = null;
    // The client's details as they are now, kept on the invoice so it always shows who it was issued to.
    let clientSnapshot: ClientSnapshot;

    if (requestId) {
      if (!isValidUuid(requestId)) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Invalid request ID"));
      }
      const requestResult = await db.query(
        `
        SELECT r.id, r.client_id, r.status, c.name AS client_name, s.name AS service_name,
               ${CLIENT_SNAPSHOT_SELECT}
        FROM client_portal_requests r
        LEFT JOIN clients c ON r.client_id = c.id
        LEFT JOIN client_portal_services s ON r.service_id = s.id
        WHERE r.id = $1 AND r.organization_team_id = $2
        `,
        [requestId, organizationId]
      );
      if (requestResult.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Request not found"));
      }
      const request = requestResult.rows[0];
      if (!isInvoiceableRequestStatus(request.status)) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Pending and rejected requests cannot be invoiced"));
      }
      clientId = request.client_id;
      clientName = request.client_name;
      serviceName = request.service_name;
      clientSnapshot = snapshotFromRow(request);
    } else if (clientIdInput) {
      if (!isValidUuid(clientIdInput)) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Invalid client ID"));
      }
      const clientResult = await db.query(
        `SELECT c.id, c.name, ${CLIENT_SNAPSHOT_SELECT} FROM clients c WHERE c.id = $1 AND c.team_id = $2`,
        [clientIdInput, organizationId]
      );
      if (clientResult.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client not found"));
      }
      clientId = clientResult.rows[0].id;
      clientName = clientResult.rows[0].name;
      clientSnapshot = snapshotFromRow(clientResult.rows[0]);
    } else {
      return res
        .status(400)
        .json(new ServerResponse(false, null, "A request or a client is required"));
    }

    // ---- write the invoice and its lines together ----
    const invoiceNo = `INV-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 7)
      .toUpperCase()}`;
    const sentAt = status === "sent" ? new Date() : null;

    const conn = await db.connect();
    let newInvoice: any;
    try {
      await conn.query("BEGIN");

      const insertResult = await conn.query(
        `
        INSERT INTO client_portal_invoices (
          invoice_no, request_id, client_id, organization_team_id,
          amount, currency, status, due_date, notes, created_by_user_id, sent_at,
          created_at, updated_at,
          tax_rate, tax_amount, discount_type, discount_value, discount_amount, subtotal,
          project_name, ${SNAPSHOT_COLUMNS.join(", ")}
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW(), $12, $13, $14, $15, $16, $17, $18,
                $19, $20, $21, $22, $23, $24)
        RETURNING id, invoice_no, amount, currency, status, payment_status, paid_amount, project_name,
                  due_date, sent_at, created_at, tax_rate, tax_amount, discount_type,
                  discount_value, discount_amount, subtotal
        `,
        [
          invoiceNo,
          requestId,
          clientId,
          organizationId,
          totals.total,
          currency,
          status,
          dueDate,
          notes,
          createdBy,
          sentAt,
          taxAndDiscount.taxRate,
          totals.taxAmount,
          taxAndDiscount.discountType,
          taxAndDiscount.discountValue,
          totals.discountAmount,
          totals.subtotal,
          projectName,
          ...snapshotParams(clientSnapshot),
        ]
      );
      newInvoice = insertResult.rows[0];

      await ClientPortalInvoicesController.insertLineItems(conn, newInvoice.id, lineItems);
      await conn.query("COMMIT");
    } catch (error) {
      await conn.query("ROLLBACK");
      console.error("Error creating invoice:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to create invoice"));
    } finally {
      conn.release();
    }

    // Tell the client about it. The invoice is already saved, so a failed notification must not
    // turn a successful create into an error.
    try {
      await this.createNotification(
        clientId,
        organizationId,
        "invoice_created",
        "New Invoice",
        `New invoice ${newInvoice.invoice_no} for ${currency} ${totals.total}`,
        newInvoice.id,
        newInvoice.invoice_no,
        {
          amount: parseFloat(newInvoice.amount),
          currency: newInvoice.currency,
          dueDate: newInvoice.due_date,
          serviceName,
        }
      );
    } catch (error) {
      console.error("Error creating invoice notification:", error);
    }

    return res.json(
      new ServerResponse(
        true,
        {
          id: newInvoice.id,
          invoiceNumber: newInvoice.invoice_no,
          amount: parseFloat(newInvoice.amount),
          currency: newInvoice.currency,
          status: newInvoice.status,
          paymentStatus: newInvoice.payment_status,
          paidAmount: parseFloat(newInvoice.paid_amount || "0"),
          projectName: newInvoice.project_name,
          dueDate: newInvoice.due_date,
          createdAt: newInvoice.created_at,
          clientName,
          serviceName,
          taxRate: parseFloat(newInvoice.tax_rate || "0"),
          taxAmount: parseFloat(newInvoice.tax_amount || "0"),
          discountType: newInvoice.discount_type,
          discountValue: parseFloat(newInvoice.discount_value || "0"),
          discountAmount: parseFloat(newInvoice.discount_amount || "0"),
          subtotal: parseFloat(newInvoice.subtotal || "0"),
        },
        "Invoice created successfully"
      )
    );
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
          i.payment_status,
          i.paid_amount,
          i.project_name,
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
          COALESCE(i.client_snapshot_name, c.name) as client_name,
          COALESCE(i.client_snapshot_company_name, c.company_name) as company_name,
          COALESCE(i.client_snapshot_email, c.email) as client_email,
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
        paymentStatus: invoice.payment_status,
        paidAmount: parseFloat(invoice.paid_amount || "0"),
        projectName: invoice.project_name,
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
        lineItems: await ClientPortalInvoicesController.getLineItems(invoice.id),
        isOverdue: ClientPortalInvoicesController.isPastDue(invoice),
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

      // Get invoice details with related information (without client_id filter)
      const query = `
        SELECT
          i.id,
          i.invoice_no,
          i.amount,
          i.currency,
          i.status,
          i.payment_status,
          i.paid_amount,
          i.project_name,
          i.due_date,
          i.sent_at,
          i.paid_at,
          i.created_at,
          i.updated_at,
          i.notes,
          i.payment_proof_url,
          i.tax_rate,
          i.tax_amount,
          i.discount_type,
          i.discount_value,
          i.discount_amount,
          i.subtotal,
          ${OVERDUE_SQL} AS is_overdue,
          r.id as request_id,
          r.req_no as request_number,
          r.request_data,
          r.notes as request_notes,
          s.id as service_id,
          s.name as service_name,
          s.description as service_description,
          c.id as client_id,
          COALESCE(i.client_snapshot_name, c.name) as client_name,
          COALESCE(i.client_snapshot_company_name, c.company_name) as company_name,
          COALESCE(i.client_snapshot_email, c.email) as client_email,
          COALESCE(i.client_snapshot_phone, c.phone) as client_phone,
          COALESCE(i.client_snapshot_address, c.address) as client_address,
          COALESCE(i.client_snapshot_contact_person, c.contact_person) as client_contact_person,
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
          cps.city,
          cps.state,
          cps.zip_code,
          cps.country,
          cps.invoice_footer_message,
          cps.invoice_template_style,
          cps.invoice_show_logo
        FROM teams t
        LEFT JOIN client_portal_settings cps ON cps.organization_team_id = t.id
        WHERE t.id = $1
      `;
      const [orgResult, lineItems] = await Promise.all([
        db.query(orgQuery, [organizationId]),
        ClientPortalInvoicesController.getLineItems(invoice.id),
      ]);
      const orgSettings = orgResult.rows[0] || {};

      const invoiceDetails = {
        id: invoice.id,
        invoiceNumber: invoice.invoice_no,
        amount: parseFloat(invoice.amount || "0"),
        currency: invoice.currency,
        status: invoice.status,
        paymentStatus: invoice.payment_status,
        paidAmount: parseFloat(invoice.paid_amount || "0"),
        projectName: invoice.project_name,
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
        lineItems,
        isOverdue: invoice.is_overdue === true,
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
          city: orgSettings.city || null,
          state: orgSettings.state || null,
          zipCode: orgSettings.zip_code || null,
          country: orgSettings.country || null,
          invoiceFooterMessage: orgSettings.invoice_footer_message || null,
          templateStyle: orgSettings.invoice_template_style || "classic",
          showLogo: orgSettings.invoice_show_logo !== false,
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
        "SELECT id, status, payment_status, amount FROM client_portal_invoices WHERE id = $1 AND client_id = $2 AND organization_team_id = $3",
        [id, clientId, organizationId]
      );

      if (invoiceCheck.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Invoice not found"));
      }

      const invoice = invoiceCheck.rows[0];

      // Check if invoice is already paid
      if (invoice.payment_status === "paid") {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Invoice is already paid"));
      }

      // Mark the invoice fully paid, store the payment proof URL and save notes. The document
      // status is left alone: payment and lifecycle are separate fields.
      const updateQuery = `
        UPDATE client_portal_invoices
        SET payment_status = 'paid', paid_amount = amount, paid_at = NOW(), updated_at = NOW(),
            payment_proof_url = $2, notes = COALESCE($3, notes)
        WHERE id = $1
        RETURNING id, invoice_no, amount, currency, status, payment_status, paid_amount, paid_at, updated_at, payment_proof_url, notes
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
            paymentStatus: updatedInvoice.payment_status,
            paidAmount: parseFloat(updatedInvoice.paid_amount || "0"),
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
            i.payment_status,
            i.paid_amount,
            i.project_name,
            i.due_date,
            i.created_at,
            i.notes,
            i.subtotal,
            i.discount_type,
            i.discount_value,
            i.discount_amount,
            i.tax_rate,
            i.tax_amount,
            c.id as client_id,
            COALESCE(i.client_snapshot_name, c.name) as client_name,
            COALESCE(i.client_snapshot_company_name, c.company_name) as company_name,
            COALESCE(i.client_snapshot_email, c.email) as client_email,
            COALESCE(i.client_snapshot_phone, c.phone) as client_phone,
            COALESCE(i.client_snapshot_address, c.address) as client_address,
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
            cps.city as organization_city,
            cps.state as organization_state,
            cps.zip_code as organization_zip_code,
            cps.country as organization_country,
            cps.invoice_footer_message as organization_invoice_footer_message,
            cps.invoice_template_style as organization_invoice_template_style,
            cps.invoice_show_logo as organization_invoice_show_logo
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
            i.payment_status,
            i.paid_amount,
            i.project_name,
            i.due_date,
            i.created_at,
            i.notes,
            i.subtotal,
            i.discount_type,
            i.discount_value,
            i.discount_amount,
            i.tax_rate,
            i.tax_amount,
            c.id as client_id,
            COALESCE(i.client_snapshot_name, c.name) as client_name,
            COALESCE(i.client_snapshot_company_name, c.company_name) as company_name,
            COALESCE(i.client_snapshot_email, c.email) as client_email,
            COALESCE(i.client_snapshot_phone, c.phone) as client_phone,
            COALESCE(i.client_snapshot_address, c.address) as client_address,
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
            cps.city as organization_city,
            cps.state as organization_state,
            cps.zip_code as organization_zip_code,
            cps.country as organization_country,
            cps.invoice_footer_message as organization_invoice_footer_message,
            cps.invoice_template_style as organization_invoice_template_style,
            cps.invoice_show_logo as organization_invoice_show_logo
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
      const isOverdue = ClientPortalInvoicesController.isPastDue(invoice);
      const lineItems = await ClientPortalInvoicesController.getLineItems(invoice.id);

      // Prepare invoice data for template generator
      const invoiceData = {
        invoiceNumber: invoice.invoice_no,
        status: invoice.status,
        paymentStatus: invoice.payment_status,
        createdAt: invoice.created_at,
        dueDate: invoice.due_date,
        amount: parseFloat(invoice.amount || "0"),
        currency: invoice.currency,
        lineItems,
        subtotal: parseFloat(invoice.subtotal || "0"),
        discountType: invoice.discount_type,
        discountValue: parseFloat(invoice.discount_value || "0"),
        discountAmount: parseFloat(invoice.discount_amount || "0"),
        taxRate: parseFloat(invoice.tax_rate || "0"),
        taxAmount: parseFloat(invoice.tax_amount || "0"),
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
          city: invoice.organization_city,
          state: invoice.organization_state,
          zipCode: invoice.organization_zip_code,
          country: invoice.organization_country,
          invoiceFooterMessage: invoice.organization_invoice_footer_message,
          templateStyle: invoice.organization_invoice_template_style || "classic",
          showLogo: invoice.organization_invoice_show_logo !== false,
        },
      };

      // Generate PDF using puppeteer
      const puppeteer = require('puppeteer');
      const { InvoiceTemplateGenerator } = require('../../shared/invoice-template-generator');

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
      const body = (req.body ?? {}) as Record<string, any>;

      // Determine if this is a client request or admin request
      const isClientRequest = 'clientId' in req && !!req.clientId;
      const clientId = isClientRequest ? (req as AuthenticatedClientRequest).clientId : null;
      const organizationId = isClientRequest
        ? (req as AuthenticatedClientRequest).organizationId
        : (req as IWorkLenzRequest).user?.team_id;

      if (!organizationId) {
        return res
          .status(401)
          .json(new ServerResponse(false, null, "Unauthorized"));
      }

      const checkResult = await db.query(
        `
        SELECT id, status, payment_status, amount, tax_rate, discount_type, discount_value
        FROM client_portal_invoices
        WHERE id = $1 AND organization_team_id = $2 ${isClientRequest ? "AND client_id = $3" : ""}
        `,
        isClientRequest ? [id, organizationId, clientId] : [id, organizationId]
      );

      if (checkResult.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Invoice not found"));
      }

      const current = checkResult.rows[0];

      // The set of things being changed; collected first so nothing is written on a bad request.
      const sets: string[] = [];
      const params: any[] = [];
      const setColumn = (column: string, value: any) => {
        params.push(value);
        sets.push(`${column} = $${params.length}`);
      };

      // ---- lifecycle status: admin only, and never "paid" (record a payment instead) ----
      if (body.status !== undefined) {
        if (isClientRequest) {
          return res
            .status(403)
            .json(new ServerResponse(false, null, "Clients cannot change an invoice's status"));
        }
        if (!isSettableInvoiceStatus(body.status)) {
          return res
            .status(400)
            .json(new ServerResponse(false, null, "Invalid invoice status"));
        }
        setColumn("status", body.status);
        // Moving to "sent" for the first time stamps when it went out.
        if (body.status === "sent") sets.push("sent_at = COALESCE(sent_at, NOW())");
      }

      // ---- content: everything below is locked once the invoice is paid ----
      const contentKeys = [
        "amount", "currency", "dueDate", "notes", "projectName", "lineItems",
        "taxRate", "taxAmount", "discountType", "discountValue", "discountAmount", "subtotal",
      ];
      const editsContent = contentKeys.some(key => body[key] !== undefined);
      if (editsContent && current.payment_status === "paid") {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Paid invoices cannot be edited"));
      }

      if (body.currency !== undefined) setColumn("currency", normalizeCurrency(body.currency));

      if (body.dueDate !== undefined) {
        const dueDate = parseOptionalDate(body.dueDate);
        if (dueDate === undefined) {
          return res.status(400).json(new ServerResponse(false, null, "Invalid due date"));
        }
        setColumn("due_date", dueDate);
      }
      if (body.notes !== undefined) setColumn("notes", cleanText(body.notes, 5000));
      if (body.projectName !== undefined) setColumn("project_name", cleanText(body.projectName, 255));

      // ---- money: line items drive the totals; a legacy scalar `amount` is still accepted ----
      let newLineItems: NormalizedLineItem[] | null = null;
      let newAmount: number | null = null;

      if (body.lineItems !== undefined) {
        const parsed = normalizeLineItems(body.lineItems);
        if (parsed.error !== undefined) {
          return res.status(400).json(new ServerResponse(false, null, parsed.error));
        }
        const taxAndDiscount = parseTaxAndDiscount({
          taxRate: body.taxRate ?? current.tax_rate,
          discountType: body.discountType ?? current.discount_type,
          discountValue: body.discountValue ?? current.discount_value,
        });
        if (taxAndDiscount.error !== undefined) {
          return res.status(400).json(new ServerResponse(false, null, taxAndDiscount.error));
        }
        const totals = computeInvoiceTotals(
          parsed.items,
          taxAndDiscount.discountType,
          taxAndDiscount.discountValue,
          taxAndDiscount.taxRate
        );
        if (totals.total <= 0) {
          return res
            .status(400)
            .json(new ServerResponse(false, null, "Invoice total must be greater than 0"));
        }
        newLineItems = parsed.items;
        newAmount = totals.total;
        setColumn("amount", totals.total);
        setColumn("subtotal", totals.subtotal);
        setColumn("tax_rate", taxAndDiscount.taxRate);
        setColumn("tax_amount", totals.taxAmount);
        setColumn("discount_type", taxAndDiscount.discountType);
        setColumn("discount_value", taxAndDiscount.discountValue);
        setColumn("discount_amount", totals.discountAmount);
      } else if (body.amount !== undefined) {
        const amount = Number(body.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          return res
            .status(400)
            .json(new ServerResponse(false, null, "Valid amount is required"));
        }
        newAmount = roundMoney(amount);
        setColumn("amount", newAmount);
        const legacyFinance: Record<string, string> = {
          taxRate: "tax_rate",
          taxAmount: "tax_amount",
          discountValue: "discount_value",
          discountAmount: "discount_amount",
          subtotal: "subtotal",
        };
        for (const [key, column] of Object.entries(legacyFinance)) {
          if (body[key] === undefined) continue;
          const value = Number(body[key]);
          if (!Number.isFinite(value) || value < 0) {
            return res
              .status(400)
              .json(new ServerResponse(false, null, `Invalid ${key}`));
          }
          setColumn(column, value);
        }
        if (body.discountType !== undefined) {
          if (!(DISCOUNT_TYPES as readonly string[]).includes(body.discountType)) {
            return res
              .status(400)
              .json(new ServerResponse(false, null, "Discount type must be percentage or fixed"));
          }
          setColumn("discount_type", body.discountType);
        }
      }

      // A smaller total can never leave more paid than the invoice is worth.
      if (newAmount !== null) {
        params.push(newAmount);
        const at = `$${params.length}`;
        sets.push(`paid_amount = LEAST(paid_amount, ${at})`);
        sets.push(
          `payment_status = CASE WHEN payment_status = 'partially_paid' AND LEAST(paid_amount, ${at}) >= ${at} THEN 'paid' ELSE payment_status END`
        );
      }

      if (sets.length === 0) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "No valid fields to update"));
      }

      sets.push("updated_at = NOW()");
      params.push(id, organizationId);
      const idAt = `$${params.length - 1}`;
      const orgAt = `$${params.length}`;
      let clientClause = "";
      if (isClientRequest) {
        params.push(clientId);
        clientClause = ` AND client_id = $${params.length}`;
      }

      const conn = await db.connect();
      try {
        await conn.query("BEGIN");
        const result = await conn.query(
          `
          UPDATE client_portal_invoices
          SET ${sets.join(", ")}
          WHERE id = ${idAt} AND organization_team_id = ${orgAt}${clientClause}
          RETURNING id, invoice_no, amount, currency, status, payment_status, paid_amount, project_name,
                    due_date, sent_at, paid_at, updated_at, tax_rate, tax_amount, discount_type,
                    discount_value, discount_amount, subtotal
          `,
          params
        );

        if (result.rows.length === 0) {
          await conn.query("ROLLBACK");
          return res
            .status(404)
            .json(new ServerResponse(false, null, "Invoice not found"));
        }

        if (newLineItems) {
          await conn.query("DELETE FROM client_portal_invoice_line_items WHERE invoice_id = $1", [id]);
          await ClientPortalInvoicesController.insertLineItems(conn, id, newLineItems);
        }
        await conn.query("COMMIT");

        return res.json(
          new ServerResponse(true, result.rows[0], "Invoice updated successfully")
        );
      } catch (error) {
        await conn.query("ROLLBACK");
        throw error;
      } finally {
        conn.release();
      }
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
        SELECT id, payment_status FROM client_portal_invoices
        WHERE id = $1 AND client_id = $2 AND organization_team_id = $3
      `
        : `
        SELECT id, payment_status FROM client_portal_invoices
        WHERE id = $1 AND organization_team_id = $2
      `;
      const checkParams = isClientRequest ? [id, clientId, organizationId] : [id, organizationId];
      const checkResult = await db.query(checkQuery, checkParams);

      if (checkResult.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Invoice not found"));
      }

      // Deleting would erase the record of money received, whether in full or in part.
      if (checkResult.rows[0].payment_status !== "unpaid") {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Cannot delete an invoice that has payments recorded"));
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
        SELECT i.id, i.status, i.payment_status, i.client_id, i.invoice_no
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
      if (invoice.payment_status === 'paid') {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Invoice is already paid"));
      }

      // A draft was never sent and a cancelled invoice is void: neither can be paid.
      if (invoice.status === 'draft' || invoice.status === 'cancelled') {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Only sent invoices can be marked as paid"));
      }

      // Fully paid; the document status is left as it was.
      const updateQuery = `
        UPDATE client_portal_invoices
        SET
          payment_status = 'paid',
          paid_amount = amount,
          paid_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
        RETURNING id, invoice_no, status, payment_status, paid_amount, paid_at
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

  static async recordPayment(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.team_id;
      const { paymentStatus, paidAmount, proof } = (req.body ?? {}) as Record<string, any>;

      if (!organizationId) {
        return res
          .status(401)
          .json(new ServerResponse(false, null, "Unauthorized"));
      }

      if (!isPaymentStatus(paymentStatus)) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Payment status must be unpaid, partially_paid or paid"));
      }

      const checkResult = await db.query(
        `SELECT id, invoice_no, status, payment_status, amount, client_id
         FROM client_portal_invoices
         WHERE id = $1 AND organization_team_id = $2`,
        [id, organizationId]
      );
      if (checkResult.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Invoice not found"));
      }
      const invoice = checkResult.rows[0];

      // Paid locks the amount to the invoice total, Unpaid clears it, Partial is clamped to it.
      const resolved = resolvePayment(paymentStatus, parseFloat(invoice.amount), paidAmount);

      // Optional proof file, sent as a base64 data URL like the other portal uploads.
      let proofUrl: string | null = null;
      if (proof && proof.fileData) {
        const problem = validatePaymentProof(proof);
        if (problem) {
          return res.status(400).json(new ServerResponse(false, null, problem));
        }
        const storageKey = getClientPortalStorageKey(
          "payment-proofs",
          organizationId,
          String(id),
          generateUniqueFilename(String(proof.fileName || "proof"), "proof")
        );
        proofUrl = (await uploadBase64(String(proof.fileData), storageKey)) || null;
        if (!proofUrl) {
          return res
            .status(500)
            .json(new ServerResponse(false, null, "Failed to upload the payment proof"));
        }
      }

      // Paid At is the time of the latest recorded payment; going back to Unpaid clears it.
      const updateResult = await db.query(
        `
        UPDATE client_portal_invoices
        SET payment_status = $2,
            paid_amount = $3,
            paid_at = CASE WHEN $2 = 'unpaid' THEN NULL ELSE NOW() END,
            payment_proof_url = COALESCE($4, payment_proof_url),
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, invoice_no, amount, currency, status, payment_status, paid_amount,
                  paid_at, updated_at, payment_proof_url
        `,
        [id, resolved.paymentStatus, resolved.paidAmount, proofUrl]
      );
      const updated = updateResult.rows[0];

      // Tell the client only when the invoice has just become fully paid.
      if (
        invoice.client_id &&
        resolved.paymentStatus === "paid" &&
        invoice.payment_status !== "paid"
      ) {
        try {
          await this.createNotification(
            invoice.client_id,
            organizationId,
            "invoice_paid",
            "Invoice Paid",
            `Invoice ${invoice.invoice_no} has been marked as paid`,
            id,
            invoice.invoice_no,
            { status: "paid", paidAt: updated.paid_at }
          );
        } catch (error) {
          console.error("Error creating invoice paid notification:", error);
        }
      }

      return res.json(
        new ServerResponse(
          true,
          {
            id: updated.id,
            invoiceNumber: updated.invoice_no,
            amount: parseFloat(updated.amount || "0"),
            currency: updated.currency,
            status: updated.status,
            paymentStatus: updated.payment_status,
            paidAmount: parseFloat(updated.paid_amount || "0"),
            paidAt: updated.paid_at,
            updatedAt: updated.updated_at,
            paymentProofUrl: updated.payment_proof_url,
          },
          "Payment recorded successfully"
        )
      );
    } catch (error) {
      console.error("Error recording invoice payment:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to record payment"));
    }
  }

  /**
   * Copies an invoice as a fresh draft: same client, request, lines, tax/discount and notes;
   * a new number, unpaid with nothing paid, issued today, and no due date, sent/paid times or proof.
   */
  static async duplicateInvoice(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ) {
    const { id } = req.params;
    const organizationId = req.user?.team_id;
    const createdBy = req.user?.id;

    if (!organizationId) {
      return res
        .status(401)
        .json(new ServerResponse(false, null, "Unauthorized"));
    }

    const conn = await db.connect();
    try {
      await conn.query("BEGIN");

      const source = await conn.query(
        `SELECT * FROM client_portal_invoices WHERE id = $1 AND organization_team_id = $2`,
        [id, organizationId]
      );
      if (source.rows.length === 0) {
        await conn.query("ROLLBACK");
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Invoice not found"));
      }
      const original = source.rows[0];

      // A duplicate is a new document, so it takes the client's details as they are now; the
      // original's snapshot is only the fallback if the client can no longer be read.
      const currentClient = await conn.query(
        `SELECT ${CLIENT_SNAPSHOT_SELECT} FROM clients c WHERE c.id = $1`,
        [original.client_id]
      );
      const liveSnapshot = snapshotFromRow(currentClient.rows[0]);
      const clientSnapshot = liveSnapshot.name
        ? liveSnapshot
        : snapshotFromRow({
            snapshot_name: original.client_snapshot_name,
            snapshot_company_name: original.client_snapshot_company_name,
            snapshot_email: original.client_snapshot_email,
            snapshot_phone: original.client_snapshot_phone,
            snapshot_address: original.client_snapshot_address,
            snapshot_contact_person: original.client_snapshot_contact_person,
          });

      const invoiceNo = `INV-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 7)
        .toUpperCase()}`;

      const inserted = await conn.query(
        `
        INSERT INTO client_portal_invoices (
          invoice_no, request_id, client_id, organization_team_id,
          amount, currency, status, payment_status, paid_amount, due_date, notes,
          created_by_user_id, sent_at, paid_at, created_at, updated_at,
          tax_rate, tax_amount, discount_type, discount_value, discount_amount, subtotal,
          project_name, ${SNAPSHOT_COLUMNS.join(", ")}
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'draft', 'unpaid', 0, NULL, $7,
                $8, NULL, NULL, NOW(), NOW(), $9, $10, $11, $12, $13, $14, $15,
                $16, $17, $18, $19, $20, $21)
        RETURNING id, invoice_no
        `,
        [
          invoiceNo,
          original.request_id,
          original.client_id,
          organizationId,
          original.amount,
          original.currency,
          original.notes,
          createdBy,
          original.tax_rate,
          original.tax_amount,
          original.discount_type,
          original.discount_value,
          original.discount_amount,
          original.subtotal,
          original.project_name,
          ...snapshotParams(clientSnapshot),
        ]
      );
      const copy = inserted.rows[0];

      await conn.query(
        `
        INSERT INTO client_portal_invoice_line_items (invoice_id, description, quantity, rate, amount, position)
        SELECT $1, description, quantity, rate, amount, position
        FROM client_portal_invoice_line_items
        WHERE invoice_id = $2
        `,
        [copy.id, id]
      );

      await conn.query("COMMIT");

      return res.json(
        new ServerResponse(
          true,
          { id: copy.id, invoiceNumber: copy.invoice_no },
          "Invoice duplicated successfully"
        )
      );
    } catch (error) {
      await conn.query("ROLLBACK");
      console.error("Error duplicating invoice:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to duplicate invoice"));
    } finally {
      conn.release();
    }
  }


}
