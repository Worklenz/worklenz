const mockTxQuery = jest.fn();
const mockRelease = jest.fn();

jest.mock("../config/db", () => ({
  __esModule: true,
  default: { query: jest.fn(), pool: { connect: jest.fn() } },
}));
jest.mock("../shared/email", () => ({ __esModule: true, sendEmail: jest.fn(), sendEmailEnhanced: jest.fn(), EmailRequest: jest.fn() }));
jest.mock("../cron_jobs/helpers", () => ({ __esModule: true, getClientPortalBaseUrl: () => "https://portal.test" }));
jest.mock("../services/client-portal-v2/notify.service", () => ({
  __esModule: true,
  notifyStaff: jest.fn(),
  notifyClientUsers: jest.fn(),
  getStaffRecipients: jest.fn(async () => []),
}));

import db from "../config/db";
import { explainAccessLoss } from "../services/client-portal-v2/subject";
import {
  deactivateClientUser,
  mapUserRow,
  reactivateClientUser,
  restoreClientAccount,
} from "../services/client-portal-v2/users.service";
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
const auditEvents = () =>
  mockTxQuery.mock.calls
    .filter(([sql]) => /INSERT INTO client_portal_audit_events/.test(String(sql)))
    .map(([, params]) => (params as unknown[])[8] as string);

const TEAM = "team-1";
const staff = { side: "internal" as const, name: "Kasun F.", userId: "user-1" };

const USER_LOOKUP = /JOIN client_contacts cc ON cc\.id = u\.id/;
const ORGANIZATION_LOCK = /FROM clients\s+WHERE id = \$1 AND team_id = \$2\s+FOR UPDATE/;
const LOG = /FROM client_user_deletion_logs\s+WHERE client_user_id = \$1 AND NOT deletion_completed/;
const MEMBERSHIPS = /COUNT\(DISTINCT team_id\)/;

const userRef = (overrides: Record<string, unknown> = {}) => ({
  id: "alex", name: "Alex Chen", email: "alex@brandbase.com", client_id: "client-1", organization_name: "Brandbase",
  role: "admin", status_key: "deleted", has_login: true, login_id: "login-1", ...overrides,
});
const orgLock = createQueryResult([{ id: "client-1", name: "Brandbase", display_name: "Brandbase", status: "active", deleted_at: null }]);

beforeEach(() => {
  mockedQuery.mockReset();
  mockTxQuery.mockReset();
  mockRelease.mockReset();
  mockedConnect.mockReset();
  mockedConnect.mockResolvedValue({ query: mockTxQuery, release: mockRelease });
  mockedQuery.mockResolvedValue(createQueryResult([]));
});

describe("a client user who deleted their own account, as staff see them", () => {
  const row = (overrides: Record<string, unknown> = {}) => ({
    id: "alex", client_id: "client-1", organization_name: "Brandbase", name: "Alex Chen", email: "a@b.c",
    role: "admin", status_key: "deleted", account_deleted_at: new Date("2026-10-01T10:00:00Z"),
    restorable_until: new Date("2026-10-31T10:00:00Z"), ...overrides,
  });

  it("keeps the profile with its own status, and says when it was deleted and until when it can be restored", () => {
    expect(mapUserRow(row())).toMatchObject({
      id: "alex",
      name: "Alex Chen",
      role: "admin",
      status: "deleted",
      account_deleted_at: "2026-10-01T10:00:00.000Z",
      restorable_until: "2026-10-31T10:00:00.000Z",
    });
  });

  it("shows no deletion details for anyone else", () => {
    expect(mapUserRow(row({ status_key: "deactivated" }))).toMatchObject({
      status: "deactivated",
      account_deleted_at: null,
      restorable_until: null,
    });
  });

  it("cannot be reactivated or deactivated: that would not bring the account back", async () => {
    stubTx([[ORGANIZATION_LOCK, orgLock], [USER_LOOKUP, createQueryResult([userRef()])]]);
    await expect(reactivateClientUser({ teamId: TEAM, userId: "alex", actor: staff })).rejects.toMatchObject({
      status: 409,
      code: "ACCOUNT_DELETED",
    });
    await expect(deactivateClientUser({ teamId: TEAM, userId: "alex", actor: staff })).rejects.toMatchObject({
      code: "ACCOUNT_DELETED",
    });
    expect(ranTx(/UPDATE client_contacts/)).toBe(false);
  });
});

describe("restoring a deleted account", () => {
  const happy = (): Handler[] => [
    [ORGANIZATION_LOCK, orgLock],
    [USER_LOOKUP, createQueryResult([userRef()])],
    [LOG, createQueryResult([{ scheduled_deletion_date: new Date(Date.now() + 5 * 86_400_000) }])],
    [MEMBERSHIPS, createQueryResult([{ teams: 1 }])],
  ];

  beforeEach(() => {
    // The view read after the transaction.
    mockedQuery.mockResolvedValue(
      createQueryResult([
        { id: "alex", client_id: "client-1", name: "Alex", email: "a@b.c", role: "admin", status_key: "active", organization_name: "Brandbase", projects: [] },
      ])
    );
  });

  it("clears the flag, takes the account out of the purge queue, and audits it", async () => {
    stubTx(happy());

    await restoreClientAccount({ teamId: TEAM, userId: "alex", actor: staff });

    const update = mockTxQuery.mock.calls.find(([sql]) => /UPDATE client_users SET deleted_at = NULL/.test(String(sql)))!;
    expect(update[1]).toEqual(["login-1"]);
    // Without this a restored account would still be purged by support at the end of the window.
    expect(ranTx(/DELETE FROM client_user_deletion_logs WHERE client_user_id = \$1 AND NOT deletion_completed/)).toBe(true);
    expect(auditEvents()).toEqual(["Client account restored"]);
  });

  it("is refused once the window has ended", async () => {
    stubTx([
      [ORGANIZATION_LOCK, orgLock],
      [USER_LOOKUP, createQueryResult([userRef()])],
      [LOG, createQueryResult([{ scheduled_deletion_date: new Date(Date.now() - 1000) }])],
    ]);
    await expect(restoreClientAccount({ teamId: TEAM, userId: "alex", actor: staff })).rejects.toMatchObject({
      status: 410,
      code: "RETENTION_EXPIRED",
    });
    expect(ranTx(/UPDATE client_users/)).toBe(false);
  });

  it("is refused when the login also belongs to another workspace's portal", async () => {
    stubTx([
      [ORGANIZATION_LOCK, orgLock],
      [USER_LOOKUP, createQueryResult([userRef()])],
      [LOG, createQueryResult([{ scheduled_deletion_date: new Date(Date.now() + 86_400_000) }])],
      [MEMBERSHIPS, createQueryResult([{ teams: 2 }])],
    ]);
    await expect(restoreClientAccount({ teamId: TEAM, userId: "alex", actor: staff })).rejects.toMatchObject({
      status: 409,
      code: "SHARED_LOGIN",
    });
    expect(ranTx(/UPDATE client_users/)).toBe(false);
  });

  it("is refused for someone who has not deleted their account", async () => {
    stubTx([[ORGANIZATION_LOCK, orgLock], [USER_LOOKUP, createQueryResult([userRef({ status_key: "active" })])]]);
    await expect(restoreClientAccount({ teamId: TEAM, userId: "alex", actor: staff })).rejects.toMatchObject({
      status: 409,
      code: "NOT_DELETED",
    });
  });
});

describe("explaining why access ended", () => {
  const explain = (row: Record<string, unknown> | null) => {
    mockedQuery.mockResolvedValue(createQueryResult(row ? [row] : []));
    return explainAccessLoss(db as any, { clientUserId: "login-1", clientId: "client-1", teamId: TEAM });
  };
  const live = {
    login_status: "active", login_deleted_at: null, client_exists: "client-1", client_status: "active",
    client_deleted_at: null, contact_id: "alex", disabled_at: null, portal_active: true,
  };

  it.each([
    [{ client_deleted_at: new Date() }, "organization_unavailable"],
    [{ client_status: "inactive" }, "organization_unavailable"],
    [{ portal_active: false }, "organization_unavailable"],
    [{ client_exists: null }, "organization_unavailable"],
    [{ login_deleted_at: new Date() }, "account_deleted"],
    [{ contact_id: null }, "access_removed"],
    [{ disabled_at: new Date() }, "access_disabled"],
    [{ login_status: "inactive" }, "access_disabled"],
    [{}, "access_removed"],
  ])("%j is %s", async (overrides, reason) => {
    await expect(explain({ ...live, ...overrides })).resolves.toBe(reason);
  });

  it("an organization that is gone wins over the person's own state", async () => {
    await expect(explain({ ...live, client_deleted_at: new Date(), login_deleted_at: new Date() })).resolves.toBe(
      "organization_unavailable"
    );
  });

  it("falls back to the neutral answer when the login does not exist or the lookup fails", async () => {
    await expect(explain(null)).resolves.toBe("access_removed");
    mockedQuery.mockRejectedValue(new Error("db down"));
    await expect(
      explainAccessLoss(db as any, { clientUserId: "login-1", clientId: "client-1", teamId: TEAM })
    ).resolves.toBe("access_removed");
  });
});
