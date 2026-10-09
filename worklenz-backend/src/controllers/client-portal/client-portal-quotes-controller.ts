import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import db from "../../config/db";
import { isValidUuid } from "../../shared/validation-helpers";
import type { PoolClient } from "pg";
import {
  NormalizedLineItem,
  cleanText,
  clampPagination,
  computeInvoiceTotals,
  escapeLikePattern,
  isInvoiceableRequestStatus,
  normalizeCurrency,
  normalizeLineItems,
  parseOptionalDate,
  parseTaxAndDiscount,
  roundMoney,
} from "./client-portal-invoice-helpers";
import {
  PENDING_QUOTE_STATUSES,
  buildQuoteOrderBy,
  generateQuoteNumber,
  isNewQuoteStatus,
  isQuoteStatus,
} from "./client-portal-quote-helpers";
import {
  CLIENT_SNAPSHOT_SELECT,
  ClientSnapshot,
  SNAPSHOT_COLUMNS,
  snapshotFromRow,
  snapshotParams,
} from "./client-portal-client-snapshot";

/**
 * Organization-side (admin) client portal quotes: pre-sale estimates that mirror invoices but with
 * a Valid Until date and no payment tracking. Status is set manually by staff.
 */
export default class ClientPortalQuotesController {
  /** A quote's lines, in the order they were entered. */
  private static async getLineItems(quoteId: string) {
    const result = await db.query(
      `SELECT id, description, quantity, rate, amount
       FROM client_portal_quote_line_items
       WHERE quote_id = $1
       ORDER BY position, created_at`,
      [quoteId]
    );
    return result.rows.map((row: any) => ({
      id: row.id,
      description: row.description,
      quantity: parseFloat(row.quantity || "0"),
      rate: parseFloat(row.rate || "0"),
      amount: parseFloat(row.amount || "0"),
    }));
  }

  /** Inserts a quote's lines in one statement; call inside the caller's transaction. */
  private static async insertLineItems(
    conn: PoolClient,
    quoteId: string,
    items: NormalizedLineItem[]
  ) {
    const values: (string | number)[] = [];
    const rows = items.map((item, index) => {
      const base = values.length;
      values.push(quoteId, item.description, item.quantity, item.rate, item.amount, index);
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
    });
    await conn.query(
      `INSERT INTO client_portal_quote_line_items (quote_id, description, quantity, rate, amount, position)
       VALUES ${rows.join(", ")}`,
      values
    );
  }

  /** The issuing organization's branding / contact details, shown on the quote document. */
  private static async getOrganizationInfo(organizationId: string) {
    const result = await db.query(
      `SELECT
         t.name AS organization_name,
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
       WHERE t.id = $1`,
      [organizationId]
    );
    const settings = result.rows[0] || {};
    return {
      name: settings.company_name || settings.organization_name || null,
      logoUrl: settings.logo_url || null,
      primaryColor: settings.primary_color || null,
      email: settings.contact_email || null,
      phone: settings.contact_phone || null,
      addressLine1: settings.address_line_1 || null,
      addressLine2: settings.address_line_2 || null,
      city: settings.city || null,
      state: settings.state || null,
      zipCode: settings.zip_code || null,
      country: settings.country || null,
      invoiceFooterMessage: settings.invoice_footer_message || null,
      templateStyle: (settings.invoice_template_style || "classic") as "classic" | "modern",
      showLogo: settings.invoice_show_logo !== false,
    };
  }

  /** A quote with everything the detail view and the document need, scoped to the organization. */
  private static async findQuote(quoteId: string, organizationId: string) {
    const result = await db.query(
      `SELECT
         q.id, q.quote_no, q.amount, q.currency, q.status, q.project_name, q.notes,
         q.valid_until::text AS valid_until,
         q.subtotal, q.tax_rate, q.tax_amount, q.discount_type, q.discount_value, q.discount_amount,
         q.created_at, q.updated_at,
         r.id AS request_id, r.req_no AS request_number, r.notes AS request_notes,
         s.id AS service_id, s.name AS service_name, s.description AS service_description,
         c.id AS client_id,
         COALESCE(q.client_snapshot_name, c.name) AS client_name,
         COALESCE(q.client_snapshot_company_name, c.company_name) AS company_name,
         COALESCE(q.client_snapshot_email, c.email) AS client_email,
         COALESCE(q.client_snapshot_phone, c.phone) AS client_phone,
         COALESCE(q.client_snapshot_address, c.address) AS client_address,
         COALESCE(q.client_snapshot_contact_person, c.contact_person) AS client_contact_person,
         u.name AS created_by_name
       FROM client_portal_quotes q
       LEFT JOIN client_portal_requests r ON q.request_id = r.id
       LEFT JOIN client_portal_services s ON r.service_id = s.id
       LEFT JOIN clients c ON q.client_id = c.id
       LEFT JOIN users u ON q.created_by_user_id = u.id
       WHERE q.id = $1 AND q.organization_team_id = $2`,
      [quoteId, organizationId]
    );
    return result.rows[0] ?? null;
  }

  static async getQuotes(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const organizationId = req.user?.team_id;
      const { status, search, clientId, sortBy, sortOrder } = req.query;
      const { page, limit, offset } = clampPagination(req.query.page, req.query.limit);

      if (!organizationId) {
        return res.status(401).json(new ServerResponse(false, null, "Unauthorized"));
      }
      if (clientId && !isValidUuid(String(clientId))) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid client ID"));
      }
      if (status && !isQuoteStatus(String(status))) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid quote status"));
      }

      // One WHERE for the rows, the count and the stat-card totals, so they always agree.
      const conditions: string[] = ["q.organization_team_id = $1"];
      const params: (string | number)[] = [organizationId];

      if (clientId) {
        params.push(String(clientId));
        conditions.push(`q.client_id = $${params.length}`);
      }
      if (status) {
        params.push(String(status));
        conditions.push(`q.status = $${params.length}`);
      }
      if (search) {
        params.push(`%${escapeLikePattern(String(search))}%`);
        const at = `$${params.length}`;
        conditions.push(
          `(q.quote_no ILIKE ${at} OR q.project_name ILIKE ${at} OR s.name ILIKE ${at} OR c.name ILIKE ${at} OR q.client_snapshot_name ILIKE ${at})`
        );
      }

      const fromClause = `
        FROM client_portal_quotes q
        LEFT JOIN client_portal_requests r ON q.request_id = r.id
        LEFT JOIN client_portal_services s ON r.service_id = s.id
        LEFT JOIN clients c ON q.client_id = c.id
        WHERE ${conditions.join(" AND ")}
      `;

      const pendingList = PENDING_QUOTE_STATUSES.map(value => `'${value}'`).join(", ");

      const [totalsResult, listResult] = await Promise.all([
        db.query(
          `SELECT
             COUNT(*)::int AS total,
             COALESCE(SUM(q.amount), 0) AS total_quoted,
             COALESCE(SUM(q.amount) FILTER (WHERE q.status = 'accepted'), 0) AS total_accepted,
             COALESCE(SUM(q.amount) FILTER (WHERE q.status IN (${pendingList})), 0) AS total_pending
           ${fromClause}`,
          params
        ),
        db.query(
          `SELECT
             q.id, q.client_id, q.quote_no, q.amount, q.currency, q.status, q.project_name,
             q.valid_until::text AS valid_until, q.created_at, q.updated_at,
             r.req_no AS request_number,
             s.name AS service_name,
             COALESCE(q.client_snapshot_name, c.name) AS client_name
           ${fromClause}
           ORDER BY ${buildQuoteOrderBy(sortBy, sortOrder)}
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, limit, offset]
        ),
      ]);

      const totalsRow = totalsResult.rows[0] || {};

      const quotes = listResult.rows.map((row: any) => ({
        id: row.id,
        quoteNumber: row.quote_no,
        amount: parseFloat(row.amount || "0"),
        currency: row.currency,
        status: row.status,
        projectName: row.project_name,
        validUntil: row.valid_until,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        requestNumber: row.request_number,
        serviceName: row.service_name,
        clientId: row.client_id,
        clientName: row.client_name,
      }));

      return res.json(
        new ServerResponse(
          true,
          {
            quotes,
            total: totalsRow.total || 0,
            page,
            limit,
            totals: {
              totalQuoted: roundMoney(parseFloat(totalsRow.total_quoted || "0")),
              totalAccepted: roundMoney(parseFloat(totalsRow.total_accepted || "0")),
              totalPending: roundMoney(parseFloat(totalsRow.total_pending || "0")),
            },
          },
          "Quotes retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching quotes:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve quotes"));
    }
  }

  static async createQuote(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const organizationId = req.user?.team_id;
    const createdBy = req.user?.id;
    const body = (req.body ?? {}) as Record<string, any>;

    if (!organizationId) {
      return res.status(401).json(new ServerResponse(false, null, "Unauthorized"));
    }

    // ---- validate input (nothing is written until all of it is good) ----
    const requestId = body.requestId ? String(body.requestId) : null;
    const clientIdInput = body.clientId ? String(body.clientId) : null;
    const status = body.status ?? "draft";
    if (!isNewQuoteStatus(status)) {
      return res
        .status(400)
        .json(new ServerResponse(false, null, "A new quote can only be created as draft or sent"));
    }

    const validUntil = parseOptionalDate(body.validUntil);
    if (validUntil === undefined) {
      return res.status(400).json(new ServerResponse(false, null, "Invalid valid until date"));
    }

    const taxAndDiscount = parseTaxAndDiscount(body);
    if (taxAndDiscount.error !== undefined) {
      return res.status(400).json(new ServerResponse(false, null, taxAndDiscount.error));
    }

    const projectName = cleanText(body.projectName, 255);
    const notes = cleanText(body.notes, 5000);
    const currency = normalizeCurrency(body.currency);

    const parsedLines = normalizeLineItems(body.lineItems);
    if (parsedLines.error !== undefined) {
      return res.status(400).json(new ServerResponse(false, null, parsedLines.error));
    }
    const lineItems = parsedLines.items;

    const totals = computeInvoiceTotals(
      lineItems,
      taxAndDiscount.discountType,
      taxAndDiscount.discountValue,
      taxAndDiscount.taxRate
    );
    if (totals.total <= 0) {
      return res
        .status(400)
        .json(new ServerResponse(false, null, "Quote total must be greater than 0"));
    }

    // ---- resolve the client: from the linked request, or picked directly ----
    let clientId: string;
    let clientName: string | null = null;
    let serviceName: string | null = null;
    // The client's details as they are now, kept on the quote so it always shows who it was prepared for.
    let clientSnapshot: ClientSnapshot;

    if (requestId) {
      if (!isValidUuid(requestId)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid request ID"));
      }
      const requestResult = await db.query(
        `SELECT r.id, r.client_id, r.status, c.name AS client_name, s.name AS service_name,
                ${CLIENT_SNAPSHOT_SELECT}
         FROM client_portal_requests r
         LEFT JOIN clients c ON r.client_id = c.id
         LEFT JOIN client_portal_services s ON r.service_id = s.id
         WHERE r.id = $1 AND r.organization_team_id = $2`,
        [requestId, organizationId]
      );
      if (requestResult.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Request not found"));
      }
      const request = requestResult.rows[0];
      if (!isInvoiceableRequestStatus(request.status)) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Pending and rejected requests cannot be quoted"));
      }
      clientId = request.client_id;
      clientName = request.client_name;
      serviceName = request.service_name;
      clientSnapshot = snapshotFromRow(request);
    } else if (clientIdInput) {
      if (!isValidUuid(clientIdInput)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid client ID"));
      }
      const clientResult = await db.query(
        `SELECT c.id, c.name, ${CLIENT_SNAPSHOT_SELECT} FROM clients c WHERE c.id = $1 AND c.team_id = $2`,
        [clientIdInput, organizationId]
      );
      if (clientResult.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Client not found"));
      }
      clientId = clientResult.rows[0].id;
      clientName = clientResult.rows[0].name;
      clientSnapshot = snapshotFromRow(clientResult.rows[0]);
    } else {
      return res
        .status(400)
        .json(new ServerResponse(false, null, "A request or a client is required"));
    }

    // ---- write the quote and its lines together ----
    const conn = await db.connect();
    let newQuote: any;
    try {
      await conn.query("BEGIN");

      const insertResult = await conn.query(
        `INSERT INTO client_portal_quotes (
           quote_no, request_id, client_id, organization_team_id, created_by_user_id,
           status, currency, project_name, notes, valid_until,
           subtotal, tax_rate, tax_amount, discount_type, discount_value, discount_amount, amount,
           ${SNAPSHOT_COLUMNS.join(", ")}
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
                 $18, $19, $20, $21, $22, $23)
         RETURNING id, quote_no, amount, currency, status, project_name, valid_until::text AS valid_until, created_at,
                   subtotal, tax_rate, tax_amount, discount_type, discount_value, discount_amount`,
        [
          generateQuoteNumber(),
          requestId,
          clientId,
          organizationId,
          createdBy,
          status,
          currency,
          projectName,
          notes,
          validUntil,
          totals.subtotal,
          taxAndDiscount.taxRate,
          totals.taxAmount,
          taxAndDiscount.discountType,
          taxAndDiscount.discountValue,
          totals.discountAmount,
          totals.total,
          ...snapshotParams(clientSnapshot),
        ]
      );
      newQuote = insertResult.rows[0];

      await ClientPortalQuotesController.insertLineItems(conn, newQuote.id, lineItems);
      await conn.query("COMMIT");
    } catch (error) {
      await conn.query("ROLLBACK");
      console.error("Error creating quote:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to create quote"));
    } finally {
      conn.release();
    }

    return res.json(
      new ServerResponse(
        true,
        {
          id: newQuote.id,
          quoteNumber: newQuote.quote_no,
          amount: parseFloat(newQuote.amount),
          currency: newQuote.currency,
          status: newQuote.status,
          projectName: newQuote.project_name,
          validUntil: newQuote.valid_until,
          createdAt: newQuote.created_at,
          clientName,
          serviceName,
          taxRate: parseFloat(newQuote.tax_rate || "0"),
          taxAmount: parseFloat(newQuote.tax_amount || "0"),
          discountType: newQuote.discount_type,
          discountValue: parseFloat(newQuote.discount_value || "0"),
          discountAmount: parseFloat(newQuote.discount_amount || "0"),
          subtotal: parseFloat(newQuote.subtotal || "0"),
        },
        "Quote created successfully"
      )
    );
  }

  static async getQuoteDetails(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.team_id;

      if (!organizationId) {
        return res.status(401).json(new ServerResponse(false, null, "Unauthorized"));
      }

      const quote = await ClientPortalQuotesController.findQuote(id, organizationId);
      if (!quote) {
        return res.status(404).json(new ServerResponse(false, null, "Quote not found"));
      }

      const [lineItems, organization] = await Promise.all([
        ClientPortalQuotesController.getLineItems(quote.id),
        ClientPortalQuotesController.getOrganizationInfo(organizationId),
      ]);

      return res.json(
        new ServerResponse(
          true,
          {
            id: quote.id,
            quoteNumber: quote.quote_no,
            amount: parseFloat(quote.amount || "0"),
            currency: quote.currency,
            status: quote.status,
            projectName: quote.project_name,
            notes: quote.notes,
            validUntil: quote.valid_until,
            createdAt: quote.created_at,
            updatedAt: quote.updated_at,
            taxRate: parseFloat(quote.tax_rate || "0"),
            taxAmount: parseFloat(quote.tax_amount || "0"),
            discountType: quote.discount_type,
            discountValue: parseFloat(quote.discount_value || "0"),
            discountAmount: parseFloat(quote.discount_amount || "0"),
            subtotal: parseFloat(quote.subtotal || "0"),
            lineItems,
            request: quote.request_id
              ? {
                  id: quote.request_id,
                  requestNumber: quote.request_number,
                  notes: quote.request_notes,
                  service: {
                    id: quote.service_id,
                    name: quote.service_name,
                    description: quote.service_description,
                  },
                }
              : null,
            client: {
              id: quote.client_id,
              name: quote.client_name,
              companyName: quote.company_name,
              email: quote.client_email,
              phone: quote.client_phone,
              address: quote.client_address,
              contactPerson: quote.client_contact_person,
            },
            createdBy: quote.created_by_name ? { name: quote.created_by_name } : null,
            organization,
          },
          "Quote details retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching quote details:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to retrieve quote details"));
    }
  }

  static async updateQuoteStatus(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.team_id;
      const status = req.body?.status;

      if (!organizationId) {
        return res.status(401).json(new ServerResponse(false, null, "Unauthorized"));
      }
      if (!isQuoteStatus(status)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid quote status"));
      }

      const result = await db.query(
        `UPDATE client_portal_quotes
         SET status = $1, updated_at = NOW()
         WHERE id = $2 AND organization_team_id = $3
         RETURNING id, quote_no, status`,
        [status, id, organizationId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Quote not found"));
      }

      const row = result.rows[0];
      return res.json(
        new ServerResponse(
          true,
          { id: row.id, quoteNumber: row.quote_no, status: row.status },
          "Quote status updated successfully"
        )
      );
    } catch (error) {
      console.error("Error updating quote status:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to update quote status"));
    }
  }

  /** Copies a quote as a new draft issued today. Valid Until, lines, client and notes carry over. */
  static async duplicateQuote(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const { id } = req.params;
    const organizationId = req.user?.team_id;
    const createdBy = req.user?.id;

    if (!organizationId) {
      return res.status(401).json(new ServerResponse(false, null, "Unauthorized"));
    }

    const conn = await db.connect();
    try {
      await conn.query("BEGIN");

      const source = await conn.query(
        "SELECT * FROM client_portal_quotes WHERE id = $1 AND organization_team_id = $2",
        [id, organizationId]
      );
      if (source.rows.length === 0) {
        await conn.query("ROLLBACK");
        return res.status(404).json(new ServerResponse(false, null, "Quote not found"));
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

      // status is always 'draft' and created_at (Issued) is now: the copy never inherits either.
      const inserted = await conn.query(
        `INSERT INTO client_portal_quotes (
           quote_no, request_id, client_id, organization_team_id, created_by_user_id,
           status, currency, project_name, notes, valid_until,
           subtotal, tax_rate, tax_amount, discount_type, discount_value, discount_amount, amount,
           created_at, updated_at, ${SNAPSHOT_COLUMNS.join(", ")}
         )
         VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW(),
                 $17, $18, $19, $20, $21, $22)
         RETURNING id, quote_no`,
        [
          generateQuoteNumber(),
          original.request_id,
          original.client_id,
          organizationId,
          createdBy,
          original.currency,
          original.project_name,
          original.notes,
          original.valid_until,
          original.subtotal,
          original.tax_rate,
          original.tax_amount,
          original.discount_type,
          original.discount_value,
          original.discount_amount,
          original.amount,
          ...snapshotParams(clientSnapshot),
        ]
      );
      const copy = inserted.rows[0];

      await conn.query(
        `INSERT INTO client_portal_quote_line_items (quote_id, description, quantity, rate, amount, position)
         SELECT $1, description, quantity, rate, amount, position
         FROM client_portal_quote_line_items
         WHERE quote_id = $2`,
        [copy.id, id]
      );

      await conn.query("COMMIT");

      return res.json(
        new ServerResponse(
          true,
          { id: copy.id, quoteNumber: copy.quote_no },
          "Quote duplicated successfully"
        )
      );
    } catch (error) {
      await conn.query("ROLLBACK");
      console.error("Error duplicating quote:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to duplicate quote"));
    } finally {
      conn.release();
    }
  }

  /** Deletes a quote (any status). Its line items go with it; the client and request are untouched. */
  static async deleteQuote(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.team_id;

      if (!organizationId) {
        return res.status(401).json(new ServerResponse(false, null, "Unauthorized"));
      }

      const result = await db.query(
        "DELETE FROM client_portal_quotes WHERE id = $1 AND organization_team_id = $2 RETURNING id",
        [id, organizationId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Quote not found"));
      }

      return res.json(new ServerResponse(true, null, "Quote deleted successfully"));
    } catch (error) {
      console.error("Error deleting quote:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to delete quote"));
    }
  }

  /** Renders the quote as an A4 PDF using the invoice template with quote labels. */
  static async downloadQuote(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.team_id;

      if (!organizationId) {
        return res.status(401).json(new ServerResponse(false, null, "Unauthorized"));
      }

      const quote = await ClientPortalQuotesController.findQuote(id, organizationId);
      if (!quote) {
        return res.status(404).json(new ServerResponse(false, null, "Quote not found"));
      }

      const [lineItems, organization] = await Promise.all([
        ClientPortalQuotesController.getLineItems(quote.id),
        ClientPortalQuotesController.getOrganizationInfo(organizationId),
      ]);

      const quoteData = {
        invoiceNumber: quote.quote_no,
        status: quote.status,
        createdAt: quote.created_at,
        dueDate: quote.valid_until,
        amount: parseFloat(quote.amount || "0"),
        currency: quote.currency,
        // Valid Until is shown in red once the quote has expired.
        isOverdue: quote.status === "expired",
        lineItems,
        subtotal: parseFloat(quote.subtotal || "0"),
        discountType: quote.discount_type,
        discountValue: parseFloat(quote.discount_value || "0"),
        discountAmount: parseFloat(quote.discount_amount || "0"),
        taxRate: parseFloat(quote.tax_rate || "0"),
        taxAmount: parseFloat(quote.tax_amount || "0"),
        client: {
          name: quote.client_name,
          companyName: quote.company_name,
          email: quote.client_email,
          phone: quote.client_phone,
          address: quote.client_address,
        },
        request: quote.request_number
          ? {
              requestNumber: quote.request_number,
              service: { name: quote.service_name, description: quote.service_description },
            }
          : null,
        notes: quote.notes,
        organization,
      };

      const puppeteer = require("puppeteer");
      const { InvoiceTemplateGenerator } = require("../../shared/invoice-template-generator");

      try {
        const html = InvoiceTemplateGenerator.generateQuoteHTML(quoteData);
        const browser = await puppeteer.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        });

        let pdfBuffer: Buffer;
        try {
          const page = await browser.newPage();
          await page.setContent(html, { waitUntil: "networkidle0" });
          pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: { top: "20mm", right: "20mm", bottom: "20mm", left: "20mm" },
          });
        } finally {
          await browser.close();
        }

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="quote-${quote.quote_no}.pdf"`);
        res.setHeader("Content-Length", pdfBuffer.length);
        return res.end(pdfBuffer, "binary");
      } catch (pdfError) {
        console.error("Quote PDF generation error:", pdfError);
        return res
          .status(500)
          .json(new ServerResponse(false, null, "Failed to generate PDF. Please try again later."));
      }
    } catch (error) {
      console.error("Error downloading quote:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to download quote"));
    }
  }
}
