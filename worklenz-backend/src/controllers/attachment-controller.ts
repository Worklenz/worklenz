import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import db from "../config/db";
import { humanFileSize, smallId } from "../shared/utils";
import { getStorageUrl } from "../shared/constants";
import { ServerResponse } from "../models/server-response";
import {
  createPresignedUrlWithClient,
  createPresignedUploadUrl,
  deleteObject,
  getAvatarKey,
  getKey,
  getRootDir,
  uploadBase64,
  uploadBuffer,
  getObjectSize,
} from "../shared/storage";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import path from "path";
import { randomUUID } from "crypto";

// Blocked extensions — kept in sync with frontend and validator middleware
const BLOCKED_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "com", "pif", "scr", "vbs", "js",
  "jar", "app", "deb", "rpm", "dmg", "pkg", "sh", "ps1", "dll", "msi",
]);

// Maximum file size for presigned uploads (250 MB — Business plan ceiling)
const MAX_PRESIGN_FILE_SIZE_BYTES = 250 * 1024 * 1024;

// How long (ms) a pending presign record is considered valid before cleanup
const PRESIGN_EXPIRY_MS = 20 * 60 * 1000;

const sanitizeFileName = (fileName: string, extension: string): string => {
  const parsed = path.parse(fileName);
  const baseName = parsed.name || "file";
  const normalizedBase = baseName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const maxBaseLength = Math.max(1, 255 - (extension ? extension.length + 1 : 0));
  const trimmedBase = normalizedBase.slice(0, maxBaseLength);
  return extension ? `${trimmedBase}.${extension}` : trimmedBase;
};

export default class AttachmentController extends WorklenzControllerBase {

  @HandleExceptions()
  public static async createTaskAttachment(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { file, file_name, task_id, project_id, size, type } = req.body;

    const q = `
      INSERT INTO task_attachments (name, task_id, team_id, project_id, uploaded_by, size, type)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, name, size, type, created_at, CONCAT($8::TEXT, '/', team_id, '/', project_id, '/', id, '.', type) AS url;
    `;

    const result = await db.query(q, [
      file_name,
      task_id,
      req.user?.team_id,
      project_id,
      req.user?.id,
      size,
      type,
      `${getStorageUrl()}/${getRootDir()}`
    ]);
    const [data] = result.rows;

    const s3Url = await uploadBase64(file, getKey(req.user?.team_id as string, project_id, data.id, data.type));

    if (!data?.id || !s3Url)
      return res.status(200).send(new ServerResponse(false, null, "Attachment upload failed"));

    // Bump task updated_at so "Updated X ago" reflects the new attachment
    await db.query(`UPDATE tasks SET updated_at = NOW() WHERE id = $1;`, [task_id]);

    data.size = humanFileSize(data.size);

    return res.status(200).send(new ServerResponse(true, data));
  }

  /**
   * Step 1 of the async upload flow for task attachments.
   *
   * Validates the file metadata, creates a pending DB record, and returns a
   * presigned URL the browser can use to PUT the file directly to S3/Azure.
   * No file bytes pass through Node.
   *
   * POST /api/v1/attachments/tasks/presign
   * Body: { task_id: string; filename: string; size: number; mime_type: string }
   */
  @HandleExceptions()
  public static async presignTaskAttachment(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const { task_id, project_id, filename, size, mime_type } = req.body as {
      task_id?: string;
      project_id?: string;
      filename?: string;
      size?: number;
      mime_type?: string;
    };

    // --- Input validation ---
    if (!task_id || !project_id || !filename || !size || !mime_type) {
      return res
        .status(400)
        .send(new ServerResponse(false, null, "task_id, project_id, filename, size, and mime_type are required"));
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

    // --- Auth & task/project ownership ---
    const userId = req.user?.id;
    const teamId = req.user?.team_id;

    if (!userId || !teamId) {
      return res
        .status(401)
        .send(new ServerResponse(false, null, "Authentication required"));
    }

    // Verify task exists and belongs to the user's team
    const taskResult = await db.query(
      `SELECT t.id, t.project_id, p.team_id
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       WHERE t.id = $1 AND p.team_id = $2`,
      [task_id, teamId],
    );

    if (!taskResult.rowCount) {
      return res
        .status(403)
        .send(new ServerResponse(false, null, "You cannot attach files to this task"));
    }

    // Use the project_id resolved from the database, not the client-supplied
    // value — trusting req.body.project_id here would let a caller pass a
    // path-traversal payload (e.g. "../otherTeamId/x") into the storage key.
    const verifiedProjectId = taskResult.rows[0].project_id;

    // --- Generate storage key and presigned URL ---
    const fileId = randomUUID();
    const cleanFileName = sanitizeFileName(filename, extension);
    const storageKey = getKey(teamId, verifiedProjectId, fileId, extension);

    const uploadUrl = await createPresignedUploadUrl(storageKey);

    if (!uploadUrl) {
      return res
        .status(500)
        .send(new ServerResponse(false, null, "Failed to generate upload URL. Please try again."));
    }

    // --- Insert a pending record ---
    await db.query(
      `INSERT INTO task_attachments (id, name, size, type, task_id, project_id, team_id, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
      [fileId, cleanFileName, size, extension, task_id, verifiedProjectId, teamId, userId],
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
   * Step 2 of the async upload flow for task attachments.
   *
   * Called by the browser after it has finished PUTting the file to storage.
   * Verifies the object actually exists in storage.
   *
   * POST /api/v1/attachments/tasks/confirm
   * Body: { file_id: string; task_id: string }
   */
  @HandleExceptions()
  public static async confirmTaskAttachment(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const { file_id, task_id } = req.body as {
      file_id?: string;
      task_id?: string;
    };

    if (!file_id || !task_id) {
      return res
        .status(400)
        .send(new ServerResponse(false, null, "file_id and task_id are required"));
    }

    const userId = req.user?.id;
    const teamId = req.user?.team_id;

    if (!userId || !teamId) {
      return res
        .status(401)
        .send(new ServerResponse(false, null, "Authentication required"));
    }

    // Get attachment details
    const attachmentResult = await db.query(
      `SELECT id, name, size, type, task_id, project_id, team_id
       FROM task_attachments
       WHERE id = $1 AND team_id = $2`,
      [file_id, teamId],
    );

    if (!attachmentResult.rowCount) {
      return res
        .status(404)
        .send(new ServerResponse(false, null, "Attachment not found"));
    }

    const attachment = attachmentResult.rows[0];

    // Verify the object actually exists in storage and read its real size —
    // the size on the attachment record at this point is still the
    // client-declared value from presign, which cannot be trusted since the
    // browser PUTs directly to storage and could have sent more (or less)
    // data than it claimed.
    const storageKey = getKey(attachment.team_id, attachment.project_id, attachment.id, attachment.type);
    const actualSize = await getObjectSize(storageKey);

    if (actualSize === null) {
      // Clean up the pending record if file doesn't exist in storage
      await db.query("DELETE FROM task_attachments WHERE id = $1", [file_id]);
      return res
        .status(400)
        .send(new ServerResponse(false, null, "Upload verification failed. File not found in storage."));
    }

    if (actualSize > MAX_PRESIGN_FILE_SIZE_BYTES) {
      // Uploaded object exceeds the size ceiling regardless of what was
      // declared at presign time — remove it from storage and reject.
      await deleteObject(storageKey);
      await db.query("DELETE FROM task_attachments WHERE id = $1", [file_id]);
      return res
        .status(400)
        .send(new ServerResponse(false, null, "Max file size is 250 MB per file.").withTitle("Upload failed!"));
    }

    // Persist the real, storage-verified size rather than the client-declared one.
    await db.query("UPDATE task_attachments SET size = $1 WHERE id = $2", [actualSize, file_id]);

    // Bump task updated_at
    await db.query(`UPDATE tasks SET updated_at = NOW() WHERE id = $1;`, [task_id]);

    // Return attachment details
    const url = `${getStorageUrl()}/${getRootDir()}/${attachment.team_id}/${attachment.project_id}/${attachment.id}.${attachment.type}`;

    return res.status(200).send(
      new ServerResponse(true, {
        id: attachment.id,
        name: attachment.name,
        size: humanFileSize(actualSize),
        type: attachment.type,
        url,
        created_at: new Date().toISOString(),
      }),
    );
  }

  @HandleExceptions()
  public static async createAvatarAttachment(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { type, buffer } = req.body;

    const s3Url = await uploadBuffer(buffer as Buffer, type, getAvatarKey(req.user?.id as string, type));

    if (!s3Url)
      return res.status(200).send(new ServerResponse(false, null, "Avatar upload failed"));

    const q = "UPDATE users SET avatar_url = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING avatar_url, updated_at;";
    const result = await db.query(q, [req.user?.id, `${s3Url}?v=${smallId(4)}`]);
    const [data] = result.rows;
    if (!data)
      return res.status(200).send(new ServerResponse(false, null, "Avatar upload failed"));

    return res.status(200).send(new ServerResponse(true, { url: data.avatar_url, updated_at: data.updated_at }, "Avatar updated."));
  }

  @HandleExceptions()
  public static async deleteAvatarAttachment(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const currentAvatarQuery = "SELECT avatar_url FROM users WHERE id = $1;";
    const currentAvatarResult = await db.query(currentAvatarQuery, [req.user?.id]);
    const currentAvatarUrl = currentAvatarResult.rows[0]?.avatar_url as string | null;

    const q =
      "UPDATE users SET avatar_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING updated_at;";
    const result = await db.query(q, [req.user?.id]);
    const [data] = result.rows;

    if (!data)
      return res.status(200).send(new ServerResponse(false, null, "Avatar removal failed."));

    if (currentAvatarUrl) {
      const sanitizedUrl = currentAvatarUrl.split("?")[0];
      const fileExtension = path.extname(sanitizedUrl).replace(".", "");

      if (fileExtension) {
        const key = getAvatarKey(req.user?.id as string, fileExtension);
        void deleteObject(key);
      }
    }

    return res
      .status(200)
      .send(new ServerResponse(true, { url: null, updated_at: data.updated_at }, "Avatar removed."));
  }

  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT id,
             name,
             size,
             CONCAT($2::TEXT, '/', team_id, '/', project_id, '/', id, '.', type) AS url,
             type,
             created_at
      FROM task_attachments
      WHERE task_id = $1;
    `;
    const result = await db.query(q, [req.params.id, `${getStorageUrl()}/${getRootDir()}`]);

    for (const item of result.rows)
      item.size = humanFileSize(item.size);

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getByProjectId(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { size, offset } = this.toPaginationOptions(req.query, "name");

    const q = `
              SELECT ROW_TO_JSON(rec) AS attachments
              FROM (SELECT COUNT(*)                          AS total,
                          (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
                            FROM (SELECT task_attachments.id,
                                        task_attachments.name,
                                        CONCAT((SELECT key FROM projects WHERE id = task_attachments.project_id), '-',
                                                (SELECT task_no FROM tasks WHERE id = task_attachments.task_id)) AS task_key,
                                        size,
                                        CONCAT($2::TEXT, '/', task_attachments.team_id, '/', task_attachments.project_id, '/',task_attachments.id,'.',type)                                                            AS url,
                                        task_attachments.type,
                                        task_attachments.created_at,
                                        t.name                                                                  AS task_name,
                                        (SELECT name FROM users WHERE id = task_attachments.uploaded_by)        AS uploader_name
                                  FROM task_attachments
                                          LEFT JOIN tasks t ON task_attachments.task_id = t.id
                                  WHERE task_attachments.project_id = $1
                                  ORDER BY created_at DESC
                          LIMIT $3 OFFSET $4)t) AS data
                    FROM task_attachments
                            LEFT JOIN tasks t ON task_attachments.task_id = t.id
                    WHERE task_attachments.project_id = $1) rec;
    `;
    const result = await db.query(q, [req.params.id, `${getStorageUrl()}/${getRootDir()}`, size, offset]);
    const [data] = result.rows;

    for (const item of data?.attachments.data || [])
      item.size = humanFileSize(item.size);

    return res.status(200).send(new ServerResponse(true, data?.attachments || this.paginatedDatasetDefaultStruct));
  }

  @HandleExceptions()
  public static async deleteById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `DELETE
               FROM task_attachments
               WHERE id = $1
               RETURNING team_id, project_id, id, type, task_id;`;
    const result = await db.query(q, [req.params.id]);
    const [data] = result.rows;

    if (data) {
      const key = getKey(data.team_id, data.project_id, data.id, data.type);
      void deleteObject(key);
      // Bump task updated_at so "Updated X ago" reflects the removed attachment
      if (data.task_id) await db.query(`UPDATE tasks SET updated_at = NOW() WHERE id = $1;`, [data.task_id]);
    }

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async download(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT team_id, project_id, id, type
               FROM task_attachments
               WHERE id = $1;`;
    const result = await db.query(q, [req.query.id]);
    const [data] = result.rows;

    if (data) {
      const key = getKey(data.team_id, data.project_id, data.id, data.type);
      const url = await createPresignedUrlWithClient(key, req.query.file as string);
      return res.status(200).send(new ServerResponse(true, { url, expires_in: 3600 }));
    }

    return res.status(200).send(new ServerResponse(true, null));
  }
}
