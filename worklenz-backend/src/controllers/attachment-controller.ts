import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import db from "../config/db";
import { humanFileSize, log_error, smallId } from "../shared/utils";
import { ServerResponse } from "../models/server-response";
import {
  createPresignedUrlWithClient,
  deleteObject,
  getAvatarKey,
  getKey,
  getRootDir,
  uploadBase64,
  uploadBuffer
} from "../shared/s3";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";

const {S3_URL} = process.env;

if (!S3_URL) {
  log_error("Invalid S3_URL. Please check .env file.");
}

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
      `${S3_URL}/${getRootDir()}`
    ]);
    const [data] = result.rows;

    const s3Url = await uploadBase64(file, getKey(req.user?.team_id as string, project_id, data.id, data.type));

    if (!data?.id || !s3Url)
      return res.status(200).send(new ServerResponse(false, null, "Attachment upload failed"));

    data.size = humanFileSize(data.size);

    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async createAvatarAttachment(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { type, buffer } = req.body;

    const s3Url = await uploadBuffer(buffer as Buffer, type, getAvatarKey(req.user?.id as string, type));

    if (!s3Url)
      return res.status(200).send(new ServerResponse(false, null, "Avatar upload failed"));

    const q = "UPDATE users SET avatar_url = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING avatar_url;";
    const result = await db.query(q, [req.user?.id, `${s3Url}?v=${smallId(4)}`]);
    const [data] = result.rows;
    if (!data)
      return res.status(200).send(new ServerResponse(false, null, "Avatar upload failed"));

    return res.status(200).send(new ServerResponse(true, { url: data.avatar_url }, "Avatar updated."));
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
    const result = await db.query(q, [req.params.id, `${S3_URL}/${getRootDir()}`]);

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
    const result = await db.query(q, [req.params.id, `${S3_URL}/${getRootDir()}`, size, offset]);
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
               RETURNING CONCAT($2::TEXT, '/', team_id, '/', project_id, '/', id, '.', type) AS key;`;
    const result = await db.query(q, [req.params.id, getRootDir()]);
    const [data] = result.rows;

    if (data?.key)
      void deleteObject(data.key);

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async download(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT CONCAT($2::TEXT, '/', team_id, '/', project_id, '/', id, '.', type) AS key
               FROM task_attachments
               WHERE id = $1;`;
    const result = await db.query(q, [req.query.id, getRootDir()]);
    const [data] = result.rows;

    if (data?.key) {
      const url = await createPresignedUrlWithClient(data.key, req.query.file as string);
      return res.status(200).send(new ServerResponse(true, url));
    }

    return res.status(200).send(new ServerResponse(true, null));
  }
}
