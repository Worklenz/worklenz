const mockTxQuery = jest.fn();
const mockRelease = jest.fn();

jest.mock("../config/db", () => ({
  __esModule: true,
  default: { query: jest.fn(), pool: { connect: jest.fn() } },
}));
jest.mock("../shared/email", () => ({ __esModule: true, sendEmail: jest.fn(), sendEmailEnhanced: jest.fn(), EmailRequest: jest.fn() }));
jest.mock("../cron_jobs/helpers", () => ({ __esModule: true, getClientPortalBaseUrl: () => "https://portal.test" }));
jest.mock("../shared/storage", () => ({
  createPresignedUploadUrl: jest.fn(async () => "https://storage.test/put"),
  createPresignedUrlWithClient: jest.fn(async () => "https://storage.test/get"),
  getProjectFileStorageKey: (t: string, p: string, f: string, e: string) => `${t}/${p}/${f}.${e}`,
  getObjectSize: jest.fn(),
  deleteObject: jest.fn(),
  getKey: jest.fn(),
  objectExists: jest.fn(),
}));
jest.mock("../services/client-portal-v2/notify.service", () => ({
  __esModule: true,
  notifyStaff: jest.fn(),
  notifyClientUsers: jest.fn(),
  getStaffRecipients: jest.fn(async () => []),
}));

import db from "../config/db";
import {
  accessClientFile,
  confirmClientUpload,
  deleteClientMessage,
  editClientMessage,
  postClientComment,
  presignClientUpload,
  replyToChangeRequest,
  submitChangeRequest,
} from "../services/client-portal-v2/client-write.service";
import { recordApprovalDecision } from "../services/client-portal-v2/approvals.service";
import type { ClientSubject } from "../services/client-portal-v2/subject";
import { createQueryResult } from "./utils/db-mock";

/**
 * The invariant the design promises: access changes take effect on the very next request. Every client
 * WRITE path re-checks the project gate (assignment + Client Portal switch) and must refuse once it is
 * closed, and must never write. Here the gate is closed for the whole run: SUBJECT_PROJECTS_SQL, which
 * is the single source of that check, returns no row.
 */

const mockedQuery = db.query as jest.Mock;
const mockedConnect = (db.pool as any).connect as jest.Mock;

const PROJECT = "11111111-1111-4111-8111-111111111111";
const FILE = "22222222-2222-4222-8222-222222222222";
const MESSAGE = "33333333-3333-4333-8333-333333333333";
const CHANGE_REQUEST = "44444444-4444-4444-8444-444444444444";

const subject: ClientSubject = {
  contactId: "alex",
  clientId: "client-1",
  teamId: "team-1",
  role: "admin",
  name: "Alex Chen",
  email: "alex@brandbase.com",
  clientUserId: "login-1",
};

const GATE = /FROM projects p\s+JOIN project_client_settings/;
const WRITES = /^\s*(INSERT|UPDATE|DELETE)/i;

/** Answers just enough for each function to reach the project gate, then refuses at the gate. */
const answer = async (sql: string) => {
  const text = String(sql);
  if (GATE.test(text)) return createQueryResult([]); // closed: unassigned, or Client Portal switched off
  if (/FROM project_files pf\s+WHERE pf\.id = \$1 AND pf\.team_id = \$2/.test(text)) {
    return createQueryResult([{ id: FILE, project_id: PROJECT, current_version: 1 }]);
  }
  if (/FROM client_portal_thread_messages m\s+JOIN client_portal_threads/.test(text)) {
    return createQueryResult([
      { id: MESSAGE, thread_id: "th1", author_contact_id: "alex", deleted_at: null, project_id: PROJECT, context_change_request_id: null, attachment_count: 0 },
    ]);
  }
  if (/FROM client_portal_change_requests r JOIN projects p/.test(text)) {
    return createQueryResult([{ id: CHANGE_REQUEST, cr_no: "CR-1", title: "t", status: "open", project_id: PROJECT, client_id: "client-1", project_name: "P" }]);
  }
  if (/FROM client_portal_threads th\s+WHERE th\.id = \$1/.test(text) || /SELECT th\.project_id, th\.context_type/.test(text)) {
    return createQueryResult([{ project_id: PROJECT, context_type: "project" }]);
  }
  if (/FROM client_portal_approvals/.test(text) && /FOR UPDATE/.test(text)) {
    return createQueryResult([
      { id: "ap1", client_id: "client-1", project_id: PROJECT, status: "awaiting", revision: 1, approver_ids: ["alex"] },
    ]);
  }
  return createQueryResult([]);
};

beforeEach(() => {
  mockedQuery.mockReset();
  mockTxQuery.mockReset();
  mockedConnect.mockReset();
  mockedConnect.mockResolvedValue({ query: mockTxQuery, release: mockRelease });
  mockedQuery.mockImplementation(answer);
  mockTxQuery.mockImplementation(answer);
});

const allSql = () => [...mockedQuery.mock.calls, ...mockTxQuery.mock.calls].map(([sql]) => String(sql));

const writeRoutes: Array<[string, () => Promise<unknown>]> = [
  ["submit a change request", () => submitChangeRequest(subject, { project_id: PROJECT, title: "t", description: "<p>d</p>" })],
  ["reply to a change request", () => replyToChangeRequest(subject, CHANGE_REQUEST, "<p>hi</p>")],
  ["post a comment on a project", () =>
    postClientComment(subject, { project_id: PROJECT, context: { type: "project", ref_id: PROJECT } as never, text: "<p>hi</p>" })],
  ["post a comment in an existing discussion", () => postClientComment(subject, { thread_id: "th1", text: "<p>hi</p>" })],
  ["edit their own message", () => editClientMessage(subject, MESSAGE, { text: "<p>edit</p>" })],
  ["delete their own message", () => deleteClientMessage(subject, MESSAGE)],
  ["preview or download a file", () => accessClientFile(subject, { fileId: FILE, action: "download" })],
  ["start an upload", () => presignClientUpload(subject, PROJECT, { filename: "a.pdf", size: 10, mime_type: "application/pdf" })],
  ["confirm an upload", () => confirmClientUpload(subject, PROJECT, FILE)],
  ["decide an approval", () => recordApprovalDecision({ teamId: "team-1", approvalId: "ap1", subject, outcome: "approved" })],
];

describe("client write routes refuse once project access is gone (unassigned, or portal switched off)", () => {
  it.each(writeRoutes)("cannot %s", async (_name, run) => {
    await expect(run()).rejects.toMatchObject({ status: 404 });
    // Nothing was written, and nothing audited or notified.
    expect(allSql().filter(sql => WRITES.test(sql))).toEqual([]);
  });

  it.each(writeRoutes)("asks the project gate about this contact, client and team when they try to %s", async (_name, run) => {
    await run().catch(() => undefined);
    const gate = [...mockedQuery.mock.calls, ...mockTxQuery.mock.calls].find(([sql]) => GATE.test(String(sql)));
    expect(gate).toBeDefined();
    expect((gate![1] as unknown[]).slice(0, 3)).toEqual(["alex", "client-1", "team-1"]);
  });
});

describe("a role that lacks the capability is refused before the database is touched", () => {
  const viewer: ClientSubject = { ...subject, role: "viewer" };
  it.each([
    ["comment", () => postClientComment(viewer, { thread_id: "th1", text: "<p>hi</p>" })],
    ["submit a change request", () => submitChangeRequest(viewer, { project_id: PROJECT, title: "t", description: "<p>d</p>" })],
    ["upload", () => presignClientUpload(viewer, PROJECT, { filename: "a.pdf", size: 10, mime_type: "application/pdf" })],
  ])("a viewer cannot %s", async (_name, run) => {
    await expect(run()).rejects.toMatchObject({ status: 403 });
    expect(mockedQuery).not.toHaveBeenCalled();
    expect(mockTxQuery).not.toHaveBeenCalled();
  });
});

describe("items that are Internal Only are indistinguishable from missing ones", () => {
  it("answers 404 for a file that is not Client Visible, and never signs a link", async () => {
    // The query itself filters on portal_visibility = 'client'; an internal file simply returns no row.
    mockedQuery.mockImplementation(async () => createQueryResult([]));
    await expect(accessClientFile(subject, { fileId: FILE, action: "preview" })).rejects.toMatchObject({ status: 404 });
    const lookup = mockedQuery.mock.calls[0][0] as string;
    expect(lookup).toMatch(/portal_visibility = 'client'/);
    const { createPresignedUrlWithClient } = jest.requireMock("../shared/storage");
    expect(createPresignedUrlWithClient).not.toHaveBeenCalled();
  });
});
