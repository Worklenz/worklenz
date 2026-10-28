const mockTxQuery = jest.fn();
const mockRelease = jest.fn();

jest.mock("../config/db", () => ({
  __esModule: true,
  default: { query: jest.fn(), pool: { connect: jest.fn() } },
}));

import db from "../config/db";
import {
  CLIENT_DELETION_RETENTION_DAYS,
  deactivateOrganization,
  deleteOrganization,
  getDeletePreview,
  reactivateOrganization,
  restoreOrganization,
} from "../services/client-portal-v2/organization-lifecycle.service";
import { createQueryResult } from "./utils/db-mock";

const mockedQuery = db.query as jest.Mock;
const mockedConnect = (db.pool as any).connect as jest.Mock;

type Handler = [RegExp, any];

/** Routes a transaction's statements by SQL text; anything unlisted succeeds with no rows. */
const stubTx = (handlers: Handler[]) =>
  mockTxQuery.mockImplementation(async (sql: string) => {
    const match = handlers.find(([pattern]) => pattern.test(String(sql)));
    if (!match) return createQueryResult([]);
    return typeof match[1] === "function" ? match[1]() : match[1];
  });

const ranTx = (pattern: RegExp) => mockTxQuery.mock.calls.some(([sql]) => pattern.test(String(sql)));
const auditEvents = () =>
  mockTxQuery.mock.calls
    .filter(([sql]) => /INSERT INTO client_portal_audit_events/.test(String(sql)))
    .map(([, params]) => (params as unknown[])[8] as string);

const TEAM = "team-1";
const ORG = "client-1";
const staff = { side: "internal" as const, name: "Kasun F.", userId: "user-1" };

const LOCK = /FOR UPDATE/;
const lockRow = (overrides: Record<string, unknown> = {}) =>
  createQueryResult([
    { id: ORG, name: "Brandbase", display_name: "Brandbase", status: "active", deleted_at: null, ...overrides },
  ]);

const organizationRow = (overrides: Record<string, unknown> = {}) => ({
  id: ORG, display_name: "Brandbase", client_status: "active", deleted_at: null, purge_on: null,
  total_users: 3, active_users: 2, invited_users: 1, deactivated_users: 0, portal_projects: 2,
  awaiting_client: 0, awaiting_approvals: 0, awaiting_change_requests: 0, outstanding: [],
  ...overrides,
});
const ORGANIZATION = /LEFT JOIN LATERAL/;

const INVOICES = /FROM client_portal_invoices i/;
const APPROVALS = /SELECT ref_no, title FROM client_portal_approvals/;
const CHANGE_REQUESTS = /SELECT title FROM client_portal_change_requests/;

/** The handlers every delete attempt needs; each test adds what it wants to differ. */
const deletable = (extra: Handler[] = []): Handler[] => [
  ...extra,
  [LOCK, lockRow()],
  [ORGANIZATION, createQueryResult([organizationRow()])],
  [/UPDATE clients SET deleted_at = NOW\(\)/, createQueryResult([{ deleted_at: new Date("2026-10-01T00:00:00Z"), purge_on: new Date("2026-10-31T00:00:00Z") }], 1)],
];

beforeEach(() => {
  mockedQuery.mockReset();
  mockTxQuery.mockReset();
  mockRelease.mockReset();
  mockedConnect.mockReset();
  mockedConnect.mockResolvedValue({ query: mockTxQuery, release: mockRelease });
  mockedQuery.mockResolvedValue(createQueryResult([organizationRow()]));
});

describe("deleting a client organization", () => {
  it("soft-deletes it: sets deleted_at and touches nothing else, so a restore brings everything back", async () => {
    stubTx(deletable());

    const result = await deleteOrganization({ teamId: TEAM, organizationId: ORG, actor: staff });

    expect(result.deleted_at).toBe("2026-10-01T00:00:00.000Z");
    expect(new Date(result.purge_on).getTime() - new Date(result.deleted_at).getTime()).toBe(
      CLIENT_DELETION_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );
    // Contacts, logins, invitations, invoices and history are all left alone.
    expect(ranTx(/DELETE FROM/)).toBe(false);
    expect(ranTx(/UPDATE client_users/)).toBe(false);
    expect(ranTx(/UPDATE client_contacts/)).toBe(false);
    expect(auditEvents()).toEqual(["Client organization deleted"]);
  });

  it("locks the organization before it reads or writes anything", async () => {
    stubTx(deletable());
    await deleteOrganization({ teamId: TEAM, organizationId: ORG, actor: staff });

    const statements = mockTxQuery.mock.calls.map(([sql]) => String(sql));
    const lockAt = statements.findIndex(sql => /FOR UPDATE/.test(sql));
    const updateAt = statements.findIndex(sql => /UPDATE clients SET deleted_at/.test(sql));
    expect(lockAt).toBeGreaterThan(-1);
    expect(lockAt).toBeLessThan(updateAt);
    const lock = mockTxQuery.mock.calls[lockAt];
    // Scoped by the caller's own team: another workspace's id answers like a missing client.
    expect(lock[1]).toEqual([ORG, TEAM]);
  });

  it("is refused while the client has an unpaid invoice, and no confirmation overrides that", async () => {
    stubTx(
      deletable([[INVOICES, createQueryResult([{ invoice_no: "INV-1001", currency: "USD", outstanding: 250 }])]])
    );

    await expect(
      deleteOrganization({
        teamId: TEAM,
        organizationId: ORG,
        actor: staff,
        confirmPendingApprovals: true,
        confirmOpenChangeRequests: true,
      })
    ).rejects.toMatchObject({ status: 409, code: "OPEN_INVOICES" });
    expect(ranTx(/UPDATE clients SET deleted_at/)).toBe(false);
    expect(auditEvents()).toEqual([]);
  });

  it("asks for confirmation when approvals are still awaiting a decision", async () => {
    stubTx(deletable([[APPROVALS, createQueryResult([{ ref_no: "AP-000007", title: "Logo" }])]]));

    await expect(deleteOrganization({ teamId: TEAM, organizationId: ORG, actor: staff })).rejects.toMatchObject({
      status: 409,
      code: "PENDING_APPROVALS",
      details: { approvals: ["AP-000007"] },
    });
    expect(ranTx(/UPDATE clients SET deleted_at/)).toBe(false);

    await deleteOrganization({ teamId: TEAM, organizationId: ORG, actor: staff, confirmPendingApprovals: true });
    expect(ranTx(/UPDATE clients SET deleted_at/)).toBe(true);
  });

  it("asks for confirmation when change requests are still open", async () => {
    stubTx(deletable([[CHANGE_REQUESTS, createQueryResult([{ title: "Add pricing page" }])]]));

    await expect(deleteOrganization({ teamId: TEAM, organizationId: ORG, actor: staff })).rejects.toMatchObject({
      status: 409,
      code: "OPEN_CHANGE_REQUESTS",
    });

    await deleteOrganization({ teamId: TEAM, organizationId: ORG, actor: staff, confirmOpenChangeRequests: true });
    expect(ranTx(/UPDATE clients SET deleted_at/)).toBe(true);
  });

  it("answers 404 for a client of another workspace and 409 for one already deleted", async () => {
    stubTx([]);
    await expect(deleteOrganization({ teamId: TEAM, organizationId: "someone-elses", actor: staff })).rejects.toMatchObject({
      status: 404,
    });

    stubTx([[LOCK, lockRow({ deleted_at: new Date() })]]);
    await expect(deleteOrganization({ teamId: TEAM, organizationId: ORG, actor: staff })).rejects.toMatchObject({
      status: 409,
      code: "ALREADY_DELETED",
    });
    expect(auditEvents()).toEqual([]);
  });
});

describe("what the Delete dialog shows first", () => {
  it("reports the users it affects and everything that would block or need confirming", async () => {
    mockedQuery.mockImplementation(async (sql: string) => {
      // The organization query itself reads invoices and approvals in sub-selects, so match it first.
      if (ORGANIZATION.test(sql)) return createQueryResult([organizationRow()]);
      if (INVOICES.test(sql)) return createQueryResult([{ invoice_no: "INV-9", currency: "USD", outstanding: 10 }]);
      if (APPROVALS.test(sql)) return createQueryResult([{ ref_no: "AP-000002", title: "Hero" }]);
      if (CHANGE_REQUESTS.test(sql)) return createQueryResult([]);
      return createQueryResult([organizationRow()]);
    });

    const preview = await getDeletePreview(db as any, TEAM, ORG);

    expect(preview).toMatchObject({
      organization_id: ORG,
      active_users: 2,
      invited_users: 1,
      total_users: 3,
      portal_projects: 2,
      retention_days: CLIENT_DELETION_RETENTION_DAYS,
      open_invoices: [{ invoice_no: "INV-9", currency: "USD", outstanding: 10 }],
      pending_approvals: [{ ref_no: "AP-000002", title: "Hero" }],
      open_change_requests: [],
    });
  });
});

describe("restoring a deleted client organization", () => {
  const deleted = (overrides: Record<string, unknown> = {}) =>
    lockRow({ deleted_at: new Date("2026-10-01T00:00:00Z"), ...overrides });

  it("brings it back inside the window by clearing deleted_at, and audits it", async () => {
    stubTx([
      [LOCK, deleted()],
      [/SELECT \(deleted_at > NOW\(\)/, createQueryResult([{ restorable: true }])],
    ]);

    await restoreOrganization({ teamId: TEAM, organizationId: ORG, actor: staff });

    const update = mockTxQuery.mock.calls.find(([sql]) => /SET deleted_at = NULL/.test(String(sql)))!;
    expect(update).toBeDefined();
    expect(update[1]).toEqual([ORG, TEAM, "Brandbase", true]);
    expect(auditEvents()).toEqual(["Client organization restored"]);
  });

  it("is refused once the retention window has ended", async () => {
    stubTx([
      [LOCK, deleted()],
      [/SELECT \(deleted_at > NOW\(\)/, createQueryResult([{ restorable: false }])],
    ]);
    await expect(restoreOrganization({ teamId: TEAM, organizationId: ORG, actor: staff })).rejects.toMatchObject({
      status: 410,
      code: "RETENTION_EXPIRED",
    });
    expect(ranTx(/SET deleted_at = NULL/)).toBe(false);
  });

  it("asks for a new name when another live client took the old one, and accepts one", async () => {
    stubTx([
      [LOCK, deleted()],
      [/SELECT \(deleted_at > NOW\(\)/, createQueryResult([{ restorable: true }])],
      [/SELECT 1 FROM clients WHERE team_id/, createQueryResult([{ "?column?": 1 }])],
    ]);
    await expect(restoreOrganization({ teamId: TEAM, organizationId: ORG, actor: staff })).rejects.toMatchObject({
      status: 409,
      code: "NAME_TAKEN",
    });
    expect(ranTx(/SET deleted_at = NULL/)).toBe(false);

    stubTx([
      [LOCK, deleted()],
      [/SELECT \(deleted_at > NOW\(\)/, createQueryResult([{ restorable: true }])],
      [/SELECT 1 FROM clients WHERE team_id/, (): any => createQueryResult([])],
    ]);
    await restoreOrganization({ teamId: TEAM, organizationId: ORG, actor: staff, newName: "  Brandbase Group  " });
    const update = mockTxQuery.mock.calls.find(([sql]) => /SET deleted_at = NULL/.test(String(sql)))!;
    expect(update[1]).toEqual([ORG, TEAM, "Brandbase Group", true]);
  });

  it("reports NAME_TAKEN when a live client wins the name between the check and the update", async () => {
    const violation = Object.assign(new Error("duplicate key"), {
      code: "23505",
      constraint: "clients_name_team_id_uindex",
    });
    mockTxQuery.mockImplementation(async (sql: string) => {
      if (LOCK.test(sql)) return deleted();
      if (/SELECT \(deleted_at > NOW\(\)/.test(sql)) return createQueryResult([{ restorable: true }]);
      if (/SET deleted_at = NULL/.test(sql)) throw violation;
      return createQueryResult([]);
    });
    await expect(restoreOrganization({ teamId: TEAM, organizationId: ORG, actor: staff })).rejects.toMatchObject({
      status: 409,
      code: "NAME_TAKEN",
    });
    expect(ranTx(/ROLLBACK TO SAVEPOINT restore_client/)).toBe(true);
    expect(auditEvents()).toEqual([]);
  });

  it("drops the sign-in slug and still restores when a live client takes it between the check and the update", async () => {
    const violation = Object.assign(new Error("duplicate key"), {
      code: "23505",
      constraint: "clients_invite_slug_unique",
    });
    let attempts = 0;
    mockTxQuery.mockImplementation(async (sql: string) => {
      if (LOCK.test(sql)) return deleted();
      if (/SELECT \(deleted_at > NOW\(\)/.test(sql)) return createQueryResult([{ restorable: true }]);
      if (/SET deleted_at = NULL/.test(sql) && attempts++ === 0) throw violation;
      return createQueryResult([]);
    });
    await restoreOrganization({ teamId: TEAM, organizationId: ORG, actor: staff });
    const updates = mockTxQuery.mock.calls.filter(([sql]) => /SET deleted_at = NULL/.test(String(sql)));
    expect(updates.map(([, params]) => (params as unknown[])[3])).toEqual([true, false]);
    expect(auditEvents()).toEqual(["Client organization restored"]);
  });

  it("refuses a client that is not deleted, and an empty new name", async () => {
    stubTx([[LOCK, lockRow()]]);
    await expect(restoreOrganization({ teamId: TEAM, organizationId: ORG, actor: staff })).rejects.toMatchObject({
      code: "NOT_DELETED",
    });

    stubTx([
      [LOCK, deleted()],
      [/SELECT \(deleted_at > NOW\(\)/, createQueryResult([{ restorable: true }])],
    ]);
    await expect(
      restoreOrganization({ teamId: TEAM, organizationId: ORG, actor: staff, newName: "   " })
    ).rejects.toMatchObject({ status: 400, code: "INVALID_NAME" });
  });
});

describe("deactivating and reactivating a client organization", () => {
  it("suspends it without touching the logins shared with other workspaces", async () => {
    stubTx([[LOCK, lockRow()]]);

    await deactivateOrganization({ teamId: TEAM, organizationId: ORG, actor: staff });

    expect(ranTx(/UPDATE clients SET status = 'inactive'/)).toBe(true);
    // Portal access is its own switch; a later reactivation must not turn it back on.
    expect(ranTx(/UPDATE client_portal_access/)).toBe(false);
    // Writing client_users.status by client would lock the person out of other workspaces' portals too.
    expect(ranTx(/UPDATE client_users/)).toBe(false);
    expect(auditEvents()).toEqual(["Client organization deactivated"]);
  });

  it("does nothing, and audits nothing, when it is already deactivated", async () => {
    stubTx([[LOCK, lockRow({ status: "inactive" })]]);
    await deactivateOrganization({ teamId: TEAM, organizationId: ORG, actor: staff });
    expect(ranTx(/UPDATE clients/)).toBe(false);
    expect(auditEvents()).toEqual([]);
  });

  it("ends a suspension", async () => {
    stubTx([[LOCK, lockRow({ status: "inactive" })]]);
    await reactivateOrganization({ teamId: TEAM, organizationId: ORG, actor: staff });
    expect(ranTx(/UPDATE clients SET status = 'active'/)).toBe(true);
    expect(ranTx(/UPDATE client_portal_access/)).toBe(false);
    expect(ranTx(/UPDATE client_users/)).toBe(false);
    expect(auditEvents()).toEqual(["Client organization reactivated"]);
  });

  it("will not touch a deleted client: restore it first", async () => {
    stubTx([[LOCK, lockRow({ deleted_at: new Date() })]]);
    await expect(deactivateOrganization({ teamId: TEAM, organizationId: ORG, actor: staff })).rejects.toMatchObject({
      status: 409,
      code: "CLIENT_DELETED",
    });
    await expect(reactivateOrganization({ teamId: TEAM, organizationId: ORG, actor: staff })).rejects.toMatchObject({
      status: 409,
      code: "CLIENT_DELETED",
    });
  });
});
