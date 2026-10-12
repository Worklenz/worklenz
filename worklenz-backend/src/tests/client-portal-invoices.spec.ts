jest.mock("../config/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

jest.mock("../services/token-service", () => ({
  __esModule: true,
  default: {},
}));

jest.mock("../shared/email", () => ({
  __esModule: true,
  sendEmail: jest.fn(),
  sendEmailEnhanced: jest.fn(),
  EmailRequest: jest.fn(),
}));

jest.mock("../shared/storage", () => ({
  __esModule: true,
  uploadBase64: jest.fn(async () => "https://files.example.com/proof.png"),
  getClientPortalStorageKey: jest.fn(() => "test/proof.png"),
  generateUniqueFilename: jest.fn(() => "proof_1.png"),
}));

import db from "../config/db";
import ClientPortalInvoicesController from "../controllers/client-portal/client-portal-invoices-controller";
import {
  buildInvoiceOrderBy,
  computeInvoiceTotals,
  isInvoiceableRequestStatus,
  normalizeLineItems,
  parseOptionalDate,
  parseTaxAndDiscount,
  resolvePayment,
  validatePaymentProof,
} from "../controllers/client-portal/client-portal-invoice-helpers";
import { createMockRequest, createMockResponse } from "./utils/express-mock";
import { createQueryResult } from "./utils/db-mock";

const mockedQuery = db.query as jest.Mock;
const mockedConnect = db.connect as jest.Mock;

const INVOICE_ID = "33333333-3333-4333-8333-333333333333";
const CLIENT_ID = "22222222-2222-4222-8222-222222222222";
const REQUEST_ID = "44444444-4444-4444-8444-444444444444";

/** A pooled client whose statements are answered by `answer` and recorded in `calls`. */
const mockTransaction = (answer: (sql: string, params?: unknown[]) => unknown[] = () => []) => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const client = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      calls.push({ sql: String(sql), params });
      return createQueryResult(answer(String(sql), params) as any[]);
    }),
    release: jest.fn(),
  };
  mockedConnect.mockResolvedValue(client);
  return { client, calls };
};

const sqlOf = (calls: Array<{ sql: string }>) => calls.map(c => c.sql.replace(/\s+/g, " ").trim());

beforeEach(() => {
  mockedQuery.mockReset();
  mockedConnect.mockReset();
});

describe("invoice helpers", () => {
  describe("normalizeLineItems", () => {
    it("recomputes each amount from quantity x rate and ignores a client-sent amount", () => {
      const result = normalizeLineItems([
        { description: " Design ", quantity: 2, rate: 1000, amount: 1 },
      ]);
      expect(result.items).toEqual([
        { description: "Design", quantity: 2, rate: 1000, amount: 2000 },
      ]);
    });

    it.each([
      ["empty", []],
      ["not an array", "nope"],
      ["missing description", [{ description: "  ", quantity: 1, rate: 5 }]],
      ["negative rate", [{ description: "x", quantity: 1, rate: -5 }]],
      ["NaN quantity", [{ description: "x", quantity: "abc", rate: 5 }]],
      ["all zero amounts", [{ description: "x", quantity: 0, rate: 5 }]],
    ])("rejects %s", (_label, input) => {
      expect(normalizeLineItems(input).error).toBeDefined();
    });
  });

  describe("computeInvoiceTotals", () => {
    const items = [{ amount: 2000 }, { amount: 500.5 }];

    it("applies a percentage discount before tax", () => {
      expect(computeInvoiceTotals(items, "percentage", 10, 10)).toEqual({
        subtotal: 2500.5,
        discountAmount: 250.05,
        taxAmount: 225.05,
        total: 2475.5,
      });
    });

    it("never lets a flat discount exceed the subtotal", () => {
      const totals = computeInvoiceTotals(items, "fixed", 99999, 20);
      expect(totals.discountAmount).toBe(2500.5);
      expect(totals.total).toBe(0);
    });
  });

  describe("parseTaxAndDiscount", () => {
    it("defaults to no tax and no discount", () => {
      expect(parseTaxAndDiscount({})).toEqual({
        taxRate: 0,
        discountType: "percentage",
        discountValue: 0,
      });
    });

    it.each([
      [{ taxRate: 101 }],
      [{ taxRate: -1 }],
      [{ discountValue: -5 }],
      [{ discountType: "bogus" }],
      [{ discountType: "percentage", discountValue: 150 }],
    ])("rejects %j", body => {
      expect(parseTaxAndDiscount(body).error).toBeDefined();
    });
  });

  describe("resolvePayment", () => {
    it("locks Paid to the full amount", () => {
      expect(resolvePayment("paid", 9300, 4000)).toEqual({ paymentStatus: "paid", paidAmount: 9300 });
    });

    it("clears the amount for Unpaid", () => {
      expect(resolvePayment("unpaid", 9300, 4000)).toEqual({ paymentStatus: "unpaid", paidAmount: 0 });
    });

    it("keeps a partial amount", () => {
      expect(resolvePayment("partially_paid", 9300, 4000)).toEqual({
        paymentStatus: "partially_paid",
        paidAmount: 4000,
      });
    });

    it("clamps a negative or missing partial amount to zero", () => {
      expect(resolvePayment("partially_paid", 9300, -5).paidAmount).toBe(0);
      expect(resolvePayment("partially_paid", 9300, undefined).paidAmount).toBe(0);
    });

    it("treats a partial payment that covers the whole invoice as Paid", () => {
      expect(resolvePayment("partially_paid", 9300, 20000)).toEqual({
        paymentStatus: "paid",
        paidAmount: 9300,
      });
    });
  });

  it("parses optional dates", () => {
    expect(parseOptionalDate(undefined)).toBeNull();
    expect(parseOptionalDate("")).toBeNull();
    expect(parseOptionalDate("2026-09-30")).toBe("2026-09-30");
    expect(parseOptionalDate("2026-09-30T10:00:00.000Z")).toBe("2026-09-30");
    expect(parseOptionalDate("2026-02-31")).toBeUndefined();
    expect(parseOptionalDate("tomorrow")).toBeUndefined();
    expect(parseOptionalDate(20260930)).toBeUndefined();
  });

  it("allows custom request statuses but not pending or rejected ones", () => {
    expect(isInvoiceableRequestStatus("accepted")).toBe(true);
    expect(isInvoiceableRequestStatus("in_progress")).toBe(true);
    expect(isInvoiceableRequestStatus("Awaiting deposit")).toBe(true);
    expect(isInvoiceableRequestStatus("pending")).toBe(false);
    expect(isInvoiceableRequestStatus("rejected")).toBe(false);
  });

  it("only sorts by whitelisted columns", () => {
    expect(buildInvoiceOrderBy("amount", "asc")).toContain("i.amount ASC");
    expect(buildInvoiceOrderBy("client_name", "desc")).toContain("c.name DESC");
    const injected = buildInvoiceOrderBy("amount; DROP TABLE clients", "asc; --");
    expect(injected).toContain("i.created_at DESC");
    expect(injected).not.toContain("DROP");
  });

  describe("validatePaymentProof", () => {
    it("accepts an image or PDF data URL", () => {
      expect(validatePaymentProof({ fileData: "data:image/png;base64,AAAA" })).toBeNull();
      expect(validatePaymentProof({ fileData: "data:application/pdf;base64,AAAA" })).toBeNull();
    });

    it("rejects other types, non data URLs and oversize files", () => {
      expect(validatePaymentProof({ fileData: "data:text/html;base64,AAAA" })).toMatch(/image or a PDF/);
      expect(validatePaymentProof({ fileData: "AAAA" })).toMatch(/data URL/);
      const huge = `data:image/png;base64,${"A".repeat(15 * 1024 * 1024)}`;
      expect(validatePaymentProof({ fileData: huge })).toMatch(/10 MB/);
    });
  });
});

describe("ClientPortalInvoicesController.recordPayment", () => {
  const invoiceRow = {
    id: INVOICE_ID,
    invoice_no: "INV-047",
    status: "sent",
    payment_status: "unpaid",
    amount: "9300.00",
    client_id: CLIENT_ID,
  };
  const updatedRow = (over: Record<string, unknown> = {}) => ({
    id: INVOICE_ID,
    invoice_no: "INV-047",
    amount: "9300.00",
    currency: "USD",
    status: "sent",
    payment_status: "partially_paid",
    paid_amount: "4000.00",
    paid_at: "2026-09-29T00:00:00.000Z",
    updated_at: "2026-09-29T00:00:00.000Z",
    payment_proof_url: null,
    ...over,
  });

  const record = async (body: Record<string, unknown>, existing = invoiceRow, updated = updatedRow()) => {
    mockedQuery
      .mockResolvedValueOnce(createQueryResult([existing]))
      .mockResolvedValueOnce(createQueryResult([updated]));
    const res = createMockResponse();
    await ClientPortalInvoicesController.recordPayment(
      createMockRequest({ params: { id: INVOICE_ID }, body }),
      res
    );
    return res;
  };

  it("rejects an unknown payment status without touching the database", async () => {
    const res = createMockResponse();
    await ClientPortalInvoicesController.recordPayment(
      createMockRequest({ params: { id: INVOICE_ID }, body: { paymentStatus: "settled" } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("returns 404 for an invoice that is not this team's", async () => {
    mockedQuery.mockResolvedValueOnce(createQueryResult([]));
    const res = createMockResponse();
    await ClientPortalInvoicesController.recordPayment(
      createMockRequest({ params: { id: INVOICE_ID }, body: { paymentStatus: "paid" } }),
      res
    );

    expect(res.statusCode).toBe(404);
    expect(mockedQuery.mock.calls[0][1]).toEqual([INVOICE_ID, "team-123"]);
  });

  it("stores a partial payment as entered", async () => {
    await record({ paymentStatus: "partially_paid", paidAmount: 4000 });

    const [, params] = mockedQuery.mock.calls[1];
    expect(params).toEqual([INVOICE_ID, "partially_paid", 4000, null]);
  });

  it("clamps a partial payment above the invoice amount and records it as Paid", async () => {
    await record({ paymentStatus: "partially_paid", paidAmount: 999999 }, invoiceRow, updatedRow({
      payment_status: "paid",
      paid_amount: "9300.00",
    }));

    const [, params] = mockedQuery.mock.calls[1];
    expect(params).toEqual([INVOICE_ID, "paid", 9300, null]);
  });

  it("locks Paid to the full amount regardless of what was sent", async () => {
    await record({ paymentStatus: "paid", paidAmount: 1 });

    expect(mockedQuery.mock.calls[1][1]).toEqual([INVOICE_ID, "paid", 9300, null]);
  });

  it("clears the amount and the paid time when set back to Unpaid", async () => {
    await record({ paymentStatus: "unpaid", paidAmount: 4000 }, { ...invoiceRow, payment_status: "partially_paid" });

    const [sql, params] = mockedQuery.mock.calls[1];
    expect(params).toEqual([INVOICE_ID, "unpaid", 0, null]);
    expect(String(sql)).toContain("WHEN $2 = 'unpaid' THEN NULL");
  });

  it("uploads an attached proof and saves its URL", async () => {
    await record({
      paymentStatus: "paid",
      proof: { fileName: "receipt.png", fileType: "image/png", fileData: "data:image/png;base64,AAAA" },
    });

    expect(mockedQuery.mock.calls[1][1][3]).toBe("https://files.example.com/proof.png");
  });

  it("rejects an unsupported proof file before saving anything", async () => {
    mockedQuery.mockResolvedValueOnce(createQueryResult([invoiceRow]));
    const res = createMockResponse();
    await ClientPortalInvoicesController.recordPayment(
      createMockRequest({
        params: { id: INVOICE_ID },
        body: { paymentStatus: "paid", proof: { fileName: "x.html", fileData: "data:text/html;base64,AAAA" } },
      }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(mockedQuery).toHaveBeenCalledTimes(1);
  });
});

describe("ClientPortalInvoicesController.duplicateInvoice", () => {
  const original = {
    id: INVOICE_ID,
    request_id: REQUEST_ID,
    client_id: CLIENT_ID,
    amount: "9300.00",
    currency: "USD",
    notes: "Net 30",
    tax_rate: "10",
    tax_amount: "845.45",
    discount_type: "percentage",
    discount_value: "10",
    discount_amount: "930",
    subtotal: "9300",
    project_name: "Retainer",
    status: "sent",
    payment_status: "paid",
    paid_amount: "9300.00",
    due_date: "2026-09-01",
    client_snapshot_name: "Old Name",
  };

  it("copies the invoice as an unpaid draft with its lines, and commits", async () => {
    const { calls } = mockTransaction((sql: string) => {
      if (sql.includes("SELECT * FROM client_portal_invoices")) return [original];
      if (sql.includes("FROM clients c")) return [{ snapshot_name: "New Name", snapshot_company_name: "New Co" }];
      if (sql.includes("RETURNING id, invoice_no")) return [{ id: "new-id", invoice_no: "INV-NEW" }];
      return [];
    });
    const res = createMockResponse();

    await ClientPortalInvoicesController.duplicateInvoice(
      createMockRequest({ params: { id: INVOICE_ID } }),
      res
    );

    // The copy is a new document: it snapshots the client as they are now, not the original's.
    const copyInsert = calls.find(c => c.sql.includes("INSERT INTO client_portal_invoices"))!;
    expect(copyInsert.params).toEqual(expect.arrayContaining(["New Name", "New Co"]));
    expect(copyInsert.params).not.toContain("Old Name");

    const statements = sqlOf(calls);
    const insert = statements.find(sql => sql.startsWith("INSERT INTO client_portal_invoices"))!;
    // Fresh state: draft, unpaid, nothing paid, no due date, not sent, not paid.
    expect(insert).toContain("'draft', 'unpaid', 0, NULL");
    expect(insert).toContain("NULL, NULL, NOW(), NOW()");
    expect(statements.some(sql => sql.includes("INSERT INTO client_portal_invoice_line_items"))).toBe(true);
    expect(statements[statements.length - 1]).toBe("COMMIT");
    expect(res.body.body).toEqual({ id: "new-id", invoiceNumber: "INV-NEW" });

    // Carries over client, request, amount, notes, tax/discount and project name.
    const insertParams = calls.find(c => c.sql.includes("INSERT INTO client_portal_invoices"))!.params!;
    expect(insertParams).toEqual(
      expect.arrayContaining([REQUEST_ID, CLIENT_ID, "9300.00", "Net 30", "Retainer"])
    );
  });

  it("rolls back and returns 404 for an invoice that is not this team's", async () => {
    const { calls } = mockTransaction(() => []);
    const res = createMockResponse();

    await ClientPortalInvoicesController.duplicateInvoice(
      createMockRequest({ params: { id: INVOICE_ID } }),
      res
    );

    expect(res.statusCode).toBe(404);
    expect(sqlOf(calls)).toContain("ROLLBACK");
    expect(sqlOf(calls)).not.toContain("COMMIT");
  });
});

describe("ClientPortalInvoicesController.createInvoice", () => {
  const goodLines = [{ description: "Retainer", quantity: 2, rate: 1000, amount: 1 }];

  const create = async (body: Record<string, unknown>) => {
    const res = createMockResponse();
    await ClientPortalInvoicesController.createInvoice(createMockRequest({ body }), res);
    return res;
  };

  it("creates a standalone invoice for a client, computing totals on the server", async () => {
    mockedQuery.mockResolvedValueOnce(createQueryResult([{ id: CLIENT_ID, name: "TechFlow Inc" }]));
    const { calls } = mockTransaction((sql: string) =>
      sql.startsWith("\n        INSERT INTO client_portal_invoices") || sql.includes("INSERT INTO client_portal_invoices")
        ? [{ id: INVOICE_ID, invoice_no: "INV-1", amount: "2200", currency: "USD", status: "draft",
             payment_status: "unpaid", paid_amount: "0", tax_rate: "10", tax_amount: "200",
             discount_type: "percentage", discount_value: "0", discount_amount: "0", subtotal: "2000" }]
        : []
    );

    const res = await create({
      clientId: CLIENT_ID,
      amount: 1, // ignored: the lines decide the total
      lineItems: goodLines,
      taxRate: 10,
    });

    const insert = calls.find(c => c.sql.includes("INSERT INTO client_portal_invoices"))!;
    // request_id null, amount 2200 (= 2 x 1000 + 10% tax), status draft, tax 200, subtotal 2000.
    expect(insert.params![1]).toBeNull();
    expect(insert.params![4]).toBe(2200);
    expect(insert.params![6]).toBe("draft");
    expect(insert.params![11]).toBe(10);
    expect(insert.params![12]).toBe(200);
    expect(insert.params![16]).toBe(2000);
    expect(sqlOf(calls)).toContain("COMMIT");
    expect(res.body.done).toBe(true);
    expect(res.body.body.clientName).toBe("TechFlow Inc");
  });

  it("stores the client's details on the invoice as they are at creation", async () => {
    mockedQuery.mockResolvedValueOnce(
      createQueryResult([
        {
          id: CLIENT_ID,
          name: "Acme",
          snapshot_name: "Acme",
          snapshot_company_name: "Acme Ltd",
          snapshot_email: "billing@acme.test",
          snapshot_phone: "+94 11 000 0000",
          snapshot_address: "1 Main St",
          snapshot_contact_person: "Ann",
        },
      ])
    );
    const { calls } = mockTransaction((sql: string) =>
      sql.includes("INSERT INTO client_portal_invoices")
        ? [{ id: INVOICE_ID, invoice_no: "INV-1", amount: "2000", currency: "USD", status: "draft", payment_status: "unpaid" }]
        : []
    );

    await create({ clientId: CLIENT_ID, lineItems: goodLines });

    const insert = calls.find(c => c.sql.includes("INSERT INTO client_portal_invoices"))!;
    expect(insert.sql).toContain("client_snapshot_name");
    expect(insert.params!.slice(-6)).toEqual([
      "Acme",
      "Acme Ltd",
      "billing@acme.test",
      "+94 11 000 0000",
      "1 Main St",
      "Ann",
    ]);
  });

  it("requires a request or a client", async () => {
    const res = await create({ lineItems: goodLines });
    expect(res.statusCode).toBe(400);
    expect(mockedConnect).not.toHaveBeenCalled();
  });

  it("refuses a request that is still pending", async () => {
    mockedQuery.mockResolvedValueOnce(
      createQueryResult([{ id: REQUEST_ID, client_id: CLIENT_ID, status: "pending", client_name: "X", service_name: "Y" }])
    );

    const res = await create({ requestId: REQUEST_ID, lineItems: goodLines });

    expect(res.statusCode).toBe(400);
    expect(mockedConnect).not.toHaveBeenCalled();
  });

  it("accepts a request with a custom status", async () => {
    mockedQuery.mockResolvedValueOnce(
      createQueryResult([{ id: REQUEST_ID, client_id: CLIENT_ID, status: "Awaiting deposit", client_name: "X", service_name: "Y" }])
    );
    mockTransaction((sql: string) =>
      sql.includes("INSERT INTO client_portal_invoices")
        ? [{ id: INVOICE_ID, invoice_no: "INV-1", amount: "2000", currency: "USD", status: "draft", payment_status: "unpaid" }]
        : []
    );

    const res = await create({ requestId: REQUEST_ID, lineItems: goodLines });

    expect(res.body.done).toBe(true);
  });

  it("rejects a client that belongs to another team", async () => {
    mockedQuery.mockResolvedValueOnce(createQueryResult([]));

    const res = await create({ clientId: CLIENT_ID, lineItems: goodLines });

    expect(res.statusCode).toBe(404);
    expect(mockedQuery.mock.calls[0][1]).toEqual([CLIENT_ID, "team-123"]);
  });

  it.each([
    ["no line items", { clientId: CLIENT_ID }],
    ["a zero total", { clientId: CLIENT_ID, lineItems: [{ description: "x", quantity: 1, rate: 100 }], discountType: "fixed", discountValue: 100 }],
    ["an invalid status", { clientId: CLIENT_ID, lineItems: goodLines, status: "paid" }],
    ["an invalid due date", { clientId: CLIENT_ID, lineItems: goodLines, dueDate: "soon" }],
  ])("returns 400 for %s and writes nothing", async (_label, body) => {
    const res = await create(body);

    expect(res.statusCode).toBe(400);
    expect(mockedConnect).not.toHaveBeenCalled();
  });
});

describe("ClientPortalInvoicesController.updateInvoice", () => {
  const current = (over: Record<string, unknown> = {}) => ({
    id: INVOICE_ID,
    status: "sent",
    payment_status: "unpaid",
    amount: "1000",
    tax_rate: "0",
    discount_type: "percentage",
    discount_value: "0",
    ...over,
  });

  const update = async (body: Record<string, unknown>, existing = current(), req: any = null) => {
    mockedQuery.mockResolvedValueOnce(createQueryResult([existing]));
    const tx = mockTransaction((sql: string) => (sql.includes("UPDATE client_portal_invoices") ? [{ id: INVOICE_ID }] : []));
    const res = createMockResponse();
    await ClientPortalInvoicesController.updateInvoice(
      req ?? createMockRequest({ params: { id: INVOICE_ID }, body }),
      res
    );
    return { res, ...tx };
  };

  it("lets the list change only the status of a paid invoice", async () => {
    const { res, calls } = await update({ status: "pending" }, current({ payment_status: "paid" }));

    expect(res.statusCode).toBe(200);
    const updateCall = calls.find(c => c.sql.includes("UPDATE client_portal_invoices"))!;
    expect(updateCall.sql).toContain("status = $1");
    expect(updateCall.params![0]).toBe("pending");
  });

  it("refuses to edit the content of a paid invoice", async () => {
    const { res } = await update({ notes: "changed" }, current({ payment_status: "paid" }));

    expect(res.statusCode).toBe(400);
    expect(mockedConnect).not.toHaveBeenCalled();
  });

  it("does not let 'paid' be set as a status", async () => {
    const { res } = await update({ status: "paid" });

    expect(res.statusCode).toBe(400);
  });

  it("does not let a client change an invoice's status", async () => {
    const req = createMockRequest({ params: { id: INVOICE_ID }, body: { status: "sent" } });
    req.clientId = CLIENT_ID;
    req.organizationId = "team-123";
    const { res } = await update({}, current(), req);

    expect(res.statusCode).toBe(403);
  });

  it("replaces the lines, recomputes the total and keeps paid within it", async () => {
    const { res, calls } = await update({
      lineItems: [{ description: "Reduced scope", quantity: 1, rate: 500 }],
    });

    expect(res.statusCode).toBe(200);
    const statements = sqlOf(calls);
    const updateCall = calls.find(c => c.sql.includes("UPDATE client_portal_invoices"))!;
    expect(updateCall.params).toEqual(expect.arrayContaining([500]));
    expect(updateCall.sql).toContain("paid_amount = LEAST(paid_amount,");
    expect(statements).toContain("DELETE FROM client_portal_invoice_line_items WHERE invoice_id = $1");
    expect(statements.some(sql => sql.includes("INSERT INTO client_portal_invoice_line_items"))).toBe(true);
    expect(statements[statements.length - 1]).toBe("COMMIT");
  });
});

describe("ClientPortalInvoicesController.deleteInvoice", () => {
  const remove = async (paymentStatus: string) => {
    mockedQuery.mockResolvedValueOnce(createQueryResult([{ id: INVOICE_ID, payment_status: paymentStatus }]));
    mockedQuery.mockResolvedValueOnce(createQueryResult([]));
    const res = createMockResponse();
    await ClientPortalInvoicesController.deleteInvoice(
      createMockRequest({ params: { id: INVOICE_ID } }),
      res
    );
    return res;
  };

  it("deletes an unpaid invoice", async () => {
    const res = await remove("unpaid");

    expect(res.body.done).toBe(true);
    expect(mockedQuery).toHaveBeenCalledTimes(2);
  });

  it.each(["partially_paid", "paid"])("refuses to delete a %s invoice", async status => {
    const res = await remove(status);

    expect(res.statusCode).toBe(400);
    expect(mockedQuery).toHaveBeenCalledTimes(1);
  });
});

describe("ClientPortalInvoicesController.getOrganizationInvoices", () => {
  const list = async (query: Record<string, unknown> = {}) => {
    mockedQuery.mockImplementation(async (sql: string) =>
      createQueryResult(
        /COUNT\(\*\)::int AS total/.test(String(sql))
          ? [{ total: 2, total_invoiced: "12000", total_paid: "4000" }]
          : [
              {
                id: INVOICE_ID,
                invoice_no: "INV-047",
                amount: "9300",
                currency: "USD",
                status: "sent",
                payment_status: "partially_paid",
                paid_amount: "4000",
                project_name: "Retainer",
                client_id: CLIENT_ID,
                client_name: "TechFlow Inc",
                is_overdue: true,
              },
            ]
      )
    );
    const res = createMockResponse();
    await ClientPortalInvoicesController.getOrganizationInvoices(createMockRequest({ query }), res);
    return res;
  };

  it("returns payment fields and org-wide totals that reconcile", async () => {
    const res = await list();

    expect(res.body.body.total).toBe(2);
    expect(res.body.body.totals).toEqual({
      totalInvoiced: 12000,
      totalPaid: 4000,
      totalOutstanding: 8000,
    });
    expect(res.body.body.invoices[0]).toMatchObject({
      paymentStatus: "partially_paid",
      paidAmount: 4000,
      projectName: "Retainer",
      isOverdue: true,
    });
  });

  it("uses one WHERE for the rows and the totals, with the payment-status filter", async () => {
    await list({ paymentStatus: "partially_paid", status: "sent", search: "50%_off" });

    const [totalsSql, totalsParams] = mockedQuery.mock.calls.find(([sql]) => /COUNT\(\*\)::int/.test(String(sql)))!;
    const [listSql, listParams] = mockedQuery.mock.calls.find(([sql]) => /ORDER BY/.test(String(sql)))!;
    expect(String(totalsSql)).toContain("i.payment_status = $3");
    expect(String(listSql)).toContain("i.payment_status = $3");
    expect(totalsParams).toEqual(["team-123", "sent", "partially_paid", "%50\\%\\_off%"]);
    // The list adds only LIMIT and OFFSET on top of the shared filter params.
    expect(listParams).toEqual([...totalsParams, 10, 0]);
  });

  it("rejects an unknown payment-status filter", async () => {
    const res = createMockResponse();
    await ClientPortalInvoicesController.getOrganizationInvoices(
      createMockRequest({ query: { paymentStatus: "bogus" } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("caps the page size and never sorts by an unlisted column", async () => {
    await list({ limit: "100000", sortBy: "amount; DROP TABLE clients" });

    const [listSql, listParams] = mockedQuery.mock.calls.find(([sql]) => /ORDER BY/.test(String(sql)))!;
    expect(listParams.slice(-2)).toEqual([100, 0]);
    expect(String(listSql)).toContain("ORDER BY i.created_at DESC");
    expect(String(listSql)).not.toContain("DROP");
  });
});
