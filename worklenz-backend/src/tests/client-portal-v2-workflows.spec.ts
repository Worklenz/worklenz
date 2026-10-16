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
import { recordApprovalDecision } from "../services/client-portal-v2/approvals.service";
import { applyChangeRequestAction } from "../services/client-portal-v2/change-requests.service";
import { notifyStaff } from "../services/client-portal-v2/notify.service";
import { savePortalSettingsV2 } from "../services/client-portal-v2/settings.service";
import type { ClientSubject } from "../services/client-portal-v2/subject";
import { deactivateClientUser, updateClientUser } from "../services/client-portal-v2/users.service";
import { createQueryResult } from "./utils/db-mock";

const mockedQuery = db.query as jest.Mock;
const mockedConnect = (db.pool as any).connect as jest.Mock;
const mockedNotifyStaff = notifyStaff as jest.Mock;

type Handler = [RegExp, any];

/** Routes a transaction's statements by SQL text; anything unlisted succeeds with no rows. */
const stubTransaction = (handlers: Handler[]) => {
  mockTxQuery.mockImplementation(async (sql: string) => {
    const match = handlers.find(([pattern]) => pattern.test(String(sql)));
    if (!match) return createQueryResult([]);
    return typeof match[1] === "function" ? match[1]() : match[1];
  });
};

const statements = () => mockTxQuery.mock.calls.map(([sql]) => String(sql));
const ran = (pattern: RegExp) => statements().some(sql => pattern.test(sql));
const auditEvents = () =>
  mockTxQuery.mock.calls
    .filter(([sql]) => /INSERT INTO client_portal_audit_events/.test(String(sql)))
    .map(([, params]) => (params as unknown[])[8] as string);

const TEAM = "team-1";
const staff = { side: "internal" as const, name: "Kasun F.", userId: "user-1" };

beforeEach(() => {
  mockedQuery.mockReset();
  mockTxQuery.mockReset();
  mockRelease.mockReset();
  mockedNotifyStaff.mockReset();
  mockedConnect.mockReset();
  mockedConnect.mockResolvedValue({ query: mockTxQuery, release: mockRelease });
  mockedQuery.mockResolvedValue(createQueryResult([]));
});

// ─── Approvals ──────────────────────────────────────────────────────────────

describe("approval decisions", () => {
  const subject = (overrides: Partial<ClientSubject> = {}): ClientSubject => ({
    contactId: "alex",
    clientId: "client-1",
    teamId: TEAM,
    role: "admin",
    name: "Alex Chen",
    email: "alex@brandbase.com",
    clientUserId: "login-1",
    ...overrides,
  });

  const approvalRow = (overrides: Record<string, unknown> = {}) => ({
    id: "ap1", ref_no: "AP-000123", client_id: "client-1", project_id: "project-1", title: "Approve wireframe v3",
    status: "awaiting", revision: 1, linked_type: "file", item_name: "Wireframe.fig", approver_contact_id: "alex", approver_ids: ["alex"],
    client_name: "Brandbase", ...overrides,
  });

  // The project gate (assigned, Client Portal switch on) passes unless a test says otherwise.
  const projectOpen: Handler = [/FROM projects p\s+JOIN project_client_settings/, createQueryResult([{ id: "project-1" }])];

  const decide = (handlers: Handler[], input: Partial<Parameters<typeof recordApprovalDecision>[0]> = {}) => {
    stubTransaction([...handlers, projectOpen]);
    return recordApprovalDecision({ teamId: TEAM, approvalId: "ap1", subject: subject(), outcome: "approved", comment: "Looks great", ...input });
  };

  const lock = (row = approvalRow()): Handler => [/FOR UPDATE OF a/, createQueryResult([row])];
  const revisionUpdated: Handler = [
    /UPDATE client_portal_approval_revisions/,
    createQueryResult([{ item_name: "Wireframe.fig", file_version: 3 }]),
  ];

  it("records an approval with the file version, audits it and notifies staff", async () => {
    const result = await decide([lock(), revisionUpdated]);

    expect(result).toEqual({ recorded: true });
    expect(ran(/UPDATE client_portal_approvals SET status/)).toBe(true);
    expect(auditEvents()).toEqual(["Approval: approved"]);
    // The history line names the exact version approved.
    const history = mockTxQuery.mock.calls.find(([sql]) => /INSERT INTO client_portal_approval_events/.test(String(sql)))!;
    expect(String((history[1] as unknown[])[4])).toContain("Wireframe.fig v3");
    expect(mockedNotifyStaff).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "Approval", emailEvent: "approval_decision", url: "/worklenz/client-portal/approvals/ap1" })
    );
  });

  it("is idempotent: a second decision on the same revision records nothing", async () => {
    // The first request already wrote the outcome, so the guarded UPDATE matches no row.
    const result = await decide([lock(), [/UPDATE client_portal_approval_revisions/, createQueryResult([])]]);

    expect(result).toEqual({ recorded: false });
    expect(ran(/UPDATE client_portal_approvals SET status/)).toBe(false);
    expect(auditEvents()).toEqual([]);
    expect(mockedNotifyStaff).not.toHaveBeenCalled();
  });

  it("ignores a decision once the approval is no longer awaiting, without touching anything", async () => {
    const result = await decide([lock(approvalRow({ status: "approved" }))]);

    expect(result).toEqual({ recorded: false });
    expect(ran(/UPDATE client_portal_approval_revisions/)).toBe(false);
    expect(auditEvents()).toEqual([]);
  });

  it("only lets a named approver decide", async () => {
    await expect(decide([lock(approvalRow({ approver_contact_id: "someone-else", approver_ids: ["someone-else"] }))])).rejects.toMatchObject({
      status: 403,
      code: "NOT_THE_APPROVER",
    });
    expect(ran(/UPDATE client_portal_approval_revisions/)).toBe(false);
  });

  it("refuses a decision once the project assignment was removed or the portal switched off", async () => {
    // SUBJECT_PROJECTS_SQL returns no row for either: the gate answers 404 and nothing is written.
    const closed: Handler = [/FROM projects p\s+JOIN project_client_settings/, createQueryResult([])];
    stubTransaction([lock(), revisionUpdated, closed]);
    await expect(
      recordApprovalDecision({ teamId: TEAM, approvalId: "ap1", subject: subject(), outcome: "approved", comment: "ok" })
    ).rejects.toMatchObject({ status: 404 });
    expect(ran(/UPDATE client_portal_approval_revisions/)).toBe(false);
    expect(auditEvents()).toEqual([]);
    expect(mockedNotifyStaff).not.toHaveBeenCalled();
    // The gate is asked about this contact, this client, this team and the approval's project.
    const gate = mockTxQuery.mock.calls.find(([sql]) => /FROM projects p\s+JOIN project_client_settings/.test(String(sql)))!;
    expect(gate[1]).toEqual(["alex", "client-1", TEAM, "project-1"]);
  });

  it("treats a draft, or another organization's approval, as not found", async () => {
    await expect(decide([lock(approvalRow({ status: "draft" }))])).rejects.toMatchObject({ status: 404 });
    await expect(decide([lock(approvalRow({ client_id: "client-2" }))])).rejects.toMatchObject({ status: 404 });
  });

  it("needs a comment to request changes, but not to approve", async () => {
    await expect(decide([], { outcome: "changes_requested", comment: "   " })).rejects.toMatchObject({
      status: 400,
      code: "COMMENT_REQUIRED",
    });
    await expect(decide([lock(), revisionUpdated], { comment: undefined })).resolves.toEqual({ recorded: true });
  });

  it("lets only a Client Admin decide, even when a Member or Viewer is the named approver", async () => {
    for (const role of ["member", "viewer"] as const) {
      await expect(decide([lock()], { subject: subject({ role }) })).rejects.toMatchObject({ status: 403, code: "ROLE_FORBIDDEN" });
    }
    expect(ran(/UPDATE client_portal_approval_revisions/)).toBe(false);
    expect(auditEvents()).toEqual([]);
  });

  it("records changes requested without a comment once the client confirmed it", async () => {
    const result = await decide([lock(), revisionUpdated], { outcome: "changes_requested", comment: "", confirmEmpty: true });
    expect(result).toEqual({ recorded: true });
    expect(auditEvents()).toEqual(["Approval: changes requested"]);
    // No quoted comment in the history line.
    const history = mockTxQuery.mock.calls.find(([sql]) => /INSERT INTO client_portal_approval_events/.test(String(sql)))!;
    expect(String((history[1] as unknown[])[4])).not.toContain('"');
  });

  it("rejects an outcome that is neither approved nor changes requested", async () => {
    await expect(decide([], { outcome: "maybe" as any })).rejects.toMatchObject({ status: 400 });
  });

  it("audits a changes-requested decision under its own event", async () => {
    await decide([lock(), revisionUpdated], { outcome: "changes_requested", comment: "Move the pricing article first." });
    expect(auditEvents()).toEqual(["Approval: changes requested"]);
  });
});

// ─── Change requests ────────────────────────────────────────────────────────

describe("change request lifecycle", () => {
  const requestRow = (status: string, overrides: Record<string, unknown> = {}) => ({
    id: "cr1", cr_no: "CR-0046", client_id: "client-1", project_id: "project-1", title: "Add testimonials carousel",
    status, assignee_team_member_id: null, requester_contact_id: "jamie", client_name: "Brandbase",
    project_name: "Website", estimate_hours: null, estimate_cost: null, priority: "low", ...overrides,
  });

  const readBack = (status: string) => {
    mockedQuery.mockImplementation(async (sql: string) => {
      if (/FROM client_portal_change_requests r/.test(sql)) {
        return createQueryResult([
          { id: "cr1", cr_no: "CR-0046", client_id: "client-1", project_id: "project-1", title: "T", description: "D", notes: "", priority: "low", requester_contact_id: "jamie", requester_name: "Jamie", submitted_at: "x", status, assignee_team_member_id: null, assignee_name: null, estimate_hours: null, estimate_cost: null, response: "", internal_assessment: "", linked_task_id: null, linked_task_key: null, linked_task_mode: null, project_name: "Website", organization_name: "Brandbase", attachments: [] },
        ]);
      }
      return createQueryResult([]);
    });
  };

  const act = (status: string, body: Parameters<typeof applyChangeRequestAction>[0]["body"], overrides: Record<string, unknown> = {}, extra = {}) => {
    stubTransaction([
      [/FOR UPDATE OF r/, createQueryResult([requestRow(status, overrides)])],
      [/SELECT 1 FROM client_portal_change_requests WHERE id/, createQueryResult([{ "?column?": 1 }])],
      [/INSERT INTO client_portal_threads/, createQueryResult([{ id: "thread-1" }])],
    ]);
    readBack(status);
    return applyChangeRequestAction({ teamId: TEAM, id: "cr1", userId: "user-1", actorMemberId: "member-1", actor: staff, body, ...extra });
  };

  it("never lets a closed request change again", async () => {
    for (const status of ["completed", "rejected", "cancelled"]) {
      await expect(act(status, { action: "cancel" })).rejects.toMatchObject({ status: 409, code: "INVALID_TRANSITION" });
    }
    expect(ran(/UPDATE client_portal_change_requests\s+SET status/)).toBe(false);
  });

  it("only offers the actions that make sense for the current status", async () => {
    await expect(act("submitted", { action: "approve" })).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await expect(act("under_review", { action: "complete" })).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await expect(act("more_info", { action: "approve" })).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("requires a written response to reject or to ask for more information", async () => {
    await expect(act("under_review", { action: "reject", response: "  " })).rejects.toMatchObject({ code: "RESPONSE_REQUIRED" });
    await expect(act("under_review", { action: "ask_more_info", response: "" })).rejects.toMatchObject({ code: "RESPONSE_REQUIRED" });
    expect(ran(/UPDATE client_portal_change_requests\s+SET status/)).toBe(false);
  });

  it("starts a review and assigns the reviewer when there is no assignee", async () => {
    await act("submitted", { action: "start_review" });
    const assign = mockTxQuery.mock.calls.find(([sql]) => /SET assignee_team_member_id/.test(String(sql)));
    expect(assign?.[1]).toEqual(["cr1", "member-1"]);
    expect(auditEvents()).toEqual(["Change request status changed"]);
  });

  it("keeps an existing assignee when a review starts", async () => {
    await act("submitted", { action: "start_review" }, { assignee_team_member_id: "member-9" });
    expect(ran(/SET assignee_team_member_id/)).toBe(false);
  });

  it("approves with the estimate in the history and tells the requester", async () => {
    await act("under_review", { action: "approve", response: "Approved.", estimate: { hours: 12, cost: 960 } });

    const history = mockTxQuery.mock.calls.find(([sql]) => /INSERT INTO client_portal_change_request_events/.test(String(sql)))!;
    expect(String((history[1] as unknown[])[3])).toBe("Approved with an estimate of 12 hours / $960");
    const label = mockTxQuery.mock.calls.find(([sql]) => /INSERT INTO client_portal_audit_events/.test(String(sql)))!;
    expect((label[1] as unknown[])[11]).toBe("CR-0046 · Under Review → Approved");
  });

  it("approves without inventing a zero estimate when staff entered none", async () => {
    await act("under_review", { action: "approve" });
    const history = mockTxQuery.mock.calls.find(([sql]) => /INSERT INTO client_portal_change_request_events/.test(String(sql)))!;
    expect(String((history[1] as unknown[])[3])).toBe("Approved");
    expect(ran(/SET estimate_hours/)).toBe(false);
  });

  it("rejects a negative estimate", async () => {
    await expect(act("under_review", { action: "approve", estimate: { hours: -1, cost: 0 } })).rejects.toMatchObject({ status: 400 });
  });

  it("audits completion under its own event", async () => {
    await act("in_progress", { action: "complete", response: "Delivered." });
    expect(auditEvents()).toEqual(["Change request completed"]);
  });

  it("can send a response without changing the status", async () => {
    await act("under_review", { action: "send_response", response: "We are looking into it." });
    expect(ran(/UPDATE client_portal_change_requests\s+SET status/)).toBe(false);
    expect(auditEvents()).toEqual([]);
    expect(ran(/INSERT INTO client_portal_change_request_messages/)).toBe(true);
    // The response also lands in the request's discussion thread, as a client-visible team message.
    expect(ran(/INSERT INTO client_portal_threads/)).toBe(true);
    expect(ran(/INSERT INTO client_portal_thread_messages/)).toBe(true);
  });
});

// ─── Client users ───────────────────────────────────────────────────────────

describe("client user lifecycle", () => {
  const userRef = (overrides: Record<string, unknown> = {}) => ({
    id: "alex", name: "Alex Chen", email: "alex@brandbase.com", client_id: "client-1",
    organization_name: "Brandbase", role: "admin", status_key: "active", has_login: true, ...overrides,
  });

  const handlers = (user: Record<string, unknown>, otherActiveAdmins: number): Handler[] => [
    [/JOIN client_contacts cc ON cc\.id = u\.id/, createQueryResult([userRef(user)])],
    [/SELECT COUNT\(\*\)::int AS n/, createQueryResult([{ n: otherActiveAdmins }])],
  ];

  const readBack = () => {
    mockedQuery.mockImplementation(async () =>
      createQueryResult([
        { id: "alex", client_id: "client-1", name: "Alex Chen", email: "a@b.c", role: "admin", status_key: "deactivated", organization_name: "Brandbase", projects: [], invitation_lapsed: false, no_invitation: false },
      ])
    );
  };

  it("warns before deactivating the last active Client Admin of an organization", async () => {
    stubTransaction(handlers({}, 0));
    await expect(deactivateClientUser({ teamId: TEAM, userId: "alex", actor: staff })).rejects.toMatchObject({
      status: 409,
      code: "LAST_CLIENT_ADMIN",
    });
    expect(ran(/SET disabled_at/)).toBe(false);
  });

  it("deactivates the last Client Admin once staff confirm", async () => {
    stubTransaction(handlers({}, 0));
    readBack();
    await deactivateClientUser({ teamId: TEAM, userId: "alex", actor: staff, confirmLastAdmin: true });
    expect(ran(/SET disabled_at/)).toBe(true);
    expect(auditEvents()).toEqual(["Client deactivated"]);
  });

  it("does not warn when another active Client Admin remains", async () => {
    stubTransaction(handlers({}, 1));
    readBack();
    await deactivateClientUser({ teamId: TEAM, userId: "alex", actor: staff });
    expect(ran(/SET disabled_at/)).toBe(true);
  });

  it("does not warn about a Client Member", async () => {
    stubTransaction(handlers({ role: "member" }, 0));
    readBack();
    await deactivateClientUser({ teamId: TEAM, userId: "alex", actor: staff });
    expect(ran(/SET disabled_at/)).toBe(true);
  });

  it("warns before demoting the last Client Admin, and writes Role changed with from and to", async () => {
    stubTransaction(handlers({}, 0));
    await expect(
      updateClientUser({ teamId: TEAM, userId: "alex", actor: staff, patch: { role: "viewer" } })
    ).rejects.toMatchObject({ code: "LAST_CLIENT_ADMIN" });

    stubTransaction(handlers({}, 0));
    readBack();
    await updateClientUser({ teamId: TEAM, userId: "alex", actor: staff, patch: { role: "viewer", confirm_last_admin: true } });
    expect(auditEvents()).toEqual(["Role changed"]);
    const label = mockTxQuery.mock.calls.find(([sql]) => /INSERT INTO client_portal_audit_events/.test(String(sql)))!;
    expect((label[1] as unknown[])[11]).toBe("Alex Chen · Client Admin → Client Viewer");
  });

  it("rejects a role that is not one of the three", async () => {
    stubTransaction(handlers({ role: "member" }, 1));
    await expect(
      updateClientUser({ teamId: TEAM, userId: "alex", actor: staff, patch: { role: "poc" } })
    ).rejects.toMatchObject({ status: 400 });
  });

  it("refuses to change the email of a user who already has a login", async () => {
    stubTransaction(handlers({ role: "member", has_login: true }, 1));
    await expect(
      updateClientUser({ teamId: TEAM, userId: "alex", actor: staff, patch: { email: "new@brandbase.com" } })
    ).rejects.toMatchObject({ status: 409, code: "HAS_LOGIN" });
  });
});

// ─── Settings ───────────────────────────────────────────────────────────────

describe("saving portal settings", () => {
  const savedRow = (overrides: Record<string, unknown> = {}) => ({
    visible_invoices: false, allow_client_uploads_default: true, poc_can_add_users: false, poc_can_remove_users: false,
    client_email_events: {}, team_email_events: {}, ...overrides,
  });

  it("audits only the permission switches that actually changed", async () => {
    stubTransaction([[/FROM client_portal_settings WHERE organization_team_id/, createQueryResult([savedRow()])]]);

    await savePortalSettingsV2(mockTx(), { teamId: TEAM, actor: staff, patch: { show_invoices: true, admins_can_invite_users: false } });

    expect(auditEvents()).toEqual(["Permission setting changed"]);
    const event = mockTxQuery.mock.calls.find(([sql]) => /INSERT INTO client_portal_audit_events/.test(String(sql)))!;
    expect((event[1] as unknown[])[11]).toBe("Show Invoices in the client portal: On");
  });

  it("audits nothing for a change that is not a permission change", async () => {
    stubTransaction([[/FROM client_portal_settings WHERE organization_team_id/, createQueryResult([savedRow()])]]);
    await savePortalSettingsV2(mockTx(), { teamId: TEAM, actor: staff, patch: { allow_client_uploads_default: false } });
    expect(auditEvents()).toEqual([]);
  });
});

function mockTx() {
  return { query: (sql: string, params?: unknown[]) => mockTxQuery(sql, params) } as any;
}
