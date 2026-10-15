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
  notifyClientUsers: jest.fn(async () => undefined),
  getStaffRecipients: jest.fn(async () => []),
}));
jest.mock("../services/client-portal-v2/project-core", () => ({
  __esModule: true,
  getProjectRef: jest.fn(async () => ({ id: "project-1", name: "Site", clientId: "client-1", clientName: "Brandbase" })),
}));

import db from "../config/db";
import { sendApproval } from "../services/client-portal-v2/approvals.service";
import { notifyClientUsers } from "../services/client-portal-v2/notify.service";
import { removeClientUser, deactivateClientUser } from "../services/client-portal-v2/users.service";
import { createQueryResult } from "./utils/db-mock";

const mockedConnect = (db.pool as any).connect as jest.Mock;
const mockedQuery = db.query as jest.Mock;
const mockedNotify = notifyClientUsers as jest.Mock;

type Handler = [RegExp, any];
const stub = (handlers: Handler[]) =>
  mockTxQuery.mockImplementation(async (sql: string) => {
    const match = handlers.find(([pattern]) => pattern.test(String(sql)));
    if (!match) return createQueryResult([]);
    return typeof match[1] === "function" ? match[1]() : match[1];
  });
const ran = (pattern: RegExp) => mockTxQuery.mock.calls.some(([sql]) => pattern.test(String(sql)));

const TEAM = "team-1";
const staff = { side: "internal" as const, name: "Kasun F.", userId: "user-1" };

beforeEach(() => {
  mockTxQuery.mockReset();
  mockedNotify.mockClear();
  mockedConnect.mockReset();
  mockedConnect.mockResolvedValue({ query: mockTxQuery, release: mockRelease });
  mockedQuery.mockReset();
  mockedQuery.mockResolvedValue(createQueryResult([]));
});

describe("approval notifications wait for the commit", () => {
  const draft = {
    id: "ap1", ref_no: "AP-000001", client_id: "client-1", project_id: "project-1", title: "Approve", status: "draft",
    revision: 1, linked_type: "freeform", item_name: "Thing", approver_name: "Alex", approver_ids: ["alex"], due_date: null, client_name: "Brandbase",
  };
  const arrange = (granted: boolean) =>
    stub([
      [/FOR UPDATE OF a/, createQueryResult([draft])],
      [/FROM \(.*\) u\s+WHERE u\.id = ANY/s, createQueryResult([{ id: "alex", name: "Alex" }])],
      [/INSERT INTO client_contact_project_access/, createQueryResult(granted ? [{ client_contact_id: "alex" }] : [])],
    ]);

  it("sends the approver notification only after COMMIT", async () => {
    arrange(false);
    await sendApproval({ teamId: TEAM, approvalId: "ap1", actor: staff }).catch(() => undefined);

    const commit = mockTxQuery.mock.calls.findIndex(([sql]) => /^COMMIT$/.test(String(sql)));
    expect(commit).toBeGreaterThan(-1);
    expect(mockedNotify).toHaveBeenCalledTimes(1);
    expect(mockTxQuery.mock.invocationCallOrder[commit]).toBeLessThan(mockedNotify.mock.invocationCallOrder[0]);
  });

  it("sends nothing when the transaction rolls back", async () => {
    stub([[/FOR UPDATE OF a/, createQueryResult([{ ...draft, status: "awaiting" }])]]);
    await expect(sendApproval({ teamId: TEAM, approvalId: "ap1", actor: staff })).rejects.toMatchObject({ code: "NOT_A_DRAFT" });
    expect(ran(/^ROLLBACK$/)).toBe(true);
    expect(mockedNotify).not.toHaveBeenCalled();
  });

  it("audits the access it newly grants to a named approver, and skips people who can already open the project", async () => {
    arrange(true);
    await sendApproval({ teamId: TEAM, approvalId: "ap1", actor: staff }).catch(() => undefined);
    const grant = mockTxQuery.mock.calls.find(([sql]) => /INSERT INTO client_contact_project_access/.test(String(sql)))!;
    // Only people who cannot already open the project are inserted (the gating chain's own predicate).
    expect(String(grant[0])).toMatch(/WHERE NOT \(/);
    const audits = mockTxQuery.mock.calls.filter(([sql]) => /INSERT INTO client_portal_audit_events/.test(String(sql)));
    expect(audits.some(([, params]) => (params as unknown[]).includes("Project access assigned"))).toBe(true);
  });
});

describe("removing or deactivating the only approver of a waiting approval", () => {
  const user = { id: "alex", name: "Alex", email: "a@b.co", client_id: "client-1", organization_name: "Brandbase", role: "member", status_key: "active", has_login: true, login_id: "login-1" };
  const waiting = { id: "ap1", ref_no: "AP-000007", revision: 2 };
  const base = (orphans: unknown[]): Handler[] => [
    [/JOIN client_contacts cc ON cc\.id = u\.id/, createQueryResult([user])],
    [/FROM client_portal_approvals a\s+JOIN client_portal_approval_approvers ap/, createQueryResult(orphans as any[])],
  ];

  it("asks staff to name another approver first", async () => {
    stub(base([waiting]));
    await expect(removeClientUser({ teamId: TEAM, userId: "alex", actor: staff })).rejects.toMatchObject({
      status: 409,
      code: "PENDING_APPROVALS",
    });
    expect(ran(/DELETE FROM client_contacts/)).toBe(false);
  });

  it("applies to deactivation too", async () => {
    stub(base([waiting]));
    await expect(deactivateClientUser({ teamId: TEAM, userId: "alex", actor: staff })).rejects.toMatchObject({ code: "PENDING_APPROVALS" });
    expect(ran(/UPDATE client_contacts SET disabled_at/)).toBe(false);
  });

  it("goes ahead when confirmed, and leaves a history line on each approval", async () => {
    stub(base([waiting]));
    await removeClientUser({ teamId: TEAM, userId: "alex", actor: staff, confirmPendingApprovals: true });
    const event = mockTxQuery.mock.calls.find(([sql]) => /INSERT INTO client_portal_approval_events/.test(String(sql)))!;
    expect(String((event[1] as unknown[])[4])).toContain("Name a new approver");
    expect(ran(/DELETE FROM client_contacts/)).toBe(true);
  });

  it("leaves a user who is not the only approver alone", async () => {
    stub(base([]));
    await removeClientUser({ teamId: TEAM, userId: "alex", actor: staff });
    expect(ran(/DELETE FROM client_contacts/)).toBe(true);
  });

  it("drops the login's link to this portal once its last company user here is gone", async () => {
    stub(base([]));
    await removeClientUser({ teamId: TEAM, userId: "alex", actor: staff });
    const link = mockTxQuery.mock.calls.find(([sql]) => /DELETE FROM client_user_organizations/.test(String(sql)))!;
    expect(String(link[0])).toMatch(/NOT EXISTS/);
    expect(link[1]).toEqual(["login-1", TEAM, "client-1"]);
  });
});

describe("volume limits on client actions that notify staff", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const write = () => require("../services/client-portal-v2/client-write.service");
  const subject = { contactId: "alex", clientId: "client-1", teamId: TEAM, role: "admin", name: "Alex", email: "a@b.co", clientUserId: "login-1" };
  const over = (n: number) => mockedQuery.mockResolvedValue(createQueryResult([{ n }]));

  it("stops a flood of change requests", async () => {
    over(write().CLIENT_HOURLY_LIMITS.change_requests);
    await expect(write().submitChangeRequest(subject, { project_id: "p", title: "t", description: "<p>d</p>" })).rejects.toMatchObject({
      status: 429,
      code: "RATE_LIMITED",
    });
  });

  it("stops a flood of comments", async () => {
    over(write().CLIENT_HOURLY_LIMITS.comments);
    await expect(write().postClientComment(subject, { thread_id: "t", text: "<p>hi</p>" })).rejects.toMatchObject({ status: 429, code: "RATE_LIMITED" });
  });

  it("lets normal use through", async () => {
    over(1);
    await expect(write().postClientComment(subject, { thread_id: "t", text: "<p>hi</p>" })).rejects.not.toMatchObject({ code: "RATE_LIMITED" });
  });
});

describe("file versions: sharing shares the current version and later ones, never earlier drafts", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const write = () => require("../services/client-portal-v2/client-write.service");
  const subject = { contactId: "alex", clientId: "client-1", teamId: TEAM, role: "admin", name: "Alex", email: "a@b.co", clientUserId: "login-1" };
  const GATE = /FROM projects p\s+JOIN project_client_settings/;
  const FILE = "22222222-2222-4222-8222-222222222222";

  const arrange = (firstShared: number, current: number) =>
    mockedQuery.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (GATE.test(text)) return createQueryResult([{ id: "project-1" }]);
      if (/FROM project_files pf\s+WHERE pf\.id = \$1/.test(text)) {
        return createQueryResult([{ id: FILE, project_id: "project-1", current_version: current, first_shared_version: firstShared }]);
      }
      return createQueryResult([]);
    });

  it("answers 404 for a version from before the file was shared, like a missing one", async () => {
    arrange(3, 4);
    await expect(write().accessClientFile(subject, { fileId: FILE, version: 2, action: "download" })).rejects.toMatchObject({ status: 404 });
    await expect(write().accessClientFile(subject, { fileId: FILE, version: 1, action: "download" })).rejects.toMatchObject({ status: 404 });
  });

  /** Whether the call got past the version gate to the stored-object lookup (resolveVersionObject). */
  const reachedStorage = () => mockedQuery.mock.calls.some(([sql]) => /SELECT id, name, type, project_id, team_id, current_version/.test(String(sql)));

  it("serves the version that was current when it was shared, and later ones", async () => {
    for (const version of [3, 4]) {
      mockedQuery.mockReset();
      arrange(3, 4);
      await write().accessClientFile(subject, { fileId: FILE, version, action: "download" }).catch(() => undefined);
      expect(reachedStorage()).toBe(true);
    }
  });

  it("starts at version 1 for a file that was never given a first shared version", async () => {
    arrange(1, 2);
    await write().accessClientFile(subject, { fileId: FILE, version: 1, action: "download" }).catch(() => undefined);
    expect(reachedStorage()).toBe(true);
  });

  it("never reaches storage for a version before the first shared one", async () => {
    arrange(3, 4);
    await write().accessClientFile(subject, { fileId: FILE, version: 2, action: "download" }).catch(() => undefined);
    expect(reachedStorage()).toBe(false);
  });
});

describe("change requests belong to their requester (and Client Admins)", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const read = () => require("../services/client-portal-v2/client-read.service");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const write = () => require("../services/client-portal-v2/client-write.service");
  const member = { contactId: "taylor", clientId: "client-1", teamId: TEAM, role: "member", name: "Taylor", email: "t@b.co", clientUserId: "login-2" };

  it("lists only the member's own requests: the predicate and the contact and role are in the query", async () => {
    mockedQuery.mockImplementation(async (sql: string) =>
      /FROM projects p\s+JOIN project_client_settings/.test(String(sql)) ? createQueryResult([{ id: "project-1" }]) : createQueryResult([])
    );
    await read().listClientChangeRequests({ query: mockedQuery }, member);
    const list = mockedQuery.mock.calls.find(([sql]) => /FROM client_portal_change_requests r\s+JOIN projects p/.test(String(sql)))!;
    expect(String(list[0])).toMatch(/r\.requester_contact_id = \$3::uuid OR \$4::text = 'admin'/);
    expect(list[1].slice(2)).toEqual(["taylor", "member"]);
  });

  it("answers 404 when a member replies to someone else's request", async () => {
    stub([[/FROM client_portal_change_requests r JOIN projects p/, createQueryResult([
      { id: "cr1", cr_no: "CR-1", title: "t", status: "under_review", project_id: "project-1", client_id: "client-1", requester_contact_id: "jamie", project_name: "P" },
    ])],
    [/FROM projects p\s+JOIN project_client_settings/, createQueryResult([{ id: "project-1" }])]]);
    await expect(write().replyToChangeRequest(member, "cr1", "<p>hi</p>")).rejects.toMatchObject({ status: 404 });
    expect(ran(/INSERT INTO client_portal_change_request_messages/)).toBe(false);
  });

  it("lets a Client Admin reply to anyone's request", async () => {
    stub([[/FROM client_portal_change_requests r JOIN projects p/, createQueryResult([
      { id: "cr1", cr_no: "CR-1", title: "t", status: "under_review", project_id: "project-1", client_id: "client-1", requester_contact_id: "jamie", project_name: "P" },
    ])],
    [/FROM projects p\s+JOIN project_client_settings/, createQueryResult([{ id: "project-1" }])]]);
    await write().replyToChangeRequest({ ...member, role: "admin" }, "cr1", "<p>hi</p>").catch(() => undefined);
    expect(ran(/INSERT INTO client_portal_change_request_messages/)).toBe(true);
  });

  it("applies the same rule to a change request's discussion thread", async () => {
    mockedQuery.mockImplementation(async (sql: string) =>
      /FROM projects p\s+JOIN project_client_settings/.test(String(sql)) ? createQueryResult([{ id: "project-1" }]) : createQueryResult([])
    );
    await write().listClientThreads(member);
    const threads = mockedQuery.mock.calls.find(([sql]) => /FROM client_portal_threads th/.test(String(sql)))!;
    expect(String(threads[0])).toMatch(/WHEN 'change_request' THEN COALESCE\(\(cr\.requester_contact_id = \$3::uuid OR \$4::text = 'admin'\)/);
    expect(threads[1].slice(2)).toEqual(["taylor", "member"]);
  });
});
