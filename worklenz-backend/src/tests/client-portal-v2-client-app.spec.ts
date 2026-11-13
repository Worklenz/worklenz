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
import { cancelClientChangeRequest, getClientApproval, getClientChangeRequest, getClientThread, markClientThreadRead } from "../services/client-portal-v2/client-detail.service";
import { getClientMe, getNotificationPrefs, listTimezones, updateClientMe, updateNotificationPrefs } from "../services/client-portal-v2/client-me.service";
import { listClientNotifications, markAllClientNotificationsRead, setClientNotificationRead } from "../services/client-portal-v2/client-notifications.service";
import { createOrganizationInviteLink, listOrganizationUsers, removeOrganizationUser, resendOrganizationInvite, setOrganizationUserProjects, updateOrganizationUser } from "../services/client-portal-v2/client-organization.service";
import { getClientDashboard, listClientFiles } from "../services/client-portal-v2/client-read.service";
import { listClientThreads } from "../services/client-portal-v2/client-write.service";
import { notifyStaff } from "../services/client-portal-v2/notify.service";
import type { ClientSubject } from "../services/client-portal-v2/subject";
import { requireInvoicesVisible } from "../middlewares/client-invoices-visible-middleware";
import { createQueryResult } from "./utils/db-mock";

const mockedQuery = db.query as jest.Mock;
const mockedConnect = (db.pool as any).connect as jest.Mock;
const mockedNotifyStaff = notifyStaff as jest.Mock;

type Handler = [RegExp, any];

const route = (handlers: Handler[]) => async (sql: string) => {
  const match = handlers.find(([pattern]) => pattern.test(String(sql)));
  if (!match) return createQueryResult([]);
  return typeof match[1] === "function" ? match[1]() : match[1];
};
/** Routes db.query (the shared pool) by SQL text. */
const stubDb = (handlers: Handler[]) => mockedQuery.mockImplementation(route(handlers));
/** Routes a transaction's statements by SQL text. */
const stubTx = (handlers: Handler[]) => mockTxQuery.mockImplementation(route(handlers));

const dbSql = () => mockedQuery.mock.calls.map(([sql]) => String(sql));
const txSql = () => mockTxQuery.mock.calls.map(([sql]) => String(sql));
const txRan = (pattern: RegExp) => txSql().some(sql => pattern.test(sql));
const auditEvents = () =>
  mockTxQuery.mock.calls
    .filter(([sql]) => /INSERT INTO client_portal_audit_events/.test(String(sql)))
    .map(([, params]) => (params as unknown[])[8] as string);

/** What the shared user lookup (`getUserRef`) and the organization lock read. */
const USER_LOOKUP = /JOIN client_contacts cc ON cc\.id = u\.id/;
const ORGANIZATION_LOCK = /FROM clients\s+WHERE id = \$1 AND team_id = \$2\s+FOR UPDATE/;
const ORGANIZATION_ROW = { id: "client-1", name: "Brandbase", display_name: "Brandbase", status: "active", deleted_at: null };
const userRef = (overrides: Record<string, unknown> = {}) => ({
  id: "jamie", name: "Jamie Wu", email: "j@x.io", client_id: "client-1", organization_name: "Brandbase",
  role: "member", status_key: "active", has_login: true, login_id: null, ...overrides,
});

const subject = (role: ClientSubject["role"] = "admin", overrides: Partial<ClientSubject> = {}): ClientSubject => ({
  contactId: "alex",
  clientId: "client-1",
  teamId: "team-1",
  role,
  name: "Alex Chen",
  email: "alex@brandbase.com",
  clientUserId: "login-1",
  ...overrides,
});

const PROJECT_ROW: Handler = [/FROM projects p\s+JOIN project_client_settings/, createQueryResult([{ id: "project-1" }])];

beforeEach(() => {
  mockedQuery.mockReset();
  mockTxQuery.mockReset();
  mockRelease.mockReset();
  mockedNotifyStaff.mockReset();
  mockedConnect.mockReset();
  mockedConnect.mockResolvedValue({ query: mockTxQuery, release: mockRelease });
  mockedQuery.mockResolvedValue(createQueryResult([]));
});

// ─── GET /me and Settings ───────────────────────────────────────────────────

describe("the signed-in person (GET /me)", () => {
  const meRow = { name: "Alex Chen", email: "alex@brandbase.com", job_title: "Creative Director", language: "es", timezone: "Asia/Colombo", organization_name: "Brandbase", operator_name: "Ceydigital" };
  const settingsRow = { visible_invoices: true, poc_can_add_users: true, poc_can_remove_users: false, client_email_events: { approval_request: true, file_shared: false, access_changes: true, comment_or_reply: true } };
  const handlers: Handler[] = [
    [/FROM client_contacts cc\s+JOIN clients c/, createQueryResult([meRow])],
    [/FROM client_portal_settings/, createQueryResult([settingsRow])],
  ];

  it("reports the role's capabilities, the operator switches and the emailed event types", async () => {
    stubDb(handlers);
    const me = await getClientMe(db as any, subject("admin"));
    expect(me).toMatchObject({ role: "admin", language: "es", timezone: "Asia/Colombo", organizationName: "Brandbase", operatorName: "Ceydigital", invoicesVisible: true, adminsCanInvite: true, adminsCanRemove: false });
    expect(me.capabilities).toEqual({ comment: true, upload: true, submitChangeRequest: true, approve: true, manageUsers: true });
    expect(me.emailedEventTypes).toEqual(expect.arrayContaining(["Approval", "Comment", "Access"]));
    expect(me.emailedEventTypes).not.toContain("File");
  });

  it("gives a Viewer a read-only capability set and a Member no approval or user management", async () => {
    stubDb(handlers);
    expect((await getClientMe(db as any, subject("viewer"))).capabilities).toEqual({ comment: false, upload: false, submitChangeRequest: false, approve: false, manageUsers: false });
    expect((await getClientMe(db as any, subject("member"))).capabilities).toMatchObject({ comment: true, approve: false, manageUsers: false });
  });
});

describe("updating your own profile and preferences (PUT /me)", () => {
  const known: Handler[] = [[/FROM timezones WHERE name/, createQueryResult([{ "?column?": 1 }])]];

  it("saves name, job title, language and a known time zone", async () => {
    stubDb(known);
    await updateClientMe(db as any, subject(), { name: "  Alexandra Chen ", job_title: "Director", language: "fr", timezone: "Asia/Colombo" });
    const update = mockedQuery.mock.calls.find(([sql]) => /UPDATE client_contacts SET/.test(String(sql)))!;
    expect(String(update[0])).toMatch(/name = \$3/);
    expect(update[1]).toEqual(["alex", "team-1", "Alexandra Chen", "Director", "fr", "Asia/Colombo"]);
  });

  it("clears the time zone back to the browser's with null", async () => {
    stubDb([]);
    await updateClientMe(db as any, subject(), { timezone: null });
    const update = mockedQuery.mock.calls.find(([sql]) => /UPDATE client_contacts SET/.test(String(sql)))!;
    expect((update[1] as unknown[])[2]).toBeNull();
  });

  it("rejects an empty name, an unknown language and a time zone that is not in the list", async () => {
    stubDb([]);
    await expect(updateClientMe(db as any, subject(), { name: "   " })).rejects.toMatchObject({ status: 400, code: "MISSING_FIELDS" });
    await expect(updateClientMe(db as any, subject(), { language: "xx" })).rejects.toMatchObject({ status: 400, code: "INVALID_LANGUAGE" });
    await expect(updateClientMe(db as any, subject(), { timezone: "Mars/Olympus" })).rejects.toMatchObject({ status: 400, code: "INVALID_TIMEZONE" });
    expect(dbSql().some(sql => /UPDATE client_contacts/.test(sql))).toBe(false);
  });

  it("ignores fields it does not own: email and role can't be changed here", async () => {
    stubDb([]);
    await updateClientMe(db as any, subject("viewer"), { email: "x@y.z", role: "admin", name: "Sam" } as any);
    const update = mockedQuery.mock.calls.find(([sql]) => /UPDATE client_contacts SET/.test(String(sql)))!;
    expect(String(update[0])).not.toMatch(/email|role/);
  });

  it("lists time zones from the shared table", async () => {
    stubDb([[/FROM timezones ORDER BY name/, createQueryResult([{ id: "t1", name: "Asia/Colombo", abbrev: "+0530" }])]]);
    expect(await listTimezones(db as any)).toEqual([{ id: "t1", name: "Asia/Colombo", abbrev: "+0530" }]);
  });
});

describe("email notification preferences", () => {
  it("defaults every event to off and honours a stored on", async () => {
    stubDb([[/FROM client_contact_notification_prefs/, createQueryResult([{ event_type: "file_shared", email: true }])]]);
    const prefs = await getNotificationPrefs(db as any, subject());
    expect(prefs.File).toBe(true);
    expect(prefs.Approval).toBe(false);
    expect(Object.keys(prefs)).toHaveLength(7);
  });

  it("stores one event per type, keyed to the operator's event names", async () => {
    stubDb([]);
    await updateNotificationPrefs(db as any, subject(), { Comment: false, Bogus: true });
    const writes = mockedQuery.mock.calls.filter(([sql]) => /INSERT INTO client_contact_notification_prefs/.test(String(sql)));
    expect(writes).toHaveLength(1);
    expect(writes[0][1]).toEqual(["alex", "comment_or_reply", false]);
  });

  it("rejects a value that is not true or false", async () => {
    stubDb([]);
    await expect(updateNotificationPrefs(db as any, subject(), { Comment: "yes" })).rejects.toMatchObject({ status: 400 });
  });
});

// ─── Notifications are per person ───────────────────────────────────────────

describe("client notifications", () => {
  const row = { id: "n1", type: "approval", reference_id: "ap1", title: "Approval requested", message: "AP-1", created_at: "2026-06-01T10:00:00Z", project_id: "project-1", is_read: false };

  it("returns nothing for a person with no projects, without querying notifications", async () => {
    stubDb([]);
    expect(await listClientNotifications(db as any, subject())).toEqual({ items: [], unread_count: 0 });
    expect(dbSql().some(sql => /FROM client_portal_notifications/.test(sql))).toBe(false);
  });

  it("scopes every read by organization, project access, named recipients and the item's own visibility", async () => {
    stubDb([PROJECT_ROW, [/SELECT n\.id, n\.type/, createQueryResult([row])], [/SELECT COUNT\(\*\)::int AS n/, createQueryResult([{ n: 3 }])]]);
    const result = await listClientNotifications(db as any, subject());

    const list = dbSql().find(sql => /SELECT n\.id, n\.type/.test(sql))!;
    expect(list).toMatch(/n\.client_id = \$1/);
    expect(list).toMatch(/n\.organization_team_id = \$2/);
    expect(list).toMatch(/\(n\.metadata ->> 'project_id'\)::uuid = ANY\(\$3::uuid\[\]\)/);
    expect(list).toMatch(/contact_ids/);
    expect(list).toMatch(/portal_visibility = 'client'/);
    // Read state is the person's own.
    expect(list).toMatch(/client_portal_notification_reads r/);
    expect(result.unread_count).toBe(3);
    expect(result.items[0]).toMatchObject({ id: "n1", type: "Approval", unread: true, emailed: false, target: { page: "approval", id: "ap1" } });
  });

  it("maps each stored type to the client's type and deep link", async () => {
    const rows = [
      { ...row, id: "a", type: "file", reference_id: "f1" },
      { ...row, id: "b", type: "milestone", reference_id: "m1" },
      { ...row, id: "c", type: "discussion", reference_id: "th1" },
      { ...row, id: "d", type: "project_update", reference_id: "u1" },
      { ...row, id: "e", type: "change_request", reference_id: "cr1" },
    ];
    stubDb([PROJECT_ROW, [/SELECT n\.id, n\.type/, createQueryResult(rows)]]);
    const { items } = await listClientNotifications(db as any, subject());
    expect(items.map(item => [item.type, item.target])).toEqual([
      ["File", { page: "file", projectId: "project-1", id: "f1" }],
      ["Milestone", { page: "milestone", projectId: "project-1", id: "m1" }],
      ["Comment", { page: "thread", projectId: "project-1", id: "th1" }],
      ["Project", { page: "project", projectId: "project-1" }],
      ["Change Request", { page: "change_request", id: "cr1" }],
    ]);
  });

  it("marks emailed true only when operator allows event and client opted in", async () => {
    stubDb([
      PROJECT_ROW,
      [/SELECT n\.id, n\.type/, createQueryResult([row])],
      [/FROM client_portal_settings/, createQueryResult([{ client_email_events: { approval_request: true } }])],
      [/FROM client_contact_notification_prefs/, createQueryResult([{ event_type: "approval_request", email: true }])],
    ]);
    const res = await listClientNotifications(db as any, subject());
    expect(res.items[0].emailed).toBe(true);
  });

  it("marks one read or unread only when it is visible to this person, else 404", async () => {
    stubDb([PROJECT_ROW]);
    await expect(setClientNotificationRead(db as any, subject(), "n-hidden", true)).rejects.toMatchObject({ status: 404 });
    expect(dbSql().some(sql => /INSERT INTO client_portal_notification_reads/.test(sql))).toBe(false);

    stubDb([PROJECT_ROW, [/AND n\.id = \$6::uuid/, createQueryResult([{ id: "n1" }])]]);
    await setClientNotificationRead(db as any, subject(), "n1", true);
    const insert = mockedQuery.mock.calls.find(([sql]) => /INSERT INTO client_portal_notification_reads/.test(String(sql)))!;
    expect(insert[1]).toEqual(["n1", "alex"]);
    await setClientNotificationRead(db as any, subject(), "n1", false);
    expect(dbSql().some(sql => /DELETE FROM client_portal_notification_reads/.test(sql))).toBe(true);
  });

  it("mark-all writes only this person's read rows for what they can see", async () => {
    stubDb([PROJECT_ROW]);
    await markAllClientNotificationsRead(db as any, subject());
    const write = mockedQuery.mock.calls.find(([sql]) => /INSERT INTO client_portal_notification_reads/.test(String(sql)))!;
    expect(String(write[0])).toMatch(/\(n\.metadata ->> 'project_id'\)::uuid = ANY/);
    expect((write[1] as unknown[])[3]).toBe("alex");
  });
});

// ─── Single-item reads ──────────────────────────────────────────────────────

describe("approval detail", () => {
  const approvalRow = (overrides: Record<string, unknown> = {}) => ({
    id: "ap1", ref_no: "AP-000123", project_id: "project-1", project_name: "P", title: "Approve", status: "awaiting", revision: 1,
    linked_type: "freeform", item_name: "Launch", freeform_description: "Soft launch", instructions: "", due_date: null, created_by_name: "Kasun F.",
    approver_names: "Alex Chen", is_approver: true, is_overdue: false, item_available: true, ...overrides,
  });
  const listed: Handler = [/FROM client_portal_approvals a\s+JOIN projects p/, createQueryResult([approvalRow()])];

  it("is a 404 for an approval that is not in the person's list, hidden or missing alike", async () => {
    stubDb([PROJECT_ROW, listed]);
    await expect(getClientApproval(db as any, subject(), "nope")).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("adds the history without the team's drafting notes, and earlier free-form revisions", async () => {
    stubDb([
      PROJECT_ROW,
      listed,
      [/FROM client_portal_approval_events/, createQueryResult([
        { actor_name: "Kasun F.", text: "Draft created. Not visible to the client until sent.", created_at: "t0" },
        { actor_name: "System", text: "Alex Chen notified by email and in the portal", created_at: "t1" },
        { actor_name: "Kasun F.", text: "Approval requested for Launch", created_at: "t2" },
        { actor_name: "Alex Chen", text: "Requested changes (Launch, revision 1)", created_at: "t3" },
      ])],
      [/FROM client_portal_approval_revisions/, createQueryResult([{ revision: 1, description_snapshot: "Old text" }])],
    ]);
    const detail = await getClientApproval(db as any, subject(), "ap1");
    expect(detail.history.map(entry => entry.text)).toEqual(["Approval requested for Launch", "Requested changes (Launch, revision 1)"]);
    expect(detail.earlier_revisions).toEqual([{ revision: 1, description: "Old text" }]);
    expect(detail.approver_name).toBe("Alex Chen");
    expect(detail.requested_by).toBe("Kasun F.");
  });
});

describe("change request detail", () => {
  const requestRow = (overrides: Record<string, unknown> = {}) => ({
    id: "cr1", cr_no: "CR-0047", project_id: "project-1", project_name: "P", title: "Mailchimp", description: "d", notes: "", priority: "medium",
    status: "more_info", submitted_at: "t", requester_name: "Jamie Wu", requester_contact_id: "jamie", estimate_hours: null, estimate_cost: null, response: "", attachments: [], ...overrides,
  });
  const detail = (row = requestRow()): Handler[] => [
    PROJECT_ROW,
    [/FROM client_portal_change_requests r\s+JOIN projects p/, createQueryResult([row])],
    [/FROM client_portal_change_request_messages/, createQueryResult([{ from_side: "team", author_name: "Kavindu K.", body: "Which plan?", created_at: "t1" }])],
    [/FROM client_portal_change_request_events/, createQueryResult([
      { text: "Submitted the change request", created_at: "t0" },
      { text: "Converted to work item WL-300", created_at: "t2" },
    ])],
    [/FROM client_portal_change_request_attachments/, createQueryResult([{ file_id: "f1", file_name: "brief.pdf" }])],
    [/SELECT requester_contact_id FROM client_portal_change_requests/, createQueryResult([{ requester_contact_id: row.requester_contact_id }])],
  ];

  it("returns the conversation, the timeline without internal work-item notes, and openable attachments", async () => {
    stubDb(detail());
    const result = await getClientChangeRequest(db as any, subject("member", { contactId: "jamie" }), "cr1");
    expect(result.thread).toEqual([{ from: "team", author: "Kavindu K.", text: "Which plan?", at: "t1" }]);
    expect(result.timeline.map(entry => entry.text)).toEqual(["Submitted the change request"]);
    expect(result.attachment_files).toEqual([{ id: "f1", name: "brief.pdf" }]);
  });

  it("lets the requester or a Client Admin cancel an open request, never a Viewer or another Member", async () => {
    stubDb(detail());
    expect((await getClientChangeRequest(db as any, subject("member", { contactId: "jamie" }), "cr1")).can_cancel).toBe(true);
    expect((await getClientChangeRequest(db as any, subject("admin"), "cr1")).can_cancel).toBe(true);
    expect((await getClientChangeRequest(db as any, subject("member", { contactId: "taylor" }), "cr1")).can_cancel).toBe(false);
    expect((await getClientChangeRequest(db as any, subject("viewer", { contactId: "jamie" }), "cr1")).can_cancel).toBe(false);
    stubDb(detail(requestRow({ status: "completed" })));
    expect((await getClientChangeRequest(db as any, subject("admin"), "cr1")).can_cancel).toBe(false);
  });

  it("is a 404 when the request is not the person's to see", async () => {
    stubDb([PROJECT_ROW]);
    await expect(getClientChangeRequest(db as any, subject(), "cr1")).rejects.toMatchObject({ status: 404 });
  });
});

describe("cancelling a change request", () => {
  const found = (overrides: Record<string, unknown> = {}): Handler => [
    /FOR UPDATE OF r/,
    createQueryResult([{ id: "cr1", cr_no: "CR-0049", title: "Cookie banner", status: "submitted", project_id: "project-1", client_id: "client-1", requester_contact_id: "jamie", client_name: "Brandbase", ...overrides }]),
  ];

  it("cancels, records the history and audit event, and tells the team", async () => {
    stubTx([found(), PROJECT_ROW]);
    await cancelClientChangeRequest(subject("member", { contactId: "jamie" }), "cr1");
    expect(txRan(/SET status = 'cancelled'/)).toBe(true);
    expect(txRan(/INSERT INTO client_portal_change_request_events/)).toBe(true);
    expect(auditEvents()).toEqual(["Change request status changed"]);
    expect(mockedNotifyStaff).toHaveBeenCalledWith(expect.objectContaining({ kind: "Change Request", url: "/worklenz/client-portal/change-requests/cr1" }));
  });

  it("lets a Client Admin cancel someone else's request", async () => {
    stubTx([found(), PROJECT_ROW]);
    await expect(cancelClientChangeRequest(subject("admin"), "cr1")).resolves.toBeUndefined();
  });

  it("refuses a Viewer, another Member, a closed request and an unknown one", async () => {
    await expect(cancelClientChangeRequest(subject("viewer", { contactId: "jamie" }), "cr1")).rejects.toMatchObject({ status: 403 });

    stubTx([found(), PROJECT_ROW]);
    // Another contact's request is not visible to a Member at all: the same 404 as a missing one.
    await expect(cancelClientChangeRequest(subject("member", { contactId: "taylor" }), "cr1")).rejects.toMatchObject({ status: 404 });

    stubTx([found({ status: "approved" }), PROJECT_ROW]);
    await expect(cancelClientChangeRequest(subject("admin"), "cr1")).rejects.toMatchObject({ status: 409, code: "REQUEST_CLOSED" });

    stubTx([PROJECT_ROW]);
    await expect(cancelClientChangeRequest(subject("admin"), "cr1")).rejects.toMatchObject({ status: 404 });
    expect(txRan(/SET status = 'cancelled'/)).toBe(false);
  });
});

// ─── Discussions: read state and rich text ──────────────────────────────────

describe("discussion threads", () => {
  const thread = (overrides: Record<string, unknown> = {}) => ({
    id: "th1", project_id: "project-1", project_name: "P", context_type: "task", context_ref_id: "task-1", context_label: "Task: Landing page copy", unread: true, ...overrides,
  });
  const handlers = (threads = [thread()]): Handler[] => [
    PROJECT_ROW,
    [/FROM client_portal_threads th\s+JOIN projects p/, createQueryResult(threads)],
    [/FROM client_portal_thread_messages m/, createQueryResult([
      { id: "m1", thread_id: "th1", author_name: "Kasun F.", author_side: "internal", body: "<p>Hello <strong>@Alex Chen</strong></p>", created_at: "t1", mine: false, attachments: [], mention_names: ["Alex Chen"] },
      { id: "m2", thread_id: "th1", author_name: "Alex Chen", author_side: "client", body: "a < b & c", created_at: "t2", mine: true, attachments: [], mention_names: [] },
    ])],
  ];

  it("returns the unread flag, the item the thread is about, and a per-person read lookup", async () => {
    stubDb(handlers());
    const [first] = await listClientThreads(subject());
    expect(first.unread).toBe(true);
    expect(first.context).toEqual({ type: "task", label: "Task: Landing page copy", ref_id: "task-1" });
    const sql = dbSql().find(query => /FROM client_portal_threads th\s+JOIN projects p/.test(query))!;
    expect(sql).toMatch(/client_portal_thread_client_reads/);
    expect(sql).toMatch(/um\.visibility IN \('client', 'client_only'\)/);
    expect(sql).toMatch(/author_contact_id IS DISTINCT FROM/);
  });

  it("returns each message as stored (rich text), with its attachments and whether it is the viewer's own", async () => {
    stubDb(handlers());
    const [first] = await listClientThreads(subject());
    expect(first.messages[0].text).toBe("<p>Hello <strong>@Alex Chen</strong></p>");
    expect(first.messages[1].text).toBe("a < b & c");
    expect(first.messages.map(message => message.attachments)).toEqual([[], []]);
    expect(first.messages.map(message => message.mine)).toEqual([false, true]);
    const sql = dbSql().find(query => /FROM client_portal_thread_messages m/.test(query))!;
    expect(sql).toMatch(/portal_visibility = 'client'/);
  });

  it("opens one thread, or the same 404 as a thread that is hidden or missing", async () => {
    stubDb(handlers());
    expect((await getClientThread(subject(), "th1")).id).toBe("th1");
    await expect(getClientThread(subject(), "th-hidden")).rejects.toMatchObject({ status: 404 });
  });

  it("marks a visible thread read for this person only, and refuses a thread they can't see", async () => {
    stubDb(handlers());
    await markClientThreadRead(subject(), "th1");
    const write = mockedQuery.mock.calls.find(([sql]) => /INSERT INTO client_portal_thread_client_reads/.test(String(sql)))!;
    expect(write[1]).toEqual(["th1", "alex"]);

    mockedQuery.mockClear();
    await expect(markClientThreadRead(subject(), "th-hidden")).rejects.toMatchObject({ status: 404 });
    expect(dbSql().some(sql => /INSERT INTO client_portal_thread_client_reads/.test(sql))).toBe(false);
  });
});

// ─── Dashboard additions ────────────────────────────────────────────────────

describe("dashboard", () => {
  const projectRow = { id: "project-1", name: "P", client_status: "on_track", current_phase: "Design", progress: 40, start_date: null, expected_completion: null, client_summary: "", allow_client_uploads: true, contact_name: null, open_approvals: 1, open_change_requests: 2, color: "#722ed1", contact_email: "k@x.io" };
  const approvalRow = (overrides: Record<string, unknown> = {}) => ({
    id: "ap1", ref_no: "AP-1", project_id: "project-1", project_name: "P", title: "Approve", status: "awaiting", revision: 1, linked_type: "file", item_name: "F", linked_file_version: 3,
    instructions: "", due_date: null, created_by_name: "Kasun F.", approver_names: "Alex Chen", is_approver: true, is_overdue: false, item_available: true, ...overrides,
  });
  const base = (settings: Record<string, unknown>, approval = approvalRow()): Handler[] => [
    // The project list query is listed first: it has the same shape as the single-project gate, and the first match wins.
    [/FROM projects p\s+JOIN project_client_settings/, createQueryResult([projectRow])],
    PROJECT_ROW,
    [/FROM client_portal_approvals a\s+JOIN projects p/, createQueryResult([approval])],
    [/FROM client_portal_settings/, createQueryResult([settings])],
    [/SUM\(GREATEST/, createQueryResult([{ unpaid: 1250 }])],
  ];

  it("carries the open item counts and project colour for the project list", async () => {
    stubDb(base({ visible_invoices: false }));
    const dashboard = await getClientDashboard(db as any, subject());
    expect(dashboard.projects[0]).toMatchObject({ open_approvals: 1, open_change_requests: 2, color: "#722ed1", contact_email: "k@x.io" });
  });

  it("reports the unpaid amount only when the operator turned invoices on", async () => {
    stubDb(base({ visible_invoices: false }));
    expect("unpaid_amount" in (await getClientDashboard(db as any, subject()))).toBe(false);
    expect(dbSql().some(sql => /SUM\(GREATEST/.test(sql))).toBe(false);

    stubDb(base({ visible_invoices: true }));
    expect((await getClientDashboard(db as any, subject())).unpaid_amount).toBe(1250);
  });

  it("lists approvals the person is waiting on someone else for, and shows the decidable ones as actions", async () => {
    stubDb(base({ visible_invoices: false }));
    const asAdmin = await getClientDashboard(db as any, subject("admin"));
    expect(asAdmin.needs_action.map(item => item.id)).toEqual(["ap1"]);
    expect(asAdmin.waiting_on_others).toEqual([]);

    const asMember = await getClientDashboard(db as any, subject("member"));
    expect(asMember.needs_action).toEqual([]);
    expect(asMember.waiting_on_others).toEqual([{ id: "ap1", ref_no: "AP-1", title: "Approve", waiting_for: "Alex Chen" }]);
  });

  it("builds recent activity from client-visible sources only, newest first", async () => {
    stubDb([
      ...base({ visible_invoices: false }),
      [/FROM project_client_updates u/, createQueryResult([{ id: "u1", project_id: "project-1", project_name: "P", at: "2026-06-01T10:00:00Z" }])],
      [/FROM project_files pf\s+LEFT JOIN LATERAL/, createQueryResult([{ id: "f2", project_id: "project-1", name: "Wireframe.fig", current_version: 3, at: "2026-06-02T10:00:00Z" }])],
      [/FROM client_portal_approval_events ev/, createQueryResult([{ id: "e1", approval_id: "ap1", ref_no: "AP-1", actor_name: "Kasun F.", text: "Approval requested for F", at: "2026-06-01T09:00:00Z" }])],
    ]);
    const { recent_activity } = await getClientDashboard(db as any, subject());
    expect(recent_activity.map(item => item.kind)).toEqual(["file", "project", "approval"]);

    const sources = dbSql().filter(sql => /ORDER BY .* DESC LIMIT 6/s.test(sql));
    const files = sources.find(sql => /FROM project_files pf/.test(sql) && /LEFT JOIN LATERAL/.test(sql))!;
    expect(files).toMatch(/portal_visibility = 'client'/);
    expect(sources.find(sql => /client_portal_approval_events/.test(sql))).toMatch(/a\.status <> 'draft'/);
    expect(sources.find(sql => /client_portal_approval_events/.test(sql))).toMatch(/a\.client_id = \$2/);
    expect(sources.find(sql => /FROM client_portal_milestones m/.test(sql))).toMatch(/m\.visibility = 'client'/);
  });
});

// ─── Account > Organization ─────────────────────────────────────────────────

describe("organization people, invites and removal", () => {
  const settings = (add: boolean, remove: boolean): Handler => [
    /FROM client_portal_settings/,
    createQueryResult([{ visible_invoices: false, poc_can_add_users: add, poc_can_remove_users: remove }]),
  ];

  it("lists only people of the caller's own organization, marking who they are", async () => {
    stubDb([[/WHERE u\.client_id = \$2/, createQueryResult([
      { id: "alex", name: "Alex Chen", email: "a@x.io", job_title: "Creative Director", role: "admin", status_key: "active" },
      { id: "jamie", name: "Jamie Wu", email: "j@x.io", job_title: null, role: "member", status_key: "invited" },
    ])]]);
    const people = await listOrganizationUsers(db as any, subject());
    expect(people).toEqual([
      { id: "alex", name: "Alex Chen", email: "a@x.io", jobTitle: "Creative Director", role: "admin", status: "Active", isYou: true },
      { id: "jamie", name: "Jamie Wu", email: "j@x.io", jobTitle: "", role: "member", status: "Invited", isYou: false },
    ]);
    expect(mockedQuery.mock.calls[0][1]).toEqual(["team-1", "client-1"]);
  });

  it("needs the Manage users capability AND the operator's invite switch", async () => {
    stubDb([settings(true, true)]);
    await expect(createOrganizationInviteLink(subject("member"), "new@x.io")).rejects.toMatchObject({ status: 403, code: "ROLE_FORBIDDEN" });
    await expect(createOrganizationInviteLink(subject("viewer"), "new@x.io")).rejects.toMatchObject({ status: 403 });

    stubDb([settings(false, false)]);
    await expect(createOrganizationInviteLink(subject("admin"), "new@x.io")).rejects.toMatchObject({ status: 403, code: "INVITES_DISABLED" });
  });

  it("rejects a bad address and one that already has access", async () => {
    stubDb([settings(true, true)]);
    await expect(createOrganizationInviteLink(subject("admin"), "not-an-email")).rejects.toMatchObject({ status: 400, code: "INVALID_EMAIL" });

    stubTx([[/FROM client_contacts cc\s+JOIN clients c ON c\.id = cc\.client_id\s+WHERE cc\.team_id/, createQueryResult([{ id: "c9", client_id: "client-9", email: "new@x.io" }])]]);
    await expect(createOrganizationInviteLink(subject("admin"), "new@x.io")).rejects.toMatchObject({ status: 409, code: "ALREADY_EXISTS" });
    expect(txRan(/INSERT INTO client_contacts/)).toBe(false);
  });

  it("creates a Client Viewer with no projects, audits it, and returns a 7-day link made by this admin", async () => {
    stubDb([
      settings(true, true),
      [/LEFT JOIN teams t ON t\.id = cc\.team_id\s+WHERE cc\.id/, createQueryResult([{ id: "c1", client_id: "client-1", name: "new", email: "new@x.io", disabled_at: null, client_name: "Brandbase", is_active: false, team_name: "Ceydigital" }])],
      [/UPDATE client_invitations/, createQueryResult([])],
      [/INSERT INTO client_invitations/, createQueryResult([{ expires_at: "2026-06-09T00:00:00Z" }])],
    ]);
    stubTx([
      [/INSERT INTO client_contacts/, createQueryResult([{ id: "c1", team_id: "team-1", client_id: "client-1", name: "new", email: "new@x.io", role: "viewer" }])],
      [/SELECT COALESCE\(NULLIF\(TRIM\(company_name\)/, createQueryResult([{ name: "Brandbase" }])],
    ]);

    const result = await createOrganizationInviteLink(subject("admin"), "  new@x.io ");

    expect(result.email).toBe("new@x.io");
    expect(result.expires_in_days).toBe(7);
    expect(result.link).toMatch(/^https:\/\/portal\.test\/invite\?token=wli_/);
    const insert = mockTxQuery.mock.calls.find(([sql]) => /INSERT INTO client_contacts/.test(String(sql)))!;
    expect((insert[1] as unknown[])[6]).toBe("viewer");
    expect(auditEvents()).toEqual(["Invite link created"]);
    // The invitation records the Client Admin, not a staff user.
    const invitation = mockedQuery.mock.calls.find(([sql]) => /INSERT INTO client_invitations/.test(String(sql)))!;
    expect(invitation[1]).toEqual(expect.arrayContaining(["alex", null]));
  });

  it("removes a colleague only with the capability and the operator's removal switch", async () => {
    stubDb([settings(true, false)]);
    await expect(removeOrganizationUser(subject("admin"), "jamie")).rejects.toMatchObject({ status: 403, code: "REMOVAL_DISABLED" });
    stubDb([settings(true, true)]);
    await expect(removeOrganizationUser(subject("member"), "jamie")).rejects.toMatchObject({ status: 403, code: "ROLE_FORBIDDEN" });
  });

  it("won't remove yourself, someone from another organization, or the last Client Admin", async () => {
    stubDb([settings(true, true)]);
    await expect(removeOrganizationUser(subject("admin"), "alex")).rejects.toMatchObject({ status: 409, code: "CANNOT_REMOVE_SELF" });

    stubTx([]);
    await expect(removeOrganizationUser(subject("admin"), "stranger")).rejects.toMatchObject({ status: 404 });

    // A person of another organization of the same workspace looks exactly like nobody, and that
    // organization is never locked on a stranger's behalf.
    stubTx([[USER_LOOKUP, createQueryResult([userRef({ id: "other", client_id: "client-2" })])]]);
    await expect(removeOrganizationUser(subject("admin"), "other")).rejects.toMatchObject({ status: 404 });
    expect(txRan(/FOR UPDATE/)).toBe(false);

    stubTx([
      [USER_LOOKUP, createQueryResult([userRef({ id: "boss", name: "Boss", role: "admin" })])],
      [ORGANIZATION_LOCK, createQueryResult([ORGANIZATION_ROW])],
      [/COUNT\(\*\)::int AS n/, createQueryResult([{ n: 0 }])],
    ]);
    await expect(removeOrganizationUser(subject("admin"), "boss")).rejects.toMatchObject({ status: 409, code: "LAST_ADMIN" });
    expect(txRan(/DELETE FROM client_contacts/)).toBe(false);
  });

  it("won't remove someone staff deactivated or who deleted their own account", async () => {
    stubDb([settings(true, true)]);
    stubTx([
      [USER_LOOKUP, createQueryResult([userRef({ status_key: "deactivated" })])],
      [ORGANIZATION_LOCK, createQueryResult([ORGANIZATION_ROW])],
    ]);
    await expect(removeOrganizationUser(subject("admin"), "jamie")).rejects.toMatchObject({ status: 409, code: "DEACTIVATED_BY_STAFF" });

    stubTx([
      [USER_LOOKUP, createQueryResult([userRef({ status_key: "deleted" })])],
      [ORGANIZATION_LOCK, createQueryResult([ORGANIZATION_ROW])],
    ]);
    await expect(removeOrganizationUser(subject("admin"), "jamie")).rejects.toMatchObject({ status: 409, code: "ACCOUNT_DELETED" });
    expect(txRan(/DELETE FROM client_contacts/)).toBe(false);
  });

  it("won't strand an approval only this person can decide, and a Client Admin cannot confirm past it", async () => {
    stubDb([settings(true, true)]);
    stubTx([
      [USER_LOOKUP, createQueryResult([userRef()])],
      [ORGANIZATION_LOCK, createQueryResult([ORGANIZATION_ROW])],
      [/FROM client_portal_approvals a\s+JOIN client_portal_approval_approvers ap/, createQueryResult([{ id: "ap1", ref_no: "AP-000001", revision: 1 }])],
    ]);
    await expect(removeOrganizationUser(subject("admin"), "jamie")).rejects.toMatchObject({ status: 409, code: "PENDING_APPROVALS" });
    expect(txRan(/DELETE FROM client_contacts/)).toBe(false);
  });

  it("answers 404 and writes no second audit entry when staff already removed the person", async () => {
    stubDb([settings(true, true)]);
    stubTx([
      [USER_LOOKUP, createQueryResult([userRef()])],
      [ORGANIZATION_LOCK, createQueryResult([ORGANIZATION_ROW])],
      [/DELETE FROM client_contacts/, createQueryResult([], 0)],
    ]);
    await expect(removeOrganizationUser(subject("admin"), "jamie")).rejects.toMatchObject({ status: 404, code: "ALREADY_REMOVED" });
    expect(auditEvents()).toEqual([]);
  });

  it("edits a colleague only with the capability, inside the caller's organization, with valid input", async () => {
    await expect(updateOrganizationUser(subject("member"), "jamie", { name: "J" })).rejects.toMatchObject({ status: 403, code: "ROLE_FORBIDDEN" });

    stubDb([]);
    await expect(updateOrganizationUser(subject("admin"), "stranger", { name: "J" })).rejects.toMatchObject({ status: 404 });

    const member = createQueryResult([{ id: "jamie", name: "Jamie", email: "j@x.io", job_title: null, role: "member", status_key: "active" }]);
    stubDb([[/WHERE u\.id = \$2 AND u\.client_id = \$3/, member]]);
    const scoped = mockedQuery.mock.calls;
    await expect(updateOrganizationUser(subject("admin"), "jamie", { role: "owner" })).rejects.toMatchObject({ status: 400, code: "INVALID_ROLE" });
    await expect(updateOrganizationUser(subject("admin"), "jamie", { name: "  " })).rejects.toMatchObject({ status: 400, code: "MISSING_FIELDS" });
    await expect(updateOrganizationUser(subject("admin"), "jamie", { job_title: "x".repeat(101) })).rejects.toMatchObject({ status: 400 });
    expect(scoped.some(([, params]) => JSON.stringify(params) === JSON.stringify(["team-1", "jamie", "client-1"]))).toBe(true);
  });

  it("assigns projects only to a Member or Viewer, only from this organization's portal-enabled projects", async () => {
    await expect(setOrganizationUserProjects(subject("member"), "jamie", [])).rejects.toMatchObject({ status: 403, code: "ROLE_FORBIDDEN" });

    const lookup = [/WHERE u\.id = \$2 AND u\.client_id = \$3/, createQueryResult([{ id: "boss", name: "Boss", email: "b@x.io", job_title: null, role: "admin", status_key: "active" }])] as Handler;
    stubDb([lookup]);
    await expect(setOrganizationUserProjects(subject("admin"), "boss", [])).rejects.toMatchObject({ status: 409, code: "ADMIN_HAS_ALL_PROJECTS" });

    stubDb([[/WHERE u\.id = \$2 AND u\.client_id = \$3/, createQueryResult([{ id: "jamie", name: "Jamie", email: "j@x.io", job_title: null, role: "member", status_key: "active" }])]]);
    await expect(setOrganizationUserProjects(subject("admin"), "jamie", "p1")).rejects.toMatchObject({ status: 400, code: "INVALID_PROJECT" });

    stubTx([[/FROM projects p\s+JOIN project_client_settings/, createQueryResult([{ id: "p1", name: "One" }])]]);
    await expect(setOrganizationUserProjects(subject("admin"), "jamie", ["other-org-project"])).rejects.toMatchObject({ status: 400, code: "INVALID_PROJECT" });
    expect(txRan(/INSERT INTO client_contact_project_access/)).toBe(false);
  });

  it("won't change your own role", async () => {
    stubDb([[/WHERE u\.id = \$2 AND u\.client_id = \$3/, createQueryResult([{ id: "alex", name: "Alex", email: "a@x.io", job_title: null, role: "admin", status_key: "active" }])]]);
    await expect(updateOrganizationUser(subject("admin"), "alex", { role: "viewer" })).rejects.toMatchObject({ status: 409, code: "CANNOT_CHANGE_OWN_ROLE" });
  });

  it("resends an invitation only with the capability and the invite switch, and only to someone who hasn't joined", async () => {
    stubDb([settings(false, true)]);
    await expect(resendOrganizationInvite(subject("admin"), "jamie", false)).rejects.toMatchObject({ status: 403, code: "INVITES_DISABLED" });
    await expect(resendOrganizationInvite(subject("member"), "jamie", false)).rejects.toMatchObject({ status: 403, code: "ROLE_FORBIDDEN" });

    stubDb([settings(true, true), [/WHERE u\.id = \$2 AND u\.client_id = \$3/, createQueryResult([{ id: "jamie", name: "Jamie", email: "j@x.io", job_title: null, role: "member", status_key: "active" }])]]);
    await expect(resendOrganizationInvite(subject("admin"), "jamie", false)).rejects.toMatchObject({ status: 409, code: "ALREADY_ACTIVE" });
  });

  it("removes a colleague, scoped to the caller's organization, and audits it", async () => {
    stubDb([settings(true, true)]);
    stubTx([
      [USER_LOOKUP, createQueryResult([userRef({ login_id: "login-2" })])],
      [ORGANIZATION_LOCK, createQueryResult([ORGANIZATION_ROW])],
      [/DELETE FROM client_contacts/, createQueryResult([], 1)],
    ]);
    await removeOrganizationUser(subject("admin"), "jamie");

    // The organization is locked before anything else is read or written.
    const sql = txSql();
    expect(sql.findIndex(text => /FOR UPDATE/.test(text))).toBeLessThan(sql.findIndex(text => /DELETE FROM client_contacts/.test(text)));
    const lock = mockTxQuery.mock.calls.find(([text]) => /FOR UPDATE/.test(String(text)))!;
    expect(lock[1]).toEqual(["client-1", "team-1"]);
    const del = mockTxQuery.mock.calls.find(([text]) => /DELETE FROM client_contacts/.test(String(text)))!;
    expect(del[1]).toEqual(["jamie", "team-1"]);
    // The login's link to this portal goes with them, like a removal by staff.
    expect(txRan(/DELETE FROM client_user_organizations/)).toBe(true);
    expect(auditEvents()).toEqual(["Client removed"]);
  });
});

// ─── Invoices are hidden unless the operator turned them on ─────────────────

describe("invoices gate", () => {
  const run = async (rows: unknown[]) => {
    mockedQuery.mockResolvedValue(createQueryResult(rows as any[]));
    const json = jest.fn();
    const res = { status: jest.fn(() => ({ json })) } as any;
    const next = jest.fn();
    await requireInvoicesVisible({ organizationId: "team-1" } as any, res, next);
    return { res, json, next };
  };

  it("answers 404 when invoices are off, or no settings row exists", async () => {
    for (const rows of [[{ visible_invoices: false }], []]) {
      const { res, json, next } = await run(rows);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ done: false }));
      expect(next).not.toHaveBeenCalled();
    }
  });

  it("lets the request through when invoices are on", async () => {
    const { next } = await run([{ visible_invoices: true }]);
    expect(next).toHaveBeenCalled();
  });
});

// ─── Files list carries who uploaded and how many versions ──────────────────

describe("client file list", () => {
  it("shows the uploader and the version count, from client-visible files only", async () => {
    stubDb([
      PROJECT_ROW,
      [/FROM project_files pf\s+LEFT JOIN users u/, createQueryResult([
        { id: "f1", name: "Brand Guidelines.pdf", category: "Design", current_version: 3, size: "2621440", uploaded_by_side: "team", uploaded_at: "t", uploaded_by: "Thakshila F.", version_count: 3 },
      ])],
    ]);
    const files = await listClientFiles(db as any, subject(), "project-1");
    expect(files[0]).toMatchObject({ uploaded_by: "Thakshila F.", version_count: 3, version: 3, source: "team" });
    const sql = dbSql().find(query => /FROM project_files pf\s+LEFT JOIN users u/.test(query))!;
    expect(sql).toMatch(/portal_visibility = 'client'/);
  });
});
