import { Request, Response } from "express";

import db from "../../config/db";
import { ServerResponse } from "../../models/server-response";
import { log_error } from "../../shared/utils";
import { IPPMClientSession } from "../middleware/require-client-auth";
import { withClientScope, UUID_RE } from "../utils/ppm-db";
import { uploadBase64, createPresignedUrlWithClient, getKey, getRootDir, deleteObject } from "../../shared/storage";
import { getStorageUrl } from "../../shared/constants";
import { humanFileSize } from "../../shared/utils";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Allowed file extensions for portal uploads
const ALLOWED_EXTENSIONS = new Set([
  // Documents
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "rtf",
  // Images
  "jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff", "tif",
  // Video/Audio
  "mp4", "mov", "avi", "mp3", "wav",
  // Design
  "psd", "ai", "eps", "sketch", "fig",
  // Archives
  "zip", "gz", "rar",
]);

export default class PortalAttachmentsController {
  /**
   * POST /ppm/api/portal/attachments/tasks
   * Upload a file attachment to a task from the portal.
   * Wraps the existing S3 upload logic.
   */
  public static async upload(req: Request, res: Response) {
    try {
      const ppmClient = (req as any).ppmClient as IPPMClientSession;
      const { file, file_name, task_id, size, type } = req.body;

      if (!file || !file_name || !task_id) {
        return res.status(400).json(new ServerResponse(false, null, "File, file name, and task ID are required"));
      }

      if (!UUID_RE.test(task_id)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid task ID"));
      }

      if (size && size > MAX_FILE_SIZE) {
        return res.status(413).json(new ServerResponse(false, null, "File exceeds 50MB limit"));
      }

      // Validate file extension
      const ext = file_name.split(".").pop()?.toLowerCase();
      if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
        return res.status(400).json(new ServerResponse(false, null, `File type .${ext || "unknown"} is not allowed`));
      }

      // Verify the task belongs to this client
      const check = await withClientScope(ppmClient.clientId, async (conn) => {
        const result = await conn.query(
          `SELECT d.id, d.worklenz_task_id, cp.project_id
           FROM ppm_deliverables d
           JOIN ppm_client_projects cp ON cp.client_id = d.client_id AND cp.is_primary = true
           WHERE d.worklenz_task_id = $1 AND d.visibility = 'client_visible'`,
          [task_id]
        );
        return result.rows[0] || null;
      });

      if (!check) {
        return res.status(404).json(new ServerResponse(false, null, "Task not found"));
      }

      // Get team_id from the project
      const projectResult = await db.query(
        `SELECT team_id FROM projects WHERE id = $1`, [check.project_id]
      );
      const teamId = projectResult.rows[0]?.team_id;
      if (!teamId) {
        return res.status(500).json(new ServerResponse(false, null, "Project configuration error"));
      }

      // Insert attachment record
      const insertResult = await db.query(
        `INSERT INTO task_attachments (name, task_id, team_id, project_id, uploaded_by, size, type)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name, size, type, created_at`,
        [file_name, task_id, teamId, check.project_id, null, size || 0, type || 'unknown']
      );

      const attachment = insertResult.rows[0];
      if (!attachment) {
        return res.status(500).json(new ServerResponse(false, null, "Failed to create attachment record"));
      }

      // Upload to S3
      try {
        const s3Key = getKey(teamId, check.project_id, attachment.id, attachment.type);
        const s3Url = await uploadBase64(file, s3Key);

        if (!s3Url) {
          // Rollback DB record on S3 failure
          await db.query(`DELETE FROM task_attachments WHERE id = $1`, [attachment.id]);
          return res.status(500).json(new ServerResponse(false, null, "Upload failed, please retry"));
        }

        attachment.size = humanFileSize(attachment.size);
        return res.status(201).json(new ServerResponse(true, attachment));
      } catch (s3Error) {
        // Rollback DB record on S3 failure
        await db.query(`DELETE FROM task_attachments WHERE id = $1`, [attachment.id]);
        log_error(s3Error);
        return res.status(500).json(new ServerResponse(false, null, "Upload failed, please retry"));
      }
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to upload attachment"));
    }
  }

  /**
   * GET /ppm/api/portal/attachments/tasks/:taskId
   * List attachments for a task.
   */
  public static async list(req: Request, res: Response) {
    try {
      const { taskId } = req.params;
      if (!taskId || !UUID_RE.test(taskId)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid task ID"));
      }

      const ppmClient = (req as any).ppmClient as IPPMClientSession;

      // Verify task belongs to client
      const check = await withClientScope(ppmClient.clientId, async (conn) => {
        const result = await conn.query(
          `SELECT id FROM ppm_deliverables WHERE worklenz_task_id = $1 AND visibility = 'client_visible'`,
          [taskId]
        );
        return result.rows[0] || null;
      });

      if (!check) {
        return res.status(404).json(new ServerResponse(false, null, "Task not found"));
      }

      const result = await db.query(
        `SELECT id, name, size, type, created_at,
                CONCAT($2::TEXT, '/', team_id, '/', project_id, '/', id, '.', type) AS url
         FROM task_attachments
         WHERE task_id = $1
         ORDER BY created_at ASC`,
        [taskId, `${getStorageUrl()}/${getRootDir()}`]
      );

      const rows = result.rows.map(r => ({ ...r, size: humanFileSize(r.size) }));
      return res.status(200).json(new ServerResponse(true, rows));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to fetch attachments"));
    }
  }

  /**
   * GET /ppm/api/portal/attachments/download
   * Generate a presigned download URL for an attachment.
   */
  public static async download(req: Request, res: Response) {
    try {
      const { id } = req.query;
      if (!id || !UUID_RE.test(id as string)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid attachment ID"));
      }

      const ppmClient = (req as any).ppmClient as IPPMClientSession;

      // Get attachment and verify ownership
      const attachResult = await db.query(
        `SELECT a.id, a.name, a.type, a.team_id, a.project_id, a.task_id
         FROM task_attachments a
         WHERE a.id = $1`,
        [id]
      );

      if (!attachResult.rows[0]) {
        return res.status(404).json(new ServerResponse(false, null, "Attachment not found"));
      }

      const attachment = attachResult.rows[0];

      // Verify the task belongs to this client
      const check = await withClientScope(ppmClient.clientId, async (conn) => {
        const result = await conn.query(
          `SELECT id FROM ppm_deliverables WHERE worklenz_task_id = $1 AND visibility = 'client_visible'`,
          [attachment.task_id]
        );
        return result.rows[0] || null;
      });

      if (!check) {
        return res.status(403).json(new ServerResponse(false, null, "Access denied"));
      }

      const key = getKey(attachment.team_id, attachment.project_id, attachment.id, attachment.type);
      const url = await createPresignedUrlWithClient(key, attachment.name);

      return res.status(200).json(new ServerResponse(true, { url }));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to generate download URL"));
    }
  }
}
