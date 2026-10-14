import { randomUUID } from "crypto";
import path from "path";
import db from "../../config/db";
import {
  BLOCKED_EXTENSIONS,
  CLIENT_BLOCKED_EXTENSIONS,
  CLIENT_BLOCKED_MIME_TYPES,
  MAX_PRESIGN_FILE_SIZE_BYTES,
  PRESIGN_EXPIRY_MS,
  sanitizeDisplayName,
} from "../../shared/project-file-rules";
import {
  createPresignedUploadUrl,
  createPresignedUrlWithClient,
  deleteObject,
  getKey,
  getObjectSize,
  getProjectFileStorageKey,
  objectExists,
} from "../../shared/storage";
import { withTransaction } from "../client-contacts-service";
import { AuditActor, recordAuditEvent } from "./audit.service";
import { PortalError, badRequest, notFound } from "./errors";
import { notifyClientUsers, notifyStaff } from "./notify.service";
import { getProjectRef } from "./project-core";
import { PortalVisibility, Queryable, isPortalVisibility } from "./types";

export const FILE_CATEGORIES = [
  "Proposal",
  "Requirements",
  "Agreement",
  "Design",
  "Report",
  "Deliverable",
  "Supporting Document",
  "Other",
] as const;
export type FileCategory = (typeof FILE_CATEGORIES)[number];

export const isFileCategory = (value: unknown): value is FileCategory =>
  typeof value === "string" && (FILE_CATEGORIES as readonly string[]).includes(value);

export interface PortalFileView {
  id: string;
  project_id: string;
  name: string;
  category: FileCategory;
  visibility: PortalVisibility;
  source: "team" | "client";
  uploaded_by: string;
  uploaded_at: string;
  size_label: string;
  current_version: number;
  version_count: number;
}

export interface FileVersionView {
  version: number;
  uploaded_at: string;
  uploaded_by: string;
  approval_ref_no: string | null;
  is_current: boolean;
}

export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

// $1 = project id, $2 = team id. Active files only.
const FILE_SELECT = `
  SELECT pf.id, pf.project_id, pf.name, pf.category, pf.portal_visibility, pf.uploaded_by_side,
         pf.size, pf.current_version,
         COALESCE(lv.created_at, pf.created_at) AS uploaded_at,
         COALESCE(NULLIF(lv.uploaded_by_name, ''), NULLIF(pf.uploaded_by_name, ''), u.name, '') AS uploaded_by,
         1 + COALESCE(vc.n, 0) AS version_count
    FROM project_files pf
    LEFT JOIN users u ON u.id = pf.uploaded_by
    LEFT JOIN LATERAL (
      SELECT v.created_at, v.uploaded_by_name
        FROM project_file_versions v
       WHERE v.file_id = pf.id AND v.status = 'active'
       ORDER BY v.version_no DESC
       LIMIT 1
    ) lv ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS n FROM project_file_versions v WHERE v.file_id = pf.id AND v.status = 'active'
    ) vc ON TRUE
   WHERE pf.project_id = $1 AND pf.team_id = $2 AND pf.status = 'active'
`;

const toView = (row: any): PortalFileView => ({
  id: row.id,
  project_id: row.project_id,
  name: row.name,
  category: row.category,
  visibility: row.portal_visibility,
  source: row.uploaded_by_side,
  uploaded_by: row.uploaded_by,
  uploaded_at: row.uploaded_at,
  size_label: formatBytes(Number(row.size)),
  current_version: row.current_version,
  version_count: Number(row.version_count),
});

export async function listPortalFiles(
  q: Queryable,
  teamId: string,
  projectId: string,
  category?: string
): Promise<PortalFileView[]> {
  await getProjectRef(q, teamId, projectId);
  if (category !== undefined && category !== "" && !isFileCategory(category)) {
    throw badRequest("Invalid category filter");
  }
  const filter = category ? "AND pf.category = $3" : "";
  const result = await q.query(`${FILE_SELECT} ${filter} ORDER BY pf.created_at DESC`, [
    projectId,
    teamId,
    ...(category ? [category] : []),
  ]);
  return result.rows.map(toView);
}

async function loadFile(q: Queryable, teamId: string, fileId: string): Promise<PortalFileView> {
  const owner = await q.query(`SELECT project_id FROM project_files WHERE id = $1 AND team_id = $2`, [fileId, teamId]);
  if (owner.rows.length === 0) throw notFound("File");
  const result = await q.query(`${FILE_SELECT} AND pf.id = $3`, [owner.rows[0].project_id, teamId, fileId]);
  if (result.rows.length === 0) throw notFound("File");
  return toView(result.rows[0]);
}

export const getPortalFile = loadFile;

export interface Uploader {
  side: "team" | "client";
  userId?: string | null;
  contactId?: string | null;
  name: string;
}

export interface PresignInput {
  filename?: string;
  size?: number;
  mime_type?: string;
  category?: string;
  visibility?: string;
}

/** Unfinished (pending) uploads one client user may hold at once; the cleanup cron removes expired ones. */
export const MAX_PENDING_CLIENT_UPLOADS = 20;

function validateUploadRequest(
  body: PresignInput,
  side: Uploader["side"] = "team"
): { extension: string; cleanName: string; size: number } {
  const { filename, size, mime_type } = body;
  if (!filename || !size || !mime_type) {
    throw badRequest("filename, size, and mime_type are required", "MISSING_FIELDS");
  }
  const extension = path.extname(filename).replace(".", "").toLowerCase();
  if (!extension) throw badRequest("A valid file extension is required.", "INVALID_FILE");
  if (BLOCKED_EXTENSIONS.has(extension)) {
    throw badRequest(`File type .${extension} is not allowed for security.`, "BLOCKED_FILE_TYPE");
  }
  if (side === "client") {
    // Client uploads are served to other people, so active content is refused by extension and by the
    // content type the browser reports (which is client-supplied and cannot be trusted on its own).
    const mime = String(mime_type).split(";")[0].trim().toLowerCase();
    if (CLIENT_BLOCKED_EXTENSIONS.has(extension) || CLIENT_BLOCKED_MIME_TYPES.has(mime)) {
      throw badRequest(`File type .${extension} is not allowed for security.`, "BLOCKED_FILE_TYPE");
    }
  }
  if (size > MAX_PRESIGN_FILE_SIZE_BYTES) throw badRequest("Max file size is 250 MB per file.", "FILE_TOO_LARGE");
  return { extension, cleanName: sanitizeDisplayName(filename, extension), size };
}

/**
 * Step 1 of an upload: validates the file, creates a pending record and returns a presigned URL the
 * browser PUTs to directly (no bytes pass through Node). New uploads default to Internal Only and
 * the Deliverable category. A client upload (Client Admin / Member, where the project allows it) is
 * always visible to staff and defaults to Client Visible so the uploader can see their own file.
 */
export async function presignPortalFile(input: {
  teamId: string;
  projectId: string;
  uploader: Uploader;
  body: PresignInput;
}): Promise<{ file_id: string; upload_url: string; expires_in: number }> {
  const { teamId, projectId, uploader, body } = input;
  const { extension, cleanName, size } = validateUploadRequest(body, uploader.side);

  const category = body.category ?? "Deliverable";
  if (!isFileCategory(category)) throw badRequest("Invalid category");
  const visibility = body.visibility ?? (uploader.side === "client" ? "client" : "internal");
  if (!isPortalVisibility(visibility)) throw badRequest("Invalid visibility");

  await getProjectRef(db, teamId, projectId);

  if (uploader.side === "client" && uploader.contactId) {
    // No unbounded pending rows or presigned URLs: expired ones are not counted (the cron removes them).
    const pending = await db.query(
      `SELECT COUNT(*)::int AS n
         FROM project_files
        WHERE team_id = $1 AND uploaded_by_contact_id = $2 AND status = 'pending'
          AND created_at > NOW() - ($3 * INTERVAL '1 millisecond')`,
      [teamId, uploader.contactId, PRESIGN_EXPIRY_MS]
    );
    if ((pending.rows[0]?.n ?? 0) >= MAX_PENDING_CLIENT_UPLOADS) {
      throw new PortalError(429, "Too many uploads in progress. Finish or wait for them, then try again.", "TOO_MANY_UPLOADS");
    }
  }

  const fileId = randomUUID();
  const storageKey = getProjectFileStorageKey(teamId, projectId, fileId, extension);
  const uploadUrl = await createPresignedUploadUrl(storageKey);
  if (!uploadUrl) throw new PortalError(500, "Failed to generate upload URL. Please try again.", "PRESIGN_FAILED");

  await db.query(
    `INSERT INTO project_files
       (id, name, size, type, project_id, team_id, uploaded_by, status,
        category, portal_visibility, uploaded_by_side, uploaded_by_contact_id, uploaded_by_name, first_shared_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, $10, $11, $12, CASE WHEN $9::text = 'client' THEN 1 END)`,
    [
      fileId,
      cleanName,
      size,
      extension,
      projectId,
      teamId,
      uploader.userId ?? null,
      category,
      visibility,
      uploader.side,
      uploader.contactId ?? null,
      uploader.side === "client" ? uploader.name : null,
    ]
  );

  return { file_id: fileId, upload_url: uploadUrl, expires_in: 900 };
}

/**
 * Step 2: the browser has PUT the file. Verifies the object really landed, reads its real size (the
 * client-reported size cannot be trusted), and makes the record visible.
 *
 * Audit and notifications depend on who uploaded and the visibility:
 *   staff, Client Visible   `Entity made Client Visible`, client users notified (File shared event)
 *   staff, Internal Only    nothing
 *   client                  `Client file uploaded`, staff notified (and emailed when switched on)
 */
export async function confirmPortalFile(input: {
  teamId: string;
  projectId: string;
  fileId: string;
  uploader: Uploader;
  actor: AuditActor;
}): Promise<PortalFileView> {
  const { teamId, projectId, fileId, uploader, actor } = input;

  // The pending row must belong to whoever confirms it: a client user can only confirm their own
  // upload, and neither side can confirm the other's. The audit and notification branch below follows the
  // stored side, not the caller's claim.
  const pending = await db.query(
    uploader.side === "client"
      ? `SELECT id, name, type, project_id, team_id, created_at, portal_visibility, uploaded_by_side
           FROM project_files
          WHERE id = $1 AND project_id = $2 AND team_id = $3 AND status = 'pending'
            AND uploaded_by_side = 'client' AND uploaded_by_contact_id = $4`
      : `SELECT id, name, type, project_id, team_id, created_at, portal_visibility, uploaded_by_side
           FROM project_files
          WHERE id = $1 AND project_id = $2 AND team_id = $3 AND status = 'pending'
            AND uploaded_by_side = 'team'`,
    uploader.side === "client" ? [fileId, projectId, teamId, uploader.contactId ?? null] : [fileId, projectId, teamId]
  );
  const record = pending.rows[0];
  if (!record) throw notFound("Pending upload");

  if (Date.now() - new Date(record.created_at).getTime() > PRESIGN_EXPIRY_MS) {
    await db.query(`DELETE FROM project_files WHERE id = $1`, [fileId]);
    throw new PortalError(410, "Upload session expired. Please try again.", "UPLOAD_EXPIRED");
  }

  const storageKey = getProjectFileStorageKey(record.team_id, record.project_id, record.id, record.type);
  const actualSize = await getObjectSize(storageKey);
  if (actualSize === null) {
    throw new PortalError(422, "File not found in storage. The upload may have failed. Please try again.", "UPLOAD_MISSING");
  }
  if (actualSize > MAX_PRESIGN_FILE_SIZE_BYTES) {
    void deleteObject(storageKey);
    await db.query(`DELETE FROM project_files WHERE id = $1`, [fileId]);
    throw badRequest("Max file size is 250 MB per file.", "FILE_TOO_LARGE");
  }

  await withTransaction(async tx => {
    await tx.query(
      `UPDATE project_files SET status = 'active', size = $4
        WHERE id = $1 AND team_id = $2 AND project_id = $3 AND status = 'pending'`,
      [fileId, teamId, projectId, actualSize]
    );

    const project = await getProjectRef(tx, teamId, projectId);
    const base = {
      teamId,
      actor,
      clientId: project.clientId,
      clientName: project.clientName,
      projectId: project.id,
      targetType: "file",
      targetId: fileId,
    };

    if (uploader.side === "client") {
      await recordAuditEvent(tx, { ...base, event: "Client file uploaded", targetLabel: `${record.name} (v1)` });
    } else if (record.portal_visibility === "client") {
      await recordAuditEvent(tx, { ...base, event: "Entity made Client Visible", targetLabel: `File: ${record.name} (v1)` });
    }
  });

  const project = await getProjectRef(db, teamId, projectId);
  if (uploader.side === "client") {
    void notifyStaff({
      teamId,
      kind: "File",
      title: `${uploader.name} uploaded a file`,
      body: `${record.name} in ${project.name}`,
      url: `/worklenz/client-portal/projects/${project.id}/files`,
      projectId: project.id,
      emailEvent: "client_file_upload",
    });
  } else if (record.portal_visibility === "client" && project.clientId) {
    void notifyClientUsers({
      teamId,
      clientId: project.clientId,
      projectId: project.id,
      type: "file",
      title: `New file shared: ${record.name}`,
      message: `A file was shared with you in ${project.name}.`,
      referenceId: fileId,
      emailEvent: "file_shared",
      portalPath: `/projects/${project.id}`,
    });
  }

  return loadFile(db, teamId, fileId);
}

export interface UpdatePortalFileInput {
  category?: string;
  visibility?: string;
}

/**
 * Changes a file's category or visibility. Turning visibility off removes the file from the portal
 * immediately without deleting it or its history; an approval that links it then shows "No longer
 * shared" to the client.
 */
export async function updatePortalFile(input: {
  teamId: string;
  fileId: string;
  actor: AuditActor;
  patch: UpdatePortalFileInput;
}): Promise<PortalFileView> {
  const { teamId, fileId, patch } = input;

  await withTransaction(async tx => {
    const current = await loadFile(tx, teamId, fileId);
    const sets: string[] = [];
    const values: unknown[] = [fileId, teamId];

    if (patch.category !== undefined) {
      if (!isFileCategory(patch.category)) throw badRequest("Invalid category");
      sets.push(`category = $${values.push(patch.category)}`);
    }
    let visibilityChanged: PortalVisibility | null = null;
    if (patch.visibility !== undefined && patch.visibility !== current.visibility) {
      if (!isPortalVisibility(patch.visibility)) throw badRequest("Invalid visibility");
      sets.push(`portal_visibility = $${values.push(patch.visibility)}`);
      // Sharing shares the version that is current now and later ones; earlier drafts stay Internal Only.
      // Returning to Internal Only forgets it, so sharing again starts from the then-current version.
      sets.push(patch.visibility === "client" ? "first_shared_version = current_version" : "first_shared_version = NULL");
      visibilityChanged = patch.visibility;
    }

    if (sets.length > 0) {
      await tx.query(`UPDATE project_files SET ${sets.join(", ")} WHERE id = $1 AND team_id = $2`, values);
    }

    if (visibilityChanged) {
      const project = await getProjectRef(tx, teamId, current.project_id);
      await recordAuditEvent(tx, {
        teamId,
        event: visibilityChanged === "client" ? "Entity made Client Visible" : "Entity returned to Internal Only",
        actor: input.actor,
        clientId: project.clientId,
        clientName: project.clientName,
        projectId: project.id,
        targetType: "file",
        targetId: fileId,
        targetLabel: `File: ${current.name} (v${current.current_version})`,
      });
    }
  });

  return loadFile(db, teamId, fileId);
}

/**
 * Step 1 of "Upload new version". The new file must keep the same extension (it replaces the file,
 * it is not a different file). Earlier versions are kept, and approvals keep pointing at the version
 * that was sent for approval.
 */
export async function presignFileVersion(input: {
  teamId: string;
  fileId: string;
  uploader: Uploader;
  body: PresignInput;
}): Promise<{ version_id: string; version: number; upload_url: string; expires_in: number }> {
  const { teamId, fileId, uploader, body } = input;
  const { extension, size } = validateUploadRequest(body);

  const file = await db.query(
    `SELECT id, project_id, team_id, type FROM project_files WHERE id = $1 AND team_id = $2 AND status = 'active'`,
    [fileId, teamId]
  );
  const row = file.rows[0];
  if (!row) throw notFound("File");
  if (extension !== String(row.type).toLowerCase()) {
    throw badRequest(`A new version must be a .${row.type} file`, "EXTENSION_MISMATCH");
  }

  const versionId = randomUUID();
  const storageKey = getProjectFileStorageKey(teamId, row.project_id, versionId, extension);
  const uploadUrl = await createPresignedUploadUrl(storageKey);
  if (!uploadUrl) throw new PortalError(500, "Failed to generate upload URL. Please try again.", "PRESIGN_FAILED");

  // The next version number. The unique (file_id, version_no) constraint guards against two uploads racing.
  const next = await db.query(
    `SELECT GREATEST(
              pf.current_version,
              COALESCE((SELECT MAX(v.version_no) FROM project_file_versions v WHERE v.file_id = pf.id), 1)
            ) + 1 AS version_no
       FROM project_files pf
      WHERE pf.id = $1`,
    [fileId]
  );
  const versionNo: number = next.rows[0].version_no;

  const inserted = await db.query(
    `INSERT INTO project_file_versions
       (id, file_id, version_no, storage_key, size, type, status, uploaded_by, uploaded_by_contact_id, uploaded_by_name)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9)
     RETURNING version_no`,
    [versionId, fileId, versionNo, storageKey, size, extension, uploader.userId ?? null, uploader.contactId ?? null, uploader.name]
  );

  return { version_id: versionId, version: inserted.rows[0].version_no, upload_url: uploadUrl, expires_in: 900 };
}

/** Step 2 of a new version: verifies the object, makes it the current version, audits it. */
export async function confirmFileVersion(input: {
  teamId: string;
  fileId: string;
  versionId: string;
  actor: AuditActor;
}): Promise<PortalFileView> {
  const { teamId, fileId, versionId } = input;

  const pending = await db.query(
    `SELECT v.id, v.version_no, v.storage_key, v.created_at, pf.name, pf.project_id
       FROM project_file_versions v
       JOIN project_files pf ON pf.id = v.file_id
      WHERE v.id = $1 AND v.file_id = $2 AND pf.team_id = $3 AND v.status = 'pending'`,
    [versionId, fileId, teamId]
  );
  const record = pending.rows[0];
  if (!record) throw notFound("Pending upload");

  if (Date.now() - new Date(record.created_at).getTime() > PRESIGN_EXPIRY_MS) {
    await db.query(`DELETE FROM project_file_versions WHERE id = $1`, [versionId]);
    throw new PortalError(410, "Upload session expired. Please try again.", "UPLOAD_EXPIRED");
  }

  const actualSize = await getObjectSize(record.storage_key);
  if (actualSize === null) {
    throw new PortalError(422, "File not found in storage. The upload may have failed. Please try again.", "UPLOAD_MISSING");
  }
  if (actualSize > MAX_PRESIGN_FILE_SIZE_BYTES) {
    void deleteObject(record.storage_key);
    await db.query(`DELETE FROM project_file_versions WHERE id = $1`, [versionId]);
    throw badRequest("Max file size is 250 MB per file.", "FILE_TOO_LARGE");
  }

  await withTransaction(async tx => {
    await tx.query(`UPDATE project_file_versions SET status = 'active', size = $2 WHERE id = $1`, [versionId, actualSize]);
    await tx.query(`UPDATE project_files SET current_version = $2, size = $3 WHERE id = $1`, [
      fileId,
      record.version_no,
      actualSize,
    ]);

    const project = await getProjectRef(tx, teamId, record.project_id);
    await recordAuditEvent(tx, {
      teamId,
      event: "File version uploaded",
      actor: input.actor,
      clientId: project.clientId,
      clientName: project.clientName,
      projectId: project.id,
      targetType: "file",
      targetId: fileId,
      targetLabel: `${record.name} (v${record.version_no})`,
      metadata: { version: record.version_no },
    });
  });

  return loadFile(db, teamId, fileId);
}

/**
 * Every version with its uploader, date and the approval that covers it. Version 1 is the file's own
 * row; later versions come from project_file_versions.
 */
export async function listFileVersions(q: Queryable, teamId: string, fileId: string): Promise<FileVersionView[]> {
  const file = await q.query(
    `SELECT pf.id, pf.current_version, pf.created_at,
            COALESCE(NULLIF(pf.uploaded_by_name, ''), u.name, '') AS uploaded_by
       FROM project_files pf
       LEFT JOIN users u ON u.id = pf.uploaded_by
      WHERE pf.id = $1 AND pf.team_id = $2 AND pf.status = 'active'`,
    [fileId, teamId]
  );
  const base = file.rows[0];
  if (!base) throw notFound("File");

  const replacements = await q.query(
    `SELECT version_no, created_at, uploaded_by_name
       FROM project_file_versions WHERE file_id = $1 AND status = 'active' ORDER BY version_no`,
    [fileId]
  );
  const approvals = await q.query(
    `SELECT DISTINCT ON (linked_file_version) linked_file_version, ref_no
       FROM client_portal_approvals
      WHERE linked_file_id = $1 AND status <> 'cancelled'
      ORDER BY linked_file_version, created_at DESC`,
    [fileId]
  );
  const refByVersion = new Map<number, string>(
    approvals.rows.map(row => [row.linked_file_version as number, row.ref_no as string])
  );

  const versions: FileVersionView[] = [
    {
      version: 1,
      uploaded_at: base.created_at,
      uploaded_by: base.uploaded_by,
      approval_ref_no: refByVersion.get(1) ?? null,
      is_current: base.current_version === 1,
    },
    ...replacements.rows.map(row => ({
      version: row.version_no as number,
      uploaded_at: row.created_at as string,
      uploaded_by: (row.uploaded_by_name as string) ?? "",
      approval_ref_no: refByVersion.get(row.version_no as number) ?? null,
      is_current: base.current_version === row.version_no,
    })),
  ];
  return versions.sort((a, b) => b.version - a.version);
}

/**
 * Resolves the storage object for a file version. Version 1 uses the key derived from the file id
 * (current format first, then the legacy key for files uploaded before project files existed);
 * a replacement version uses its own stored key.
 */
export async function resolveVersionObject(
  q: Queryable,
  input: { teamId: string; fileId: string; version?: number }
): Promise<{ key: string; name: string; version: number; projectId: string }> {
  const file = await q.query(
    `SELECT id, name, type, project_id, team_id, current_version
       FROM project_files WHERE id = $1 AND team_id = $2 AND status = 'active'`,
    [input.fileId, input.teamId]
  );
  const row = file.rows[0];
  if (!row) throw notFound("File");

  const version = input.version ?? row.current_version;
  if (version === 1) {
    const newKey = getProjectFileStorageKey(row.team_id, row.project_id, row.id, row.type);
    const key = (await objectExists(newKey)) ? newKey : getKey(row.team_id, row.project_id, row.id, row.type);
    return { key, name: row.name, version, projectId: row.project_id };
  }

  const replacement = await q.query(
    `SELECT storage_key FROM project_file_versions WHERE file_id = $1 AND version_no = $2 AND status = 'active'`,
    [input.fileId, version]
  );
  if (replacement.rows.length === 0) throw notFound("File version");
  return { key: replacement.rows[0].storage_key, name: row.name, version, projectId: row.project_id };
}

/** A presigned download URL for staff. Clients get a much shorter-lived one (see the client API). */
export async function getFileDownloadUrl(input: {
  teamId: string;
  fileId: string;
  version?: number;
  expiresInSeconds?: number;
}): Promise<{ url: string; expires_in: number }> {
  const resolved = await resolveVersionObject(db, input);
  const expires = input.expiresInSeconds ?? 3600;
  const url = await createPresignedUrlWithClient(resolved.key, resolved.name, expires);
  if (!url) throw new PortalError(500, "Could not create a download link", "DOWNLOAD_FAILED");
  return { url, expires_in: expires };
}
