const mockQuery = jest.fn();

jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock("../services/client-contacts-service", () => ({
  withTransaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn({ query: mockQuery })),
}));
jest.mock("../services/client-portal-v2/scope", () => ({
  assertSubjectProject: jest.fn(),
  getSubjectProjectIds: jest.fn(),
  fileClientVisibleSql: jest.fn(),
}));
jest.mock("../services/client-portal-v2/project-core", () => ({
  getProjectRef: jest.fn(async () => ({ id: "11111111-1111-4111-8111-111111111111", clientName: "Brandbase" })),
}));
jest.mock("../services/client-portal-v2/sequences", () => ({ nextChangeRequestNo: jest.fn(async () => "CR-0001") }));
jest.mock("../services/client-portal-v2/audit.service", () => ({
  recordAuditEvent: jest.fn(),
  recordAuditEventSafely: jest.fn(),
}));
jest.mock("../services/client-portal-v2/notify.service", () => ({ notifyStaff: jest.fn(), notifyClientUsers: jest.fn() }));
jest.mock("../services/client-portal-v2/client-read.service", () => ({ requireCapability: jest.fn() }));
jest.mock("../services/client-portal-v2/discussions.service", () => ({ ensureThread: jest.fn() }));
jest.mock("../services/client-portal-v2/files.service", () => ({
  confirmPortalFile: jest.fn(),
  presignPortalFile: jest.fn(),
  resolveVersionObject: jest.fn(),
}));
jest.mock("../shared/storage", () => ({
  createPresignedUrlWithClient: jest.fn(),
  getProjectFileStorageKey: (team: string, project: string, file: string, ext: string) => `${team}/${project}/${file}.${ext}`,
}));

import db from "../config/db";
import { submitChangeRequest } from "../services/client-portal-v2/client-write.service";

const FILE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FILE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const subject = { teamId: "team-1", clientId: "client-1", contactId: "contact-1", name: "Jamie" } as never;
const base = { project_id: "11111111-1111-4111-8111-111111111111", title: "Add export", description: "Please add CSV export" };

const fileRow = (id: string, size = 1024) => ({ id, name: `${id.slice(0, 4)}.pdf`, type: "pdf", size });

beforeEach(() => {
  mockQuery.mockReset();
  // The hourly volume check reads through the pool (not the transaction) and finds no recent requests.
  (db.query as jest.Mock).mockReset();
  (db.query as jest.Mock).mockResolvedValue({ rows: [{ n: 0 }] });
});

describe("submitChangeRequest attachments", () => {
  it("links each confirmed upload to the new request", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [fileRow(FILE_A), fileRow(FILE_B, 50 * 1024 * 1024)] }) // attachment lookup
      .mockResolvedValue({ rows: [{ id: "cr-1" }] });

    const result = await submitChangeRequest(subject, { ...base, attachment_file_ids: [FILE_A, FILE_B] });

    expect(result).toEqual({ id: "cr-1", cr_no: "CR-0001" });
    const inserts = mockQuery.mock.calls.filter(([sql]) => String(sql).includes("INSERT INTO client_portal_change_request_attachments"));
    expect(inserts).toHaveLength(2);
    expect(inserts[0][1]).toEqual(["cr-1", "aaaa.pdf", expect.stringContaining(FILE_A), 1024, FILE_A]);
  });

  it("only accepts uploads the same contact made on this project, and not yet attached", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [fileRow(FILE_A)] }); // one of the two ids is not eligible

    await expect(submitChangeRequest(subject, { ...base, attachment_file_ids: [FILE_A, FILE_B] })).rejects.toMatchObject({
      code: "INVALID_ATTACHMENTS",
    });
    const sql = String(mockQuery.mock.calls[0][0]);
    expect(sql).toContain("uploaded_by_contact_id");
    expect(sql).toContain("NOT EXISTS");
  });

  it("rejects more than 5 files", async () => {
    const ids = Array.from({ length: 6 }, (_, index) => `${String(index).repeat(8)}-0000-4000-8000-000000000000`);

    await expect(submitChangeRequest(subject, { ...base, attachment_file_ids: ids })).rejects.toMatchObject({
      code: "TOO_MANY_ATTACHMENTS",
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("rejects a file over 100 MB", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [fileRow(FILE_A, 101 * 1024 * 1024)] });

    await expect(submitChangeRequest(subject, { ...base, attachment_file_ids: [FILE_A] })).rejects.toMatchObject({
      code: "ATTACHMENT_TOO_LARGE",
    });
  });

  it("rejects ids that are not UUIDs", async () => {
    await expect(submitChangeRequest(subject, { ...base, attachment_file_ids: ["nope"] })).rejects.toMatchObject({
      code: "INVALID_ATTACHMENTS",
    });
  });

  it("still submits without attachments", async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: "cr-2" }] });

    await expect(submitChangeRequest(subject, base)).resolves.toEqual({ id: "cr-2", cr_no: "CR-0001" });
    expect(mockQuery.mock.calls.some(([sql]) => String(sql).includes("change_request_attachments"))).toBe(false);
  });
});
