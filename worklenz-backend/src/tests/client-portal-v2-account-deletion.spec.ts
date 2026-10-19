const mockTxQuery = jest.fn();
const mockRelease = jest.fn();
const mockPost = jest.fn();

jest.mock("../config/db", () => ({
  __esModule: true,
  default: { query: jest.fn(), pool: { connect: jest.fn() } },
}));
jest.mock("axios", () => ({ __esModule: true, default: { post: (...args: unknown[]) => mockPost(...args) } }));
jest.mock("../services/client-portal-v2/notify.service", () => ({
  __esModule: true,
  notifyStaff: jest.fn(),
  notifyClientUsers: jest.fn(),
  getStaffRecipients: jest.fn(async () => []),
}));

import db from "../config/db";
import {
  requestAccountDeletion,
  submitAccountDeletionRequest,
} from "../services/client-portal-v2/client-account-deletion.service";
import { notifyStaff } from "../services/client-portal-v2/notify.service";
import type { ClientSubject } from "../services/client-portal-v2/subject";
import { createQueryResult } from "./utils/db-mock";

const mockedConnect = (db.pool as any).connect as jest.Mock;

type Handler = [RegExp, any];
const stubTx = (handlers: Handler[]) =>
  mockTxQuery.mockImplementation(async (sql: string) => {
    const match = handlers.find(([pattern]) => pattern.test(String(sql)));
    return match ? match[1] : createQueryResult([]);
  });
const txRan = (pattern: RegExp) => mockTxQuery.mock.calls.some(([sql]) => pattern.test(String(sql)));

const subject: ClientSubject = {
  contactId: "alex",
  clientId: "client-1",
  teamId: "team-1",
  role: "admin",
  name: "Alex Chen",
  email: "alex@brandbase.com",
  clientUserId: "login-1",
};

const LOGIN: Handler = [/FROM client_users WHERE id = \$1 AND deleted_at IS NULL FOR UPDATE/, createQueryResult([{ id: "login-1", name: "Alex Chen", email: "alex@brandbase.com" }])];
const MEMBERSHIPS: Handler = [
  /FROM client_contacts cc\s+JOIN clients c ON c\.id = cc\.client_id\s+WHERE cc\.client_user_id/,
  createQueryResult([
    { id: "alex", team_id: "team-1", client_id: "client-1", name: "Alex Chen", role: "admin", client_name: "Brandbase" },
    { id: "alex-2", team_id: "team-2", client_id: "client-9", name: "Alex Chen", role: "admin", client_name: "Other Co" },
  ]),
];

const mockedNotifyStaff = notifyStaff as jest.Mock;

beforeEach(() => {
  mockedNotifyStaff.mockReset();
  mockTxQuery.mockReset();
  mockRelease.mockReset();
  mockPost.mockReset();
  mockPost.mockResolvedValue({});
  mockedConnect.mockReset();
  mockedConnect.mockResolvedValue({ query: mockTxQuery, release: mockRelease });
  delete process.env.TEAMS_SUPPORT_WEBHOOK;
});

describe("client account deletion", () => {
  it("is for a Client Admin only: a Member or Viewer is refused before anything is read", async () => {
    await expect(requestAccountDeletion({ ...subject, role: "member" }, { confirmation: "DELETE" })).rejects.toMatchObject({
      status: 403,
      code: "ADMIN_ONLY",
    });
    await expect(requestAccountDeletion({ ...subject, role: "viewer" }, { confirmation: "DELETE" })).rejects.toMatchObject({
      code: "ADMIN_ONLY",
    });
    expect(mockedConnect).not.toHaveBeenCalled();
  });

  it("requires the typed confirmation before touching the database", async () => {
    await expect(requestAccountDeletion(subject, {})).rejects.toMatchObject({ status: 400, code: "INVALID_CONFIRMATION" });
    await expect(requestAccountDeletion(subject, { confirmation: "delete" })).rejects.toMatchObject({ code: "INVALID_CONFIRMATION" });
    expect(mockedConnect).not.toHaveBeenCalled();
  });

  it("refuses a subject with no login", async () => {
    await expect(requestAccountDeletion({ ...subject, clientUserId: null }, { confirmation: "DELETE" })).rejects.toMatchObject({ code: "NO_LOGIN" });
  });

  it("refuses when the person is the only Client Admin of an organization", async () => {
    stubTx([LOGIN, [/cc\.role = 'admin'/, createQueryResult([{ organization_name: "Brandbase" }])]]);
    await expect(requestAccountDeletion(subject, { confirmation: "DELETE" })).rejects.toMatchObject({
      status: 409,
      code: "LAST_ADMIN",
      details: { organizations: ["Brandbase"] },
    });
    expect(txRan(/UPDATE client_users SET deleted_at/)).toBe(false);
  });

  it("refuses when they are the only approver on a pending approval", async () => {
    stubTx([LOGIN, [/FROM client_portal_approvals a/, createQueryResult([{ title: "Logo sign-off" }])]]);
    await expect(requestAccountDeletion(subject, { confirmation: "DELETE" })).rejects.toMatchObject({ status: 409, code: "SOLE_APPROVER" });
    expect(txRan(/UPDATE client_users SET deleted_at/)).toBe(false);
  });

  it("refuses a login that is already deleted", async () => {
    stubTx([]);
    await expect(requestAccountDeletion(subject, { confirmation: "DELETE" })).rejects.toMatchObject({ status: 409, code: "ALREADY_DELETED" });
  });

  it("soft-deletes the login, logs a 30-day purge date and audits every portal", async () => {
    process.env.TEAMS_SUPPORT_WEBHOOK = "https://teams.test/hook";
    stubTx([LOGIN, MEMBERSHIPS]);
    const before = Date.now();
    const result = await requestAccountDeletion(subject, { confirmation: "DELETE" });

    const update = mockTxQuery.mock.calls.find(([sql]) => /UPDATE client_users SET deleted_at/.test(String(sql)))!;
    expect(update[1][0]).toBe("login-1");
    expect(txRan(/DELETE FROM/)).toBe(false);

    const log = mockTxQuery.mock.calls.find(([sql]) => /INSERT INTO client_user_deletion_logs/.test(String(sql)))!;
    const days = (new Date(log[1][4]).getTime() - new Date(log[1][3]).getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(30);
    expect(new Date(result.scheduled_deletion_date).getTime()).toBeGreaterThan(before);

    const audits = mockTxQuery.mock.calls.filter(([sql]) => /INSERT INTO client_portal_audit_events/.test(String(sql)));
    expect(audits.map(([, params]) => params[8])).toEqual(["Client account deleted", "Client account deleted"]);
    expect(audits.map(([, params]) => params[0])).toEqual(["team-1", "team-2"]);
    expect(mockPost).toHaveBeenCalledTimes(1);

    // The history staff see says what happened and until when it can be undone, with no email in the append-only log.
    const metadata = JSON.parse(audits[0][1][13]);
    expect(metadata).toMatchObject({ role: "admin" });
    expect(new Date(metadata.restorable_until).getTime()).toBe(new Date(result.scheduled_deletion_date).getTime());
    expect(JSON.stringify(metadata)).not.toContain("@");

    // Every workspace the person belonged to is told in its activity bell.
    expect(mockedNotifyStaff.mock.calls.map(([input]) => input.teamId)).toEqual(["team-1", "team-2"]);
  });

  it("still deletes when the support notification fails", async () => {
    process.env.TEAMS_SUPPORT_WEBHOOK = "https://teams.test/hook";
    mockPost.mockRejectedValue(new Error("down"));
    stubTx([LOGIN, MEMBERSHIPS]);
    await expect(requestAccountDeletion(subject, { confirmation: "DELETE" })).resolves.toHaveProperty("scheduled_deletion_date");
  });
});

describe("a Member or Viewer asking for their account to be deleted", () => {
  const member: ClientSubject = { ...subject, role: "member", contactId: "jamie", name: "Jamie Wu" };
  const ORG: Handler = [/SELECT COALESCE\(NULLIF\(TRIM\(company_name\)/, createQueryResult([{ name: "Brandbase" }])];

  it("is not offered to a Client Admin, who deletes the account directly", async () => {
    await expect(submitAccountDeletionRequest(subject)).rejects.toMatchObject({ status: 409, code: "USE_DELETE" });
    expect(mockedConnect).not.toHaveBeenCalled();
  });

  it("is audited and reaches the workspace's Owners and Admins, and does not delete anything", async () => {
    stubTx([ORG]);
    await expect(submitAccountDeletionRequest(member)).resolves.toEqual({ sent: true });

    const audit = mockTxQuery.mock.calls.find(([sql]) => /INSERT INTO client_portal_audit_events/.test(String(sql)))!;
    expect(audit[1][8]).toBe("Account deletion requested");
    expect(audit[1][5]).toBe("jamie");
    expect(txRan(/UPDATE client_users/)).toBe(false);
    expect(mockedNotifyStaff).toHaveBeenCalledTimes(1);
    expect(mockedNotifyStaff.mock.calls[0][0]).toMatchObject({ teamId: "team-1", kind: "Access" });
  });

  it("is a no-op when they already asked in the last 24 hours", async () => {
    stubTx([[/FROM client_portal_audit_events\s+WHERE actor_contact_id/, createQueryResult([{ "?column?": 1 }])], ORG]);
    await expect(submitAccountDeletionRequest(member)).resolves.toEqual({ sent: false });
    expect(txRan(/INSERT INTO client_portal_audit_events/)).toBe(false);
    expect(mockedNotifyStaff).not.toHaveBeenCalled();
  });
});
