const mockTxQuery = jest.fn();

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
  notifyMentionedMembers: jest.fn(),
  getStaffRecipients: jest.fn(async () => []),
}));

import db from "../config/db";
import { postStaffMessage, startThread } from "../services/client-portal-v2/discussions.service";
import { notifyClientUsers, notifyMentionedMembers } from "../services/client-portal-v2/notify.service";
import { createQueryResult } from "./utils/db-mock";

const mockedQuery = db.query as jest.Mock;
const mockedConnect = (db.pool as any).connect as jest.Mock;
const mockedNotify = notifyClientUsers as jest.Mock;
const mockedNotifyMembers = notifyMentionedMembers as jest.Mock;

const TEAM = "team-1";
const actor = { side: "internal" as const, name: "Kasun F.", userId: "user-1" };

// Client users on the project. "gone" is deactivated or has no access, so the contact lookup never returns it.
const ANNA = "11111111-1111-4111-8111-111111111111";
const RAVI = "22222222-2222-4222-8222-222222222222";
const GONE = "33333333-3333-4333-8333-333333333333";
const ON_PROJECT = [
  { id: ANNA, name: "Anna Lee" },
  { id: RAVI, name: "Ravi Perera" },
];

// Members of the project. "OTHER" is on the team but not on this project, so the member lookup never returns it.
const SAM = "44444444-4444-4444-8444-444444444444";
const OTHER = "55555555-5555-4555-8555-555555555555";
const AUTHOR = "66666666-6666-4666-8666-666666666666";
const MEMBERS = [{ id: SAM, name: "Sam Patel" }];

const threadRow = {
  id: "thread-1", ref_no: "DS-000001", client_id: "client-1", project_id: "project-1", context_type: "project",
  project_name: "Website", organization_name: "Brandbase", context_label: "General", hidden_from_client: false,
  unread: false, created_at: "2026-01-01T00:00:00Z",
};

/** Answers the statements postStaffMessage and startThread make, by SQL text. */
const stubQueries = (impl: (sql: string, params: unknown[]) => unknown) => {
  const run = async (sql: string, params: unknown[] = []) => createQueryResult((impl(String(sql), params) as any[]) ?? []);
  mockTxQuery.mockImplementation(run);
  mockedQuery.mockImplementation(run);
};

const baseStub = (sql: string, params: unknown[]) => {
  if (/AND th\.id = \$3/.test(sql)) return [threadRow];
  if (/FROM project_members pm/.test(sql)) {
    const only = params[2] as string[] | null;
    return MEMBERS.filter(person => !only || only.includes(person.id));
  }
  if (/client_contact_project_access/.test(sql)) {
    const only = params[3] as string[] | null;
    return ON_PROJECT.filter(person => !only || only.includes(person.id));
  }
  if (/INSERT INTO client_portal_thread_messages/.test(sql)) return [{ id: "message-1", created_at: "2026-01-02T00:00:00Z" }];
  return [];
};

const post = (body: Record<string, unknown>) =>
  postStaffMessage({ teamId: TEAM, userId: "user-1", actor, threadId: "thread-1", body: { visibility: "client", text: "Hello", ...body } });

beforeEach(() => {
  mockedQuery.mockReset();
  mockTxQuery.mockReset();
  mockedNotify.mockReset();
  mockedNotifyMembers.mockReset();
  mockedConnect.mockReset();
  mockedConnect.mockResolvedValue({ query: mockTxQuery, release: jest.fn() });
  stubQueries(baseStub);
});

describe("who a client-visible message notifies", () => {
  it("notifies everyone on the project when no recipient is chosen", async () => {
    const result = await post({});

    expect(result.notified).toEqual(["Anna Lee", "Ravi Perera"]);
    expect(mockedNotify).toHaveBeenCalledTimes(1);
    expect(mockedNotify.mock.calls[0][0]).not.toHaveProperty("onlyContactIds");
  });

  it("notifies only the chosen people, in the in-app notification and the email", async () => {
    const result = await post({ notify_contact_ids: [ANNA] });

    expect(result.notified).toEqual(["Anna Lee"]);
    expect(mockedNotify.mock.calls[0][0]).toMatchObject({ onlyContactIds: [ANNA], portalPath: "/discussions/thread-1" });
  });

  it("notifies a mentioned person even when only someone else was chosen", async () => {
    const result = await post({ notify_contact_ids: [ANNA], mention_ids: [RAVI] });

    expect(result.notified.sort()).toEqual(["Anna Lee", "Ravi Perera"]);
    expect(mockedNotify.mock.calls[0][0].onlyContactIds.sort()).toEqual([ANNA, RAVI]);
  });

  it("narrows the notification to the people mentioned in a reply", async () => {
    const result = await post({ mention_ids: [RAVI] });

    expect(result.notified).toEqual(["Ravi Perera"]);
    expect(mockedNotify.mock.calls[0][0]).toMatchObject({ onlyContactIds: [RAVI] });
  });

  it("rejects someone who is not an active client user on the project, and sends nothing", async () => {
    await expect(post({ notify_contact_ids: [ANNA, GONE] })).rejects.toMatchObject({ status: 400, code: "INVALID_RECIPIENT" });
    expect(mockedNotify).not.toHaveBeenCalled();
  });

  it("rejects an id that is not a UUID before it reaches the database", async () => {
    await expect(post({ notify_contact_ids: ["not-an-id"] })).rejects.toMatchObject({ status: 400, code: "INVALID_RECIPIENT" });
    expect(mockTxQuery).not.toHaveBeenCalled();
  });

  it("never notifies a client of an internal comment, or lets one name recipients", async () => {
    const result = await post({ visibility: "internal" });
    expect(result.notified).toEqual([]);
    expect(mockedNotify).not.toHaveBeenCalled();

    await expect(post({ visibility: "internal", notify_contact_ids: [ANNA] })).rejects.toMatchObject({
      status: 400,
      code: "NOTIFY_NOT_ALLOWED",
    });
  });
});

describe("mentioning project members in an internal comment", () => {
  it("stores the mention, returns the name and notifies the member, not any client", async () => {
    const result = await post({ visibility: "internal", mention_user_ids: [SAM] });

    expect(result.message.mentions).toEqual(["Sam Patel"]);
    const insert = mockTxQuery.mock.calls.find(([sql]) => /INSERT INTO client_portal_thread_messages/.test(String(sql)));
    expect(insert?.[1][6]).toEqual([SAM]);
    expect(mockedNotifyMembers).toHaveBeenCalledWith(expect.objectContaining({ threadId: "thread-1", userIds: [SAM] }));
    expect(mockedNotify).not.toHaveBeenCalled();
  });

  it("does not notify the author for mentioning themselves", async () => {
    MEMBERS.push({ id: AUTHOR, name: "Kasun F." });
    try {
      await postStaffMessage({
        teamId: TEAM,
        userId: AUTHOR,
        actor,
        threadId: "thread-1",
        body: { visibility: "internal", text: "Note to self", mention_user_ids: [AUTHOR] },
      });
    } finally {
      MEMBERS.pop();
    }
    expect(mockedNotifyMembers).not.toHaveBeenCalled();
  });

  it("rejects someone who is not an active member of the project", async () => {
    await expect(post({ visibility: "internal", mention_user_ids: [SAM, OTHER] })).rejects.toMatchObject({
      status: 400,
      code: "INVALID_MENTION",
    });
    expect(mockedNotifyMembers).not.toHaveBeenCalled();
  });

  it("rejects a team-member mention on a client-visible message", async () => {
    await expect(post({ visibility: "client", mention_user_ids: [SAM] })).rejects.toMatchObject({
      status: 400,
      code: "MENTION_NOT_ALLOWED",
    });
  });

  it("rejects an id that is not a UUID before it reaches the database", async () => {
    await expect(post({ visibility: "internal", mention_user_ids: ["nope"] })).rejects.toMatchObject({ code: "INVALID_MENTION" });
    expect(mockTxQuery).not.toHaveBeenCalled();
  });
});

describe("starting a discussion with chosen recipients", () => {
  const projectRow = { id: "project-1", client_id: "client-1", name: "Website" };
  const start = (notify?: string[]) =>
    startThread({
      teamId: TEAM,
      userId: "user-1",
      actor,
      body: { project_id: "project-1", context: { type: "project", ref_id: null }, message: "Kick-off", notify_contact_ids: notify },
    });

  const startStub = (sql: string, params: unknown[]) => {
    // The contact lookup's SQL also mentions portal_enabled and projects; answer it from baseStub first
    if (/client_contact_project_access/.test(sql)) return baseStub(sql, params);
    if (/portal_enabled/.test(sql)) return [{ portal_enabled: true }];
    if (/INSERT INTO client_portal_threads/.test(sql)) return [{ id: "thread-1" }];
    if (/FROM projects/.test(sql) && !/client_portal_threads/.test(sql)) return [projectRow];
    return baseStub(sql, params);
  };

  it("notifies only the chosen people about the first message", async () => {
    stubQueries(startStub);
    await start([RAVI]);

    expect(mockedNotify.mock.calls[0][0]).toMatchObject({ onlyContactIds: [RAVI] });
  });

  it("creates no thread when a recipient is not on the project", async () => {
    stubQueries(startStub);
    await expect(start([GONE])).rejects.toMatchObject({ status: 400, code: "INVALID_RECIPIENT" });

    const createdThread = [...mockTxQuery.mock.calls, ...mockedQuery.mock.calls].some(([sql]) =>
      /INSERT INTO client_portal_threads/.test(String(sql))
    );
    expect(createdThread).toBe(false);
  });
});

describe("attaching files to a message", () => {
  const FILE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const FILE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const fileRow = (id: string, size = 1024) => ({ id, name: `${id.slice(0, 4)}.png`, type: "PNG", size });

  const stubFiles = (rows: unknown[]) =>
    stubQueries((sql, params) => {
      if (/FROM project_files pf/.test(sql)) return rows;
      if (/INSERT INTO client_portal_thread_message_attachments/.test(sql)) return [{ id: `att-${String(params[1]).slice(0, 4)}` }];
      if (/UPDATE project_files SET portal_visibility/.test(sql)) return (params[0] as string[]).map(id => ({ id, name: "file" }));
      return baseStub(sql, params);
    });

  it("links each file to the message and shares them with the client on a client-visible message", async () => {
    stubFiles([fileRow(FILE_A), fileRow(FILE_B)]);

    const result = await post({ attachment_file_ids: [FILE_A, FILE_B] });

    expect(result.message.attachments).toEqual([
      { id: "att-aaaa", file_id: FILE_A, name: "aaaa.png", type: "png", size: 1024 },
      { id: "att-bbbb", file_id: FILE_B, name: "bbbb.png", type: "png", size: 1024 },
    ]);
    const sqls = mockTxQuery.mock.calls.map(([sql]) => String(sql));
    expect(sqls.some(sql => /UPDATE project_files SET portal_visibility = 'client'/.test(sql))).toBe(true);
  });

  it("keeps the files Internal Only on an internal comment", async () => {
    stubFiles([fileRow(FILE_A)]);

    await post({ visibility: "internal", attachment_file_ids: [FILE_A] });

    const sqls = mockTxQuery.mock.calls.map(([sql]) => String(sql));
    expect(sqls.some(sql => /UPDATE project_files SET portal_visibility/.test(sql))).toBe(false);
  });

  it("only accepts this person's confirmed, unattached uploads on the thread's project", async () => {
    stubFiles([fileRow(FILE_A)]); // one of the two ids is not eligible

    await expect(post({ attachment_file_ids: [FILE_A, FILE_B] })).rejects.toMatchObject({ code: "INVALID_ATTACHMENTS" });
    const lookup = mockTxQuery.mock.calls.map(([sql]) => String(sql)).find(sql => /FROM project_files pf/.test(sql)) ?? "";
    expect(lookup).toContain("pf.uploaded_by = $4");
    expect(lookup).toContain("NOT EXISTS");
  });

  it("rejects more than 5 files and ids that are not UUIDs before touching the database", async () => {
    const ids = Array.from({ length: 6 }, (_, i) => `${String(i).repeat(8)}-0000-4000-8000-000000000000`);
    await expect(post({ attachment_file_ids: ids })).rejects.toMatchObject({ code: "TOO_MANY_ATTACHMENTS" });
    await expect(post({ attachment_file_ids: ["nope"] })).rejects.toMatchObject({ code: "INVALID_ATTACHMENTS" });
    expect(mockTxQuery).not.toHaveBeenCalled();
  });

  it("rejects a file over 100 MB", async () => {
    stubFiles([fileRow(FILE_A, 101 * 1024 * 1024)]);
    await expect(post({ attachment_file_ids: [FILE_A] })).rejects.toMatchObject({ code: "ATTACHMENT_TOO_LARGE" });
  });

  it("allows a message that is only files, and still needs text or a file", async () => {
    stubFiles([fileRow(FILE_A)]);
    await expect(post({ text: "", attachment_file_ids: [FILE_A] })).resolves.toBeDefined();
    const insert = mockTxQuery.mock.calls.find(([sql]) => /INSERT INTO client_portal_thread_messages/.test(String(sql)));
    expect(insert?.[1][4]).toBe("<p></p>");
    expect(mockedNotify.mock.calls[0][0].message).toBe("Sent 1 attachment");

    await expect(post({ text: "" })).rejects.toMatchObject({ code: "MISSING_FIELDS" });
  });
});
