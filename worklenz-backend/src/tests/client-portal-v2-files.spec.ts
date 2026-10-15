const mockQuery = jest.fn();
const mockTxQuery = jest.fn();
const mockPoolConnect = jest.fn(async () => ({ query: mockTxQuery, release: jest.fn() }));

jest.mock("../config/db", () => ({
  __esModule: true,
  default: { query: (...args: unknown[]) => mockQuery(...args), pool: { connect: () => mockPoolConnect() } },
}));
jest.mock("../shared/storage", () => ({
  createPresignedUploadUrl: jest.fn(async () => "https://storage.test/put"),
  createPresignedUrlWithClient: jest.fn(),
  deleteObject: jest.fn(),
  getKey: jest.fn(),
  getObjectSize: jest.fn(async () => 1024),
  getProjectFileStorageKey: (team: string, project: string, file: string, ext: string) => `${team}/${project}/${file}.${ext}`,
  objectExists: jest.fn(),
}));
jest.mock("../services/client-portal-v2/project-core", () => ({
  getProjectRef: jest.fn(async () => ({ id: "project-1", name: "Site", clientId: "client-1", clientName: "Brandbase" })),
}));
jest.mock("../services/client-portal-v2/notify.service", () => ({ notifyStaff: jest.fn(), notifyClientUsers: jest.fn() }));

import {
  MAX_PENDING_CLIENT_UPLOADS,
  confirmFileVersion,
  confirmPortalFile,
  presignPortalFile,
} from "../services/client-portal-v2/files.service";

const TEAM = "team-1";
const PROJECT = "project-1";
const client = { side: "client" as const, contactId: "alex", name: "Alex" };
const staff = { side: "team" as const, userId: "user-1", name: "Kasun" };

const presign = (filename: string, mime_type: string, uploader: typeof client | typeof staff = client) =>
  presignPortalFile({ teamId: TEAM, projectId: PROJECT, uploader, body: { filename, size: 1000, mime_type } });

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  mockTxQuery.mockReset();
  mockTxQuery.mockResolvedValue({ rows: [], rowCount: 1 });
});

describe("client uploads: active content", () => {
  it.each(["page.html", "page.HTM", "a.xhtml", "logo.svg", "x.hta", "m.mht", "d.xml"])(
    "refuses %s from a client",
    async name => {
      await expect(presign(name, "application/octet-stream")).rejects.toMatchObject({ code: "BLOCKED_FILE_TYPE" });
      expect(mockQuery).not.toHaveBeenCalled();
    }
  );

  it.each(["text/html", "image/svg+xml", "text/html; charset=utf-8", "application/xhtml+xml"])(
    "refuses a file reporting content type %s, whatever its extension",
    async mime => {
      await expect(presign("report.pdf", mime)).rejects.toMatchObject({ code: "BLOCKED_FILE_TYPE" });
    }
  );

  it("still accepts ordinary documents and images", async () => {
    await expect(presign("report.pdf", "application/pdf")).resolves.toMatchObject({ upload_url: "https://storage.test/put" });
    await expect(presign("photo.png", "image/png")).resolves.toMatchObject({ expires_in: 900 });
  });

  it("leaves staff uploads to the main Files rules (SVG is sanitised there)", async () => {
    await expect(presign("logo.svg", "image/svg+xml", staff)).resolves.toMatchObject({ upload_url: "https://storage.test/put" });
  });

  it("still refuses executables from everyone", async () => {
    await expect(presign("setup.exe", "application/octet-stream", staff)).rejects.toMatchObject({ code: "BLOCKED_FILE_TYPE" });
  });
});

describe("client uploads: pending quota", () => {
  it("refuses a new presign when the contact already has too many unfinished uploads", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ n: MAX_PENDING_CLIENT_UPLOADS }] });
    await expect(presign("a.pdf", "application/pdf")).rejects.toMatchObject({ status: 429, code: "TOO_MANY_UPLOADS" });
    expect(mockQuery.mock.calls.some(([sql]) => /INSERT INTO project_files/.test(String(sql)))).toBe(false);
  });

  it("counts only this contact's unexpired pending rows", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ n: 0 }] });
    await presign("a.pdf", "application/pdf");
    const [sql, params] = mockQuery.mock.calls[0];
    expect(String(sql)).toMatch(/uploaded_by_contact_id = \$2 AND status = 'pending'/);
    expect(params.slice(0, 2)).toEqual([TEAM, "alex"]);
  });
});

describe("confirmPortalFile is bound to the uploader", () => {
  const confirm = (uploader: typeof client | typeof staff) =>
    confirmPortalFile({ teamId: TEAM, projectId: PROJECT, fileId: "f1", uploader, actor: { side: "client", name: "x" } as never });

  it("looks up a client's pending row by their own contact id and the client side", async () => {
    await expect(confirm(client)).rejects.toMatchObject({ status: 404 });
    const [sql, params] = mockQuery.mock.calls[0];
    expect(String(sql)).toMatch(/uploaded_by_side = 'client' AND uploaded_by_contact_id = \$4/);
    expect(params).toEqual(["f1", PROJECT, TEAM, "alex"]);
  });

  it("lets staff confirm only staff-side pending rows, so a client row cannot be confirmed as staff", async () => {
    await expect(confirm(staff)).rejects.toMatchObject({ status: 404 });
    const [sql, params] = mockQuery.mock.calls[0];
    expect(String(sql)).toMatch(/uploaded_by_side = 'team'/);
    expect(params).toEqual(["f1", PROJECT, TEAM]);
  });

  it("answers 404 (not 403) when the row belongs to someone else", async () => {
    // The lookup filters on the uploader, so another contact's row is simply not found.
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(confirm({ ...client, contactId: "someone-else" })).rejects.toMatchObject({ status: 404 });
  });
});

describe("confirmFileVersion keeps the current version monotonic", () => {
  const actor = { side: "team", userId: "user-1", name: "Kasun" } as never;

  // Queues up the pending-version lookup plus the two loadFile() queries confirmFileVersion makes afterwards.
  const queueConfirm = (pendingVersionNo: number, resultingCurrentVersion: number) => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "v-pending",
          version_no: pendingVersionNo,
          storage_key: `${TEAM}/${PROJECT}/f1.pdf`,
          created_at: new Date(),
          name: "spec.pdf",
          project_id: PROJECT,
        },
      ],
    });
    mockQuery.mockResolvedValueOnce({ rows: [{ project_id: PROJECT }] });
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "f1",
          project_id: PROJECT,
          name: "spec.pdf",
          category: "Other",
          portal_visibility: "internal",
          uploaded_by_side: "team",
          size: 1024,
          current_version: resultingCurrentVersion,
          uploaded_at: new Date(),
          uploaded_by: "Kasun",
          version_count: 2,
        },
      ],
    });
  };

  const findUpdate = () =>
    mockTxQuery.mock.calls.find(([sql]) => /UPDATE project_files SET current_version/.test(String(sql)));

  it("advances current_version/size when the confirmed version is newer", async () => {
    queueConfirm(3, 3);
    await confirmFileVersion({ teamId: TEAM, fileId: "f1", versionId: "v-pending", actor });

    const updateCall = findUpdate();
    expect(updateCall).toBeDefined();
    const [sql, params] = updateCall!;
    expect(String(sql)).toMatch(/WHERE id = \$1 AND current_version < \$2/);
    expect(params).toEqual(["f1", 3, 1024]);
  });

  it("guards the current-version update so an older pending version confirmed after a newer one cannot roll it back", async () => {
    // Reproduces the reviewer's scenario: current_version is already 3 when the slower v2 upload is confirmed.
    queueConfirm(2, 3);
    await confirmFileVersion({ teamId: TEAM, fileId: "f1", versionId: "v-pending", actor });

    const updateCall = findUpdate();
    expect(updateCall).toBeDefined();
    const [sql, params] = updateCall!;
    // The WHERE guard is what stops Postgres from applying this update once current_version (3) is no
    // longer less than the confirmed version_no (2) — without it the row would be downgraded back to v2.
    expect(String(sql)).toMatch(/WHERE id = \$1 AND current_version < \$2/);
    expect(params).toEqual(["f1", 2, 1024]);

    // The older version is still activated for history/download, independent of the current pointer.
    const historyCall = mockTxQuery.mock.calls.find(([sql]) => /UPDATE project_file_versions SET status = 'active'/.test(String(sql)));
    expect(historyCall).toBeDefined();
  });
});
