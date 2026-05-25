import { randomUUID } from "crypto";

import db from "../config/db";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import HandleExceptions from "../decorators/handle-exceptions";
import WorklenzControllerBase from "./worklenz-controller-base";
import {
  createPresignedUrlWithClient,
  deleteObject,
  getProjectFileStorageKey,
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
        `INSERT INTO project_files (id, name, size, type, project_id, team_id, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
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
      ${searchClause};
    `;

    const countResult = await db.query(countQuery, params);
    const total = countResult.rows?.[0]?.total || 0;

    const statsResult = await db.query(
      `SELECT COUNT(*)::int AS file_count, COALESCE(SUM(size), 0)::bigint AS storage_used
       FROM project_files
       WHERE project_id = $1;`,
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
       WHERE id = $1 AND project_id = $2;`,
      [fileId, projectId],
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

    const url = await createPresignedUrlWithClient(storageKey, file.name);

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

    const result = await db.query(
      `DELETE FROM project_files
       WHERE id = $1 AND project_id = $2
       RETURNING id, team_id, project_id, type;`,
      [fileId, projectId],
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
       WHERE project_id = $1;`,
      [projectId],
    );

    const used = Number(statsResult.rows?.[0]?.used || 0);
    const fileCount = Number(statsResult.rows?.[0]?.file_count || 0);

    return res
      .status(200)
      .send(new ServerResponse(true, { used, file_count: fileCount }));
  }
}
