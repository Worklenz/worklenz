jest.mock("../config/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

import db from "../config/db";
import ClientPortalQuotesController from "../controllers/client-portal/client-portal-quotes-controller";
import {
  buildQuoteOrderBy,
  generateQuoteNumber,
  isNewQuoteStatus,
  isQuoteStatus,
} from "../controllers/client-portal/client-portal-quote-helpers";
import { InvoiceTemplateGenerator } from "../shared/invoice-template-generator";
import { createMockRequest, createMockResponse } from "./utils/express-mock";
import { createQueryResult } from "./utils/db-mock";

const mockedQuery = db.query as jest.Mock;
const mockedConnect = db.connect as jest.Mock;

const QUOTE_ID = "33333333-3333-4333-8333-333333333333";
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

describe("quote helpers", () => {
  it("knows the five staff-managed statuses", () => {
    for (const status of ["draft", "sent", "accepted", "declined", "expired"]) {
      expect(isQuoteStatus(status)).toBe(true);
    }
    expect(isQuoteStatus("paid")).toBe(false);
    expect(isQuoteStatus(undefined)).toBe(false);
  });

  it("lets a new quote start only as draft or sent", () => {
    expect(isNewQuoteStatus("draft")).toBe(true);
    expect(isNewQuoteStatus("sent")).toBe(true);
    expect(isNewQuoteStatus("accepted")).toBe(false);
  });

  it("numbers quotes QUO-...", () => {
    expect(generateQuoteNumber()).toMatch(/^QUO-\d+-[A-Z0-9]+$/);
  });

  it("never sorts by an unlisted column", () => {
    expect(buildQuoteOrderBy("1; DROP TABLE x", "asc")).toMatch(/^q\.created_at ASC/);
    expect(buildQuoteOrderBy("valid_until", "desc")).toMatch(/^q\.valid_until DESC/);
  });
});

describe("InvoiceTemplateGenerator.generateQuoteHTML", () => {
  const base = {
    invoiceNumber: "QUO-1",
    status: "expired",
    createdAt: "2026-03-02T00:00:00Z",
    dueDate: "2026-03-16",
    amount: 100,
    currency: "USD",
    isOverdue: true,
    client: { name: "Acme" },
  };

  it("uses quote labels", () => {
    const html = InvoiceTemplateGenerator.generateQuoteHTML(base);
    expect(html).toContain("<h2>QUOTE</h2>");
    expect(html).toContain("PREPARED FOR");
    expect(html).toContain("Valid Until");
    expect(html).toContain("Expired");
    expect(html).not.toContain("BILLED TO");
  });

  it("leaves the invoice wording unchanged", () => {
    const html = InvoiceTemplateGenerator.generateInvoiceHTML({ ...base, status: "sent", isOverdue: false });
    expect(html).toContain("<h2>INVOICE</h2>");
    expect(html).toContain("BILLED TO");
    expect(html).toContain("Due Date");
  });
});

describe("ClientPortalQuotesController.createQuote", () => {
  const goodLines = [{ description: "Design", quantity: 2, rate: 1000 }];

  const create = async (body: Record<string, unknown>) => {
    const res = createMockResponse();
    await ClientPortalQuotesController.createQuote(createMockRequest({ body }), res);
    return res;
  };

  it("creates a standalone quote, computing totals on the server", async () => {
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
      sql.includes("INSERT INTO client_portal_quotes")
        ? [{ id: QUOTE_ID, quote_no: "QUO-1", amount: "1800", currency: "USD", status: "draft", subtotal: "2000" }]
        : []
    );

    const res = await create({
      clientId: CLIENT_ID,
      lineItems: goodLines,
      discountType: "percentage",
      discountValue: 10,
      amount: 1,
    });

    expect(res.body.done).toBe(true);
    const statements = sqlOf(calls);
    expect(statements[0]).toBe("BEGIN");
    expect(statements.some(s => s.includes("INSERT INTO client_portal_quote_line_items"))).toBe(true);
    expect(statements[statements.length - 1]).toBe("COMMIT");

    const insert = calls.find(c => c.sql.includes("INSERT INTO client_portal_quotes"))!;
    // subtotal 2000, 10% discount => 1800 total; a client-sent amount is ignored
    expect(insert.params).toEqual(expect.arrayContaining([2000, 200, 1800]));
    expect(insert.params).not.toContain(1);
  });

  it("stores the client's details on the quote as they are at creation", async () => {
    mockedQuery.mockResolvedValueOnce(
      createQueryResult([
        {
          id: CLIENT_ID,
          name: "Acme",
          snapshot_name: "Acme",
          snapshot_company_name: "Acme Ltd",
          snapshot_email: "billing@acme.test",
          snapshot_phone: " ",
          snapshot_address: "1 Main St",
          snapshot_contact_person: "Ann",
        },
      ])
    );
    const { calls } = mockTransaction((sql: string) =>
      sql.includes("INSERT INTO client_portal_quotes")
        ? [{ id: QUOTE_ID, quote_no: "QUO-1", amount: "2000", currency: "USD", status: "draft" }]
        : []
    );

    await create({ clientId: CLIENT_ID, lineItems: goodLines });

    const insert = calls.find(c => c.sql.includes("INSERT INTO client_portal_quotes"))!;
    expect(insert.sql).toContain("client_snapshot_name");
    // The six snapshot values are the last parameters, a blank one is stored as null.
    expect(insert.params!.slice(-6)).toEqual([
      "Acme",
      "Acme Ltd",
      "billing@acme.test",
      null,
      "1 Main St",
      "Ann",
    ]);
  });

  it("requires a request or a client", async () => {
    const res = await create({ lineItems: goodLines });
    expect(res.statusCode).toBe(400);
    expect(mockedConnect).not.toHaveBeenCalled();
  });

  it("refuses a request that is still pending, and one that was rejected", async () => {
    for (const status of ["pending", "rejected"]) {
      mockedQuery.mockResolvedValueOnce(
        createQueryResult([{ id: REQUEST_ID, client_id: CLIENT_ID, status, client_name: "X", service_name: "Y" }])
      );
      const res = await create({ requestId: REQUEST_ID, lineItems: goodLines });
      expect(res.statusCode).toBe(400);
    }
    expect(mockedConnect).not.toHaveBeenCalled();
  });

  it("accepts an accepted request and a request with a custom status", async () => {
    for (const status of ["accepted", "Awaiting deposit"]) {
      mockedQuery.mockResolvedValueOnce(
        createQueryResult([{ id: REQUEST_ID, client_id: CLIENT_ID, status, client_name: "X", service_name: "Y" }])
      );
      mockTransaction((sql: string) =>
        sql.includes("INSERT INTO client_portal_quotes")
          ? [{ id: QUOTE_ID, quote_no: "QUO-1", amount: "2000", currency: "USD", status: "draft" }]
          : []
      );
      const res = await create({ requestId: REQUEST_ID, lineItems: goodLines });
      expect(res.body.done).toBe(true);
    }
  });

  it("rejects a client that belongs to another team", async () => {
    mockedQuery.mockResolvedValueOnce(createQueryResult([]));
    const res = await create({ clientId: CLIENT_ID, lineItems: goodLines });
    expect(res.statusCode).toBe(404);
    expect(mockedQuery.mock.calls[0][1]).toEqual([CLIENT_ID, "team-123"]);
  });

  it.each([
    ["no line items", { clientId: CLIENT_ID }],
    ["a zero total", { clientId: CLIENT_ID, lineItems: goodLines, discountType: "fixed", discountValue: 2000 }],
    ["an accepted status", { clientId: CLIENT_ID, lineItems: goodLines, status: "accepted" }],
    ["an invalid valid-until date", { clientId: CLIENT_ID, lineItems: goodLines, validUntil: "soon" }],
  ])("returns 400 for %s and writes nothing", async (_label, body) => {
    const res = await create(body);
    expect(res.statusCode).toBe(400);
    expect(mockedConnect).not.toHaveBeenCalled();
  });
});

describe("ClientPortalQuotesController.duplicateQuote", () => {
  const original = {
    id: QUOTE_ID,
    quote_no: "QUO-OLD",
    request_id: REQUEST_ID,
    client_id: CLIENT_ID,
    status: "accepted",
    currency: "USD",
    project_name: "Landing page",
    notes: "Approved by client",
    valid_until: "2026-03-24",
    subtotal: "600",
    tax_rate: "0",
    tax_amount: "0",
    discount_type: "percentage",
    discount_value: "0",
    discount_amount: "0",
    amount: "600",
    created_at: "2026-03-10",
    client_snapshot_name: "Old Name",
    client_snapshot_company_name: "Old Co",
  };

  const duplicate = async (currentClient: unknown[] = [{ snapshot_name: "New Name", snapshot_company_name: "New Co" }]) => {
    const tx = mockTransaction((sql: string) => {
      if (sql.includes("SELECT * FROM client_portal_quotes")) return [original];
      if (sql.includes("FROM clients c")) return currentClient;
      if (sql.includes("INSERT INTO client_portal_quotes")) return [{ id: "new-id", quote_no: "QUO-NEW" }];
      return [];
    });
    const res = createMockResponse();
    await ClientPortalQuotesController.duplicateQuote(createMockRequest({ params: { id: QUOTE_ID } }), res);
    return { res, ...tx };
  };

  it("copies the quote as a draft issued now, keeping Valid Until, lines, client and notes", async () => {
    const { res, calls } = await duplicate();

    expect(res.body.done).toBe(true);
    const insert = calls.find(c => c.sql.includes("INSERT INTO client_portal_quotes"))!;
    const sql = insert.sql.replace(/\s+/g, " ");
    // status and created_at are literals in the statement, never taken from the original
    expect(sql).toContain("'draft'");
    expect(sql).toContain("NOW(), NOW()");
    expect(insert.params).not.toContain("accepted");
    expect(insert.params).not.toContain("2026-03-10");
    expect(insert.params).toEqual(expect.arrayContaining(["2026-03-24", "Approved by client", CLIENT_ID]));
    expect(sqlOf(calls)).toContain("COMMIT");
  });

  it("snapshots the client as they are now, not as the original quote had them", async () => {
    const { calls } = await duplicate();

    const insert = calls.find(c => c.sql.includes("INSERT INTO client_portal_quotes"))!;
    expect(insert.params).toEqual(expect.arrayContaining(["New Name", "New Co"]));
    expect(insert.params).not.toContain("Old Name");
  });

  it("falls back to the original's snapshot when the client can no longer be read", async () => {
    const { calls } = await duplicate([]);

    const insert = calls.find(c => c.sql.includes("INSERT INTO client_portal_quotes"))!;
    expect(insert.params).toEqual(expect.arrayContaining(["Old Name", "Old Co"]));
  });

  it("rolls back and returns 404 for a quote that is not this team's", async () => {
    const { calls } = mockTransaction(() => []);
    const res = createMockResponse();
    await ClientPortalQuotesController.duplicateQuote(createMockRequest({ params: { id: QUOTE_ID } }), res);

    expect(res.statusCode).toBe(404);
    expect(sqlOf(calls)).toContain("ROLLBACK");
  });
});

describe("ClientPortalQuotesController.deleteQuote", () => {
  const remove = async (rows: unknown[]) => {
    mockedQuery.mockResolvedValueOnce(createQueryResult(rows as any[]));
    const res = createMockResponse();
    await ClientPortalQuotesController.deleteQuote(createMockRequest({ params: { id: QUOTE_ID } }), res);
    return res;
  };

  it("deletes a quote of any status, scoped to the team, and leaves the client alone", async () => {
    const res = await remove([{ id: QUOTE_ID }]);

    expect(res.body.done).toBe(true);
    const [sql, params] = mockedQuery.mock.calls[0];
    expect(sql).toContain("DELETE FROM client_portal_quotes");
    expect(sql).not.toMatch(/clients/);
    expect(params).toEqual([QUOTE_ID, "team-123"]);
  });

  it("returns 404 for a quote that is not this team's", async () => {
    const res = await remove([]);
    expect(res.statusCode).toBe(404);
  });
});

describe("ClientPortalQuotesController.updateQuoteStatus", () => {
  const update = async (status: unknown, rows: unknown[] = [{ id: QUOTE_ID, quote_no: "QUO-1", status }]) => {
    mockedQuery.mockResolvedValueOnce(createQueryResult(rows as any[]));
    const res = createMockResponse();
    await ClientPortalQuotesController.updateQuoteStatus(
      createMockRequest({ params: { id: QUOTE_ID }, body: { status } }),
      res
    );
    return res;
  };

  it("sets any of the five statuses, scoped to the team", async () => {
    const res = await update("expired");
    expect(res.body.done).toBe(true);
    expect(mockedQuery.mock.calls[0][1]).toEqual(["expired", QUOTE_ID, "team-123"]);
  });

  it("rejects an unknown status without touching the database", async () => {
    const res = await update("paid");
    expect(res.statusCode).toBe(400);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("returns 404 for a quote that is not this team's", async () => {
    const res = await update("sent", []);
    expect(res.statusCode).toBe(404);
  });
});

describe("ClientPortalQuotesController.getQuotes", () => {
  const list = async (query: Record<string, unknown> = {}) => {
    mockedQuery
      .mockResolvedValueOnce(
        createQueryResult([
          { total: 3, total_quoted: "20000", total_accepted: "600", total_pending: "12600" },
        ])
      )
      .mockResolvedValueOnce(
        createQueryResult([
          {
            id: QUOTE_ID,
            client_id: CLIENT_ID,
            quote_no: "QUO-1",
            amount: "7200",
            currency: "USD",
            status: "sent",
            project_name: "Refresh",
            valid_until: "2026-05-18",
            client_name: "Brandbase",
          },
        ])
      );
    const res = createMockResponse();
    await ClientPortalQuotesController.getQuotes(createMockRequest({ query }), res);
    return res;
  };

  it("returns the quotes with org-wide Total quoted / Accepted / Pending", async () => {
    const res = await list();
    expect(res.body.body.totals).toEqual({ totalQuoted: 20000, totalAccepted: 600, totalPending: 12600 });
    expect(res.body.body.quotes[0]).toEqual(
      expect.objectContaining({ quoteNumber: "QUO-1", status: "sent", validUntil: "2026-05-18", clientName: "Brandbase" })
    );
  });

  it("uses one WHERE for the rows and the totals, with the status filter", async () => {
    await list({ status: "accepted" });
    const [totalsSql, totalsParams] = mockedQuery.mock.calls[0];
    const [listSql, listParams] = mockedQuery.mock.calls[1];
    expect(totalsSql).toContain("q.status = $2");
    expect(listSql).toContain("q.status = $2");
    expect(totalsParams).toEqual(["team-123", "accepted"]);
    expect(listParams.slice(0, 2)).toEqual(["team-123", "accepted"]);
  });

  it("rejects an unknown status filter", async () => {
    const res = createMockResponse();
    await ClientPortalQuotesController.getQuotes(createMockRequest({ query: { status: "bogus" } }), res);
    expect(res.statusCode).toBe(400);
    expect(mockedQuery).not.toHaveBeenCalled();
  });
});
