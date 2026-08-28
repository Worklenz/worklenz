import { randomUUID } from "crypto";
import path from "path";

import db from "../config/db";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import HandleExceptions from "../decorators/handle-exceptions";
import WorklenzControllerBase from "./worklenz-controller-base";
import {
  createPresignedUploadUrl,
  createPresignedUrlWithClient,
  deleteObject,
  getKey,
  getObjectSize,
  getProjectFileStorageKey,
  objectExists,
  uploadBuffer,
} from "../shared/storage";
import { getStorageUrl } from "../shared/constants";
import { log_error } from "../shared/utils";

const ALLOWED_SORT_FIELDS: Record<string, string> = {
  name: "pf.name",
  size: "pf.size",
  created_at: "pf.created_at",
  uploaded_by: "u.name",
};

const MAX_PAGE_SIZE = 100;

// Blocked extensions — kept in sync with the frontend and the validator middleware
const BLOCKED_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "com", "pif", "scr", "vbs", "js",
  "jar", "app", "deb", "rpm", "dmg", "pkg", "sh", "ps1", "dll", "msi",
]);

// Maximum file size for presigned uploads (250 MB — Business plan ceiling)
const MAX_PRESIGN_FILE_SIZE_BYTES = 250 * 1024 * 1024;

// How long (ms) a pending presign record is considered valid before it can be
// cleaned up. Matches the presigned URL expiry (15 min) plus a small buffer.
const PRESIGN_EXPIRY_MS = 20 * 60 * 1000;

// Sanitize a filename for use as the *display name* (the `name` column shown in
// the UI). The storage key is derived from a random fileId, never the filename,
// so we only need to strip characters that are dangerous for display/paths —
// not flatten every space or parenthesis into underscores. This keeps names
// like "My Report (Final).pdf" readable instead of "My_Report__Final_.pdf".
const sanitizeDisplayName = (fileName: string, extension: string): string => {
  const parsed = path.parse(fileName);
  const baseName = parsed.name || "file";
  // Strip characters that are dangerous for paths, filesystems and — critically
  // — the download Content-Disposition header (the stored name is reflected
  // unquoted into `attachment; filename=...`), while preserving spaces,
  // parentheses and other readable characters. Removed set: path separators
  // (/ \), ASCII control chars (incl. CR/LF), the header-breaking quote/
  // semicolon/comma, and Windows-reserved chars (< > : " | ? *). Then collapse
  // whitespace. The storage key is derived from a random fileId (never the
  // filename), so this name is purely for display and can stay human-readable.
  // eslint-disable-next-line no-control-regex
  const normalizedBase = baseName
    .replace(/[/\\<>:"|?*;,\x00-\x1f\x7f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const safeBase = normalizedBase || "file";
  const maxBaseLength = Math.max(1, 255 - (extension ? extension.length + 1 : 0));
  const trimmedBase = safeBase.slice(0, maxBaseLength);
  return extension ? `${trimmedBase}.${extension}` : trimmedBase;
};

export default class ProjectFilesController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async upload(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const { projectId } = req.params;
    const file = req.file;
    const meta = req.projectFileMeta;

    if (!projectId || !file || !meta) {
      return res
        .status(400)
        .send(new ServerResponse(false, null, "Invalid upload request"));
    }

    const userId = req.user?.id;
    const teamId = req.user?.team_id;

    if (!userId || !teamId) {
      return res
        .status(401)
        .send(new ServerResponse(false, null, "Authentication required"));
    }

    const projectResult = await db.query(
      "SELECT team_id FROM projects WHERE id = $1",
      [projectId],
    );

    if (!projectResult.rowCount) {
      return res
        .status(404)
        .send(new ServerResponse(false, null, "Project not found"));
    }

    if (projectResult.rows[0].team_id !== teamId) {
      return res
        .status(403)
        .send(
          new ServerResponse(
            false,
            null,
            "You cannot upload files to this project",
          ),
        );
    }

    const fileId = randomUUID();
    const storageKey = getProjectFileStorageKey(
      teamId,
      projectId,
      fileId,
      meta.extension,
    );

    const uploadUrl = await uploadBuffer(
      file.buffer,
      file.mimetype || "application/octet-stream",
      storageKey,
    );

    if (!uploadUrl) {
      return res
        .status(500)
        .send(new ServerResponse(false, null, "File upload failed"));
    }

    try {
      const insertResult = await db.query(
        `INSERT INTO project_files (id, name, size, type, project_id, team_id, uploaded_by, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
         RETURNING id, name, size, type, created_at, uploaded_by;`,
        [
          fileId,
          meta.cleanFileName,
          file.size,
          meta.extension,
          projectId,
          teamId,
          userId,
        ],
      );

      const [data] = insertResult.rows;

      const uploader = await db.query("SELECT name FROM users WHERE id = $1", [
        userId,
      ]);
      const uploadedBy = uploader.rows?.[0]?.name || "";

      return res.status(200).send(
        new ServerResponse(true, {
          ...data,
          uploaded_by: uploadedBy,
          url: uploadUrl || `${getStorageUrl()}/${storageKey}`,
        }),
      );
    } catch (error) {
      // Clean up uploaded object if DB insert fails
      log_error(error);
      void deleteObject(storageKey);
      return res
        .status(500)
        .send(new ServerResponse(false, null, "File upload failed"));
    }
  }

  @HandleExceptions()
  public static async list(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const { projectId } = req.params;
    const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
    const size = Math.min(
      Math.max(parseInt((req.query.size as string) || "20", 10), 1),
      MAX_PAGE_SIZE,
    );
    const search = ((req.query.search as string) || "").trim();
    const sortParam = (
      (req.query.sort as string) || "created_at"
    ).toLowerCase();
    const sortField =
      ALLOWED_SORT_FIELDS[sortParam] || ALLOWED_SORT_FIELDS.created_at;
    const sortOrder =
      ((req.query.order as string) || "desc").toLowerCase() === "asc"
        ? "ASC"
        : "DESC";
    const offset = (page - 1) * size;

    // Build parameterized query — $1 is always projectId.
    // If search is provided, $2 is the ILIKE pattern, then LIMIT=$3/OFFSET=$4.
    // Without search, LIMIT=$2/OFFSET=$3.
    const params: Array<string | number> = [projectId];

    let searchClause = "";
    if (search) {
      params.push(`%${search}%`);
      searchClause = `AND pf.name ILIKE $${params.length}`;
    }

    const limitParam = params.length + 1;
    const offsetParam = params.length + 2;

    const dataQuery = `
      SELECT pf.id,
             pf.name,
             pf.size,
             pf.type,
             pf.created_at,
             COALESCE(u.name, '') AS uploaded_by
      FROM project_files pf
      LEFT JOIN users u ON u.id = pf.uploaded_by
      WHERE pf.project_id = $1
        AND pf.status = 'active'
      ${searchClause}
      ORDER BY ${sortField} ${sortOrder}
      LIMIT $${limitParam}
      OFFSET $${offsetParam};
    `;

    const dataResult = await db.query(dataQuery, [...params, size, offset]);
    const files = dataResult.rows.map((item: any) => ({
      ...item,
      size: Number(item.size) || 0,
    }));

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM project_files pf
      WHERE pf.project_id = $1
        AND pf.status = 'active'
      ${searchClause};
    `;

    const countResult = await db.query(countQuery, params);
    const total = countResult.rows?.[0]?.total || 0;

    const statsResult = await db.query(
      `SELECT COUNT(*)::int AS file_count, COALESCE(SUM(size), 0)::bigint AS storage_used
       FROM project_files
       WHERE project_id = $1
         AND status = 'active';`,
      [projectId],
    );

    const storageUsed = Number(statsResult.rows?.[0]?.storage_used || 0);
    const fileCount = Number(statsResult.rows?.[0]?.file_count || 0);

    return res.status(200).send(
      new ServerResponse(true, {
        files,
        total,
        storage_used: storageUsed,
        file_count: fileCount,
      }),
    );
  }

  @HandleExceptions()
  public static async download(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const { projectId, fileId } = req.params;

    const result = await db.query(
      `SELECT id, name, size, type, project_id, team_id
       FROM project_files
       WHERE id = $1
         AND project_id = $2
         AND status = 'active';`,
      [fileId, projectId],
    );

    if (!result.rowCount) {
      return res
        .status(404)
        .send(new ServerResponse(false, null, "File not found"));
    }

    const file = result.rows[0];

    // Try the current key format first (files uploaded via the project files feature)
    // Format: {env}/{teamId}/projects/{projectId}/files/{fileId}.{ext}
    const newKey = getProjectFileStorageKey(
      file.team_id,
      file.project_id,
      file.id,
      file.type,
    );

    // Fall back to the legacy key format (files uploaded before the project files feature)
    // Format: {env}/{teamId}/{projectId}/{fileId}.{ext}
    const legacyKey = getKey(
      file.team_id,
      file.project_id,
      file.id,
      file.type,
    );

    const keyToUse = (await objectExists(newKey)) ? newKey : legacyKey;

    const url = await createPresignedUrlWithClient(keyToUse, file.name);

    return res
      .status(200)
      .send(new ServerResponse(true, { url, expires_in: 3600 }));
  }

  @HandleExceptions()
  public static async delete(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const { projectId, fileId } = req.params;

    const userId = req.user?.id;
    const teamId = req.user?.team_id;

    if (!userId || !teamId) {
      return res
        .status(401)
        .send(new ServerResponse(false, null, "Authentication required"));
    }

    const result = await db.query(
      `DELETE FROM project_files
       WHERE id = $1
         AND project_id = $2
         AND team_id = $3
         AND status = 'active'
       RETURNING id, team_id, project_id, type;`,
      [fileId, projectId, teamId],
    );

    if (!result.rowCount) {
      return res
        .status(404)
        .send(new ServerResponse(false, null, "File not found"));
    }

    const file = result.rows[0];
    const storageKey = getProjectFileStorageKey(
      file.team_id,
      file.project_id,
      file.id,
      file.type,
    );

    void deleteObject(storageKey);

    return res
      .status(200)
      .send(new ServerResponse(true, null));
  }

  @HandleExceptions()
  public static async storage(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const { projectId } = req.params;

    const statsResult = await db.query(
      `SELECT COUNT(*)::int AS file_count, COALESCE(SUM(size), 0)::bigint AS used
       FROM project_files
       WHERE project_id = $1
         AND status = 'active';`,
      [projectId],
    );

    const used = Number(statsResult.rows?.[0]?.used || 0);
    const fileCount = Number(statsResult.rows?.[0]?.file_count || 0);

    return res
      .status(200)
      .send(new ServerResponse(true, { used, file_count: fileCount }));
  }

  /**
   * Step 1 of the async upload flow.
   *
   * Validates the file metadata, creates a pending DB record, and returns a
   * presigned URL the browser can use to PUT the file directly to S3/Azure.
   * No file bytes pass through Node.
   *
   * POST /api/v1/projects/:projectId/files/presign
   * Body: { filename: string; size: number; mime_type: string }
   */
  @HandleExceptions()
  public static async presign(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const { projectId } = req.params;
    const { filename, size, mime_type } = req.body as {
      filename?: string;
      size?: number;
      mime_type?: string;
    };

    // --- Input validation ---
    if (!projectId || !filename || !size || !mime_type) {
      return res
        .status(400)
        .send(new ServerResponse(false, null, "filename, size, and mime_type are required"));
    }

    const extension = path.extname(filename).replace(".", "").toLowerCase();

    if (!extension) {
      return res
        .status(400)
        .send(new ServerResponse(false, null, "A valid file extension is required.").withTitle("Upload failed!"));
    }

    if (BLOCKED_EXTENSIONS.has(extension)) {
      return res
        .status(400)
        .send(new ServerResponse(false, null, `File type .${extension} is not allowed for security.`).withTitle("Upload blocked!"));
    }

    if (size > MAX_PRESIGN_FILE_SIZE_BYTES) {
      return res
        .status(400)
        .send(new ServerResponse(false, null, "Max file size is 250 MB per file.").withTitle("Upload failed!"));
    }

    // --- Auth & project ownership ---
    const userId = req.user?.id;
    const teamId = req.user?.team_id;

    if (!userId || !teamId) {
      return res
        .status(401)
        .send(new ServerResponse(false, null, "Authentication required"));
    }

    const projectResult = await db.query(
      "SELECT team_id FROM projects WHERE id = $1",
      [projectId],
    );

    if (!projectResult.rowCount) {
      return res
        .status(404)
        .send(new ServerResponse(false, null, "Project not found"));
    }

    if (projectResult.rows[0].team_id !== teamId) {
      return res
        .status(403)
        .send(new ServerResponse(false, null, "You cannot upload files to this project"));
    }

    // --- Generate storage key and presigned URL ---
    const fileId = randomUUID();
    const cleanFileName = sanitizeDisplayName(filename, extension);
    const storageKey = getProjectFileStorageKey(teamId, projectId, fileId, extension);

    const uploadUrl = await createPresignedUploadUrl(storageKey);

    if (!uploadUrl) {
      return res
        .status(500)
        .send(new ServerResponse(false, null, "Failed to generate upload URL. Please try again."));
    }

    // --- Insert a pending record so we can confirm it later ---
    // status = 'pending' means the browser hasn't finished uploading yet.
    await db.query(
      `INSERT INTO project_files
         (id, name, size, type, project_id, team_id, uploaded_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending');`,
      [fileId, cleanFileName, size, extension, projectId, teamId, userId],
    );

    return res.status(200).send(
      new ServerResponse(true, {
        file_id: fileId,
        upload_url: uploadUrl,
        expires_in: 900, // seconds
      }),
    );
  }

  /**
   * Step 2 of the async upload flow.
   *
   * Called by the browser after it has finished PUTting the file to storage.
   * Verifies the object actually exists, then marks the DB record as active.
   *
   * POST /api/v1/projects/:projectId/files/confirm
   * Body: { file_id: string }
   */
  @HandleExceptions()
  public static async confirm(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const { projectId } = req.params;
    const { file_id } = req.body as { file_id?: string };

    if (!projectId || !file_id) {
      return res
        .status(400)
        .send(new ServerResponse(false, null, "file_id is required"));
    }

    const userId = req.user?.id;
    const teamId = req.user?.team_id;

    if (!userId || !teamId) {
      return res
        .status(401)
        .send(new ServerResponse(false, null, "Authentication required"));
    }

    // Fetch the pending record — must belong to this project and team
    const pendingResult = await db.query(
      `SELECT id, name, size, type, project_id, team_id, uploaded_by, created_at
       FROM project_files
       WHERE id = $1
         AND project_id = $2
         AND team_id = $3
         AND status = 'pending';`,
      [file_id, projectId, teamId],
    );

    if (!pendingResult.rowCount) {
      return res
        .status(404)
        .send(new ServerResponse(false, null, "Pending upload record not found"));
    }

    const record = pendingResult.rows[0];

    // Guard against stale presign records (e.g. browser never uploaded)
    const ageMs = Date.now() - new Date(record.created_at).getTime();
    if (ageMs > PRESIGN_EXPIRY_MS) {
      // Clean up the stale record
      await db.query("DELETE FROM project_files WHERE id = $1", [file_id]);
      return res
        .status(410)
        .send(new ServerResponse(false, null, "Upload session expired. Please try again."));
    }

    // Verify the object actually landed in storage and read its real size.
    // The browser PUT directly to storage, so the client-reported `size` from
    // presign cannot be trusted — this HeadObject is the only authoritative
    // size check before we make the record visible.
    const storageKey = getProjectFileStorageKey(
      record.team_id,
      record.project_id,
      record.id,
      record.type,
    );

    const actualSize = await getObjectSize(storageKey);

    if (actualSize === null) {
      return res
        .status(422)
        .send(new ServerResponse(false, null, "File not found in storage. The upload may have failed — please try again."));
    }

    // Reject (and clean up) uploads that exceeded the size limit despite a
    // smaller client-reported size at presign time.
    if (actualSize > MAX_PRESIGN_FILE_SIZE_BYTES) {
      void deleteObject(storageKey);
      await db.query("DELETE FROM project_files WHERE id = $1", [file_id]);
      return res
        .status(400)
        .send(new ServerResponse(false, null, "Max file size is 250 MB per file.").withTitle("Upload failed!"));
    }

    // Mark the record as active, persisting the actual storage size (not the
    // client-reported one). The UPDATE re-asserts team/project ownership as
    // defense-in-depth against any SELECT/UPDATE drift, and pulls the uploader
    // name via a sub-select to avoid a second round-trip.
    const confirmResult = await db.query(
      `UPDATE project_files pf
       SET status = 'active', size = $4
       WHERE pf.id = $1
         AND pf.team_id = $2
         AND pf.project_id = $3
         AND pf.status = 'pending'
       RETURNING pf.id, pf.name, pf.size, pf.type, pf.created_at,
                 COALESCE((SELECT name FROM users WHERE id = pf.uploaded_by), '') AS uploaded_by;`,
      [file_id, teamId, projectId, actualSize],
    );

    if (!confirmResult.rowCount) {
      return res
        .status(404)
        .send(new ServerResponse(false, null, "Pending upload record not found"));
    }

    const [data] = confirmResult.rows;

    return res.status(200).send(new ServerResponse(true, data));
  }
}
