const mockTxQuery = jest.fn();
const mockRelease = jest.fn();

jest.mock("../config/db", () => ({
  __esModule: true,
  default: { query: jest.fn(), pool: { connect: jest.fn() } },
}));

import db from "../config/db";
import {
  findPurgeCandidates,
  purgeOrganization,
  runClientPurge,
} from "../services/client-portal-v2/organization-purge.service";
import { createQueryResult } from "./utils/db-mock";

const mockedQuery = db.query as jest.Mock;
const mockedConnect = (db.pool as any).connect as jest.Mock;

type Handler = [RegExp, any];
const stubTx = (handlers: Handler[]) =>
  mockTxQuery.mockImplementation(async (sql: string) => {
    const match = handlers.find(([pattern]) => pattern.test(String(sql)));
    return match ? match[1] : createQueryResult([]);
  });
const ranTx = (pattern: RegExp) => mockTxQuery.mock.calls.some(([sql]) => pattern.test(String(sql)));
const auditRows = () =>
  mockTxQuery.mock.calls.filter(([sql]) => /INSERT INTO client_portal_audit_events/.test(String(sql)));

const CANDIDATE = { id: "client-1", team_id: "team-1", name: "Brandbase" };
const LOCK = /FROM clients\s+WHERE id = \$1 AND deleted_at IS NOT NULL/;
const FINANCIAL = /AS must_keep/;
const LOGINS = /SELECT DISTINCT client_user_id FROM client_contacts/;

beforeEach(() => {
  mockedQuery.mockReset();
  mockTxQuery.mockReset();
  mockRelease.mockReset();
  mockedConnect.mockReset();
  mockedConnect.mockResolvedValue({ query: mockTxQuery, release: mockRelease });
  mockedQuery.mockResolvedValue(createQueryResult([]));
});

describe("which deleted clients are purged", () => {
  it("only those past the retention window that have not been purged already", async () => {
    mockedQuery.mockResolvedValue(createQueryResult([CANDIDATE]));
    await expect(findPurgeCandidates(db as any)).resolves.toEqual([CANDIDATE]);

    const sql = String(mockedQuery.mock.calls[0][0]);
    expect(sql).toMatch(/deleted_at IS NOT NULL/);
    expect(sql).toMatch(/deleted_at < NOW\(\) - INTERVAL '30 days'/);
    expect(sql).toMatch(/purged_at IS NULL/);
  });

  it("re-checks under a row lock, so a client restored a moment ago is left alone", async () => {
    stubTx([[LOCK, createQueryResult([])]]);
    await expect(purgeOrganization(CANDIDATE)).resolves.toBe("skipped");
    expect(ranTx(/DELETE FROM/)).toBe(false);
    expect(auditRows()).toHaveLength(0);
  });
});

describe("purging a deleted client", () => {
  it("deletes the row when there are no financial records, letting the foreign keys do the cascade", async () => {
    stubTx([
      [LOCK, createQueryResult([{ id: "client-1" }])],
      [FINANCIAL, createQueryResult([{ must_keep: false }])],
      [LOGINS, createQueryResult([{ client_user_id: "login-1" }])],
    ]);

    await expect(purgeOrganization(CANDIDATE)).resolves.toBe("deleted");

    expect(ranTx(/DELETE FROM clients WHERE id = \$1/)).toBe(true);
    // The audit entry survives with the name, no longer pointing at a row that is gone.
    const audit = auditRows()[0];
    expect((audit[1] as unknown[])[1]).toBeNull();
    expect((audit[1] as unknown[])[12]).toBe("Brandbase");
    expect((audit[1] as unknown[])[8]).toBe("Client organization purged");
  });

  it("keeps the row as a tombstone when invoices or quotes exist, and scrubs the contact details", async () => {
    stubTx([
      [LOCK, createQueryResult([{ id: "client-1" }])],
      [FINANCIAL, createQueryResult([{ must_keep: true }])],
      [LOGINS, createQueryResult([])],
    ]);

    await expect(purgeOrganization(CANDIDATE)).resolves.toBe("tombstoned");

    expect(ranTx(/DELETE FROM clients/)).toBe(false);
    expect(ranTx(/DELETE FROM client_contacts WHERE client_id = \$1/)).toBe(true);
    expect(ranTx(/DELETE FROM client_portal_approvals WHERE client_id/)).toBe(true);
    expect(ranTx(/DELETE FROM client_portal_threads WHERE client_id/)).toBe(true);
    // The financial documents are never touched.
    expect(ranTx(/client_portal_invoices/)).toBe(true); // only the existence check
    expect(ranTx(/DELETE FROM client_portal_invoices/)).toBe(false);
    expect(ranTx(/DELETE FROM client_portal_quotes/)).toBe(false);
    const scrub = mockTxQuery.mock.calls.find(([sql]) => /SET email = NULL/.test(String(sql)))!;
    expect(String(scrub[0])).toMatch(/purged_at = NOW\(\)/);
  });

  it("keeps the row when legacy requests, tickets or chat exist, or when a login is shared with another organization", async () => {
    stubTx([
      [LOCK, createQueryResult([{ id: "client-1" }])],
      [FINANCIAL, createQueryResult([{ must_keep: true }])],
      [LOGINS, createQueryResult([])],
    ]);

    await expect(purgeOrganization(CANDIDATE)).resolves.toBe("tombstoned");
    expect(ranTx(/DELETE FROM clients/)).toBe(false);

    const check = String(mockTxQuery.mock.calls.find(([sql]) => FINANCIAL.test(String(sql)))![0]);
    expect(check).toMatch(/FROM client_portal_requests WHERE client_id = \$1/);
    expect(check).toMatch(/FROM client_portal_tickets WHERE client_id = \$1/);
    expect(check).toMatch(/FROM client_portal_chat_messages WHERE client_id = \$1/);
    expect(check).toMatch(/FROM client_portal_task_comments WHERE client_id = $1/);
    expect(check).toMatch(/FROM client_portal_attachments WHERE uploaded_by_client_id = $1/);
    expect(check).toMatch(/cu\.client_id = \$1/);
    expect(check).toMatch(/cc\.client_id <> \$1/);
    expect(check).toMatch(/cuo\.client_id <> \$1/);
  });

  it("removes a login only when nothing else references it, since a login is shared across portals", async () => {
    stubTx([
      [LOCK, createQueryResult([{ id: "client-1" }])],
      [FINANCIAL, createQueryResult([{ must_keep: false }])],
      [LOGINS, createQueryResult([{ client_user_id: "login-1" }])],
    ]);
    await purgeOrganization(CANDIDATE);

    const cleanup = mockTxQuery.mock.calls.find(([sql]) => /DELETE FROM client_users cu/.test(String(sql)))!;
    expect(cleanup[1]).toEqual([["login-1"]]);
    expect(String(cleanup[0])).toMatch(/NOT EXISTS \(SELECT 1 FROM client_contacts/);
    expect(String(cleanup[0])).toMatch(/NOT EXISTS \(SELECT 1 FROM client_user_organizations/);
  });
});

describe("a sweep", () => {
  it("only reports what it would do unless it is told to execute", async () => {
    mockedQuery.mockResolvedValue(createQueryResult([CANDIDATE, { ...CANDIDATE, id: "client-2" }]));

    await expect(runClientPurge({ execute: false })).resolves.toEqual({
      candidates: 2,
      deleted: 0,
      tombstoned: 0,
      skipped: 0,
      failed: 0,
    });
    expect(mockedConnect).not.toHaveBeenCalled();
  });

  it("carries on past a client it cannot purge", async () => {
    mockedQuery.mockResolvedValue(createQueryResult([CANDIDATE, { ...CANDIDATE, id: "client-2" }]));
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    let attempt = 0;
    mockTxQuery.mockImplementation(async (sql: string) => {
      if (LOCK.test(String(sql))) {
        attempt += 1;
        if (attempt === 1) throw new Error("deadlock");
        return createQueryResult([{ id: "client-2" }]);
      }
      if (FINANCIAL.test(String(sql))) return createQueryResult([{ must_keep: false }]);
      return createQueryResult([]);
    });

    await expect(runClientPurge({ execute: true })).resolves.toMatchObject({ candidates: 2, deleted: 1, failed: 1 });
  });
});
